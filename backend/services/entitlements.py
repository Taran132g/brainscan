"""
PAIS entitlements.

Free trial: the Briefing agent + ONE agent of the user's choosing work for 30
days. After that nothing runs until they're on PAIS Pro ($4.99/mo), which
unlocks every agent. The Control Room chat (assistant) is free during the trial.

State (trial_start, chosen_agent) lives in accounts/{user_id}.json. The plan is
read from the Supabase subscription (active sub == pro). The owner is always pro.
"""

import json
import os
import re
import time
from pathlib import Path

from fastapi import HTTPException

ACCT_DIR = Path(__file__).resolve().parent.parent / "accounts"
ACCT_DIR.mkdir(exist_ok=True)

TRIAL_MS = 30 * 24 * 60 * 60 * 1000
FREE_ALWAYS = {"assistant", "briefing"}          # chat + briefing, free during trial
OWNER_IDS = {u.strip() for u in os.getenv("BRIDGE_BRAIN_USER_IDS", "").split(",") if u.strip()}
UPGRADE_MSG = "Upgrade to PAIS Pro ($4.99/mo) to unlock every agent."


def _path(user_id: str) -> Path:
    return ACCT_DIR / f"{re.sub(r'[^a-zA-Z0-9_-]', '', user_id)}.json"


def _load(user_id: str) -> dict:
    p = _path(user_id)
    try:
        return json.loads(p.read_text()) if p.exists() else {}
    except Exception:
        return {}


def _save(user_id: str, data: dict) -> None:
    _path(user_id).write_text(json.dumps(data))


def get_plan(user_id: str) -> str:
    if user_id in OWNER_IDS:
        return "pro"
    try:
        from services.db import get_client
        res = get_client().table("profiles").select("subscription_status").eq("id", user_id).limit(1).execute()
        st = (res.data or [{}])[0].get("subscription_status")
        return "pro" if st in ("active", "trialing") else "free"
    except Exception:
        return "free"


def status(user_id: str) -> dict:
    plan = get_plan(user_id)
    acct = _load(user_id)
    now = int(time.time() * 1000)
    if not acct.get("trial_start"):
        acct["trial_start"] = now
        _save(user_id, acct)
    left_ms = TRIAL_MS - (now - acct["trial_start"])
    expired = plan == "free" and left_ms <= 0
    return {
        "plan": plan,
        "chosen_agent": acct.get("chosen_agent"),
        "trial_days_left": 0 if plan == "pro" else max(0, round(left_ms / 86400000, 1)),
        "trial_expired": expired,
        "free_always": sorted(FREE_ALWAYS - {"assistant"}),
        "price": "$4.99/mo",
    }


def allowed_agents(user_id: str) -> list:
    """Which agents this user can currently run ('*' = all)."""
    st = status(user_id)
    if st["plan"] == "pro":
        return ["*"]
    if st["trial_expired"]:
        return []
    agents = list(FREE_ALWAYS)
    if st["chosen_agent"]:
        agents.append(st["chosen_agent"])
    return agents


def choose(user_id: str, agent: str) -> dict:
    """Lock in the user's one free agent (only if not pro and not already set)."""
    if get_plan(user_id) == "pro":
        return status(user_id)
    acct = _load(user_id)
    if not acct.get("chosen_agent"):
        acct["chosen_agent"] = agent
        _save(user_id, acct)
    return status(user_id)


def enforce(user_id: str, agent: str, claim: bool = True) -> None:
    """Raise 402 if the user may not use this agent right now."""
    plan = get_plan(user_id)
    if plan == "pro":
        return
    acct = _load(user_id)
    now = int(time.time() * 1000)
    if not acct.get("trial_start"):
        acct["trial_start"] = now
    if now - acct["trial_start"] > TRIAL_MS:
        _save(user_id, acct)
        raise HTTPException(402, {"code": "trial_expired", "product": "pro",
                                  "message": "Your free month is up. " + UPGRADE_MSG})
    if agent in FREE_ALWAYS or acct.get("chosen_agent") == agent:
        _save(user_id, acct)
        return
    if not acct.get("chosen_agent") and claim:
        acct["chosen_agent"] = agent
        _save(user_id, acct)
        return
    _save(user_id, acct)
    raise HTTPException(402, {"code": "locked", "product": "pro",
                             "chosen_agent": acct.get("chosen_agent"),
                             "message": f"This agent needs PAIS Pro. Your free agent is "
                                        f"'{acct.get('chosen_agent')}'. {UPGRADE_MSG}"})
