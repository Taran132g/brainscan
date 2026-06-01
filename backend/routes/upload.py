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
from services.db import record_vault_upload, upsert_profile_snapshot, get_client
from services.paywall import check_upload_allowed
from services.match_service import upsert_scan_match_vectors

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
        .select("github_connected, github_data, github_quality, linkedin, linkedin_connected, instagram")
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
    # The Brain Card is the single whole-person scan (career + relationships +
    # how they think). This is what powers the profile, the card, and people-matching.
    brain_card = generate_brain_card(all_chunks, external_signals=external_signals, user_id=user_id, domain="brainscan")

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
    # Verification → brain confidence. Connecting GitHub / LinkedIn / Instagram
    # raises credibility; an unverified card takes a penalty. (Instagram weights
    # the relationship/social side of the card.)
    gh_v = bool(profile_row.get("github_connected"))
    li_v = bool(profile_row.get("linkedin_connected")) or bool(linkedin_url) or bool(profile_row.get("linkedin"))
    ig_v = bool(profile_row.get("instagram"))
    verification_penalty = (0 if gh_v else 12) + (0 if li_v else 8) + (0 if ig_v else 6)
    effective_confidence = max(30, quality["quality_score"] - verification_penalty)

    upsert_profile_snapshot(
        user_id=user_id,
        brain_card=brain_card,
        quality_score=effective_confidence,
        github_username=github_username,
        linkedin_url=linkedin_url,
    )

    # Make this card matchable in the people pool, with full metadata.
    match_meta = {"full_name": None, "city": None, "school": None, "avatar_url": None}
    try:
        meta_res = get_client().table("profiles").select(
            "full_name, city, school, avatar_url"
        ).eq("id", user_id).limit(1).execute()
        if meta_res.data:
            match_meta.update(meta_res.data[0])
    except Exception as e:
        print(f"[upload] match metadata read failed: {e}")

    upsert_scan_match_vectors(user_id, "brainscan", brain_card, match_meta)

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
    })
