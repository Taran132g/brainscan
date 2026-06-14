"""
Per-agent setup — let a signed-in user configure their own PAIS agents:
required info (some prefilled from their brain), personal secrets (Telegram
token, API keys), and a schedule or webhook trigger.

Secrets are encrypted at rest with Fernet (AGENT_SECRET_KEY in env) and never
returned to the client — the API only reports whether each secret is set.

Storage is a per-user JSON file (MVP; no DDL on the box). Execution of the
configured workflows happens in the user's own runtime (the desktop agent,
coming later) — this layer captures config, prefills from the brain, and issues
webhook trigger URLs so the runtime can run them.

Endpoints (all auth'd via Supabase JWT):
  GET  /api/agents/schema                 → field schema for connections + agents
  GET  /api/agents/config                 → this user's config (secrets masked)
  POST /api/agents/config                 → save/merge config (encrypts secrets)
  POST /api/agents/prefill/{agent}        → suggest field values from their brain
  POST /api/agents/run/{agent}            → trigger a run (queued; needs runtime)
"""

import json
import os
import re
import threading
import time
import uuid
from pathlib import Path
from typing import Optional

from cryptography.fernet import Fernet
from fastapi import APIRouter, Body, Depends, HTTPException

from services.auth import get_current_user_id
from services.embedder import embed_query
from services.vector_store import query_namespace
from services import llm
from services import entitlements

router = APIRouter()

CONFIG_DIR = Path(__file__).resolve().parent.parent / "agent_configs"
CONFIG_DIR.mkdir(exist_ok=True)
MSG_DIR = Path(__file__).resolve().parent.parent / "agent_messages"
MSG_DIR.mkdir(exist_ok=True)
MAX_MESSAGES = 200
MAX_MSG_CHARS = 12000   # feed messages are descriptive reports — don't clip them
SECRET_SENTINEL = "__SET__"   # client sends this to mean "keep existing secret"
PREFILL_MODEL = os.getenv("PAIS_PREFILL_MODEL", "claude-haiku-4-5-20251001")  # fast field extraction
BRIDGE_BRAIN_USERS = {u.strip() for u in os.getenv("BRIDGE_BRAIN_USER_IDS", "").split(",") if u.strip()}

# ── schema ────────────────────────────────────────────────────────────────────
# Agents now message you ON THE WEBSITE (a per-user feed), not Telegram — so the
# only connections left are keys an agent genuinely needs to do external work.
CONNECTIONS = [
    {"key": "gmail_address",      "label": "Gmail address",      "secret": False, "hint": "the account outreach sends from"},
    {"key": "gmail_app_password", "label": "Gmail app password", "secret": True,  "hint": "Google account → App passwords"},
    {"key": "hunter_api_key",     "label": "Hunter.io API key",  "secret": True,  "hint": "finds contact emails for outreach"},
]
SECRET_KEYS = {c["key"] for c in CONNECTIONS if c["secret"]}

