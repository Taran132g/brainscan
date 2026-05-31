from fastapi import APIRouter, HTTPException, Depends, Body
from services.embedder import embed_query
from services.vector_store import query_namespace
from services.brain_card import generate_brain_card
from services.auth import verify_user_owns_path, get_current_user_id
from services.db import get_client, update_profile_fields
from services.match_service import update_match_location_metadata, _coords_for
from services.paywall import FULL_TIER_FREE_UPLOADS_PER_CYCLE

router = APIRouter()


@router.put("/profile/me")
async def update_my_profile(
    fields: dict = Body(...),
    user_id: str = Depends(get_current_user_id),
):
    """
    Persist user-editable profile fields to the `profiles` table and refresh the
    user's match-vector location metadata. This is what makes the city typed into
    the profile form actually drive the "nearest" match sort — previously the form
    only wrote to auth user_metadata, which the matching layer never reads.
    """
    written = update_profile_fields(user_id, fields)
    update_match_location_metadata(user_id, {
        "city": written.get("city"),
        "full_name": written.get("full_name"),
        "school": written.get("school"),
    })
    coords = _coords_for(written.get("city") or "")
    return {
        "ok": True,
        "city": written.get("city"),
        "geocoded": coords is not None,
    }


@router.get("/discover/founders")
async def list_public_founders(limit: int = 200):
    """
    Public list of profiles that have a cached brain card. Powers the
    discovery globe. Returns the minimal fields needed to render a dot +
    open the profile.
    """
    supabase = get_client()
    res = (
        supabase.table("profiles")
        .select("id, full_name, city, brain_confidence, founder_signal, school, age, linkedin")
        .not_.is_("brain_card", "null")
        .limit(min(max(limit, 1), 500))
        .execute()
    )
    rows = res.data or []
    return {
        "count": len(rows),
        "founders": [
            {
                "id": r.get("id"),
                "name": r.get("full_name") or "Founder",
                "city": r.get("city") or "",
                "brain_confidence": r.get("brain_confidence"),
                "founder_signal": r.get("founder_signal") or {},
                "school": r.get("school"),
                "age": r.get("age"),
                "linkedin": r.get("linkedin"),
            }
            for r in rows
        ],
    }


@router.get("/profile/{user_id}/public-card")
async def get_public_brain_card(user_id: str):
    """
    Public read of the cached brain card snapshot in `profiles`. Powers the
    unauthenticated profile page (public-by-default share model). Returns the
    same shape the client expects from /brain-card so the page can swap in.
    """
    supabase = get_client()
    res = (
        supabase.table("profiles")
        .select(
            "id, full_name, brain_card, founder_signal, brain_confidence, "
            "github, linkedin, school, age, avatar_url, "
            "founder_score, founder_rank, founder_tier, "
            "github_quality, linkedin_quality, big_tech_employer"
        )
        .eq("id", user_id)
        .limit(1)
        .execute()
    )
    row = (res.data or [None])[0]
    if not row or not row.get("brain_card"):
        raise HTTPException(status_code=404, detail="No public brain card for this user")

    return {
        "user_id": user_id,
        "full_name": row.get("full_name") or "Founder",
        "avatar_url": row.get("avatar_url"),
        "brain_card": {
            "sections": row.get("brain_card"),
            "founder_signal": row.get("founder_signal") or {},
        },
        "brain_confidence": row.get("brain_confidence"),
        "profile": {
            "full_name": row.get("full_name"),
            "avatar_url": row.get("avatar_url"),
            "github": row.get("github"),
            "linkedin": row.get("linkedin"),
            "school": row.get("school"),
            "age": row.get("age"),
            "github_quality": row.get("github_quality"),
            "linkedin_quality": row.get("linkedin_quality"),
            "big_tech_employer": row.get("big_tech_employer"),
        },
        "rank": {
            "score": row.get("founder_score"),
            "rank": row.get("founder_rank"),
            "tier": row.get("founder_tier"),
        } if row.get("founder_rank") else None,
    }


