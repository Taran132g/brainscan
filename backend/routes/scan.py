"""
Multi-domain scans — run any ScanDomain (founder / career / relationships) over
a user's already-uploaded vault, store the result append-only, and expose the
longitudinal diff.

`/upload` remains the founder scan. This parallel surface adds the other lenses
without touching the existing flow or matching.
"""

from fastapi import APIRouter, Depends, Body, Query
from fastapi.responses import JSONResponse

from services.auth import get_current_user_id
from services.scan_domains import DOMAINS, get_domain
from services.brain_card import generate_brain_card
from services.db import record_scan, get_latest_scans, get_scan_timeline

router = APIRouter()


@router.get("/scan/domains")
async def list_domains():
    """Available scan domains + their sensitivity/disclaimer (powers the UI picker)."""
    return JSONResponse({
        "domains": [
            {
                "id": d.id,
                "sensitivity": d.sensitivity,
                "disclaimer": d.disclaimer,
                "sections": list(d.section_titles.values()),
            }
            for d in DOMAINS.values()
        ]
    })


@router.post("/scan/me")
async def run_scans(body: dict = Body(default={}), user_id: str = Depends(get_current_user_id)):
    """
    Run one or more domain scans against the caller's indexed vault, store each
    append-only, and return the fresh cards. Requires an uploaded vault.
    """
    requested = body.get("domains") or []
    valid = [d for d in requested if d in DOMAINS]
    if not valid:
        return JSONResponse(
            {"detail": f"No valid domains. Choose from: {', '.join(DOMAINS)}"},
            status_code=400,
        )

    results: dict = {}
    for d in valid:
        try:
            card = generate_brain_card([], user_id=user_id, domain=d)
            sections = card.get("sections") or {}
            signal = card.get("signal") or {}
            if not sections:
                results[d] = {"error": "No vault content found — upload your digital brain first."}
                continue
            record_scan(user_id, d, sections, signal)
            dom = get_domain(d)
            results[d] = {
                "domain": d,
                "sections": sections,
                "signal": signal,
                "sensitivity": dom.sensitivity,
                "disclaimer": dom.disclaimer,
            }
        except Exception as e:
            results[d] = {"error": str(e)[:200]}

    return JSONResponse({"scans": results})


@router.get("/scan/me")
async def latest_scans(user_id: str = Depends(get_current_user_id)):
    """Latest scan per domain for the caller."""
    return JSONResponse({"latest": get_latest_scans(user_id)})


def _diff_signals(prev: dict, curr: dict) -> list:
    """Field-level changes between two signal snapshots (the longitudinal unlock)."""
    prev, curr = prev or {}, curr or {}
    changes = []
    for k, v in curr.items():
        if k in prev and prev[k] != v:
            changes.append({"field": k, "from": prev[k], "to": v})
    return changes


@router.get("/scan/me/timeline")
async def scan_timeline(domain: str = Query(...), user_id: str = Depends(get_current_user_id)):
    """
    History of a domain's scans (newest first) + a diff of the two most recent —
    "here's what shifted since last time."
    """
    if domain not in DOMAINS:
        return JSONResponse({"detail": "Unknown domain"}, status_code=400)
    scans = get_scan_timeline(user_id, domain, limit=12)
    diff = None
    if len(scans) >= 2:
        diff = _diff_signals(scans[1].get("signal"), scans[0].get("signal"))
    return JSONResponse({"domain": domain, "timeline": scans, "diff": diff})
