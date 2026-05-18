from fastapi import APIRouter, HTTPException, Depends
from services.embedder import embed_chunks
from services.vector_store import query_namespace
from services.brain_card import generate_brain_card
from services.auth import verify_user_owns_path

router = APIRouter()


@router.get("/profile/{user_id}/brain-card")
async def get_brain_card(user_id: str = Depends(verify_user_owns_path)):
    """
    Regenerate a brain card for a user from their stored vectors.
    Useful if the user updates their vault or wants a fresh card.
    """
    # Use a broad query to sample diverse chunks from their vault
    broad_queries = [
        "who I am background experience skills",
        "what I am building projects ideas startup",
        "values philosophy risk long term vision",
        "how I think mental models frameworks",
    ]

    # Embed one of the broad queries and retrieve a wide sample
    sample_chunk = [{"title": "", "heading": "", "text": broad_queries[0]}]
    embedded = embed_chunks(sample_chunk)
    query_vector = embedded[0]["embedding"]

    chunks = query_namespace(user_id, query_vector, top_k=40)

    if not chunks:
        raise HTTPException(status_code=404, detail="No vault data found for this user")

    brain_card = generate_brain_card(chunks)

    return {
        "user_id": user_id,
        "brain_card": brain_card,
    }
