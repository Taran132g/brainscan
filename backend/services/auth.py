"""
Supabase JWT verification for FastAPI.

Supabase signs user JWTs with HS256 using a secret available in the dashboard
(Settings → API → JWT Settings). We verify the signature, expiry, and audience,
then return the user id (the `sub` claim).
"""

import os
from typing import Optional
import jwt
from fastapi import Depends, Header, HTTPException, status


JWT_ALGORITHM = "HS256"
SUPABASE_AUDIENCE = "authenticated"


def _get_secret() -> str:
    secret = os.getenv("SUPABASE_JWT_SECRET")
    if not secret:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Server misconfigured: SUPABASE_JWT_SECRET not set.",
        )
    return secret


def _bearer_token(authorization: Optional[str]) -> str:
    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing Authorization header.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    parts = authorization.split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authorization must be 'Bearer <token>'.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return parts[1]


def get_current_user_id(authorization: Optional[str] = Header(default=None)) -> str:
    """
    FastAPI dependency: verifies the Supabase JWT and returns the user id.
    Raises 401 on any failure (missing header, bad signature, expired, wrong audience).
    """
    token = _bearer_token(authorization)
    try:
        payload = jwt.decode(
            token,
            _get_secret(),
            algorithms=[JWT_ALGORITHM],
            audience=SUPABASE_AUDIENCE,
        )
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session expired. Please sign in again.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except jwt.InvalidTokenError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid token: {e}",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token missing subject claim.",
        )
    return user_id


def verify_user_owns_path(
    user_id: str,
    current_user_id: str = Depends(get_current_user_id),
) -> str:
    """
    FastAPI path-level dependency: takes the user_id from the URL and verifies it
    matches the authenticated user. Returns the verified user_id.

    Use on any route shaped like /api/{resource}/{user_id}/... — prevents one user
    from reading or modifying another user's data by manipulating the URL.
    """
    if user_id != current_user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only access your own data.",
        )
    return user_id
