from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import JSONResponse, RedirectResponse
from pydantic import BaseModel
from typing import Optional

import httpx

from services.auth import get_current_user_id
from services.github_service import (
    authorize_url,
    exchange_code,
    fetch_user_data,
    fetch_user_data_public,
    grade_quality,
    persist_to_profile,
    disconnect,
    get_profile_github,
    verify_state,
)
from services.github_service import _frontend_url  # for callback redirect
from services.db import compute_and_persist_rank

router = APIRouter()


class GitHubSyncRequest(BaseModel):
    access_token: str


class GitHubLookupRequest(BaseModel):
    username: str


@router.post("/github/lookup")
async def github_lookup(
    body: GitHubLookupRequest,
    user_id: str = Depends(get_current_user_id),
):
    """
    Username-only flow — fetches the user's public GitHub data without OAuth.
    Used as the primary connection path while OAuth is broken on certain
    accounts. Data is self-reported (anyone can claim any username) so the
    UI flags it as unverified.

    The shape of the persisted github_data matches the OAuth flow exactly,
    so downstream code (brain card prompt, founder rank, profile UI) works
    identically.
    """
    username = (body.username or "").strip().lstrip("@")
    if not username or len(username) > 39 or "/" in username:
        raise HTTPException(status_code=400, detail="Invalid GitHub username")

    try:
        data = fetch_user_data_public(username)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=502, detail=f"GitHub API error: {e.response.status_code}")
    except httpx.HTTPError as e:
        raise HTTPException(status_code=502, detail=f"GitHub network error: {e}")

    quality = grade_quality(data)
    # No access_token — pass None. persist_to_profile clears stale token if any.
    persist_to_profile(user_id, "", data, quality)

    # GitHub quality changed → recompute founder rank
    rank_result = compute_and_persist_rank(user_id)

    return JSONResponse({
        "ok": True,
        "username": data.get("username"),
        "quality": quality,
        "verified": False,
        "rank": rank_result,
    })


@router.post("/github/sync")
async def github_sync(
    body: GitHubSyncRequest,
    user_id: str = Depends(get_current_user_id),
):
    """
    Accept a GitHub provider access token (from Supabase's OAuth callback)
    and use it to fetch the user's GitHub data, grade it, and persist to
    profiles. The frontend captures Supabase's provider_token right after
    linkIdentity / signInWithOAuth completes and posts it here.

    Replaces the direct-OAuth dance (/api/github/connect + /callback) for
    accounts whose GitHub OAuth Apps misbehave (the 0v23 format issue).
    """
    if not body.access_token or not body.access_token.startswith(("gho_", "ghu_", "ghs_", "ghr_", "ghp_")):
        # gho_ = OAuth user-to-server (what Supabase issues for GitHub provider)
        # accept a few prefixes defensively
        raise HTTPException(status_code=400, detail="Invalid GitHub access token format")

    try:
        data = fetch_user_data(body.access_token)
        quality = grade_quality(data)
        persist_to_profile(user_id, body.access_token, data, quality)
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=502, detail=f"GitHub API error: {e.response.status_code}")
    except httpx.HTTPError as e:
        raise HTTPException(status_code=502, detail=f"GitHub network error: {e}")

    return JSONResponse({
        "ok": True,
        "username": data.get("username"),
        "quality": quality,
    })


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
