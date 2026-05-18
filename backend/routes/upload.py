from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from fastapi.responses import JSONResponse
from services.vault_parser import parse_vault_zip
from services.vault_quality import assess_vault_quality
from services.chunker import chunk_document
from services.embedder import embed_chunks
from services.vector_store import upsert_chunks, delete_user_namespace
from services.brain_card import generate_brain_card
from services.auth import verify_user_owns_path

router = APIRouter()


@router.post("/upload/{user_id}")
async def upload_vault(
    file: UploadFile = File(...),
    user_id: str = Depends(verify_user_owns_path),
):
    if not file.filename.endswith(".zip"):
        raise HTTPException(status_code=400, detail="Upload must be a .zip file")

    zip_bytes = await file.read()
    if len(zip_bytes) > 100 * 1024 * 1024:  # 100MB limit
        raise HTTPException(status_code=400, detail="Vault zip exceeds 100MB limit")

    # Parse vault
    documents = parse_vault_zip(zip_bytes)
    if not documents:
        raise HTTPException(status_code=400, detail="No readable markdown files found in vault")

    # Quality gate — reject sparse vaults before doing expensive embedding work
    quality = assess_vault_quality([
        {"title": d["title"], "text": d["content"], "file_path": d["path"]}
        for d in documents
    ])
    if not quality["passes"]:
        raise HTTPException(
            status_code=400,
            detail={
                "message": quality["reason"],
                "stats": quality["stats"],
                "code": "vault_too_sparse",
            },
        )

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
        "vault_quality": {
            "score": quality["quality_score"],
            "stats": quality["stats"],
        },
        "brain_card": brain_card,
    })
