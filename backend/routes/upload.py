from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse
from services.vault_parser import parse_vault_zip
from services.chunker import chunk_document
from services.embedder import embed_chunks
from services.vector_store import upsert_chunks, delete_user_namespace
from services.brain_card import generate_brain_card

router = APIRouter()


@router.post("/upload/{user_id}")
async def upload_vault(user_id: str, file: UploadFile = File(...)):
    if not file.filename.endswith(".zip"):
        raise HTTPException(status_code=400, detail="Upload must be a .zip file")

    zip_bytes = await file.read()
    if len(zip_bytes) > 100 * 1024 * 1024:  # 100MB limit
        raise HTTPException(status_code=400, detail="Vault zip exceeds 100MB limit")

    # Parse vault
    documents = parse_vault_zip(zip_bytes)
    if not documents:
        raise HTTPException(status_code=400, detail="No readable markdown files found in vault")

    # Chunk all documents
    all_chunks = []
    for doc in documents:
        all_chunks.extend(chunk_document(doc))

    # Embed
    all_chunks = embed_chunks(all_chunks)

    # Clear old data and upsert fresh
    delete_user_namespace(user_id)
    count = upsert_chunks(user_id, all_chunks)

    # Generate brain card from raw (pre-embedding) chunks
    brain_card = generate_brain_card(all_chunks)

    return JSONResponse({
        "status": "success",
        "user_id": user_id,
        "documents_parsed": len(documents),
        "chunks_indexed": count,
        "brain_card": brain_card,
    })
