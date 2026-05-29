"""
Hinge-style opt-in connections.

A `matches` row is the canonical record of intent between two users. The
0001 schema enforces `user_a < user_b` (canonical_order) and 0006 adds a
unique constraint on the pair, so there is exactly one row per pair.

State, relative to the *requesting* user:
    connected         — both sides accepted → messaging unlocked
    pending_outgoing  — I accepted, they haven't decided yet
    pending_incoming  — they accepted, I haven't decided yet
    passed            — I declined (my side is explicitly false)
    none              — no row yet

Seeded demo founders (email prefix `seed.`) can't log in to accept, so when a
real user connects with one we auto-accept the seed side. That lets the connect
→ chat flow complete end-to-end in a demo without a second human.
"""

from datetime import datetime, timezone
from typing import Optional

from services.db import get_client

SEED_EMAIL_PREFIX = "seed."


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _canonical(me: str, other: str) -> tuple[str, str, bool]:
    """Return (user_a, user_b, me_is_a) with user_a < user_b."""
    if me < other:
        return me, other, True
    return other, me, False


def _status_for(me_accepted: Optional[bool], other_accepted: Optional[bool]) -> str:
    if me_accepted and other_accepted:
        return "connected"
    if me_accepted and not other_accepted:
        return "pending_outgoing"
    if me_accepted is False:
        return "passed"
    if other_accepted:
        return "pending_incoming"
    return "none"


def set_decision(me: str, other: str, accept: bool) -> dict:
    """
    Record the requesting user's accept/pass for a pair, creating the match row
    if needed. Auto-accepts the seed side. Returns the resulting connection.
    """
    if me == other:
        raise ValueError("Cannot connect with yourself")

    sb = get_client()
    user_a, user_b, me_is_a = _canonical(me, other)
    now = _now_iso()

    # Is the other party a seeded demo founder? If so, auto-accept their side.
    other_row = (
        sb.table("profiles").select("email").eq("id", other).limit(1).execute()
    )
    other_email = (other_row.data or [{}])[0].get("email") or ""
    other_is_seed = other_email.startswith(SEED_EMAIL_PREFIX)

    my_col = "user_a_accepted" if me_is_a else "user_b_accepted"
    my_at = "user_a_decision_at" if me_is_a else "user_b_decision_at"
    their_col = "user_b_accepted" if me_is_a else "user_a_accepted"
    their_at = "user_b_decision_at" if me_is_a else "user_a_decision_at"

    existing = (
        sb.table("matches")
        .select("id, user_a_accepted, user_b_accepted")
        .eq("user_a", user_a)
        .eq("user_b", user_b)
        .limit(1)
        .execute()
    )
    row = (existing.data or [None])[0]

    payload = {my_col: accept, my_at: now}
    # Only auto-accept the seed side on a positive connect, never on a pass.
    if accept and other_is_seed:
        payload[their_col] = True
        payload[their_at] = now

    if row:
        sb.table("matches").update(payload).eq("id", row["id"]).execute()
    else:
        payload.update({"user_a": user_a, "user_b": user_b})
        sb.table("matches").insert(payload).execute()

    # Read back the authoritative state
    fresh = (
        sb.table("matches")
        .select("id, user_a_accepted, user_b_accepted")
        .eq("user_a", user_a)
        .eq("user_b", user_b)
        .limit(1)
        .execute()
    )
    r = (fresh.data or [{}])[0]
    me_acc = r.get("user_a_accepted") if me_is_a else r.get("user_b_accepted")
    other_acc = r.get("user_b_accepted") if me_is_a else r.get("user_a_accepted")
    return {
        "match_id": r.get("id"),
        "other_user_id": other,
        "status": _status_for(me_acc, other_acc),
    }


def list_connections(me: str) -> list[dict]:
    """All of the requesting user's match rows, enriched with the other user's
    public-ish profile fields and a derived status."""
    sb = get_client()
    res = (
        sb.table("matches")
        .select(
            "id, user_a, user_b, user_a_accepted, user_b_accepted, "
            "user_a_decision_at, user_b_decision_at, created_at"
        )
        .or_(f"user_a.eq.{me},user_b.eq.{me}")
        .execute()
    )
    rows = res.data or []
    if not rows:
        return []

    other_ids = [r["user_b"] if r["user_a"] == me else r["user_a"] for r in rows]
    profiles: dict[str, dict] = {}
    if other_ids:
        pres = (
            sb.table("profiles")
            .select("id, full_name, city, school, founder_tier, founder_rank")
            .in_("id", other_ids)
            .execute()
        )
        profiles = {p["id"]: p for p in (pres.data or [])}

    out: list[dict] = []
    for r in rows:
        me_is_a = r["user_a"] == me
        other_id = r["user_b"] if me_is_a else r["user_a"]
        me_acc = r.get("user_a_accepted") if me_is_a else r.get("user_b_accepted")
        other_acc = r.get("user_b_accepted") if me_is_a else r.get("user_a_accepted")
        p = profiles.get(other_id, {})
        out.append({
            "match_id": r["id"],
            "other_user_id": other_id,
            "other_name": p.get("full_name") or "Founder",
            "other_city": p.get("city") or "",
            "other_school": p.get("school") or "",
            "other_tier": p.get("founder_tier") or "",
            "other_rank": p.get("founder_rank") or 0,
            "status": _status_for(me_acc, other_acc),
            "created_at": r.get("created_at"),
        })
    # Newest activity first
    out.sort(key=lambda c: c.get("created_at") or "", reverse=True)
    return out
