"""
PAIS chat — talk to your own digital brain.

Conversational RAG over the user's private Pinecone namespace (the same one
BrainScan ingests vaults into). Reuses the existing embedder + vector_store +
auth, so a logged-in user can ask their second brain questions from any device
(phone included) and get answers grounded in their own notes.

POST /api/chat
  body: { "message": "...", "history": [{"role","content"}, ...] }
  → { "reply": "...", "sources": [{"title","file_path"}], "grounded": bool }

Billing note: each call hits the Anthropic API (metered). Model is pinned to
Sonnet for cost control — Brain Card generation stays on Opus separately.
"""

import concurrent.futures
import os
from typing import List

from fastapi import APIRouter, Body, Depends, HTTPException

from services.auth import get_current_user_id
from services.embedder import embed_query
from services.vector_store import query_namespace
from services import llm
from services import entitlements

router = APIRouter()

CHAT_MODEL = os.getenv("PAIS_CHAT_MODEL", "claude-sonnet-4-6")
# Models a user may pick (all run on the subscription via the bridge).
ALLOWED_MODELS = {
    "claude-sonnet-4-6",
    "claude-opus-4-8",
    "claude-haiku-4-5-20251001",
}
TOP_K = int(os.getenv("PAIS_CHAT_TOP_K", "12"))
# Accounts whose brain is served by the local Mac bridge (Ollama + ChromaDB)
# instead of Pinecone — currently the owner, for credit-free end-to-end testing.
# Each future user would run their own bridge against their own vault.
BRIDGE_BRAIN_USERS = {u.strip() for u in os.getenv("BRIDGE_BRAIN_USER_IDS", "").split(",") if u.strip()}
MAX_HISTORY = 12          # cap turns sent back to the model
MAX_CONTEXT_CHARS = 8000  # cap retrieved context

# Shared pool for retrieval. We never join it, so a slow/rate-limited vector
# call that overruns the per-request timeout is abandoned (not awaited) — the
# request stays bounded and answers ungrounded.
_RETRIEVE_POOL = concurrent.futures.ThreadPoolExecutor(max_workers=4)


SYSTEM = """You are PAIS — the user's personal AI agent, speaking through their own second brain.

You are given excerpts retrieved from the user's private notes (Obsidian/Notion vault, journals, chat logs). Answer as a sharp, warm chief-of-staff who knows them well.

Rules:
- Ground every claim in the provided context. If the notes don't cover something, say so plainly rather than inventing — "I don't see anything in your brain about that yet."
- Be specific and cite what you're drawing on by note title when it helps trust.
- Mirror, don't flatter. It's fine to surface a real pattern or a growth edge if the notes show one.
- Keep answers tight and useful — this is often read on a phone."""

# Agent "modes" mirror PAIS's real multi-agent roster (orchestrator queues:
# career / finance / briefing / study / content / outreach / general). Each just
# re-frames the same brain-grounded assistant toward one job.
AGENTS = {
    "assistant": "",
    "career": "\n\nYou are in CAREER mode: focus on job search, internships, applications, networking, and resume positioning. Pull from their experience, skills, and goals in the notes.",
    "finance": "\n\nYou are in FINANCE mode: focus on money, markets, spending, and trading. Pull from their financial notes, statements, and market views. You are not a licensed advisor — frame as their own reasoning, not investment advice.",
    "briefing": "\n\nYou are in BRIEFING mode: give a crisp situational brief — what happened recently, what's open, what matters next. Lead with the most important item.",
    "study": "\n\nYou are in STUDY mode: focus on coursework, learning, and academic progress. Pull from their study notes and explain clearly.",
    "content": "\n\nYou are in CONTENT mode: focus on content ideas, scripts, hooks, and the creative pipeline. Pull from their content notes and voice.",
    "outreach": "\n\nYou are in OUTREACH mode: help draft warm, specific outreach and networking messages in their voice, grounded in who they are and who they're reaching.",
}


