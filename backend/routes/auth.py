from fastapi import APIRouter, HTTPException
from fastapi.responses import RedirectResponse
import os

router = APIRouter()

# TODO: Implement Google OAuth 2.0
# Flow:
# 1. GET /api/auth/google → redirect to Google consent screen
# 2. GET /api/auth/google/callback → exchange code for token, create session
# 3. GET /api/auth/me → return current user from session
# 4. POST /api/auth/logout → clear session

@router.get("/auth/google")
async def google_login():
    raise HTTPException(status_code=501, detail="Google OAuth not yet implemented")


@router.get("/auth/google/callback")
async def google_callback(code: str, state: str = None):
    raise HTTPException(status_code=501, detail="Google OAuth not yet implemented")


@router.get("/auth/me")
async def get_current_user():
    raise HTTPException(status_code=501, detail="Auth not yet implemented")


@router.post("/auth/logout")
async def logout():
    raise HTTPException(status_code=501, detail="Auth not yet implemented")
