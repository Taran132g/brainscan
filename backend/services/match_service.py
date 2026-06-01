"""
People matching — "meet similar (or complementary) people" based on a person's
whole-person Brain Card scan.

One profile vector + one needs vector per (user, domain), stored in
scan_<domain>_{profile,needs}. Matching for user A:
  similar       — nearest neighbors to A's scan persona
  complementary — Hinge-style mutual fit (A's needs ↔ their persona, both ways)

Vectors are refreshed on every successful vault upload (post brain card
generation) so the feed reflects the user's latest thinking.
"""

import math
from typing import List, Optional

from services.embedder import _embed
from services.vector_store import _get_index
from services.scan_domains import get_domain


# City → (lat, lng) lookup, used to surface a geocoded flag when a user edits
# their profile city. (Covers seeded tech hubs + a few near-Taran East Coast
# cities.) Lowercased keys; lookups strip the state/country suffix first.
CITY_COORDS: dict[str, tuple[float, float]] = {
    "san francisco": (37.7749, -122.4194), "palo alto": (37.4419, -122.143),
    "san jose": (37.3382, -121.8863), "berkeley": (37.8716, -122.2727),
    "los angeles": (34.0522, -118.2437), "seattle": (47.6062, -122.3321),
    "new york": (40.7128, -74.006), "brooklyn": (40.6782, -73.9442),
    "boston": (42.3601, -71.0589), "cambridge": (42.3736, -71.1097),
    "new haven": (41.3083, -72.9279), "philadelphia": (39.9526, -75.1652),
    "state college": (40.7934, -77.8600), "pittsburgh": (40.4406, -79.9959),
    "austin": (30.2672, -97.7431), "chicago": (41.8781, -87.6298),
    "denver": (39.7392, -104.9903), "miami": (25.7617, -80.1918),
    "toronto": (43.6532, -79.3832), "london": (51.5074, -0.1278),
    "berlin": (52.52, 13.405), "paris": (48.8566, 2.3522),
    "amsterdam": (52.3676, 4.9041), "stockholm": (59.3293, 18.0686),
    "zurich": (47.3769, 8.5417), "tel aviv": (32.0853, 34.7818),
    "dubai": (25.2048, 55.2708), "bangalore": (12.9716, 77.5946),
    "mumbai": (19.076, 72.8777), "delhi": (28.7041, 77.1025),
    "singapore": (1.3521, 103.8198), "tokyo": (35.6762, 139.6503),
    "seoul": (37.5665, 126.978), "hong kong": (22.3193, 114.1694),
    "shanghai": (31.2304, 121.4737), "beijing": (39.9042, 116.4074),
    "sydney": (-33.8688, 151.2093), "lagos": (6.5244, 3.3792),
    "nairobi": (-1.2921, 36.8219), "cape town": (-33.9249, 18.4241),
    "são paulo": (-23.5505, -46.6333), "mexico city": (19.4326, -99.1332),
}


def _coords_for(city: str) -> Optional[tuple[float, float]]:
    if not city:
        return None
    # Trim "City, ST" or "City, Country" → first part
    key = city.split(",")[0].strip().lower()
    return CITY_COORDS.get(key)


def _strip_nulls(d: dict) -> dict:
    """Pinecone doesn't accept None values in metadata."""
    return {k: v for k, v in d.items() if v is not None and v != ""}


def _cosine(a: List[float], b: List[float]) -> float:
    dot = sum(x * y for x, y in zip(a, b))
    na = math.sqrt(sum(x * x for x in a))
    nb = math.sqrt(sum(x * x for x in b))
    if na == 0 or nb == 0:
        return 0.0
    return dot / (na * nb)


# ============================================================
# Domain people-matching — "meet similar (or complementary) people"
# on their scan. One profile vector + one needs vector per (user, domain),
# in scan_<domain>_{profile,needs}.
# ============================================================

def _scan_profile_ns(domain: str) -> str:
    return f"scan_{domain}_profile"


def _scan_needs_ns(domain: str) -> str:
    return f"scan_{domain}_needs"