# Each agent is a teammate: a title + role + an editable persona (how it works),
# the connections it needs, brain-prefillable fields, and a prefill query.
AGENTS = {
    "assistant": {"title": "Chief of Staff", "role": "Orchestrator", "needs": [], "fields": [],
                  "persona": "You are the user's chief of staff. Coordinate the team, answer from their brain, and run general tasks.",
                  "prefill_query": "who this person is, what they're building, their current focus and goals"},
    "briefing": {"title": "Briefing", "role": "Daily analyst", "needs": [], "fields": [],
                 "persona": "You write a thorough daily brief — what happened, what's open, what matters next. "
                            "Lead with the most important item, then cover EVERY active project and thread with "
                            "specifics: names, numbers, dates, statuses, and the exact next action for each.",
                 "prefill_query": "the projects and threads this person wants briefed on"},
    "career": {"title": "Career", "role": "Recruiter", "needs": [],
               "fields": [{"key": "target_roles", "label": "Target roles", "prefill": True},
                          {"key": "locations", "label": "Locations", "prefill": True}],
               "persona": "You scout internships/jobs that fit the user and rank by fit. Post a detailed report: "
                          "every role found with company, title, location, link, and WHY it fits (or doesn't) — "
                          "plus which ones to apply to first and what to tailor.",
               "prefill_query": "the job roles, industries, companies and locations this person is targeting"},
    "apply": {"title": "Job Apply", "role": "Application filler", "needs": [], "fields": [],
              "attention": True,
              "persona": "You fill the user's scouted job applications in browser windows ON THEIR COMPUTER. "
                         "Windows open one by one with the application brief; every window is left open. "
                         "You ALWAYS need the user's attention to finish: they review each filled form, "
                         "attach their résumé, and click Submit themselves. Nothing is submitted without them.",
              "prefill_query": "the jobs, companies and roles this person is actively applying to"},
    "outreach": {"title": "Outreach", "role": "BD rep",
                 "needs": ["gmail_address", "gmail_app_password", "hunter_api_key"],
                 "fields": [{"key": "sender_name", "label": "Your name", "prefill": True},
                            {"key": "company", "label": "Company / project", "prefill": True},
                            {"key": "voice", "label": "Outreach voice", "prefill": True}],
                 "persona": "You draft warm, specific outreach in the user's voice and find contact emails. "
                            "Post the FULL drafts for review — complete subject + body for each lead, who it "
                            "targets and why you angled it that way, plus the contact email found and its source.",
                 "prefill_query": "this person's name, company/project, outreach voice, and who they reach out to"},
    "email": {"title": "Email", "role": "Inbox analyst",
              "needs": ["gmail_address", "gmail_app_password"],
              "fields": [{"key": "priorities", "label": "What to flag / who matters", "prefill": True}],
              "persona": "You triage the user's Gmail, classify by priority, and post a detailed prioritized "
                         "digest — action-needed first. For each email that matters: sender, subject, what it "
                         "says, why it's urgent (or not), and the suggested reply or action. Count what you skipped and why.",
              "prefill_query": "the people, companies, and topics whose emails matter most to this person; what they consider urgent"},
    "linkedin": {"title": "LinkedIn", "role": "Networker",
                 "needs": [],
                 "fields": [{"key": "targets", "label": "Target companies / people", "prefill": True},
                            {"key": "goal", "label": "Networking goal", "prefill": True}],
                 "persona": "You draft one warm LinkedIn connection note + a post-accept message per day toward "
                            "the user's networking goal. Post both messages IN FULL, who the target is (name, "
                            "role, company, mutual context), why you picked them today, and what to say if they reply.",
                 "prefill_query": "the companies, roles, and people this person wants to network with for their career/internship goals"},
    "code": {"title": "Code", "role": "Engineer",
             "needs": [],
             "fields": [{"key": "repos", "label": "Repos to sync", "prefill": True}],
             "persona": "You commit and push the user's active repos behind a secret/PII guard, and report what "
                        "shipped in detail: per repo — files changed, commit messages, what the changes do, "
                        "anything the guard blocked and why, and any repo left dirty or unpushed.",
             "prefill_query": "the code projects, repos, and tech the user is actively building"},
    "reviewer": {"title": "Reviewer", "role": "Routine auditor", "needs": [], "fields": [],
                 "persona": "You run LAST, after the whole routine has executed. Read each teammate's "
                            "LATEST OUTPUT in the ROUTINE data and judge it: was it useful, specific, "
                            "and on-target, or weak/empty? Then suggest concrete improvements to the AGENT "
                            "routine — which agents underperformed and how to fix their setup, better ordering "
                            "or timing, missing or redundant agents, and gaps versus the user's goals. Quote "
                            "or reference the actual outputs. This is strictly about the agent team's "
                            "performance — not personal or health habits.",
                 "prefill_query": "the user's career, projects, job search and outreach that an AI agent team should automate"},
}
# Editable descriptive parts a user can tweak per agent.
PROFILE_KEYS = ("display_name", "role", "persona")


def _fernet() -> Fernet:
    key = os.getenv("AGENT_SECRET_KEY")
    if not key:
        raise HTTPException(503, "Secret store not configured (AGENT_SECRET_KEY).")
    return Fernet(key.encode())


