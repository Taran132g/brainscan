"""
Stripe integration — checkout sessions + webhook event handling.

Pricing tiers (locked decision):
  brain_card        $0.99 one-time         price_BRAIN_CARD
  full_membership   $3.99 / month          price_FULL_MEMBERSHIP
  extra_upload      $0.99 one-time         price_EXTRA_UPLOAD
  upgrade           $3.00 one-time         price_UPGRADE
                    (brain_card → full)
"""

import json
import os
from typing import Literal, Optional
import stripe
from services.db import get_client
from services.paywall import grant_credit

ProductKey = Literal["brain_card", "full_membership", "extra_upload", "upgrade"]


def _init_stripe():
    """Lazy-init the Stripe SDK with the secret key from env."""
    key = os.getenv("STRIPE_SECRET_KEY")
    if not key:
        raise RuntimeError("STRIPE_SECRET_KEY not set in backend/.env")
    stripe.api_key = key


def _price_id_for(product: ProductKey) -> str:
    """Resolve our internal product key to the Stripe price ID from env."""
    env_var = {
        "brain_card": "STRIPE_PRICE_BRAIN_CARD",
        "full_membership": "STRIPE_PRICE_FULL_MEMBERSHIP",
        "extra_upload": "STRIPE_PRICE_EXTRA_UPLOAD",
        "upgrade": "STRIPE_PRICE_UPGRADE",
        "pro": "STRIPE_PRICE_PRO",
    }[product]
    price_id = os.getenv(env_var)
    if not price_id:
        raise RuntimeError(f"{env_var} not set in backend/.env")
    return price_id


def _frontend_url() -> str:
    return os.getenv("FRONTEND_URL", "http://localhost:3000")


def get_or_create_customer(user_id: str, email: str) -> str:
    """
    Get the Stripe customer ID for this user, creating one if needed.
    Persists the ID to profiles.stripe_customer_id so we only ever create one.
    """
    _init_stripe()
    supabase = get_client()

    # Already have a customer id?
    res = supabase.table("profiles").select("stripe_customer_id").eq("id", user_id).limit(1).execute()
    existing = (res.data or [{}])[0].get("stripe_customer_id")
    if existing:
        return existing

    customer = stripe.Customer.create(
        email=email,
        metadata={"supabase_user_id": user_id},
    )
    supabase.table("profiles").update({"stripe_customer_id": customer.id}).eq("id", user_id).execute()
    return customer.id


def create_checkout_session(
    user_id: str,
    email: str,
    product: ProductKey,
) -> str:
    """
    Create a Stripe Checkout session and return its URL.
    The frontend redirects the user to that URL to complete payment.
    """
    _init_stripe()
    customer_id = get_or_create_customer(user_id, email)
    price_id = _price_id_for(product)

    # Subscriptions vs one-time payments need different modes
    mode = "subscription" if product in ("full_membership", "pro") else "payment"

    session = stripe.checkout.Session.create(
        customer=customer_id,
        line_items=[{"price": price_id, "quantity": 1}],
        mode=mode,
        success_url=f"{_frontend_url()}/app?upgraded=1",
        cancel_url=f"{_frontend_url()}/app?checkout=cancelled",
        metadata={
            "supabase_user_id": user_id,
            "product": product,
        },
        # Pass through to webhooks regardless of mode
        client_reference_id=user_id,
    )
    return session.url or ""


def create_billing_portal_session(user_id: str) -> Optional[str]:
    """
    Return URL for the Stripe billing portal (manage subscription, update card,
    cancel, etc.). Returns None if the user doesn't have a Stripe customer ID yet.
    """
    _init_stripe()
    supabase = get_client()
    res = supabase.table("profiles").select("stripe_customer_id").eq("id", user_id).limit(1).execute()
    customer_id = (res.data or [{}])[0].get("stripe_customer_id")
    if not customer_id:
        return None

    portal = stripe.billing_portal.Session.create(
        customer=customer_id,
        return_url=f"{_frontend_url()}/dashboard/settings",
    )
    return portal.url


# ---------------------------------------------------------------
# Webhook event handlers
# ---------------------------------------------------------------

