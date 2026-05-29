from typing import Optional, Literal

from fastapi import APIRouter, Depends, Query
from fastapi.responses import JSONResponse

from services.auth import get_current_user_id
from services.db import get_client
from services.connections import set_decision, list_connections
from services.match_service import (
    find_matches,
    delete_match_vectors,
    filter_and_sort,
    _coords_for,
)

router = APIRouter()


SortMode = Literal["mutual_fit", "smartest", "rank", "nearest"]


@router.get("/match/me")
async def get_my_matches(
    top_k: int = Query(default=10, ge=1, le=50),
    sort: SortMode = Query(default="mutual_fit"),
    market: Optional[str] = Query(default=None, description="b2b | consumer | infrastructure | mixed | unclear | all"),
    tier: Optional[str] = Query(default=None, description="Visionary | Builder | Operator | Explorer | Newcomer | all"),
    role: Optional[str] = Query(default=None, description="technical | business | design | domain | all"),
    shipped_only: bool = Query(default=False),
    user_id: str = Depends(get_current_user_id),
):
    """
    Top-K co-founder matches for the authenticated user.

    Sort modes:
      mutual_fit (default) — Hinge-style: (A→B + B→A) / 2 from brain card embeddings
      smartest             — implied intelligence grade, then founder rank
      rank                 — founder rank desc
      nearest              — haversine km from the user's city (skip distance-less profiles)

    Filters compose multiplicatively with the sort. We over-fetch by 5× internally
    so filters that narrow the pool still return a useful number of matches.
    """
    # Over-fetch to give filters something to work with
    over_fetch = min(top_k * 5, 50)
    matches = find_matches(user_id, top_k=over_fetch)

    # Look up the requesting user's city → coords once for nearest sort
    user_coords = None
    try:
        res = (
            get_client()
            .table("profiles")
            .select("city")
            .eq("id", user_id)
            .limit(1)
            .execute()
        )
        city = (res.data or [{}])[0].get("city")
        user_coords = _coords_for(city or "")
    except Exception:
        user_coords = None

    sorted_filtered = filter_and_sort(
        matches,
        user_coords=user_coords,
        sort=sort,
        market=market,
        tier=tier,
        role=role,
        shipped_only=shipped_only,
    )

    return JSONResponse({
        "count": len(sorted_filtered[:top_k]),
        "total_available": len(sorted_filtered),
        "sort": sort,
        "filters": {
            "market": market, "tier": tier, "role": role, "shipped_only": shipped_only,
        },
        "user_coords": user_coords,
        "matches": sorted_filtered[:top_k],
    })


@router.delete("/match/me")
async def remove_from_matching(user_id: str = Depends(get_current_user_id)):
    """Opt out of the matching pool. Their vault stays — only the match vectors are removed."""
    delete_match_vectors(user_id)
    return JSONResponse({"ok": True})


# ---------- Hinge-style opt-in connections ----------

@router.get("/match/connections")
async def get_connections(user_id: str = Depends(get_current_user_id)):
    """
    Every match record the user is part of, with the other founder's basic
    profile and a derived status (connected / pending_outgoing /
    pending_incoming / passed). Powers the Connections page.
    """
    return JSONResponse({"connections": list_connections(user_id)})


@router.post("/match/{other_user_id}/connect")
async def connect(other_user_id: str, user_id: str = Depends(get_current_user_id)):
    """
    Express interest in / accept a match. Creates the canonical match row if
    needed and marks the caller's side accepted. If both sides have accepted,
    messaging unlocks. Seeded demo founders are auto-accepted.
    """
    try:
        result = set_decision(user_id, other_user_id, accept=True)
    except ValueError as e:
        return JSONResponse({"detail": str(e)}, status_code=400)
    return JSONResponse(result)


@router.post("/match/{other_user_id}/pass")
async def pass_match(other_user_id: str, user_id: str = Depends(get_current_user_id)):
    """Decline a match. Marks the caller's side as declined."""
    try:
        result = set_decision(user_id, other_user_id, accept=False)
    except ValueError as e:
        return JSONResponse({"detail": str(e)}, status_code=400)
    return JSONResponse(result)
