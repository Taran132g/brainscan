"""
Co-founder matching — Hinge-style mutual scoring on top of brain card embeddings.

Architecture:
- Two namespaces in the existing Pinecone index:
    match_profiles  — one vector per user representing "who they are"
                      (built from Who They Are / Building / Thinking / Values)
    match_needs     — one vector per user representing "who they want"
                      (built from What They Need in a Co-Founder)
- ID for both vectors = the user's UUID.

Matching for User A:
  1. Query match_profiles with A's needs vector → top N candidates whose
     persona matches what A is looking for.
  2. For each candidate B, fetch B's needs vector from match_needs and
     compute cosine similarity vs A's profile vector — this tests whether
     B is also looking for someone like A.
  3. mutual_score = (A→B score + B→A score) / 2.
  4. Sort by mutual_score desc, return top K.

Storage is refreshed on every successful vault upload (post brain card
generation) so the match feed reflects the user's latest thinking.
"""

import math
from typing import List, Optional

from services.embedder import _embed
from services.vector_store import _get_index


PROFILE_NAMESPACE = "match_profiles"
NEEDS_NAMESPACE = "match_needs"


# ---------- Text builders ----------

def build_profile_text(brain_card: dict, profile_meta: dict) -> str:
    """The persona/projects/values text that others will search against."""
    sections = brain_card.get("sections", {}) or {}
    signal = brain_card.get("founder_signal", {}) or {}

    parts: list[str] = []
    building_key = "What They're Building"
    cofounder_key = "What They Likely Need in a Co-Founder"

    if sections.get("Who They Are"):
        parts.append("WHO: " + sections["Who They Are"])
    if sections.get(building_key):
        parts.append("BUILDING: " + sections[building_key])
    if sections.get("How They Think"):
        parts.append("THINKING: " + sections["How They Think"])
    if sections.get("What They Value"):
        parts.append("VALUES: " + sections["What They Value"])

    # Founder signal — embedded for soft matching on style/intent
    parts.append(
        "SIGNAL: "
        f"domain_obsession={signal.get('domain_obsession', '?')}, "
        f"market={signal.get('market_orientation', '?')}, "
        f"intelligence={signal.get('implied_intelligence', '?')}, "
        f"emotional_stability={signal.get('emotional_stability_signal', '?')}, "
        f"shipped={signal.get('shipped_before', False)}"
    )

    if profile_meta.get("city"):
        parts.append(f"CITY: {profile_meta['city']}")
    if profile_meta.get("school"):
        parts.append(f"SCHOOL: {profile_meta['school']}")

    return "\n\n".join(parts)


def build_needs_text(brain_card: dict) -> str:
    """What this user is looking for in a co-founder."""
    sections = brain_card.get("sections", {}) or {}
    text = sections.get("What They Likely Need in a Co-Founder")
    if not text:
        return ""
    return f"LOOKING FOR: {text}"


# ---------- Persistence ----------

def upsert_match_vectors(
    user_id: str,
    brain_card: dict,
    profile_meta: dict,
) -> bool:
    """
    Embed profile + needs text and upsert into the two match namespaces.
    Returns True on success, False if there wasn't enough text to embed.
    Soft-fails on any Pinecone hiccup so the upload response isn't blocked.
    """
    try:
        profile_text = build_profile_text(brain_card, profile_meta)
        needs_text = build_needs_text(brain_card)

        if not profile_text or not needs_text:
            return False

        # Embed both as passages — symmetric similarity is fine for cosine.
        profile_vec, needs_vec = _embed(
            [profile_text, needs_text], input_type="passage"
        )

        # Shared metadata for both vectors (so the query result has it without
        # a second DB read).
        sections_dict = brain_card.get("sections") or {}
        building_key = "What They're Building"
        metadata = _strip_nulls({
            "user_id": user_id,
            "name": profile_meta.get("full_name") or "Founder",
            "city": profile_meta.get("city") or "",
            "school": profile_meta.get("school") or "",
            "tier": profile_meta.get("founder_tier") or "",
            "rank": profile_meta.get("founder_rank") or 0,
            "preview": (sections_dict.get("Who They Are") or "")[:300],
            "building_preview": (sections_dict.get(building_key) or "")[:300],
        })

        index = _get_index()
        index.upsert(
            vectors=[{"id": user_id, "values": profile_vec, "metadata": metadata}],
            namespace=PROFILE_NAMESPACE,
        )
        index.upsert(
            vectors=[{"id": user_id, "values": needs_vec, "metadata": metadata}],
            namespace=NEEDS_NAMESPACE,
        )
        return True
    except Exception as e:
        print(f"[match] upsert_match_vectors failed: {e}")
        return False


