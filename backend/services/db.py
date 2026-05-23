"""
Supabase Postgres client for backend writes.

We use the service role key here — bypasses RLS, which is correct because
the routes are already auth-gated by services/auth.py (the user's identity
is verified before we touch the DB).

Never expose SUPABASE_SERVICE_ROLE_KEY to the browser.
"""

import os
from typing import Optional
from supabase import create_client, Client

_client: Optional[Client] = None


def get_client() -> Client:
    """Return a singleton Supabase client (lazy-initialized)."""
    global _client
    if _client is None:
        url = os.getenv("SUPABASE_URL")
        key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        if not url or not key:
            raise RuntimeError(
                "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in backend/.env"
            )
        _client = create_client(url, key)
    return _client


def record_vault_upload(
    user_id: str,
    stats: dict,
    quality_score: int,
    chunks_indexed: int,
    brain_card: dict,
    github_username: Optional[str] = None,
    linkedin_url: Optional[str] = None,
) -> None:
    """
    Insert a new row in vault_uploads after a successful analysis.
    Soft-fails — we don't want a DB error to fail the upload response.
    """
    try:
        get_client().table("vault_uploads").insert({
            "user_id": user_id,
            "note_count": stats.get("note_count"),
            "total_words": stats.get("total_words"),
            "avg_words_per_note": stats.get("avg_words_per_note"),
            "quality_score": quality_score,
            "chunks_indexed": chunks_indexed,
            "brain_card": brain_card.get("sections"),
            "founder_signal": brain_card.get("founder_signal"),
            "github_username": github_username,
            "linkedin_url": linkedin_url,
        }).execute()
    except Exception as e:
        # Log but don't raise — upload itself succeeded; DB hiccup shouldn't fail the user.
        print(f"[db] record_vault_upload failed: {e}")


def upsert_profile_snapshot(
    user_id: str,
    brain_card: dict,
    quality_score: int,
    github_username: Optional[str] = None,
    linkedin_url: Optional[str] = None,
) -> None:
    """
    Upsert the user's profile row with their latest brain card snapshot +
    GitHub/LinkedIn. Real upsert (insert-or-update) — the previous version
    used .update() which silently did nothing if the row didn't exist (the
    handle_new_user trigger only fires on new sign-ups, so pre-existing
    auth users had no profile row).
    """
    try:
        payload: dict = {
            "id": user_id,
            "brain_card": brain_card.get("sections"),
            "founder_signal": brain_card.get("founder_signal"),
            "brain_confidence": quality_score,
        }
        if github_username:
            payload["github"] = github_username
        if linkedin_url:
            payload["linkedin"] = linkedin_url

        # on_conflict=id → upsert pattern. Supabase Postgrest handles INSERT/UPDATE.
        get_client().table("profiles").upsert(payload, on_conflict="id").execute()
    except Exception as e:
        print(f"[db] upsert_profile_snapshot failed: {e}")