def _path(user_id: str) -> Path:
    safe = re.sub(r"[^a-zA-Z0-9_-]", "", user_id)
    return CONFIG_DIR / f"{safe}.json"


DEFAULT_ROUTINE = {"cron": "30 7 * * *", "order": []}

# The routine ALWAYS runs in this canonical order — briefing → career →
# linkedin → email → outreach → code (→ apply) → reviewer — regardless of the
# sequence agents were enabled in. Enabling/disabling only changes membership.
CANON_ORDER = ["briefing", "career", "linkedin", "email", "outreach", "code", "apply"]


def _canonical(order: list) -> list:
    members = [a for a in dict.fromkeys(order) if a in AGENTS]

    def rank(a: str) -> int:
        if a == "reviewer":
            return 99                      # reviewer is always last
        return CANON_ORDER.index(a) if a in CANON_ORDER else 50

    return sorted(members, key=rank)


def _load_raw(user_id: str) -> dict:
    p = _path(user_id)
    if not p.exists():
        return {"connections": {}, "agents": {}, "routine": dict(DEFAULT_ROUTINE)}
    try:
        data = json.loads(p.read_text())
        data.setdefault("routine", dict(DEFAULT_ROUTINE))
        return data
    except Exception:
        return {"connections": {}, "agents": {}, "routine": dict(DEFAULT_ROUTINE)}


def _save_raw(user_id: str, data: dict) -> None:
    _path(user_id).write_text(json.dumps(data, indent=2))


def _decrypt(token: str) -> str:
    try:
        return _fernet().decrypt(token.encode()).decode()
    except Exception:
        return ""


# ── endpoints ─────────────────────────────────────────────────────────────────

@router.get("/agents/schema")
async def schema(_uid: str = Depends(get_current_user_id)):
    return {"connections": CONNECTIONS, "agents": AGENTS}


@router.get("/agents/config")
async def get_config(user_id: str = Depends(get_current_user_id)):
    """Return the user's config with secrets masked to a boolean 'is set'."""
    raw = _load_raw(user_id)
    conns = {}
    for c in CONNECTIONS:
        v = raw.get("connections", {}).get(c["key"])
        conns[c["key"]] = (bool(v) if c["secret"] else (v or ""))
    routine = raw.get("routine", dict(DEFAULT_ROUTINE))
    routine["order"] = _canonical(routine.get("order", []))   # fixed sequence, reviewer last
    return {"connections": conns, "agents": raw.get("agents", {}), "routine": routine}


@router.post("/agents/config")
async def save_config(body: dict = Body(...), user_id: str = Depends(get_current_user_id)):
    raw = _load_raw(user_id)
    raw.setdefault("connections", {})
    raw.setdefault("agents", {})

    # Connections — encrypt secrets, keep existing when sentinel/blank is sent.
    for key, val in (body.get("connections") or {}).items():
        if key in SECRET_KEYS:
            if val in (None, "", SECRET_SENTINEL):
                continue  # leave the stored secret untouched
            raw["connections"][key] = _fernet().encrypt(str(val).encode()).decode()
        else:
            raw["connections"][key] = str(val)

    # Per-agent settings (enabled / trigger / cron / non-secret fields).
    for agent, cfg in (body.get("agents") or {}).items():
        if agent not in AGENTS:
            continue
        cur = raw["agents"].setdefault(agent, {})
        for k in ("enabled", "trigger", "cron"):
            if k in cfg:
                cur[k] = cfg[k]
        for k in PROFILE_KEYS:           # editable descriptive parts
            if k in cfg:
                cur[k] = str(cfg[k])[:600]
        if "fields" in cfg and isinstance(cfg["fields"], dict):
            cur.setdefault("fields", {}).update({k: str(v) for k, v in cfg["fields"].items()})
        # Each agent gets a stable webhook token for "press to run".
        if "webhook_id" not in cur:
            cur["webhook_id"] = uuid.uuid4().hex

    # Morning routine — the ordered queue + its single schedule.
    if "routine" in body and isinstance(body["routine"], dict):
        r = raw.setdefault("routine", dict(DEFAULT_ROUTINE))
        if "cron" in body["routine"]:
            r["cron"] = str(body["routine"]["cron"])
        if "order" in body["routine"] and isinstance(body["routine"]["order"], list):
            r["order"] = _canonical(body["routine"]["order"])   # stored canonical

    _save_raw(user_id, raw)
    return await get_config(user_id)


