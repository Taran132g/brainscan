"""
Local, Claude-free comparison of OLD (diversity sampling) vs NEW (retrieval)
brain-card chunk selection, using the real digital-brain.zip and the real
multilingual-e5-large retrieval against a TEMPORARY Pinecone namespace.

It then applies a TRANSPARENT heuristic signal extractor (NOT Claude) to each
selected note set and runs them through the real compute_founder_score so we can
see a *directional* rating delta. The heuristic is crude on purpose and labeled.
"""
import os, re, sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

from services.vault_parser import parse_vault_zip
from services.chunker import chunk_document
from services.embedder import embed_chunks
from services.vector_store import upsert_chunks, delete_user_namespace
from services.brain_card import _sample_diverse_chunks, _retrieve_brain_card_chunks
from services.founder_score import compute_founder_score

ZIP = "/Users/taranveersingh/Desktop/digital-brain.zip"
TEST_UID = "braincard_compare_tmp"   # -> namespace user_braincard_compare_tmp


def key(c):
    return (c.get("file_path"), c.get("heading"), (c.get("text") or "")[:50])


# ---- transparent heuristic signal extractor (NOT Claude) -------------------
def heuristic_signal(chunks):
    t = "\n".join(c.get("text", "") for c in chunks).lower()
    c = lambda ws: sum(t.count(w) for w in ws)
    ship = c(["shipped", "launched", "deployed", "released", " live ", "in production",
              "users", "customers", "mvp", "prototype", "built ", "we built"])
    deep = c(["architecture", "algorithm", "framework", "pipeline", "optimize",
              "first principles", "trade-off", "tradeoff", "therefore", "because",
              "hypothesis", "system design"])
    anx = c(["anxious", "panic", "overwhelmed", "stressed", "afraid", "hopeless",
             "i hate", "burnt out", "burned out", "spiral", "can't"])
    calm = c(["calm", "steady", "disciplined", "consistent", "systematic",
              "grateful", "plan", "routine", "long-term"])
    b2b = c(["b2b", "enterprise", "saas", "compliance", "api", "workflow"])
    cons = c(["consumer", "social", "creators", "viral", "content", "app for"])
    infra = c(["infrastructure", "protocol", "developer tool", "sdk", "database", "open source"])
    mk = max([("b2b", b2b), ("consumer", cons), ("infrastructure", infra)], key=lambda x: x[1])
    words = re.findall(r"[a-z]+", t)
    uniq = len(set(words)) / max(1, len(words))
    return {
        "shipped_before": ship >= 8,
        "domain_obsession": "high" if deep >= 40 else "medium" if deep >= 15 else "low",
        "emotional_stability_signal": "low" if (anx > calm and anx >= 8)
            else "high" if (calm >= anx and calm >= 10) else "medium",
        "market_orientation": mk[0] if mk[1] > 0 else "unclear",
        "implied_intelligence": "high" if uniq > 0.28 else "medium" if uniq > 0.20 else "low",
        "_raw_counts": {"ship": ship, "deep": deep, "anx": anx, "calm": calm,
                         "b2b": b2b, "consumer": cons, "infra": infra, "uniq_ratio": round(uniq, 3)},
    }


# Held CONSTANT for both so the rating delta is purely from chunk selection.
FIXED_PROFILE = dict(school="Penn State", linkedin_present=True, age=21, github_quality="high")


def score_for(chunks, label):
    sig = heuristic_signal(chunks)
    res = compute_founder_score(
        domain_obsession=sig["domain_obsession"],
        emotional_stability=sig["emotional_stability_signal"],
        shipped_before=sig["shipped_before"],
        implied_intelligence=sig["implied_intelligence"],
        **FIXED_PROFILE,
    )
    print(f"\n=== {label} ===")
    print("  heuristic signal:", {k: v for k, v in sig.items() if k != "_raw_counts"})
    print("  raw counts      :", sig["_raw_counts"])
    print(f"  SCORE {res['score']}  RANK {res['rank']}/10  TIER {res['tier']}")
    print("  breakdown:", res["breakdown"])
    return res, sig


def main():
    print("Parsing + chunking vault...")
    docs = parse_vault_zip(open(ZIP, "rb").read())
    all_chunks = []
    for d in docs:
        all_chunks.extend(chunk_document(d))
    print(f"  {len(docs)} docs -> {len(all_chunks)} chunks")

    print("\nEmbedding all chunks into temp namespace (real e5, this is the slow part)...")
    delete_user_namespace(TEST_UID)
    embedded = embed_chunks([dict(c) for c in all_chunks])
    n = upsert_chunks(TEST_UID, embedded)
    print(f"  upserted {n} vectors to user_{TEST_UID}")

    try:
        old = _sample_diverse_chunks(all_chunks, target=40)
        new = _retrieve_brain_card_chunks(TEST_UID, target=40)

        old_keys, new_keys = {key(c) for c in old}, {key(c) for c in new}
        overlap = old_keys & new_keys
        old_files = {c["file_path"] for c in old}
        new_files = {c["file_path"] for c in new}

        print("\n############## SELECTION DIFFERENCE (measured, real retrieval) ##############")
        print(f"  chunks each            : old={len(old)}  new={len(new)}")
        print(f"  identical chunks shared: {len(overlap)} / 40 ({len(overlap)*100//40}%)")
        print(f"  distinct files covered : old={len(old_files)}  new={len(new_files)}")
        print(f"  files only in OLD      : {len(old_files - new_files)}")
        print(f"  files only in NEW      : {len(new_files - old_files)}")

        print("\n  Sample notes OLD-only (diversity sampling surfaced these):")
        for c in [x for x in old if key(x) not in new_keys][:10]:
            print(f"    - {c['title']}  ::  {c.get('heading','')[:50]}")
        print("\n  Sample notes NEW-only (retrieval surfaced these):")
        for c in [x for x in new if key(x) not in old_keys][:10]:
            print(f"    - {c['title']}  ::  {c.get('heading','')[:50]}")

        print("\n############## HEURISTIC RATING PROXY (NOT Claude) ##############")
        print("Profile fields held constant; only chunk selection differs.")
        r_old, _ = score_for(old, "OLD  (diversity sampling)")
        r_new, _ = score_for(new, "NEW  (retrieval-driven)")
        print(f"\n>>> RATING DELTA (heuristic proxy): "
              f"{r_old['rank']}/10 ({r_old['tier']})  ->  {r_new['rank']}/10 ({r_new['tier']})  "
              f"| score {r_old['score']} -> {r_new['score']} ({r_new['score']-r_old['score']:+d})")
    finally:
        delete_user_namespace(TEST_UID)
        print("\n(cleaned up temp namespace)")


if __name__ == "__main__":
    main()
