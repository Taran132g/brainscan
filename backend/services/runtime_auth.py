"""
PAIS desktop-runtime auth — durable device tokens, independent of Supabase
browser sessions.

Why this exists: the runtime used to borrow the web app's Supabase REFRESH token,
which Supabase rotates and a browser "Sign out" revokes — stranding the runtime
(the 06-12 zero-run failure). A per-device token issued here never rotates and is
unaffected by web logins/logouts.

Flow:
  web (authed)  POST /api/runtime/link-code      -> {code}            (short-TTL, single-use)
  runtime       POST /api/runtime/link {code}     -> {device_token}    (durable, shown once)
  runtime       POST /api/runtime/session  Bearer<device_token>
                                                  -> {access_token, expires_in}

Storage (file-based, mirrors accounts/ + agent_configs/):
  runtime_codes/<CODE>.json      {user_id, exp}
  runtime_devices/<sha256>.json  {user_id, created, last_seen}

Tokens:
  device_token : opaque secrets.token_urlsafe(32); only its SHA-256 is stored.
  access_token : short-lived HS256 JWT (aud=pais-runtime), signed with a local
                 secret; verified alongside Supabase JWTs in services.auth. A
                 Supabase token (aud=authenticated, different key) can't validate
                 here and vice-versa, so the two paths stay isolated.
"""

import hashlib
import json
import os
import re
import secrets
import time
from pathlib import Path

import jwt

BASE = Path(__file__).resolve().parent.parent          # backend/
CODES_DIR = BASE / "runtime_codes"
DEVICES_DIR = BASE / "runtime_devices"
SECRET_FILE = BASE / "runtime_secret.key"

CODE_TTL = 600          # link code valid 10 min
ACCESS_TTL = 3600       # access token valid 1 h
RUNTIME_AUD = "pais-runtime"
_CODE_RE = re.compile(r"[0-9A-F]{8}")   # exact-match guard (filename safety)


def _secret() -> str:
    """HMAC secret for runtime access tokens. Prefers RUNTIME_JWT_SECRET; else a
    generated-and-persisted local key (zero deploy config). Independent of the
    Supabase JWT secret on purpose — runtime tokens are ours, not Supabase's."""
    env = os.getenv("RUNTIME_JWT_SECRET")
    if env:
        return env
    if SECRET_FILE.exists():
        return SECRET_FILE.read_text().strip()
    s = secrets.token_urlsafe(48)
    SECRET_FILE.write_text(s)
    try:
        os.chmod(SECRET_FILE, 0o600)
    except OSError:
        pass
    return s


def _sha256(tok: str) -> str:
    return hashlib.sha256(tok.encode()).hexdigest()


def _write_private(path: Path, data: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data))
    try:
        os.chmod(path, 0o600)
    except OSError:
        pass


# ── link codes (web → runtime handoff) ─────────────────────────────────────────
def mint_link_code(user_id: str) -> tuple[str, int]:
    code = secrets.token_hex(4).upper()        # 8 hex chars, easy to read/type
    _write_private(CODES_DIR / f"{code}.json",
                   {"user_id": user_id, "exp": time.time() + CODE_TTL})
    return code, CODE_TTL


def redeem_link_code(code: str) -> str:
    """Validate + consume a link code (single-use). Raises ValueError if the code
    is malformed, unknown, or expired."""
    code = (code or "").strip().upper()
    if not _CODE_RE.fullmatch(code):
        raise ValueError("invalid or expired code")
    path = CODES_DIR / f"{code}.json"
    if not path.exists():
        raise ValueError("invalid or expired code")
    data = json.loads(path.read_text())
    path.unlink(missing_ok=True)               # consume immediately (single-use)
    if time.time() > data.get("exp", 0):
        raise ValueError("invalid or expired code")
    return data["user_id"]


# ── device tokens (durable, per machine) ───────────────────────────────────────
def mint_device_token(user_id: str) -> str:
    tok = secrets.token_urlsafe(32)
    _write_private(DEVICES_DIR / f"{_sha256(tok)}.json",
                   {"user_id": user_id, "created": time.time(),
                    "last_seen": time.time()})
    return tok                                  # returned ONCE; only the hash persists


def device_user(device_token: str) -> str:
    """Map a device token to its user_id (by hash). Raises ValueError if unknown."""
    path = DEVICES_DIR / f"{_sha256(device_token or '')}.json"
    if not path.exists():
        raise ValueError("unknown device token")
    data = json.loads(path.read_text())
    data["last_seen"] = time.time()
    try:
        path.write_text(json.dumps(data))
    except OSError:
        pass
    return data["user_id"]


# ── access tokens (short-lived, exchanged from a device token) ──────────────────
def mint_access(user_id: str) -> tuple[str, int]:
    now = int(time.time())
    payload = {"sub": user_id, "aud": RUNTIME_AUD, "iss": RUNTIME_AUD,
               "iat": now, "exp": now + ACCESS_TTL}
    return jwt.encode(payload, _secret(), algorithm="HS256"), ACCESS_TTL


def verify_access(token: str):
    """Return user_id for a valid runtime access token, else None — so the auth
    dependency can fall through to Supabase verification for normal web tokens."""
    try:
        payload = jwt.decode(token, _secret(), algorithms=["HS256"],
                             audience=RUNTIME_AUD)
    except jwt.InvalidTokenError:
        return None
    return payload.get("sub")
