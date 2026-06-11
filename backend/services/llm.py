"""
LLM bridge client — routes all model calls to Taran's Mac (claude -p over a
reverse SSH tunnel) instead of the metered Anthropic API. No API key, no credits.

The Mac runs pais_bridge.py; a reverse tunnel exposes it on this box's
localhost:8787. If the Mac is asleep/offline the call fails fast with
BridgeOffline, and routes surface a clean "AI offline" message.
"""

import os
import requests

BRIDGE_URL = os.getenv("BRIDGE_URL", "http://localhost:8787")
BRIDGE_TOKEN = os.getenv("BRIDGE_TOKEN", "")


class BridgeError(RuntimeError):
    pass


class BridgeOffline(BridgeError):
    pass


def complete(prompt: str, model: str | None = None, timeout: int = 240) -> str:
    """One completion via the Mac's Claude subscription. Returns the text."""
    if not BRIDGE_TOKEN:
        raise BridgeError("LLM bridge not configured (BRIDGE_TOKEN missing).")
    payload = {"prompt": prompt}
    if model:
        payload["model"] = model
    try:
        r = requests.post(f"{BRIDGE_URL}/llm", json=payload,
                          headers={"Authorization": "Bearer " + BRIDGE_TOKEN},
                          timeout=timeout)
    except requests.exceptions.RequestException:
        raise BridgeOffline("PAIS AI is offline right now — the Mac runtime isn't reachable.")
    if r.status_code == 401:
        raise BridgeError("Bridge auth failed.")
    if not r.ok:
        try:
            msg = r.json().get("error", "")
        except Exception:
            msg = ""
        raise BridgeError(f"Bridge error {r.status_code}: {msg}")
    return r.json().get("text", "")


def search(query: str, top_k: int = 12, timeout: int = 15) -> list:
    """Semantic search over the local vault brain on the Mac (Ollama + ChromaDB).
    Returns chunks [{text, title, file_path}]. No cloud, no credits."""
    if not BRIDGE_TOKEN:
        raise BridgeError("LLM bridge not configured (BRIDGE_TOKEN missing).")
    try:
        r = requests.post(f"{BRIDGE_URL}/search", json={"query": query, "top_k": top_k},
                          headers={"Authorization": "Bearer " + BRIDGE_TOKEN}, timeout=timeout)
    except requests.exceptions.RequestException:
        raise BridgeOffline("Brain is offline — the Mac runtime isn't reachable.")
    if not r.ok:
        raise BridgeError(f"Bridge search error {r.status_code}")
    return r.json().get("chunks", [])


def run_agent(agent: str, persona: str, fields: dict, query: str,
              web: bool = False, timeout: int = 900) -> str:
    """Run an agent's work on the Mac (brain + subscription, + WebSearch if web)."""
    if not BRIDGE_TOKEN:
        raise BridgeError("LLM bridge not configured.")
    try:
        r = requests.post(f"{BRIDGE_URL}/run-agent",
                          json={"agent": agent, "persona": persona, "fields": fields,
                                "query": query, "web": web},
                          headers={"Authorization": "Bearer " + BRIDGE_TOKEN}, timeout=timeout)
    except requests.exceptions.RequestException:
        raise BridgeOffline("Agent runtime is offline — your Mac isn't reachable.")
    if not r.ok:
        raise BridgeError(f"Bridge run error {r.status_code}")
    return r.json().get("text", "")


def brain_stats(timeout: int = 8) -> dict:
    """Local brain stats from the Mac bridge → {ready, notes, chunks}."""
    if not BRIDGE_TOKEN:
        raise BridgeError("LLM bridge not configured.")
    try:
        r = requests.post(f"{BRIDGE_URL}/stats", json={},
                          headers={"Authorization": "Bearer " + BRIDGE_TOKEN}, timeout=timeout)
    except requests.exceptions.RequestException:
        raise BridgeOffline("Brain is offline.")
    if not r.ok:
        raise BridgeError(f"Bridge stats error {r.status_code}")
    return r.json()
