from fastapi import APIRouter, Depends, Query
from fastapi.responses import JSONResponse

from services.auth import get_current_user_id
from services.match_service import find_matches, delete_match_vectors

router = APIRouter()


@router.get("/match/me")
async def get_my_matches(
    top_k: int = Query(default=10, ge=1, le=50),
    user_id: str = Depends(get_current_user_id),
):
    """
    Return top-K co-founder matches for the authenticated user, ranked by
    mutual score (Hinge-style: how well A's needs match B's profile AND
    how well B's needs match A's profile).

    Empty list if the user hasn't uploaded a brain card yet.
    """
    matches = find_matches(user_id, top_k=top_k)
    return JSONResponse({
        "count": len(matches),
        "matches": matches,
    })


@router.delete("/match/me")
async def remove_from_matching(user_id: str = Depends(get_current_user_id)):
    """Opt out of the matching pool. Their vault stays — only the match vectors are removed."""
    delete_match_vectors(user_id)
    return JSONResponse({"ok": True})