def _msg_path(user_id: str) -> Path:
    return MSG_DIR / f"{re.sub(r'[^a-zA-Z0-9_-]', '', user_id)}.json"


@router.get("/agents/messages")
async def get_messages(agent: Optional[str] = None, user_id: str = Depends(get_current_user_id)):
    """The team's messages to the user, posted on the website (newest last)."""
    p = _msg_path(user_id)
    msgs = json.loads(p.read_text()) if p.exists() else []
    if agent:
        msgs = [m for m in msgs if m.get("agent") == agent]
    return {"messages": msgs[-100:]}


@router.post("/agents/message")
async def post_message(body: dict = Body(...), user_id: str = Depends(get_current_user_id)):
    """An agent (usually the desktop runtime) posts a message to the user's feed."""
    agent = str(body.get("agent") or "").strip()
    text = str(body.get("text") or "").strip()
    if agent not in AGENTS or not text:
        raise HTTPException(400, "agent + text required")
    if user_id not in BRIDGE_BRAIN_USERS:
        _stamp_runtime(user_id)              # runtime heartbeat
    p = _msg_path(user_id)
    msgs = json.loads(p.read_text()) if p.exists() else []
    msgs.append({"agent": agent, "text": text[:MAX_MSG_CHARS], "ts": int(time.time() * 1000)})
    p.write_text(json.dumps(msgs[-MAX_MESSAGES:], ensure_ascii=False))
    return {"ok": True}


@router.get("/agents/secrets")
async def get_secrets(user_id: str = Depends(get_current_user_id)):
    """
    Owner-only: return the caller's OWN decrypted connections for their desktop
    runtime to use. Scoped to the authenticated user — you can only ever pull
    your own secrets, over TLS. Never logged.
    """
    _stamp_runtime(user_id)                  # runtime heartbeat
    raw = _load_raw(user_id)
    conns = {}
    for k, v in raw.get("connections", {}).items():
        conns[k] = _decrypt(v) if k in SECRET_KEYS else v
    return {"connections": conns, "agents": raw.get("agents", {})}


def _brain_chunks(user_id: str, query: str) -> str:
    try:
        if user_id in BRIDGE_BRAIN_USERS:
            chunks = llm.search(query, top_k=14)          # local Mac brain, no credits
        else:
            chunks = query_namespace(user_id, embed_query(query), top_k=14)
    except Exception:
        chunks = []
    return "\n\n".join((c.get("text") or "")[:650] for c in chunks if c.get("text"))[:8000]


def _prefill_agent(user_id: str, agent: str) -> dict:
    """Mine the brain for an agent: DESCRIPTIVE field values + a rich persona,
    so the agent has the most context to do its best work."""
    spec = AGENTS[agent]
    if user_id not in BRIDGE_BRAIN_USERS:
        return {"fields": {}, "persona": "", "grounded": False}
    context = _brain_chunks(user_id, spec["prefill_query"])
    if not context:
        return {"fields": {}, "persona": "", "grounded": False}
    fields = [f for f in spec["fields"] if f.get("prefill")]
    keys = [f["key"] for f in fields]
    field_lines = "\n".join(f'   - {f["key"]}: {f["label"]}' for f in fields) or "   (none)"
    prompt = (
        f"You are configuring the {spec['title']} agent ({spec.get('role','')}) for this person, "
        f"using ONLY their own notes below. Be specific and descriptive — give the agent maximum "
        f"context to do excellent work, naming real people, companies, projects, and details.\n\n"
        f"1) Fill each field with a detailed, specific value (not vague):\n{field_lines}\n"
        f"2) Write 'persona': 2-4 sentences on exactly how THIS agent should work for THIS person — "
        f"their goals, context, voice, and constraints.\n\n"
        f'Return ONLY JSON: {{"fields": {{{", ".join(chr(34)+k+chr(34)+": ..." for k in keys)}}}, "persona": "..."}}\n'
        f"If a field isn't supported by the notes, give a sensible default rather than blank.\n\n"
        f"NOTES:\n{context}"
    )
    try:
        text = llm.complete(prompt, model=PREFILL_MODEL, timeout=120)
        m = re.search(r"\{.*\}", text, re.S)
        data = json.loads(m.group(0)) if m else {}
        fdata = data.get("fields") if isinstance(data.get("fields"), dict) else {}
        out = {k: str(fdata.get(k, "")).strip() for k in keys}
        persona = str(data.get("persona", "")).strip()[:600]
    except Exception:
        out, persona = {k: "" for k in keys}, ""
    return {"fields": out, "persona": persona, "grounded": True}


