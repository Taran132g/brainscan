from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse

from services.auth import get_current_user_id
from services.connections import set_decision, list_connections

router = APIRouter()


# ---------- Hinge-style opt-in connections ----------
# These power the People flow: connecting unlocks the other person's full Brain
# Card and in-app messaging.

@router.get("/match/connections")
async def get_connections(user_id: str = Depends(get_current_user_id)):
    """
    Every match record the user is part of, with the other person's basic
    profile and a derived status (connected / pending_outgoing /
    pending_incoming / passed). Powers the Connections page.
    """
    return JSONResponse({"connections": list_connections(user_id)})


@router.post("/match/{other_user_id}/connect")
async def connect(other_user_id: str, user_id: str = Depends(get_current_user_id)):
    """
    Express interest in / accept a connection. Creates the canonical match row
    if needed and marks the caller's side accepted. If both sides have accepted,
    messaging + the full Brain Card unlock. Seeded demo people are auto-accepted.
    """
    try:
        result = set_decision(user_id, other_user_id, accept=True)
    except ValueError as e:
        return JSONResponse({"detail": str(e)}, status_code=400)
    return JSONResponse(result)


@router.post("/match/{other_user_id}/pass")
async def pass_match(other_user_id: str, user_id: str = Depends(get_current_user_id)):
    """Decline a connection. Marks the caller's side as declined."""
    try:
        result = set_decision(user_id, other_user_id, accept=False)
    except ValueError as e:
        return JSONResponse({"detail": str(e)}, status_code=400)
    return JSONResponse(result)
