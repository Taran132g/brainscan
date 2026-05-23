"""
Paywall logic for vault uploads.

Pricing rules (from locked business decisions):
  free          — never paid: one $0.99 brain card unlocks the product
  brain_card    — bought $0.99 one-time. Each subsequent upload costs $0.99.
  full          — $3.99/month. Two free uploads per month, $0.99 each extra.

`check_upload_allowed` is called BEFORE the heavy work (parsing, embedding,
Claude) so we never waste tokens on a user without permission.

If the user is missing a credit/quota, we raise an HTTPException with
{code: "payment_required", required_product: ...} so the frontend can route
to the right Stripe checkout flow.
"""

from datetime import datetime, timedelta, timezone
from fastapi import HTTPException, status
from services.db import get_client


CYCLE_DAYS = 30
FULL_TIER_FREE_UPLOADS_PER_CYCLE = 2


def _profile(user_id: str) -> dict:
    res = (
        get_client()
        .table("profiles")
        .select(
            "subscription_tier, subscription_status, uploads_in_cycle, cycle_started_at"
        )
        .eq("id", user_id)
        .limit(1)
        .execute()
    )
    return (res.data or [{}])[0]


def _consume_credit(user_id: str) -> bool:
    """If the user has an unconsumed upload credit, mark it consumed. Returns True if a credit was used."""
    supabase = get_client()
    res = (
        supabase.table("upload_credits")
        .select("id")
        .eq("user_id", user_id)
        .is_("consumed_at", "null")
        .order("granted_at")
        .limit(1)
        .execute()
    )
    rows = res.data or []
    if not rows:
        return False
    supabase.table("upload_credits").update(
        {"consumed_at": datetime.now(timezone.utc).isoformat()}
    ).eq("id", rows[0]["id"]).execute()
    return True


def _ensure_current_cycle(user_id: str, profile: dict) -> dict:
    """Reset uploads_in_cycle if the cycle has expired. Returns updated profile dict."""
    cycle_started = profile.get("cycle_started_at")
    if not cycle_started:
        return profile
    # Parse the ISO timestamp returned by Postgrest
    try:
        started = datetime.fromisoformat(cycle_started.replace("Z", "+00:00"))
    except Exception:
        return profile
    if started + timedelta(days=CYCLE_DAYS) < datetime.now(timezone.utc):
        get_client().table("profiles").update(
            {"uploads_in_cycle": 0, "cycle_started_at": datetime.now(timezone.utc).isoformat()}
        ).eq("id", user_id).execute()
        profile["uploads_in_cycle"] = 0
    return profile


def check_upload_allowed(user_id: str) -> dict:
    """
    Decide whether this user can run a vault upload right now.

    Returns a dict describing how the upload is being paid for:
      {"allowed": True, "method": "credit" | "monthly_quota" | "first_free"}

    Raises HTTPException(402, {code: "payment_required", required_product: ...})
    if not allowed.
    """
    profile = _profile(user_id)
    tier = profile.get("subscription_tier", "free")
    status_str = profile.get("subscription_status", "inactive")

    # Always burn a credit first if one exists (extra_upload purchases, etc.)
    # Credits aren't tied to tier — they're discrete pre-paid uploads.
    if _consume_credit(user_id):
        return {"allowed": True, "method": "credit"}

    if tier == "free":
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail={
                "code": "payment_required",
                "message": "Buy the brain card ($0.99) to upload your first vault.",
                "required_product": "brain_card",
            },
        )

    if tier == "brain_card":
        # Got the one-time brain card, but no credits left → needs an extra upload
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail={
                "code": "payment_required",
                "message": "Brain card members pay $0.99 per additional upload — or upgrade to Full Membership for matching + monthly quota.",
                "required_product": "extra_upload",
                "alt_product": "upgrade",
            },
        )

    if tier == "full" and status_str in ("active", "trialing"):
        profile = _ensure_current_cycle(user_id, profile)
        used = int(profile.get("uploads_in_cycle") or 0)
        if used < FULL_TIER_FREE_UPLOADS_PER_CYCLE:
            # Consume one of this month's free uploads
            get_client().table("profiles").update(
                {"uploads_in_cycle": used + 1}
            ).eq("id", user_id).execute()
            return {
                "allowed": True,
                "method": "monthly_quota",
                "uploads_used_this_cycle": used + 1,
                "uploads_per_cycle": FULL_TIER_FREE_UPLOADS_PER_CYCLE,
            }
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail={
                "code": "payment_required",
                "message": f"You've used both free uploads in this cycle. Buy an extra upload for $0.99.",
                "required_product": "extra_upload",
            },
        )

    raise HTTPException(
        status_code=status.HTTP_402_PAYMENT_REQUIRED,
        detail={
            "code": "payment_required",
            "message": "Subscription is not active. Buy the brain card or full membership to upload.",
            "required_product": "brain_card",
            "alt_product": "full_membership",
        },
    )


def grant_credit(user_id: str, source: str, stripe_session_id: str | None = None) -> None:
    """Grant a single upload credit (called by Stripe webhook handlers)."""
    get_client().table("upload_credits").insert(
        {"user_id": user_id, "source": source, "stripe_session_id": stripe_session_id}
    ).execute()