@router.post("/agents/prefill/{agent}")
def prefill(agent: str, user_id: str = Depends(get_current_user_id)):
    """Brain-prefill one agent: descriptive fields + persona."""
    if agent not in AGENTS:
        raise HTTPException(404, "unknown agent")
    return _prefill_agent(user_id, agent)


@router.post("/agents/prefill-all")
def prefill_all(user_id: str = Depends(get_current_user_id)):
    """When a brain is connected: prefill EVERY agent (descriptive fields +
    persona) and save it, so the whole team has maximum context at once."""
    raw = _load_raw(user_id)
    raw.setdefault("agents", {})
    done = []
    for agent in AGENTS:
        if agent == "assistant":
            continue
        spec = AGENTS[agent]
        cur = raw["agents"].setdefault(agent, {})
        # Skip if already fully filled — keeps this cheap after the first run.
        need_keys = [f["key"] for f in spec["fields"] if f.get("prefill")]
        already = cur.get("persona") and all((cur.get("fields") or {}).get(k) for k in need_keys)
        if already:
            continue
        res = _prefill_agent(user_id, agent)
        if not res["grounded"]:
            continue
        # Only fill what the user hasn't already set, so we never clobber edits.
        if res.get("persona") and not cur.get("persona"):
            cur["persona"] = res["persona"]
        cur.setdefault("fields", {})
        for k, v in res["fields"].items():
            if v and not cur["fields"].get(k):
                cur["fields"][k] = v
        done.append(agent)
    _save_raw(user_id, raw)
    return {"prefilled": done}


RUNTIME_FRESH_MS = 26 * 3600 * 1000     # daily routine cadence + slack


def _stamp_runtime(user_id: str) -> None:
    raw = _load_raw(user_id)
    raw["runtime_seen"] = int(time.time() * 1000)
    _save_raw(user_id, raw)


def runtime_connected(user_id: str) -> bool:
    """Has this user's desktop runtime synced recently? (Owner: always true.)"""
    if user_id in BRIDGE_BRAIN_USERS:
        return True
    seen = _load_raw(user_id).get("runtime_seen", 0)
    return (int(time.time() * 1000) - seen) < RUNTIME_FRESH_MS


def _append_message(user_id: str, agent: str, text: str) -> None:
    p = _msg_path(user_id)
    msgs = json.loads(p.read_text()) if p.exists() else []
    msgs.append({"agent": agent, "text": text[:MAX_MSG_CHARS], "ts": int(time.time() * 1000)})
    p.write_text(json.dumps(msgs[-MAX_MESSAGES:], ensure_ascii=False))


# In-flight background runs: user_id → {agent: {state, started, finished, result}}.
# In-memory is fine — single uvicorn process; a restart just clears stale status.
RUNS: dict = {}
_RUNS_LOCK = threading.Lock()
RUNS_FILE = CONFIG_DIR.parent / "agent_runs.json"


def _persist() -> None:
    try:
        RUNS_FILE.write_text(json.dumps(RUNS))
    except Exception:
        pass


