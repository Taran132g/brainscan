"""
TRUE old-vs-new brain-card rating comparison — makes exactly 2 real Claude
(Opus 4.8) calls, one per selection method, on the same corpus so the delta is
purely the selection change. Profile fields are held constant.

OLD = generate_brain_card(all_chunks)              -> diversity sampling
NEW = generate_brain_card(all_chunks, user_id=...) -> retrieval-driven
"""
import os, sys, json
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

from services.vault_parser import parse_vault_zip
from services.chunker import chunk_document
from services.embedder import embed_chunks
from services.vector_store import upsert_chunks, delete_user_namespace
from services.brain_card import generate_brain_card
from services.founder_score import compute_founder_score

ZIP = "/Users/taranveersingh/Desktop/digital-brain.zip"
TEST_UID = "braincard_true_tmp"

# Held constant for both runs so the rating delta is purely selection-driven.
FIXED_PROFILE = dict(school="Penn State", linkedin_present=True, age=21, github_quality="high")


def rate(brain_card, label):
    sig = brain_card.get("founder_signal", {}) or {}
    res = compute_founder_score(
        domain_obsession=sig.get("domain_obsession"),
        emotional_stability=sig.get("emotional_stability_signal"),
        shipped_before=bool(sig.get("shipped_before")),
        implied_intelligence=sig.get("implied_intelligence"),
        **FIXED_PROFILE,
    )
    print(f"\n================= {label} =================")
    print("  founder_signal:", json.dumps(sig))
    print(f"  SCORE {res['score']}  RANK {res['rank']}/10  TIER {res['tier']}")
    print("  breakdown:", res["breakdown"])
    print("  --- Who They Are ---\n   ", (brain_card['sections'].get('Who They Are','') or '')[:400])
    print("  --- What They're Building ---\n   ", (brain_card['sections'].get("What They're Building",'') or '')[:400])
    return res


def main():
    print("Parsing + chunking (parser skip now active)...")
    docs = parse_vault_zip(open(ZIP, "rb").read())
    all_chunks = []
    for d in docs:
        all_chunks.extend(chunk_document(d))
    print(f"  {len(docs)} docs -> {len(all_chunks)} chunks")

    print("\nEmbedding into temp namespace for retrieval (slow part)...")
    delete_user_namespace(TEST_UID)
    embedded = embed_chunks([dict(c) for c in all_chunks])
    upsert_chunks(TEST_UID, embedded)
    print("  embedded + upserted.")

    try:
        print("\n>>> Claude call 1/2: OLD (diversity sampling)")
        old_card = generate_brain_card(all_chunks)                      # no user_id -> diversity
        print(">>> Claude call 2/2: NEW (retrieval-driven)")
        new_card = generate_brain_card(all_chunks, user_id=TEST_UID)    # retrieval

        r_old = rate(old_card, "OLD  (diversity sampling)")
        r_new = rate(new_card, "NEW  (retrieval-driven)")

        print("\n############################################################")
        print(f">>> TRUE RATING DELTA (real Claude Opus 4.8):")
        print(f"    {r_old['rank']}/10 {r_old['tier']} (score {r_old['score']})"
              f"   ->   {r_new['rank']}/10 {r_new['tier']} (score {r_new['score']})"
              f"   | {r_new['score']-r_old['score']:+d} pts")
        print("############################################################")
    finally:
        delete_user_namespace(TEST_UID)
        print("\n(cleaned up temp namespace)")


if __name__ == "__main__":
    main()
