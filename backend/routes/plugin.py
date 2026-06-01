"""
Obsidian plugin surface.

The plugin authenticates with a per-user personal token (minted from the web app
while signed in), NOT a Supabase session. It uploads the vault zip exactly like
the web upload, then sends the user to the platform to view their Brain Card.

  POST /api/plugin/token   (session auth)  → mint + return a token, shown once
  POST /api/plugin/scan    (token auth)    → ingest the vault, return view_url
"""

import os
import hashlib
import secrets
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException, UploadFile, File, status
from fastapi.responses import JSONResponse

from services.auth import get_current_user_id
from services.db import get_client
from services.ingest import ingest_vault

router = APIRouter()


def _hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


@router.post("/plugin/token")
def mint_plugin_token(user_id: str = Depends(get_current_user_id)):
    """
    Generate a fresh plugin token for the signed-in user (replacing any prior
    one) and return the plaintext ONCE. Only the hash is stored.
    """
    token = secrets.token_urlsafe(32)
    get_client().table("profiles").update({
        "plugin_token_hash": _hash(token),
        "plugin_token_created_at": datetime.now(timezone.utc).isoformat(),
    }).eq("id", user_id).execute()
    return JSONResponse({"token": token})


def get_user_from_token(authorization: Optional[str] = Header(default=None)) -> str:
    """
    FastAPI dependency: resolve a plugin personal token to a user_id.
    """
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing plugin token. Connect the plugin in BrainScan settings.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    token = authorization.split(None, 1)[1].strip()
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Empty token.")
    # Any failure to verify (unknown token, DB error, missing column pre-migration)
    # is an auth failure — never leak a 500 with internals from an auth dependency.
    try:
        res = (
            get_client()
            .table("profiles")
            .select("id")
            .eq("plugin_token_hash", _hash(token))
            .limit(1)
            .execute()
        )
        rows = res.data or []
    except Exception as e:
        print(f"[plugin] token lookup failed: {e}")
        rows = []
    if not rows:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid plugin token. Reconnect the plugin in BrainScan settings.",
        )
    return rows[0]["id"]


@router.post("/plugin/scan")
def plugin_scan(
    file: UploadFile = File(...),
    user_id: str = Depends(get_user_from_token),
):
    """
    Ingest a vault zip uploaded by the Obsidian plugin (same pipeline as the web
    upload), then return a URL to view the resulting Brain Card on the platform.
    The plugin deliberately does NOT render the card — the reveal happens on the
    platform (account + the people-matching opt-in live there).
    """
    if not file.filename.endswith(".zip"):
        raise HTTPException(status_code=400, detail="Upload must be a .zip file")

    zip_bytes = file.file.read()
    result = ingest_vault(user_id, zip_bytes)

    frontend = os.getenv("FRONTEND_URL", "https://findingfounders.app").rstrip("/")
    result["view_url"] = f"{frontend}/dashboard/brain-card?scanned=1"
    # The plugin doesn't need the full card payload — keep the response light.
    result.pop("brain_card", None)
    return JSONResponse(result)