# Reload run state across restarts; anything mid-flight when the server died
# is marked interrupted (the worker thread died with the process).
try:
    RUNS.update(json.loads(RUNS_FILE.read_text()))
    for _u, _d in RUNS.items():
        for _k, _v in list(_d.items()):
            if isinstance(_v, dict) and _v.get("state") == "running":
                _v.update({"state": "done", "finished": int(time.time() * 1000)})
                if _k == "__routine":
                    _v["stopped"] = True
                else:
                    _v["result"] = {"ran": False, "agent": _k,
                                    "message": "Interrupted by a server restart — run it again."}
except Exception:
    pass


def _execute_run(user_id: str, agent: str) -> dict:
    """
    The actual work of one agent run (blocking — real scripts take minutes).
    For the owner this executes on the Mac (bridge → real n8n scripts + brain);
    the reviewer runs server-side for everyone. Posts to the feed on success.
    """
    raw = _load_raw(user_id)
    spec = AGENTS[agent]
    have = raw.get("connections", {})
    # Owner scripts read keys from the Mac's own .env — web-stored keys not needed.
    missing = [] if user_id in BRIDGE_BRAIN_USERS else [n for n in spec["needs"] if not have.get(n)]
    if missing:
        return {"ran": False, "agent": agent, "missing": missing,
                "message": f"Add the required info first: {', '.join(missing)}."}

    acfg = raw.get("agents", {}).get(agent, {})
    persona = acfg.get("persona") or spec.get("persona", "")
    fields = dict(acfg.get("fields", {}))
    # The reviewer runs last and grades each teammate's LATEST output, then
    # suggests how the routine can improve.
    if agent == "reviewer":
        rt = raw.get("routine", {})
        order = _canonical(rt.get("order", []))
        mp = _msg_path(user_id)
        allmsgs = json.loads(mp.read_text()) if mp.exists() else []
        latest = {}
        for m in allmsgs:                      # newest message per agent wins
            if m.get("agent") not in (None, "reviewer"):
                latest[m["agent"]] = m.get("text", "")
        agent_ids = order or [a for a in latest if a in AGENTS]
        outputs = [{"agent": a, "role": AGENTS.get(a, {}).get("role", ""),
                    "latest_output": (latest.get(a) or "(no output yet)")[:1500]}
                   for a in dict.fromkeys(agent_ids)]
        enabled = {a: bool(c.get("enabled")) for a, c in raw.get("agents", {}).items()
                   if a in AGENTS and a not in ("assistant", "reviewer")}
        fields["ROUTINE"] = (
            f"schedule={rt.get('cron')}; run-order={order}; enabled={json.dumps(enabled)}; "
            f"agent_outputs={json.dumps(outputs, ensure_ascii=False)}"
        )

    if user_id in BRIDGE_BRAIN_USERS:
        try:
            text = llm.run_agent(agent=agent, persona=persona, fields=fields,
                                 query=spec["prefill_query"], web=(agent == "career"))
        except llm.BridgeOffline:
            return {"ran": False, "agent": agent, "message": "Your Mac runtime is offline — wake it and try again."}
        except Exception as e:
            return {"ran": False, "agent": agent, "message": f"Couldn't run: {e}"}
        _append_message(user_id, agent, text)
        return {"ran": True, "agent": agent, "text": text}

    # Non-owner: nothing executes server-side — their desktop runtime runs every
    # agent on THEIR OWN Claude subscription. The owner's bridge is owner-only.
    if not runtime_connected(user_id):
        return {"ran": False, "agent": agent,
                "message": "Connect your desktop runtime first — your agents run on "
                           "your own machine and your own Claude subscription."}
    return {"ran": False, "agent": agent,
            "message": f"{spec['title']} is configured. Connect your desktop and it runs on schedule."}