def handle_webhook_event(payload: bytes, signature: str) -> dict:
    """
    Verify and dispatch a Stripe webhook event.
    Raises stripe.error.SignatureVerificationError on bad signature.
    Returns {handled: bool, type: str, action?: str}.

    Stripe SDK v15+ returns StripeObject instances from construct_event() — the
    handlers below expect plain dicts (so .get() works on optional fields).
    We re-parse the verified payload to plain dicts after signature checking.
    """
    _init_stripe()
    webhook_secret = os.getenv("STRIPE_WEBHOOK_SECRET")
    if not webhook_secret:
        raise RuntimeError("STRIPE_WEBHOOK_SECRET not set in backend/.env")

    # construct_event verifies the signature (we rely on this for security)
    event_obj = stripe.Webhook.construct_event(payload, signature, webhook_secret)
    event_type = event_obj["type"]

    # Re-parse the same payload to get plain dicts for downstream code.
    # Safe because the signature was just verified against the same bytes.
    event_dict = json.loads(payload.decode("utf-8"))
    data_object = event_dict["data"]["object"]

    if event_type == "checkout.session.completed":
        return _on_checkout_completed(data_object)
    if event_type in ("customer.subscription.updated", "customer.subscription.created"):
        return _on_subscription_change(data_object)
    if event_type == "customer.subscription.deleted":
        return _on_subscription_deleted(data_object)

    return {"handled": False, "type": event_type}


def _on_checkout_completed(session: dict) -> dict:
    """
    Fired when a one-time payment or subscription checkout completes.
    For one-time products we set subscription_tier directly.
    For subscriptions we wait for customer.subscription.updated.
    """
    user_id = session.get("client_reference_id") or (session.get("metadata") or {}).get("supabase_user_id")
    product = (session.get("metadata") or {}).get("product")
    if not user_id:
        return {"handled": False, "type": "checkout.session.completed", "reason": "no user_id"}

    update: dict = {}
    session_id = session.get("id")
    if product == "brain_card":
        update = {"subscription_tier": "brain_card", "subscription_status": "active"}
        # First brain card → grant one upload credit
        grant_credit(user_id, source="brain_card", stripe_session_id=session_id)
    elif product == "extra_upload":
        # Grant one extra upload credit; tier doesn't change
        grant_credit(user_id, source="extra_upload", stripe_session_id=session_id)
    elif product == "upgrade":
        update = {"subscription_tier": "full", "subscription_status": "active"}
    # full_membership flows through subscription.updated, not here

    if update:
        get_client().table("profiles").update(update).eq("id", user_id).execute()
    return {"handled": True, "type": "checkout.session.completed", "action": product}


def _on_subscription_change(subscription: dict) -> dict:
    """
    Fired when a subscription is created/updated.
    Map status → subscription_tier + subscription_status in profiles.
    """
    customer_id = subscription.get("customer")
    status = subscription.get("status")  # active, trialing, past_due, canceled, ...
    subscription_id = subscription.get("id")

    if not customer_id:
        return {"handled": False, "type": "customer.subscription.updated", "reason": "no customer"}

    # Look up the user by customer_id
    supabase = get_client()
    res = supabase.table("profiles").select("id").eq("stripe_customer_id", customer_id).limit(1).execute()
    user_row = (res.data or [{}])[0]
    user_id = user_row.get("id")
    if not user_id:
        return {"handled": False, "type": "customer.subscription.updated", "reason": "no user mapped to customer"}

    tier = "full" if status in ("active", "trialing") else "free"
    supabase.table("profiles").update({
        "subscription_tier": tier,
        "subscription_status": status,
        "stripe_subscription_id": subscription_id,
    }).eq("id", user_id).execute()
    return {"handled": True, "type": "customer.subscription.updated", "action": f"tier={tier} status={status}"}


def _on_subscription_deleted(subscription: dict) -> dict:
    """Subscription fully canceled — downgrade to free."""
    customer_id = subscription.get("customer")
    if not customer_id:
        return {"handled": False, "type": "customer.subscription.deleted"}

    supabase = get_client()
    res = supabase.table("profiles").select("id").eq("stripe_customer_id", customer_id).limit(1).execute()
    user_id = (res.data or [{}])[0].get("id")
    if not user_id:
        return {"handled": False, "type": "customer.subscription.deleted"}

    supabase.table("profiles").update({
        "subscription_tier": "free",
        "subscription_status": "canceled",
    }).eq("id", user_id).execute()
    return {"handled": True, "type": "customer.subscription.deleted", "action": "downgrade to free"}
