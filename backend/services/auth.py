"""
Supabase JWT verification for FastAPI.

Supabase migrated from HS256 (shared secret) to ES256 (asymmetric) tokens by
default. We support both:

- ES256 / RS256 / EdDSA → fetch the public key from Supabase's JWKS endpoint
  at {SUPABASE_URL}/auth/v1/.well-known/jwks.json
- HS256 (legacy) → use SUPABASE_JWT_SECRET shared secret

The algorithm is read from the JWT header to pick the right verification path.
"""

import os
from typing import Optional
import jwt
from jwt import PyJWKClient
from fastapi import Depends, Header, HTTPException, status


SUPABASE_AUDIENCE = "authenticated"
ASYMMETRIC_ALGS = {"ES256", "RS256", "EdDSA"}

_jwks_client: Optional[PyJWKClient] = None


def _get_jwks_client() -> PyJWKClient:
    """Cached JWKS client — fetches and caches Supabase's public keys."""
    global _jwks_client
    if _jwks_client is None:
        supabase_url = os.getenv("SUPABASE_URL")
        if not supabase_url:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Server misconfigured: SUPABASE_URL not set.",
            )
        # Strip trailing slash to keep the URL clean
        jwks_url = f"{supabase_url.rstrip('/')}/auth/v1/.well-known/jwks.json"
        _jwks_client = PyJWKClient(jwks_url, cache_keys=True)
    return _jwks_client


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


def _verify_token(token: str) -> dict:
    try:
        unverified_header = jwt.get_unverified_header(token)
    except jwt.InvalidTokenError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid token header: {e}",
        )

    alg = unverified_header.get("alg")

    if alg == "HS256":
        secret = os.getenv("SUPABASE_JWT_SECRET")
        if not secret:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Server misconfigured: SUPABASE_JWT_SECRET not set.",
            )
        try:
            return jwt.decode(
                token,
                secret,
                algorithms=["HS256"],
                audience=SUPABASE_AUDIENCE,
            )
        except jwt.ExpiredSignatureError:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Session expired. Please sign in again.",
            )
        except jwt.InvalidTokenError as e:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"Invalid token: {e}",
            )

    if alg in ASYMMETRIC_ALGS:
        try:
            signing_key = _get_jwks_client().get_signing_key_from_jwt(token).key
            return jwt.decode(
                token,
                signing_key,
                algorithms=[alg],
                audience=SUPABASE_AUDIENCE,
            )
        except jwt.ExpiredSignatureError:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Session expired. Please sign in again.",
            )
        except jwt.InvalidTokenError as e:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"Invalid token: {e}",
            )

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=f"Unsupported token algorithm: {alg}",
    )


def get_current_user_id(authorization: Optional[str] = Header(default=None)) -> str:
    """
    FastAPI dependency: verifies the Supabase JWT and returns the user id.
    Raises 401 on any failure.
    """
    token = _bearer_token(authorization)
    payload = _verify_token(token)
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
    Path-level guard: ensures the URL's user_id matches the authenticated user.
    Returns the verified user_id.
    """
    if user_id != current_user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only access your own data.",
        )
    return user_id