def _build_context(chunks: List[dict]) -> tuple[str, list]:
    """Assemble retrieved chunks into a context block + a dedoped source list."""
    blocks, sources, seen, total = [], [], set(), 0
    for c in chunks:
        text = (c.get("text") or "").strip()
        if not text:
            continue
        title = c.get("title") or c.get("file_path") or "note"
        heading = c.get("heading") or ""
        label = f"{title}{' · ' + heading if heading else ''}"
        block = f"### {label}\n{text}"
        if total + len(block) > MAX_CONTEXT_CHARS:
            break
        blocks.append(block)
        total += len(block)
        key = c.get("file_path") or title
        if key not in seen:
            seen.add(key)
            sources.append({"title": title, "file_path": c.get("file_path", "")})
    return "\n\n".join(blocks), sources


# sync `def` (not async): the bridge + retrieval calls are blocking, so FastAPI
# runs this in a worker thread and the single event loop stays responsive.
@router.get("/brain/status")
def brain_status(user_id: str = Depends(get_current_user_id)):
    """Is this user's brain connected, and how big? Owner → local Mac brain."""
    if user_id in BRIDGE_BRAIN_USERS:
        try:
            s = llm.brain_stats()
            return {"connected": bool(s.get("ready")), "source": "local",
                    "notes": s.get("notes", 0), "chunks": s.get("chunks", 0),
                    "updated": s.get("updated")}
        except llm.BridgeOffline:
            return {"connected": False, "source": "local", "offline": True}
        except Exception:
            return {"connected": False, "source": "local"}
    # Non-owner → Pinecone namespace (best-effort).
    try:
        from services.vector_store import _get_index
        stats = _get_index().describe_index_stats()
        ns = (stats.get("namespaces") or {}).get(f"user_{user_id}", {})
        n = ns.get("vector_count", 0)
        return {"connected": n > 0, "source": "pinecone", "chunks": n, "notes": None}
    except Exception:
        return {"connected": False, "source": "pinecone"}


@router.post("/chat")
def chat(
    body: dict = Body(...),
    user_id: str = Depends(get_current_user_id),
):
    message = (body.get("message") or "").strip()
    if not message:
        raise HTTPException(400, "message is required")
    if len(message) > 4000:
        raise HTTPException(400, "message too long")

    history = body.get("history") or []
    if not isinstance(history, list):
        history = []

    agent = str(body.get("agent") or "assistant").lower()
    entitlements.enforce(user_id, agent)            # Control Room chat free in trial; locked after
    system = SYSTEM + AGENTS.get(agent, "")
    model = body.get("model") if body.get("model") in ALLOWED_MODELS else CHAT_MODEL

    # 1. Retrieve from the user's private brain — bounded + graceful. Owner's
    # account uses the local Mac brain (bridge → Ollama + ChromaDB, no credits);
    # everyone else uses Pinecone. Either way, answer ungrounded rather than hang.
    if user_id in BRIDGE_BRAIN_USERS:
        retrieve = lambda: llm.search(message, top_k=TOP_K)
    else:
        retrieve = lambda: query_namespace(user_id, embed_query(message), top_k=TOP_K)
    chunks = []
    try:
        chunks = _RETRIEVE_POOL.submit(retrieve).result(timeout=12)  # abandon (don't join) on timeout
    except Exception:
        chunks = []

    context, sources = _build_context(chunks)
    grounded = bool(context)

    # 2. Assemble the conversation
    convo = []
    for turn in history[-MAX_HISTORY:]:
        role = turn.get("role")
        content = (turn.get("content") or "").strip()
        if role in ("user", "assistant") and content:
            convo.append({"role": role, "content": content[:4000]})

    user_block = (
        f"Context retrieved from your brain:\n\n{context}\n\n---\n\nQuestion: {message}"
        if grounded
        else f"(No relevant notes were found in your brain for this.)\n\nQuestion: {message}"
    )
    convo.append({"role": "user", "content": user_block})

    # 3. Generate — composed into a single prompt for the Claude CLI bridge.
    lines = [system, "", "--- Conversation ---"]
    for m in convo:
        lines.append(("User: " if m["role"] == "user" else "PAIS: ") + m["content"])
    lines.append("\nRespond as PAIS (plain text, no preamble):")
    prompt = "\n".join(lines)
    try:
        reply = llm.complete(prompt, model=model).strip()
    except llm.BridgeOffline as e:
        raise HTTPException(503, str(e))
    except llm.BridgeError as e:
        raise HTTPException(502, str(e))

    return {"reply": reply, "sources": sources, "grounded": grounded}