@router.post("/agents/run/{agent}")
def run(agent: str, bg: int = 0, user_id: str = Depends(get_current_user_id)):
    """
    Run an agent. `?bg=1` starts it in the background and returns immediately —
    poll /agents/run-status until done (real runs take minutes; this keeps the
    HTTP request well under any proxy timeout). Without bg it blocks (legacy).
    """
    if agent not in AGENTS:
        raise HTTPException(404, "unknown agent")
    entitlements.enforce(user_id, agent)            # free tier / Pro gate
    if not bg:
        return _execute_run(user_id, agent)

    now = int(time.time() * 1000)
    with _RUNS_LOCK:
        cur = RUNS.setdefault(user_id, {})
        if (cur.get(agent) or {}).get("state") == "running":
            return {"queued": True, "agent": agent, "already": True}
        cur[agent] = {"state": "running", "started": now, "finished": None, "result": None}
        _persist()

    def _job():
        try:
            res = _execute_run(user_id, agent)
        except Exception as e:
            res = {"ran": False, "agent": agent, "message": f"Couldn't run: {e}"}
        with _RUNS_LOCK:
            RUNS.setdefault(user_id, {})[agent] = {
                "state": "done", "started": now,
                "finished": int(time.time() * 1000), "result": res}
        _persist()

    threading.Thread(target=_job, daemon=True).start()
    return {"queued": True, "agent": agent}


@router.post("/agents/routine-ctl")
def routine_ctl(body: dict = Body(...), user_id: str = Depends(get_current_user_id)):
    """Control a running routine: pause / resume / stop / skip (next boundary)."""
    action = str(body.get("action") or "")
    if action not in ("pause", "resume", "stop", "skip"):
        raise HTTPException(400, "action must be pause|resume|stop|skip")
    with _RUNS_LOCK:
        rt = RUNS.get(user_id, {}).get("__routine")
        if not rt or rt.get("state") != "running":
            return {"ok": False, "message": "No routine is running."}
        if action == "resume":
            rt["ctl"] = "run"
        elif action == "skip":
            rt["skip"] = True
        else:
            rt["ctl"] = action
    _persist()
    return {"ok": True, "action": action}


@router.post("/agents/run-ctl")
def run_ctl(body: dict = Body(...), user_id: str = Depends(get_current_user_id)):
    """Stop ONE running agent (owner: kills the script on the Mac via the bridge)."""
    agent = str(body.get("agent") or "")
    if user_id not in BRIDGE_BRAIN_USERS or agent not in AGENTS:
        return {"ok": False}
    import requests as rq
    try:
        r = rq.post(f"{llm.BRIDGE_URL}/kill", json={"agent": agent},
                    headers={"Authorization": "Bearer " + llm.BRIDGE_TOKEN}, timeout=10)
        return r.json() if r.ok else {"ok": False}
    except Exception:
        return {"ok": False}


@router.get("/agents/run-status")
def run_status(agent: Optional[str] = None, user_id: str = Depends(get_current_user_id)):
    """State of this user's background runs: running / done (+result) / idle."""
    with _RUNS_LOCK:
        cur = {a: dict(s) for a, s in RUNS.get(user_id, {}).items()}
    if agent:
        return {"agent": agent, **(cur.get(agent) or {"state": "idle"})}
    return {"runs": cur}


