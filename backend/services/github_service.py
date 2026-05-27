"""
GitHub OAuth + data fetching.

Flow:
  1. Frontend hits /api/github/connect → returns the GitHub authorize URL
     (with a CSRF state we sign so the callback can verify it).
  2. User approves → GitHub redirects to /api/github/callback?code=...&state=...
  3. Backend exchanges the code for an access token, fetches the user's GitHub
     profile + repos, computes a github_quality grade, persists everything to
     profiles, and redirects the browser back to /dashboard/profile.

The github_quality grade feeds the founder score. Heuristic (intentionally
coarse for MVP — refine after we have data):
  high:    >= 8 public repos AND (>= 20 total stars OR >= 4 distinct languages)
  medium:  >= 3 public repos AND >= 1 non-fork repo
  low:     anything else
"""

import os
import time
import hmac
import hashlib
import base64
import json
from typing import Optional
from urllib.parse import urlencode

import httpx

GITHUB_AUTHORIZE_URL = "https://github.com/login/oauth/authorize"
GITHUB_TOKEN_URL = "https://github.com/login/oauth/access_token"
GITHUB_API_BASE = "https://api.github.com"
SCOPES = "read:user public_repo"
STATE_TTL_SECONDS = 600  # 10 min CSRF state lifetime


def _client_id() -> str:
    v = os.getenv("GITHUB_CLIENT_ID")
    if not v:
        raise RuntimeError("GITHUB_CLIENT_ID not set in backend/.env")
    return v


def _client_secret() -> str:
    v = os.getenv("GITHUB_CLIENT_SECRET")
    if not v:
        raise RuntimeError("GITHUB_CLIENT_SECRET not set in backend/.env")
    return v


def _state_secret() -> str:
    # Re-use Supabase JWT secret as the state signing key (already on the server).
    # Falls back to a fixed placeholder so dev doesn't crash if it's not set.
    return os.getenv("SUPABASE_JWT_SECRET") or "ff-github-state-dev-secret"


def _backend_callback_url() -> str:
    base = os.getenv("BACKEND_URL", "http://localhost:8001")
    return f"{base.rstrip('/')}/api/github/callback"


def _frontend_url() -> str:
    return os.getenv("FRONTEND_URL", "http://localhost:3000").rstrip("/")


# ---------------- Signed state (CSRF defence) ----------------

def sign_state(user_id: str) -> str:
    """Return a base64 token encoding {user_id, expires_at} + HMAC signature."""
    payload = {"user_id": user_id, "exp": int(time.time()) + STATE_TTL_SECONDS}
    raw = json.dumps(payload, separators=(",", ":")).encode("utf-8")
    sig = hmac.new(_state_secret().encode("utf-8"), raw, hashlib.sha256).digest()
    return base64.urlsafe_b64encode(raw + b"." + sig).decode("ascii")


def verify_state(token: str) -> str:
    """Validate a state token. Returns the embedded user_id or raises ValueError."""
    try:
        decoded = base64.urlsafe_b64decode(token.encode("ascii"))
    except Exception as e:
        raise ValueError(f"Malformed state token: {e}")

    if b"." not in decoded:
        raise ValueError("Missing signature in state token")
    raw, sig = decoded.rsplit(b".", 1)

    expected = hmac.new(_state_secret().encode("utf-8"), raw, hashlib.sha256).digest()
    if not hmac.compare_digest(sig, expected):
        raise ValueError("State signature mismatch")

    payload = json.loads(raw.decode("utf-8"))
    if int(payload.get("exp", 0)) < int(time.time()):
        raise ValueError("State token expired")
    user_id = payload.get("user_id")
    if not user_id:
        raise ValueError("State missing user_id")
    return user_id


# ---------------- OAuth flow ----------------

def authorize_url(user_id: str) -> str:
    """Build the GitHub OAuth authorize URL with a signed state."""
    params = {
        "client_id": _client_id(),
        "redirect_uri": _backend_callback_url(),
        "scope": SCOPES,
        "state": sign_state(user_id),
        "allow_signup": "false",
    }
    return f"{GITHUB_AUTHORIZE_URL}?{urlencode(params)}"


def exchange_code(code: str) -> str:
    """Exchange the auth code for an access token. Returns the token."""
    with httpx.Client(timeout=15.0) as client:
        r = client.post(
            GITHUB_TOKEN_URL,
            data={
                "client_id": _client_id(),
                "client_secret": _client_secret(),
                "code": code,
                "redirect_uri": _backend_callback_url(),
            },
            headers={"Accept": "application/json"},
        )
        r.raise_for_status()
        data = r.json()
        token = data.get("access_token")
        if not token:
            raise RuntimeError(f"GitHub did not return an access token: {data}")
        return token


# ---------------- Data fetch ----------------

