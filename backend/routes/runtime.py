"""
PAIS desktop-runtime endpoints — durable device-token auth.

  POST /api/runtime/link-code   (authed web user) -> {code, expires_in}
  POST /api/runtime/link {code}                    -> {device_token}
  POST /api/runtime/session  Bearer<device_token>  -> {access_token, expires_in}

See services/runtime_auth.py for the token model. These are sync `def` per this
codebase's rule (endpoints touching services are sync, served on the threadpool).
"""

from fastapi import APIRouter, Body, Depends, Header, HTTPException
from typing import Optional

from services.auth import get_current_user_id
from services import runtime_auth

router = APIRouter()


@router.post("/runtime/link-code")
def link_code(user_id: str = Depends(get_current_user_id)):
    """Authed web user requests a short-lived code to connect a desktop runtime."""
    code, ttl = runtime_auth.mint_link_code(user_id)
    return {"code": code, "expires_in": ttl}


@router.post("/runtime/link")
def link(body: dict = Body(...)):
    """Runtime exchanges the code (unauthenticated — the code IS the proof) for a
    durable device token, shown to it once."""
    try:
        uid = runtime_auth.redeem_link_code(body.get("code", ""))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {"device_token": runtime_auth.mint_device_token(uid)}


@router.post("/runtime/session")
def session(authorization: Optional[str] = Header(default=None)):
    """Runtime exchanges its durable device token for a short-lived access token."""
    parts = (authorization or "").split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise HTTPException(status_code=401, detail="Bearer device token required.")
    try:
        uid = runtime_auth.device_user(parts[1])
    except ValueError:
        raise HTTPException(status_code=401, detail="Invalid device token.")
    access, ttl = runtime_auth.mint_access(uid)
    return {"access_token": access, "expires_in": ttl}
