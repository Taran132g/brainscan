from typing import Optional, Literal

from fastapi import APIRouter, Depends, Query
from fastapi.responses import JSONResponse

from services.auth import get_current_user_id
from services.db import get_client
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