@router.get("/og/profile/{user_id}")
async def get_og_profile(user_id: str):
    """
    Public OG-safe snapshot of a profile, used by the Next.js opengraph-image
    route. No auth — social crawlers can't carry a session. Returns only the
    minimal fields needed to render a share card.
    """
    supabase = get_client()
    res = (
        supabase.table("profiles")
        .select("id, full_name, brain_confidence, founder_signal, github, linkedin, school, age")
        .eq("id", user_id)
        .limit(1)
        .execute()
    )
    row = (res.data or [None])[0]
    if not row:
        raise HTTPException(status_code=404, detail="Profile not found")

    # Lifetime scan count — small extra read; cheap and useful on the card
    scans_res = (
        supabase.table("vault_uploads")
        .select("id", count="exact")
        .eq("user_id", user_id)
        .execute()
    )

    return {
        "user_id": user_id,
        "full_name": row.get("full_name") or "Founder",
        "brain_confidence": row.get("brain_confidence"),
        "founder_signal": row.get("founder_signal") or {},
        "github": row.get("github"),
        "linkedin": row.get("linkedin"),
        "school": row.get("school"),
        "age": row.get("age"),
        "total_scans": scans_res.count or 0,
    }


@router.get("/profile/{user_id}/brain-card")
async def get_brain_card(user_id: str = Depends(verify_user_owns_path)):
    """
    Regenerate a brain card for a user from their stored vectors.
    Useful if the user updates their vault or wants a fresh card.
    """
    # Use a broad query to sample diverse chunks from their vault
    broad_query = "who I am background experience skills what I am building values how I think"

    query_vector = embed_query(broad_query)

    chunks = query_namespace(user_id, query_vector, top_k=40)

    if not chunks:
        raise HTTPException(status_code=404, detail="No vault data found for this user")

    # Retrieval-driven: generate_brain_card runs per-dimension queries against the
    # user's namespace internally. The `chunks` above double as the existence guard
    # and the diversity-sampling fallback.
    brain_card = generate_brain_card(chunks, user_id=user_id)

    return {
        "user_id": user_id,
        "brain_card": brain_card,
    }


@router.get("/profile/{user_id}/scan-stats")
async def get_scan_stats(user_id: str = Depends(verify_user_owns_path)):
    """
    Brain scan counters for the upload + profile pages.

    Returns:
      total_scans                — lifetime count of vault analyses
      available_credits          — unused one-time upload credits
      subscription_tier          — free | brain_card | full
      uploads_in_cycle           — used this month (Full tier only)
      free_uploads_per_cycle     — monthly quota cap (Full tier only)
      remaining_this_cycle       — quota - used (Full tier only)
      can_upload                 — true if user can run another scan right now
                                   without paying
    """
    supabase = get_client()

    # Lifetime upload count
    scans_res = (
        supabase.table("vault_uploads")
        .select("id", count="exact")
        .eq("user_id", user_id)
        .execute()
    )
    total_scans = scans_res.count or 0

    # Available upload credits (LIFO consumption — same logic as paywall)
    credits_res = (
        supabase.table("upload_credits")
        .select("id", count="exact")
        .eq("user_id", user_id)
        .is_("consumed_at", "null")
        .execute()
    )
    available_credits = credits_res.count or 0

    # Profile (tier + monthly counter)
    profile_res = (
        supabase.table("profiles")
        .select("subscription_tier, subscription_status, uploads_in_cycle")
        .eq("id", user_id)
        .limit(1)
        .execute()
    )
    p = (profile_res.data or [{}])[0]
    tier = p.get("subscription_tier") or "free"
    status_str = p.get("subscription_status") or "inactive"
    used = int(p.get("uploads_in_cycle") or 0)

    remaining_this_cycle = None
    can_upload_via_quota = False
    if tier == "full" and status_str in ("active", "trialing"):
        remaining_this_cycle = max(0, FULL_TIER_FREE_UPLOADS_PER_CYCLE - used)
        can_upload_via_quota = remaining_this_cycle > 0

    # Everyone's first brain card is free — a free-tier user who has never
    # scanned can upload once without paying.
    first_free_available = tier == "free" and total_scans == 0

    can_upload = available_credits > 0 or can_upload_via_quota or first_free_available

    return {
        "total_scans": total_scans,
        "available_credits": available_credits,
        "subscription_tier": tier,
        "subscription_status": status_str,
        "uploads_in_cycle": used,
        "free_uploads_per_cycle": FULL_TIER_FREE_UPLOADS_PER_CYCLE if tier == "full" else None,
        "remaining_this_cycle": remaining_this_cycle,
        "first_free_available": first_free_available,
        "can_upload": can_upload,
    }
