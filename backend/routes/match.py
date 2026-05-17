from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter()

# TODO: Implement cross-user matching (Phase 3)
# Strategy (similar to Hinge/Tinder vector approach):
# 1. Take User A's brain card embedding as query vector
# 2. Query ALL user namespaces in Pinecone (excluding A's own namespace)
# 3. Rank by cosine similarity, filter by complementary skill gaps
# 4. Run Claude to generate a compatibility report + "what you two should build" suggestion
# 5. Return top N matches with compatibility score and suggested build areas

class MatchRequest(BaseModel):
    user_id: str
    looking_for: str  # free-text: "technical co-founder who can handle backend"
    top_k: int = 10


@router.post("/match")
async def find_matches(request: MatchRequest):
    raise HTTPException(status_code=501, detail="Matching not yet implemented — Phase 3")


@router.get("/match/{user_id}/history")
async def get_match_history(user_id: str):
    raise HTTPException(status_code=501, detail="Matching not yet implemented — Phase 3")
