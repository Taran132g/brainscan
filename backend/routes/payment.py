from fastapi import APIRouter, Depends, HTTPException, Request, Header
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Literal, Optional
import stripe as stripe_sdk

from services.auth import get_current_user_id
from services.stripe_service import (
    create_checkout_session,
    create_billing_portal_session,
    handle_webhook_event,
)
from services.db import get_client

router = APIRouter()

ProductKey = Literal["brain_card", "full_membership", "extra_upload", "upgrade"]


class CheckoutRequest(BaseModel):
    product: ProductKey


@router.post("/payment/create-checkout")
async def create_checkout(
    request: CheckoutRequest,
    user_id: str = Depends(get_current_user_id),
):
    """Create a Stripe Checkout session and return its URL for redirect."""
    # Look up email from profiles
    res = get_client().table("profiles").select("email").eq("id", user_id).limit(1).execute()
    email = (res.data or [{}])[0].get("email")
    if not email:
        raise HTTPException(status_code=400, detail="Profile email missing — please sign in again.")

    try:
        url = create_checkout_session(user_id=user_id, email=email, product=request.product)
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))
    except stripe_sdk.error.StripeError as e:
        raise HTTPException(status_code=502, detail=f"Stripe error: {e.user_message or str(e)}")

    return JSONResponse({"url": url})


@router.post("/payment/billing-portal")
async def billing_portal(user_id: str = Depends(get_current_user_id)):
    """Return URL for the Stripe billing portal (manage card, cancel sub, etc.)."""
    try:
        url = create_billing_portal_session(user_id)
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))
    if not url:
        raise HTTPException(status_code=400, detail="No active Stripe customer yet — make a purchase first.")
    return JSONResponse({"url": url})


@router.get("/payment/status/{user_id}")
async def subscription_status(
    user_id: str,
    current_user_id: str = Depends(get_current_user_id),
):
    """Return the user's subscription state from profiles."""
    if user_id != current_user_id:
        raise HTTPException(status_code=403, detail="You can only check your own subscription.")
    res = (
        get_client()
        .table("profiles")
        .select("subscription_tier, subscription_status, stripe_customer_id")
        .eq("id", user_id)
        .limit(1)
        .execute()
    )
    row = (res.data or [{}])[0]
    return {
        "subscription_tier": row.get("subscription_tier", "free"),
        "subscription_status": row.get("subscription_status", "inactive"),
        "has_stripe_customer": bool(row.get("stripe_customer_id")),
    }


@router.post("/payment/webhook")
async def webhook(
    request: Request,
    stripe_signature: Optional[str] = Header(default=None, alias="Stripe-Signature"),
):
    """
    Stripe webhook endpoint. Must accept raw body for signature verification.
    Configure in Stripe Dashboard → Webhooks → Add endpoint:
      URL:    <FRONTEND_URL backend equivalent>/api/payment/webhook
      Events: checkout.session.completed,
              customer.subscription.created,
              customer.subscription.updated,
              customer.subscription.deleted
    """
    payload = await request.body()
    if not stripe_signature:
        raise HTTPException(status_code=400, detail="Missing Stripe-Signature header.")
    try:
        result = handle_webhook_event(payload, stripe_signature)
    except stripe_sdk.error.SignatureVerificationError:
        raise HTTPException(status_code=400, detail="Invalid Stripe signature.")
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))
    return JSONResponse(result)