def fetch_user_data(token: str) -> dict:
    """
    OAuth path — pull the authenticated user's profile + repos using their token.
    Returns a normalized dict matching fetch_user_data_public.
    """
    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
    }
    with httpx.Client(timeout=20.0, headers=headers) as client:
        u = client.get(f"{GITHUB_API_BASE}/user")
        u.raise_for_status()
        user = u.json()

        # Public repos, most recently pushed first
        r = client.get(
            f"{GITHUB_API_BASE}/user/repos",
            params={
                "per_page": 100,
                "sort": "pushed",
                "direction": "desc",
                "visibility": "public",
                "affiliation": "owner",
            },
        )
        r.raise_for_status()
        repos = r.json()

    return _summarize(user, repos)


def fetch_user_data_public(username: str) -> dict:
    """
    Public-API path — fetch any user's public profile + repos by username.
    No auth required; uses GITHUB_TOKEN if set to bump rate limit 60 → 5000/hour.

    Used when OAuth is broken or as a low-friction fallback. Data is
    "self-reported" — caller should mark verification=false.
    """
    headers = {
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
    }
    server_token = os.getenv("GITHUB_TOKEN")
    if server_token:
        headers["Authorization"] = f"Bearer {server_token}"

    with httpx.Client(timeout=20.0, headers=headers) as client:
        u = client.get(f"{GITHUB_API_BASE}/users/{username}")
        if u.status_code == 404:
            raise ValueError(f"GitHub user '{username}' not found")
        u.raise_for_status()
        user = u.json()

        r = client.get(
            f"{GITHUB_API_BASE}/users/{username}/repos",
            params={"per_page": 100, "sort": "pushed", "direction": "desc", "type": "owner"},
        )
        r.raise_for_status()
        repos = r.json()

    return _summarize(user, repos)


def _summarize(user: dict, repos: list[dict]) -> dict:
    """Reduce GitHub's verbose API payloads to the signal-bearing fields."""
    non_fork = [r for r in repos if not r.get("fork", False)]
    total_stars = sum(r.get("stargazers_count", 0) for r in non_fork)
    languages = sorted({r.get("language") for r in non_fork if r.get("language")})

    # Top 10 by stars (or push date) so the brain card prompt can use them later
    top_repos = sorted(non_fork, key=lambda r: r.get("stargazers_count", 0), reverse=True)[:10]
    repo_summary = [
        {
            "name": r.get("name"),
            "description": r.get("description"),
            "language": r.get("language"),
            "stars": r.get("stargazers_count", 0),
            "pushed_at": r.get("pushed_at"),
            "url": r.get("html_url"),
        }
        for r in top_repos
    ]

    return {
        "username": user.get("login"),
        "name": user.get("name"),
        "bio": user.get("bio"),
        "company": user.get("company"),
        "location": user.get("location"),
        "blog": user.get("blog"),
        "html_url": user.get("html_url"),
        "avatar_url": user.get("avatar_url"),
        "public_repo_count": user.get("public_repos", 0),
        "followers": user.get("followers", 0),
        "following": user.get("following", 0),
        "created_at": user.get("created_at"),
        "stats": {
            "total_repos_fetched": len(repos),
            "non_fork_repos": len(non_fork),
            "total_stars": total_stars,
            "language_count": len(languages),
            "languages": languages,
        },
        "top_repos": repo_summary,
    }


def grade_quality(github_data: dict) -> str:
    """Map summarized github data → low | medium | high."""
    stats = github_data.get("stats", {}) or {}
    non_fork = stats.get("non_fork_repos", 0)
    stars = stats.get("total_stars", 0)
    langs = stats.get("language_count", 0)

    if non_fork >= 8 and (stars >= 20 or langs >= 4):
        return "high"
    if non_fork >= 3 and (stars >= 1 or langs >= 2):
        return "medium"
    return "low"


# ---------------- Persistence ----------------

def persist_to_profile(user_id: str, access_token: str, github_data: dict, quality: str) -> None:
    """Write the GitHub bundle to the user's profile row."""
    from services.db import get_client
    get_client().table("profiles").update({
        "github_connected": True,
        "github_access_token": access_token,
        "github_username": github_data.get("username"),
        "github": github_data.get("username"),  # also keep the simple display field in sync
        "github_data": github_data,
        "github_quality": quality,
        "github_connected_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }).eq("id", user_id).execute()


def disconnect(user_id: str) -> None:
    """Wipe GitHub fields from a profile (user-initiated disconnect)."""
    from services.db import get_client
    get_client().table("profiles").update({
        "github_connected": False,
        "github_access_token": None,
        "github_data": None,
        "github_quality": None,
        "github_connected_at": None,
    }).eq("id", user_id).execute()


def get_profile_github(user_id: str) -> Optional[dict]:
    """Read the GitHub bundle (without access_token) from profiles."""
    from services.db import get_client
    res = (
        get_client()
        .table("profiles")
        .select("github_connected, github_username, github_data, github_quality, github_connected_at")
        .eq("id", user_id)
        .limit(1)
        .execute()
    )
    return (res.data or [{}])[0] if res.data else None
