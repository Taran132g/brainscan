#!/usr/bin/env python3
"""FindingFounders — daily new-signup + fresh-match digest (built for n8n 2026-05-31).

Reuses the existing backend services (no new infra):
  - services.db.get_client()         → Supabase profiles
  - services.match_service.find_matches → Pinecone-backed co-founder matches

Run (from the n8n Execute Command node):
    ~/FindingFounders/backend/venv/bin/python3 \
        ~/FindingFounders/backend/scripts/daily_digest.py

Sends a Telegram summary using the agentic_os bot creds. Set DIGEST_DRY=1 to
print the digest to stdout WITHOUT sending Telegram (for testing n8n wiring).

Window defaults to the last 24h; override with DIGEST_HOURS=48.
Exit 0 always (a digest with zero new users is still a successful run).
"""

import os
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

import requests
from dotenv import load_dotenv

BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))
load_dotenv(BACKEND_DIR / ".env")

# Telegram creds live in agentic_os/.env (shared PAIS bot).
load_dotenv(Path.home() / "agentic_os" / ".env")

from services.db import get_client
from services.match_service import find_matches


def _send_telegram(text: str) -> None:
    token = os.environ.get("TELEGRAM_BOT_TOKEN")
    chat_id = os.environ.get("TELEGRAM_CHAT_ID")
    if not token or not chat_id:
        print("! TELEGRAM creds missing — printing instead:\n", text)
        return
    resp = requests.post(
        f"https://api.telegram.org/bot{token}/sendMessage",
        json={"chat_id": int(chat_id), "text": text, "parse_mode": "HTML",
              "disable_web_page_preview": True},
        timeout=15,
    )
    if not resp.ok:
        print("! Telegram send failed:", resp.status_code, resp.text[:200])


def _top_match_line(user_id: str) -> str:
    """Best fresh match for a user, or '' if none."""
    try:
        matches = find_matches(user_id, top_k=1)
    except Exception as e:
        return f"   (match lookup failed: {e})"
    if not matches:
        return "   (no matches yet — needs a brain card)"
    m = matches[0]
    name = m.get("full_name") or m.get("name") or "a founder"
    comp = m.get("compatibility")
    comp_s = f"{round(comp)}%" if isinstance(comp, (int, float)) else "?"
    return f"   ↳ top match: <b>{name}</b> ({comp_s})"


def main() -> int:
    hours = int(os.environ.get("DIGEST_HOURS", "24"))
    since = datetime.now(timezone.utc) - timedelta(hours=hours)
    since_iso = since.isoformat()

    sb = get_client()
    res = (
        sb.table("profiles")
        .select("id, full_name, email, school, city, founder_tier, "
                "founder_score, brain_card, created_at")
        .gte("created_at", since_iso)
        .order("created_at", desc=True)
        .execute()
    )
    new_users = res.data or []

    today = datetime.now().strftime("%a %b %d")
    lines = [f"<b>🧭 FindingFounders — Daily Digest ({today})</b>",
             f"<i>Last {hours}h</i>", ""]

    if not new_users:
        lines.append("No new signups in this window.")
    else:
        lines.append(f"<b>{len(new_users)} new signup"
                     f"{'s' if len(new_users) != 1 else ''}:</b>")
        for u in new_users:
            name = u.get("full_name") or u.get("email") or "Unknown"
            tier = u.get("founder_tier") or "—"
            score = u.get("founder_score")
            score_s = f" · score {score}" if score is not None else ""
            where = " · ".join(x for x in (u.get("school"), u.get("city")) if x)
            lines.append(f"• <b>{name}</b> [{tier}{score_s}]"
                         + (f" — {where}" if where else ""))
            # Fresh match only meaningful once they have a brain card.
            if u.get("brain_card"):
                lines.append(_top_match_line(u["id"]))

    # Always include Taran's own freshest matches (his account is seeded).
    taran = (
        sb.table("profiles").select("id, full_name")
        .ilike("email", "%taran%").limit(1).execute()
    )
    if taran.data:
        t = taran.data[0]
        try:
            tm = find_matches(t["id"], top_k=3)
        except Exception:
            tm = []
        if tm:
            lines += ["", f"<b>Your top matches today:</b>"]
            for m in tm:
                nm = m.get("full_name") or "a founder"
                c = m.get("compatibility")
                c_s = f"{round(c)}%" if isinstance(c, (int, float)) else "?"
                lines.append(f"• {nm} — {c_s}")

    digest = "\n".join(lines)

    if os.environ.get("DIGEST_DRY") == "1":
        print(digest)
        return 0

    _send_telegram(digest)
    print(f"Digest sent — {len(new_users)} new users.")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as e:
        import traceback
        traceback.print_exc()
        print(f"DIGEST FAILED: {e}", file=sys.stderr)
        sys.exit(1)