def delete_match_vectors(user_id: str) -> None:
    """Remove a user from the matching pool (opt-out / account deletion)."""
    index = _get_index()
    for ns in (PROFILE_NAMESPACE, NEEDS_NAMESPACE):
        try:
            index.delete(ids=[user_id], namespace=ns)
        except Exception:
            pass


def _strip_nulls(d: dict) -> dict:
    """Pinecone doesn't accept None values in metadata."""
    return {k: v for k, v in d.items() if v is not None and v != ""}


# ---------- Querying ----------

def _cosine(a: List[float], b: List[float]) -> float:
    dot = sum(x * y for x, y in zip(a, b))
    na = math.sqrt(sum(x * x for x in a))
    nb = math.sqrt(sum(x * x for x in b))
    if na == 0 or nb == 0:
        return 0.0
    return dot / (na * nb)


def find_matches(user_id: str, top_k: int = 10) -> List[dict]:
    """
    Return top-K co-founder matches with mutual scoring.
    Returns empty list if the user hasn't uploaded a brain card yet.
    """
    index = _get_index()

    # 1. Fetch my profile + needs vectors
    my_profile_fetch = index.fetch(ids=[user_id], namespace=PROFILE_NAMESPACE)
    my_needs_fetch = index.fetch(ids=[user_id], namespace=NEEDS_NAMESPACE)

    my_profile = my_profile_fetch.vectors.get(user_id) if my_profile_fetch.vectors else None
    my_needs = my_needs_fetch.vectors.get(user_id) if my_needs_fetch.vectors else None

    if not my_profile or not my_needs:
        return []

    my_profile_vec = my_profile["values"] if isinstance(my_profile, dict) else my_profile.values
    my_needs_vec = my_needs["values"] if isinstance(my_needs, dict) else my_needs.values

    # 2. Over-fetch from profile namespace with my needs (so we can skip self + dedupe)
    matches = index.query(
        vector=my_needs_vec,
        namespace=PROFILE_NAMESPACE,
        top_k=min(top_k * 3, 100),
        include_metadata=True,
    )

    candidate_ids: list[str] = []
    a_to_b_scores: dict[str, float] = {}
    metas: dict[str, dict] = {}
    for m in matches.matches:
        if m.id == user_id:
            continue
        candidate_ids.append(m.id)
        a_to_b_scores[m.id] = float(m.score)
        metas[m.id] = dict(m.metadata or {})
        if len(candidate_ids) >= top_k * 2:
            break

    if not candidate_ids:
        return []

    # 3. Fetch their needs vectors so we can compute B's reciprocal score
    needs_fetch = index.fetch(ids=candidate_ids, namespace=NEEDS_NAMESPACE)
    needs_lookup = needs_fetch.vectors if needs_fetch.vectors else {}

    # 4. Compute mutual scores
    results: list[dict] = []
    for cid in candidate_ids:
        their_needs_obj = needs_lookup.get(cid)
        their_needs_vec = None
        if their_needs_obj:
            their_needs_vec = (
                their_needs_obj["values"] if isinstance(their_needs_obj, dict) else their_needs_obj.values
            )

        a_to_b = a_to_b_scores.get(cid, 0.0)
        if their_needs_vec is not None:
            b_to_a = _cosine(their_needs_vec, my_profile_vec)
            mutual = (a_to_b + b_to_a) / 2.0
        else:
            # Candidate hasn't refreshed their needs vector — discount one-way score
            b_to_a = None
            mutual = a_to_b * 0.7

        meta = metas.get(cid, {})
        results.append({
            "user_id": cid,
            "mutual_score": round(mutual, 4),
            "a_to_b_score": round(a_to_b, 4),
            "b_to_a_score": round(b_to_a, 4) if b_to_a is not None else None,
            "name": meta.get("name") or "Founder",
            "city": meta.get("city") or "",
            "school": meta.get("school") or "",
            "tier": meta.get("tier") or "",
            "rank": int(meta.get("rank") or 0),
            "preview": meta.get("preview") or "",
            "building_preview": meta.get("building_preview") or "",
        })

    results.sort(key=lambda r: -r["mutual_score"])
    return results[:top_k]
