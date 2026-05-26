from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import JSONResponse, RedirectResponse
from typing import Optional

import httpx

from services.auth import get_current_user_id
from services.github_service import (
    authorize_url,
    exchange_code,
    fetch_user_data,
    grade_quality,
    persist_to_profile,
    disconnect,
    get_profile_github,
    verify_state,
)
from services.github_service import _frontend_url  # for callback redirect

router = APIRouter()


@router.get("/github/connect")
async def github_connect(user_id: str = Depends(get_current_user_id)):
    """Return the GitHub OAuth authorize URL the frontend should redirect to."""
    try:
        url = authorize_url(user_id)
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))
    return JSONResponse({"url": url})


@router.get("/github/callback")
async def github_callback(code: Optional[str] = None, state: Optional[str] = None, error: Optional[str] = None):
    """
    GitHub redirects the user's browser here after they approve/deny.
    We exchange the code for a token, fetch their data, persist, and bounce
    the browser back to the dashboard.
    """
    frontend = _frontend_url()
    if error:
        return RedirectResponse(url=f"{frontend}/dashboard/profile?github_error={error}")
    if not code or not state:
        return RedirectResponse(url=f"{frontend}/dashboard/profile?github_error=missing_params")

    # Verify CSRF state and extract user_id
    try:
        user_id = verify_state(state)
    except ValueError as e:
        return RedirectResponse(url=f"{frontend}/dashboard/profile?github_error=bad_state&detail={e}")

    # Exchange + fetch + persist
    try:
        token = exchange_code(code)
        data = fetch_user_data(token)
        quality = grade_quality(data)
        persist_to_profile(user_id, token, data, quality)
    except httpx.HTTPError as e:
        return RedirectResponse(url=f"{frontend}/dashboard/profile?github_error=github_api&detail={e}")
    except RuntimeError as e:
        return RedirectResponse(url=f"{frontend}/dashboard/profile?github_error=config&detail={e}")

    return RedirectResponse(url=f"{frontend}/dashboard/profile?github_connected=1")


@router.get("/github/status")
async def github_status(user_id: str = Depends(get_current_user_id)):
    """Return the user's current GitHub connection state (no access token)."""
    return JSONResponse(get_profile_github(user_id) or {"github_connected": False})


@router.post("/github/disconnect")
async def github_disconnect(user_id: str = Depends(get_current_user_id)):
    disconnect(user_id)
    return JSONResponse({"ok": True})