def upsert_scan_match_vectors(user_id: str, domain: str, card: dict, profile_meta: dict) -> bool:
    """Embed a user's domain scan into the per-domain match namespaces.
    profile vector = the whole persona; needs vector = the domain's 'needs' section."""
    try:
        dom = get_domain(domain)
        sections = card.get("sections") or {}
        if not sections:
            return False
        profile_text = "\n\n".join(f"{t}: {v}" for t, v in sections.items() if v)
        needs_title = dom.section_titles.get(dom.needs_section_key) if dom.needs_section_key else None
        needs_text = (sections.get(needs_title) if needs_title else "") or profile_text

        profile_vec, needs_vec = _embed([profile_text, needs_text], input_type="passage")
        meta = _strip_nulls({
            "user_id": user_id,
            "domain": domain,
            "name": profile_meta.get("full_name") or "Someone",
            "city": profile_meta.get("city") or "",
            "avatar_url": profile_meta.get("avatar_url") or "",
            "school": profile_meta.get("school") or "",
            "preview": (next(iter(sections.values()), "") or "")[:300],
        })
        index = _get_index()
        index.upsert(vectors=[{"id": user_id, "values": profile_vec, "metadata": meta}], namespace=_scan_profile_ns(domain))
        index.upsert(vectors=[{"id": user_id, "values": needs_vec, "metadata": meta}], namespace=_scan_needs_ns(domain))
        return True
    except Exception as e:
        print(f"[match] upsert_scan_match_vectors failed: {e}")
        return False


def delete_scan_match_vectors(user_id: str, domain: str = "brainscan") -> None:
    """Remove a user from the people pool for a domain (matching opt-out)."""
    index = _get_index()
    for ns in (_scan_profile_ns(domain), _scan_needs_ns(domain)):
        try:
            index.delete(ids=[user_id], namespace=ns)
        except Exception as e:
            print(f"[match] delete_scan_match_vectors ({ns}) failed: {e}")


def _vec_of(obj):
    if not obj:
        return None
    return obj["values"] if isinstance(obj, dict) else obj.values


def _calibrate_match(raw: float) -> int:
    """Stretch the compressed e5 similarity band (~0.74–0.97) across 35–99 so
    match percentages are legible instead of all reading in the 90s."""
    f = max(0.0, min(1.0, (raw - 0.74) / (0.97 - 0.74)))
    return round(35 + f * 64)


def find_domain_matches(user_id: str, domain: str, mode: str = "similar", top_k: int = 12) -> List[dict]:
    """
    People in `domain` ranked by:
      similar       — nearest neighbors to the caller's scan persona
      complementary — Hinge-style mutual fit (my needs ↔ their persona, both ways)
    Returns [] if the caller has no scan vector for the domain yet.
    """
    index = _get_index()
    pns, nns = _scan_profile_ns(domain), _scan_needs_ns(domain)

    mine_p = index.fetch(ids=[user_id], namespace=pns).vectors if True else None
    my_profile_vec = _vec_of((mine_p or {}).get(user_id))
    if my_profile_vec is None:
        return []

    if mode == "complementary":
        mine_n = index.fetch(ids=[user_id], namespace=nns).vectors
        my_needs_vec = _vec_of((mine_n or {}).get(user_id)) or my_profile_vec
        query_vec = my_needs_vec
    else:
        query_vec = my_profile_vec

    res = index.query(vector=query_vec, namespace=pns, top_k=min(top_k * 3, 60), include_metadata=True)
    cand_ids, a_to_b, metas = [], {}, {}
    for m in res.matches:
        if m.id == user_id:
            continue
        cand_ids.append(m.id)
        a_to_b[m.id] = float(m.score)
        metas[m.id] = dict(m.metadata or {})
        if len(cand_ids) >= top_k * 2:
            break
    if not cand_ids:
        return []

    scored = []
    if mode == "complementary":
        needs_lookup = index.fetch(ids=cand_ids, namespace=nns).vectors or {}
        for cid in cand_ids:
            tn = _vec_of(needs_lookup.get(cid))
            ab = a_to_b.get(cid, 0.0)
            score = ((ab + _cosine(tn, my_profile_vec)) / 2.0) if tn is not None else ab * 0.7
            scored.append((cid, score, metas[cid]))
    else:
        for cid in cand_ids:
            scored.append((cid, a_to_b[cid], metas[cid]))

    scored.sort(key=lambda x: -x[1])
    return [
        {
            "user_id": cid,
            "score": _calibrate_match(s),
            "name": m.get("name") or "Someone",
            "city": m.get("city") or "",
            "avatar_url": m.get("avatar_url") or None,
            "school": m.get("school") or "",
            "preview": m.get("preview") or "",
        }
        for cid, s, m in scored[:top_k]
    ]
