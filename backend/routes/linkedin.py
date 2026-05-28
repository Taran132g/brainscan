from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Optional

from services.auth import get_current_user_id
from services.linkedin_service import (
    validate_url, grade, persist_to_profile, disconnect, get_profile_linkedin,
)
from services.db import compute_and_persist_rank

router = APIRouter()


class LinkedInLookupRequest(BaseModel):
    linkedin_url: str
    latest_company: Optional[str] = None
    latest_role: Optional[str] = None
    previous_employers: Optional[str] = None
    years_experience: Optional[int] = None


@router.post("/linkedin/lookup")
async def linkedin_lookup(
    body: LinkedInLookupRequest,
    user_id: str = Depends(get_current_user_id),
):
    """
    Self-reported LinkedIn connection. Validates the URL and grades quality
    via the big-tech keyword heuristic. Triggers a server-side rank recompute.
    """
    try:
        clean_url = validate_url(body.linkedin_url)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    quality, big_tech = grade(
        latest_company=body.latest_company,
        latest_role=body.latest_role,
        previous_employers=body.previous_employers,
        years_experience=body.years_experience,
    )

    persist_to_profile(
        user_id=user_id,
        linkedin_url=clean_url,
        latest_company=body.latest_company,
        latest_role=body.latest_role,
        previous_employers=body.previous_employers,
        years_experience=body.years_experience,
        quality=quality,
        big_tech_employer=big_tech,
    )

    rank_result = compute_and_persist_rank(user_id)

    return JSONResponse({
        "ok": True,
        "linkedin_url": clean_url,
        "quality": quality,
        "big_tech_employer": big_tech,
        "verified": False,
        "rank": rank_result,
    })


@router.get("/linkedin/status")
async def linkedin_status(user_id: str = Depends(get_current_user_id)):
    return JSONResponse(get_profile_linkedin(user_id) or {"linkedin_connected": False})


@router.post("/linkedin/disconnect")
async def linkedin_disconnect(user_id: str = Depends(get_current_user_id)):
    disconnect(user_id)
    compute_and_persist_rank(user_id)
    return JSONResponse({"ok": True})
