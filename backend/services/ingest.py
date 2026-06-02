"""
Shared vault-ingest pipeline.

One code path used by both the web upload (`POST /upload/{user_id}`, session
auth) and the Obsidian plugin (`POST /plugin/scan`, personal-token auth):
parse → quality gate → chunk → embed → upsert → generate the whole-person
BrainScan card → persist → make matchable.

Kept here (not in a route) so the two surfaces can never drift apart.
"""

from typing import Optional

from fastapi import HTTPException

from services.vault_parser import parse_vault_zip
from services.vault_quality import assess_vault_quality
from services.chunker import chunk_document
from services.embedder import embed_chunks
from services.vector_store import upsert_chunks, delete_user_namespace
from services.brain_card import generate_brain_card
from services.db import record_vault_upload, upsert_profile_snapshot, record_scan, get_client
from services.paywall import check_upload_allowed


def ingest_vault(
    user_id: str,
    zip_bytes: bytes,
    *,
    github_username: Optional[str] = None,
    linkedin_url: Optional[str] = None,
) -> dict:
    """
    Run the full vault → BrainScan pipeline for a user and return the result dict.
    Raises HTTPException (402 paywall, 400 bad/sparse vault) exactly like the web
    upload did. Charges the paywall BEFORE any heavy work so denied requests never
    burn Claude tokens.
    """
    # GitHub/LinkedIn/Instagram are verification signals, not gates — connected
    # profiles enrich the card and earn higher brain confidence.
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
    payment_info = check_upload_allowed(user_id)

    if len(zip_bytes) > 100 * 1024 * 1024:  # 100MB limit
        raise HTTPException(status_code=400, detail="Vault zip exceeds 100MB limit")

    documents = parse_vault_zip(zip_bytes)
    if not documents:
        raise HTTPException(status_code=400, detail="No readable markdown files found in vault")

    # Quality gate — reject sparse vaults before expensive embedding work
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

    # Chunk + embed
    all_chunks = []
    for doc in documents:
        all_chunks.extend(chunk_document(doc))
    all_chunks = embed_chunks(all_chunks)

    # Clear old data and upsert fresh
    delete_user_namespace(user_id)
    count = upsert_chunks(user_id, all_chunks)

    # External verification signals enrich the card.
    external_signals: dict = {}
    gh_data = profile_row.get("github_data") or {}
    gh_username = gh_data.get("username") or github_username
    if gh_username:
        external_signals["github_url"] = f"https://github.com/{gh_username}"
    if gh_data:
        external_signals["github_data"] = gh_data
        external_signals["github_quality"] = profile_row.get("github_quality")
    if linkedin_url:
        external_signals["linkedin_url"] = linkedin_url

    # The single whole-person BrainScan card (powers profile, card, matching).
    brain_card = generate_brain_card(
        all_chunks, external_signals=external_signals, user_id=user_id, domain="brainscan"
    )

    record_vault_upload(
        user_id=user_id,
        stats=quality["stats"],
        quality_score=quality["quality_score"],
        chunks_indexed=count,
        brain_card=brain_card,
        github_username=github_username,
        linkedin_url=linkedin_url,
    )

    # An upload IS a scan — record it to the scans table so the Brain Card page
    # (/scan/me) and the People page (hasScanned gate) reflect it without the
    # user having to click "Generate" separately. Powers the longitudinal diff too.
    record_scan(
        user_id,
        "brainscan",
        brain_card.get("sections") or {},
        brain_card.get("signal") or brain_card.get("founder_signal") or {},
    )

    # Verification → brain confidence (GitHub / LinkedIn / Instagram).
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

    return {
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
    }
