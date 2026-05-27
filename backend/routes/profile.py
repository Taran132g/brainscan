from fastapi import APIRouter, HTTPException, Depends
from services.embedder import embed_chunks
from services.vector_store import query_namespace
from services.brain_card import generate_brain_card
from services.auth import verify_user_owns_path
from services.db import get_client
from services.paywall import FULL_TIER_FREE_UPLOADS_PER_CYCLE

router = APIRouter()


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
        .select("id, full_name, brain_card, founder_signal, brain_confidence, github, linkedin, school, age")
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
        "brain_card": {
            "sections": row.get("brain_card"),
            "founder_signal": row.get("founder_signal") or {},
        },
        "brain_confidence": row.get("brain_confidence"),
        "profile": {
            "full_name": row.get("full_name"),
            "github": row.get("github"),
            "linkedin": row.get("linkedin"),
            "school": row.get("school"),
            "age": row.get("age"),
        },
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
    broad_queries = [
        "who I am background experience skills",
        "what I am building projects ideas startup",
        "values philosophy risk long term vision",
        "how I think mental models frameworks",
    ]

    # Embed one of the broad queries and retrieve a wide sample
    sample_chunk = [{"title": "", "heading": "", "text": broad_queries[0]}]
    embedded = embed_chunks(sample_chunk)
    query_vector = embedded[0]["embedding"]

    chunks = query_namespace(user_id, query_vector, top_k=40)

    if not chunks:
        raise HTTPException(status_code=404, detail="No vault data found for this user")

    brain_card = generate_brain_card(chunks)

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

    can_upload = available_credits > 0 or can_upload_via_quota

    return {
        "total_scans": total_scans,
        "available_credits": available_credits,
        "subscription_tier": tier,
        "subscription_status": status_str,
        "uploads_in_cycle": used,
        "free_uploads_per_cycle": FULL_TIER_FREE_UPLOADS_PER_CYCLE if tier == "full" else None,
        "remaining_this_cycle": remaining_this_cycle,
        "can_upload": can_upload,
    }
