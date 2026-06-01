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
            # Stores the whole-person brain_signal (or founder_signal for legacy
            # founder cards) — the profiles.founder_signal column is reused.
            "founder_signal": brain_card.get("signal") or brain_card.get("founder_signal"),
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


PROFILE_EDITABLE_FIELDS = {
    "full_name", "age", "city", "willing_to_relocate", "work_authorization",
    "school", "github", "linkedin", "instagram", "twitter", "website",
    "gender", "race", "languages", "avatar_url",
}


def update_profile_fields(user_id: str, fields: dict) -> dict:
    """
    Write user-editable profile fields to the `profiles` table. This is what
    keeps `profiles.city` (read by the matching layer) in sync with the city
    the user types into their profile form — the form previously only wrote to
    auth user_metadata, so the matching layer never saw it.

    Returns the cleaned payload that was written.
    """
    clean: dict = {"id": user_id}
    for k, v in (fields or {}).items():
        if k not in PROFILE_EDITABLE_FIELDS:
            continue
        if k == "age":
            try:
                clean[k] = int(v) if v not in (None, "") else None
            except (TypeError, ValueError):
                clean[k] = None
        else:
            clean[k] = (v.strip() if isinstance(v, str) else v) or None
    # Drop the willing_to_relocate / work_authorization empties so we don't
    # violate the CHECK constraints with "" — None is allowed, "" is not.
    get_client().table("profiles").upsert(clean, on_conflict="id").execute()
    return clean


def record_scan(user_id: str, domain: str, sections: dict, signal: dict) -> None:
    """Append a scan result to the append-only scans table (soft-fails)."""
    try:
        get_client().table("scans").insert({
            "user_id": user_id,
            "domain": domain,
            "sections": sections,
            "signal": signal,
        }).execute()
    except Exception as e:
        print(f"[db] record_scan failed: {e}")


def get_latest_scans(user_id: str) -> dict:
    """Latest scan per domain for a user → {domain: {sections, signal, created_at}}."""
    try:
        res = (
            get_client()
            .table("scans")
            .select("domain, sections, signal, created_at")
            .eq("user_id", user_id)
            .order("created_at", desc=True)
            .execute()
        )
    except Exception as e:
        print(f"[db] get_latest_scans failed: {e}")
        return {}
    latest: dict = {}
    for row in res.data or []:
        d = row.get("domain")
        if d and d not in latest:
            latest[d] = row
    return latest


def get_scan_timeline(user_id: str, domain: str, limit: int = 12) -> list:
    """Most-recent-first history of a user's scans for one domain."""
    try:
        res = (
            get_client()
            .table("scans")
            .select("sections, signal, created_at")
            .eq("user_id", user_id)
            .eq("domain", domain)
            .order("created_at", desc=True)
            .limit(limit)
            .execute()
        )
        return res.data or []
    except Exception as e:
        print(f"[db] get_scan_timeline failed: {e}")
        return []


def compute_and_persist_rank(user_id: str) -> dict:
    """
    Compute the server-side founder rank for a user using current profile data
    + latest brain card signals, then persist score / rank / tier to profiles.

    Authoritative — frontend client-side computation is a fallback for users
    who haven't completed enough signals yet. This is what powers Discover,
    matching, and the public profile card.

    Soft-fails on any DB hiccup so callers (upload, github_lookup,
    linkedin_lookup) never break on a rank computation issue.

    Returns the computed result dict (or empty dict on failure).
    """
    try:
        from services.founder_score import compute_founder_score
        supabase = get_client()
        res = (
            supabase.table("profiles")
            .select(
                "school, linkedin, age, github_quality, linkedin_quality, "
                "founder_signal, big_tech_employer, gender"
            )
            .eq("id", user_id)
            .limit(1)
            .execute()
        )
        profile = (res.data or [{}])[0]
        signal = profile.get("founder_signal") or {}

        # Defensive int parse — `age` is stored as int but may come back as string
        age_val = profile.get("age")
        try:
            age_int = int(age_val) if age_val is not None else None
        except (TypeError, ValueError):
            age_int = None

        result = compute_founder_score(
            domain_obsession=signal.get("domain_obsession"),
            emotional_stability=signal.get("emotional_stability_signal"),
            shipped_before=bool(signal.get("shipped_before")),
            implied_intelligence=signal.get("implied_intelligence"),
            school=profile.get("school"),
            linkedin_present=bool(profile.get("linkedin")),
            age=age_int,
            github_quality=profile.get("github_quality"),
            linkedin_quality=profile.get("linkedin_quality"),
            # The fields below default off until we have OAuth / parsed data.
            # `big_tech_employer` is set by the LinkedIn lookup route when the
            # latest_company matches the big-tech list.
            big_tech_employer=bool(profile.get("big_tech_employer")),
            female_founder=(profile.get("gender") or "").lower().strip() in ("female", "woman", "f"),
        )

        supabase.table("profiles").update({
            "founder_score": result["score"],
            "founder_rank": result["rank"],
            "founder_tier": result["tier"],
        }).eq("id", user_id).execute()

        return result
    except Exception as e:
        print(f"[db] compute_and_persist_rank failed: {e}")
        return {}
