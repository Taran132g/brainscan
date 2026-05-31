from typing import Optional
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Depends
from fastapi.responses import JSONResponse
from services.vault_parser import parse_vault_zip
from services.vault_quality import assess_vault_quality
from services.chunker import chunk_document
from services.embedder import embed_chunks
from services.vector_store import upsert_chunks, delete_user_namespace
from services.brain_card import generate_brain_card
from services.auth import verify_user_owns_path
from services.db import record_vault_upload, upsert_profile_snapshot, get_client, compute_and_persist_rank
from services.paywall import check_upload_allowed
from services.match_service import upsert_match_vectors

router = APIRouter()


@router.post("/upload/{user_id}")
async def upload_vault(
    file: UploadFile = File(...),
    github_username: Optional[str] = Form(default=None),
    linkedin_url: Optional[str] = Form(default=None),
    user_id: str = Depends(verify_user_owns_path),
):
    if not file.filename.endswith(".zip"):
        raise HTTPException(status_code=400, detail="Upload must be a .zip file")

    # GitHub/LinkedIn are no longer hard gates — they're *verification* signals.
    # We still read them: connected profiles enrich the brain card and earn higher
    # brain confidence; unverified profiles are allowed but lose credibility (below).
    profile_res = (
        get_client()
        .table("profiles")
        .select("github_connected, github_data, github_quality, linkedin, linkedin_connected")
        .eq("id", user_id)
        .limit(1)
        .execute()
    )
    profile_row = (profile_res.data or [{}])[0]

    # Paywall — raises 402 if the user can't upload.
    # Charged BEFORE any heavy work so we never burn Claude tokens on a denied request.
    payment_info = check_upload_allowed(user_id)

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

    # Generate brain card from raw chunks PLUS the rich GitHub data we now have
    # from OAuth. Claude can reference specific projects, languages, and stars
    # in the brain card instead of just knowing a URL exists.
    external_signals = {}
    gh_data = profile_row.get("github_data") or {}
    gh_username = gh_data.get("username") or github_username
    if gh_username:
        external_signals["github_url"] = f"https://github.com/{gh_username}"
    if gh_data:
        external_signals["github_data"] = gh_data
        external_signals["github_quality"] = profile_row.get("github_quality")
    if linkedin_url:
        external_signals["linkedin_url"] = linkedin_url
    brain_card = generate_brain_card(all_chunks, external_signals=external_signals, user_id=user_id)

    # Persist to Postgres — both an append-only upload record and a profile snapshot.
    # Soft-fails if Supabase isn't configured yet (so dev still works pre-migration).
    record_vault_upload(
        user_id=user_id,
        stats=quality["stats"],
        quality_score=quality["quality_score"],
        chunks_indexed=count,
        brain_card=brain_card,
        github_username=github_username,
        linkedin_url=linkedin_url,
    )
    # Verification → brain confidence. The raw vault quality is preserved in the
    # upload record above; the *profile* brain_confidence is the credibility a
    # viewer should place in this card, so unverified founders (no GitHub /
    # LinkedIn) take a penalty. Connecting them is the way to earn it back.
    github_verified = bool(profile_row.get("github_connected"))
    linkedin_verified = bool(profile_row.get("linkedin_connected")) or bool(linkedin_url) or bool(profile_row.get("linkedin"))
    verification_penalty = (0 if github_verified else 15) + (0 if linkedin_verified else 10)
    effective_confidence = max(30, quality["quality_score"] - verification_penalty)

    upsert_profile_snapshot(
        user_id=user_id,
        brain_card=brain_card,
        quality_score=effective_confidence,
        github_username=github_username,
        linkedin_url=linkedin_url,
    )

    # Server-side rank — authoritative, drives Discover / matching / public card
    rank_result = compute_and_persist_rank(user_id)

    # Match vectors — embed brain card sections into one profile vector + one
    # needs vector per user (Pinecone namespaces: match_profiles, match_needs).
    # Refresh on every upload so the match feed reflects the latest thinking.
    match_profile_meta = {
        "full_name": profile_row.get("full_name") if isinstance(profile_row, dict) else None,
        "city": None,
        "school": None,
        "founder_tier": (rank_result or {}).get("tier"),
        "founder_rank": (rank_result or {}).get("rank"),
    }
    # Pull the fields we need for match metadata
    try:
        meta_res = get_client().table("profiles").select(
            "full_name, city, school"
        ).eq("id", user_id).limit(1).execute()
        if meta_res.data:
            row = meta_res.data[0]
            match_profile_meta["full_name"] = row.get("full_name") or match_profile_meta["full_name"]
            match_profile_meta["city"] = row.get("city")
            match_profile_meta["school"] = row.get("school")
    except Exception as e:
        print(f"[upload] match metadata read failed: {e}")

    upsert_match_vectors(user_id, brain_card, match_profile_meta)

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
        "payment_info": payment_info,
        "rank": rank_result,
    })