@router.post("/agents/routine-run")
def routine_run(user_id: str = Depends(get_current_user_id)):
    """
    Run the WHOLE routine server-side in one background thread — canonical
    order, reviewer last. Survives page reloads: the browser only watches
    /agents/run-status; closing the tab never kills the routine.
    """
    raw = _load_raw(user_id)
    order = _canonical(raw.get("routine", {}).get("order", []))
    seq = [a for a in order if a != "reviewer"] + ["reviewer"]
    allowed = entitlements.allowed_agents(user_id)
    if "*" not in allowed:
        seq = [a for a in seq if a in allowed]
    if not seq or seq == ["reviewer"] and not order:
        return {"started": False, "message": "Your routine is empty — activate agents in their settings."}

    now = int(time.time() * 1000)
    with _RUNS_LOCK:
        cur = RUNS.setdefault(user_id, {})
        rt = cur.get("__routine")
        if rt and rt.get("state") == "running":
            return {"started": True, "already": True, "seq": rt.get("seq", seq)}
        cur["__routine"] = {"state": "running", "seq": seq, "current": seq[0],
                            "started": now, "finished": None, "ok": 0}
        for a in seq:
            cur[a] = {"state": "pending", "started": None, "finished": None, "result": None}
        _persist()

    def _job():
        ok = 0
        for a in seq:
            # honor pause/stop/skip at agent boundaries (in-flight agents finish)
            while True:
                with _RUNS_LOCK:
                    rt = RUNS[user_id]["__routine"]
                    ctl = rt.get("ctl", "run"); skip = rt.pop("skip", False)
                if ctl == "stop":
                    with _RUNS_LOCK:
                        RUNS[user_id]["__routine"].update({"state": "done", "current": None,
                            "finished": int(time.time() * 1000), "ok": ok, "stopped": True})
                        _persist()
                    return
                if skip:
                    with _RUNS_LOCK:
                        RUNS[user_id][a] = {"state": "done", "started": int(time.time()*1000),
                            "finished": int(time.time()*1000),
                            "result": {"ran": False, "agent": a, "message": "Skipped by you."}}
                        _persist()
                    break
                if ctl != "pause":
                    break
                time.sleep(2)
            else:
                continue
            if skip:
                continue
            t0 = int(time.time() * 1000)
            with _RUNS_LOCK:
                RUNS[user_id]["__routine"]["current"] = a
                RUNS[user_id][a] = {"state": "running", "started": t0, "finished": None, "result": None}
                _persist()
            try:
                res = _execute_run(user_id, a)
            except Exception as e:
                res = {"ran": False, "agent": a, "message": f"Couldn't run: {e}"}
            if res.get("ran"):
                ok += 1
            with _RUNS_LOCK:
                RUNS[user_id][a] = {"state": "done", "started": t0,
                                    "finished": int(time.time() * 1000), "result": res}
                RUNS[user_id]["__routine"]["ok"] = ok
                _persist()
        with _RUNS_LOCK:
            RUNS[user_id]["__routine"].update(
                {"state": "done", "current": None, "finished": int(time.time() * 1000), "ok": ok})
            _persist()

    threading.Thread(target=_job, daemon=True).start()
    return {"started": True, "seq": seq}


@router.get("/agents/leads")
def leads(agent: str = "outreach", user_id: str = Depends(get_current_user_id)):
    """Per-agent pipeline data (owner: from the Mac bridge)."""
    if user_id not in BRIDGE_BRAIN_USERS:
        return {"items": []}
    import requests as rq
    try:
        r = rq.post(f"{llm.BRIDGE_URL}/leads", json={"agent": agent},
                    headers={"Authorization": "Bearer " + llm.BRIDGE_TOKEN}, timeout=10)
        return {"items": r.json().get("items", [])} if r.ok else {"items": []}
    except Exception:
        return {"items": []}


@router.get("/agents/account")
def account(user_id: str = Depends(get_current_user_id)):
    """Plan, trial days left, chosen free agent, and which agents are unlocked."""
    st = entitlements.status(user_id)
    st["allowed"] = entitlements.allowed_agents(user_id)
    return st


@router.post("/agents/choose/{agent}")
def choose(agent: str, user_id: str = Depends(get_current_user_id)):
    """Lock in the user's one free agent (besides Briefing)."""
    if agent not in AGENTS or agent in ("assistant", "briefing"):
        raise HTTPException(400, "pick a non-briefing agent")
    return entitlements.choose(user_id, agent)


@router.post("/agents/run-routine")
async def run_routine(user_id: str = Depends(get_current_user_id)):
    """Return the ordered morning-routine plan + per-step readiness (the runtime
    runs them sequentially, like morning_stack.sh)."""
    raw = _load_raw(user_id)
    have = raw.get("connections", {})
    order = _canonical(raw.get("routine", {}).get("order", []))
    plan = []
    for a in order:
        missing = [n for n in AGENTS[a]["needs"] if not have.get(n)]
        plan.append({"agent": a, "title": AGENTS[a]["title"], "ready": not missing, "missing": missing})
    cron = raw.get("routine", {}).get("cron", DEFAULT_ROUTINE["cron"])
    return {"cron": cron, "steps": plan,
            "message": f"Routine queued: {len(plan)} workflow(s). They run in order in your runtime." if plan
                       else "Your routine is empty — stack some workflows first."}
