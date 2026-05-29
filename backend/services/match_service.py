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


# City → (lat, lng) lookup for haversine distance scoring. Covers the seeded
# tech hubs and a few near-Taran East Coast cities. Lowercased keys; lookups
# strip the state/country suffix before matching.
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


def haversine_km(a: tuple[float, float], b: tuple[float, float]) -> float:
    """Distance between two (lat, lng) points in kilometers."""
    R = 6371.0
    lat1, lon1, lat2, lon2 = map(math.radians, (a[0], a[1], b[0], b[1]))
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    h = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
    return 2 * R * math.asin(math.sqrt(h))


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
    *,
    primary_role: Optional[str] = None,
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
        signal = brain_card.get("founder_signal") or {}
        building_key = "What They're Building"

        # Geocode city to (lat, lng) so we can rank by distance later
        coords = _coords_for(profile_meta.get("city") or "")

        metadata = _strip_nulls({
            "user_id": user_id,
            "name": profile_meta.get("full_name") or "Founder",
            "city": profile_meta.get("city") or "",
            "school": profile_meta.get("school") or "",
            "tier": profile_meta.get("founder_tier") or "",
            "rank": profile_meta.get("founder_rank") or 0,
            "preview": (sections_dict.get("Who They Are") or "")[:300],
            "building_preview": (sections_dict.get(building_key) or "")[:300],

            # Founder signal grades — surface as metadata so we can filter
            # without re-decoding the brain card on every match request.
            "market": signal.get("market_orientation") or "unclear",
            "intelligence": signal.get("implied_intelligence") or "medium",
            "domain_obsession": signal.get("domain_obsession") or "medium",
            "emotional_stability": signal.get("emotional_stability_signal") or "medium",
            "shipped_before": bool(signal.get("shipped_before")),

            # Lat/lng for haversine distance ranking
            "lat": float(coords[0]) if coords else None,
            "lng": float(coords[1]) if coords else None,

            # Primary role — set by the seed script for fakes; null for real
            # users until we infer it from the brain card or add a profile field.
            "primary_role": primary_role,
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


def update_match_location_metadata(user_id: str, profile_meta: dict) -> bool:
    """
    Patch the city/coords/name on a user's existing match vectors WITHOUT
    re-embedding. Called when the profile is edited so the matching layer (and
    everyone else's "nearest" sort) reflects the new city immediately.

    No-ops (returns False) if the user has no match vectors yet — they'll get
    full metadata the next time they upload.
    """
    coords = _coords_for(profile_meta.get("city") or "")
    set_meta: dict = {}
    if profile_meta.get("city"):
        set_meta["city"] = profile_meta["city"]
    if profile_meta.get("full_name"):
        set_meta["name"] = profile_meta["full_name"]
    if profile_meta.get("school"):
        set_meta["school"] = profile_meta["school"]
    if coords:
        set_meta["lat"] = float(coords[0])
        set_meta["lng"] = float(coords[1])

    if not set_meta:
        return False

    index = _get_index()
    ok = False
    for ns in (PROFILE_NAMESPACE, NEEDS_NAMESPACE):
        try:
            index.update(id=user_id, set_metadata=set_meta, namespace=ns)
            ok = True
        except Exception as e:
            print(f"[match] update_match_location_metadata ({ns}) failed: {e}")
    return ok


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
            # Signal + role fields (used by the filter/sort layer)
            "market": meta.get("market"),
            "intelligence": meta.get("intelligence"),
            "domain_obsession": meta.get("domain_obsession"),
            "emotional_stability": meta.get("emotional_stability"),
            "shipped_before": bool(meta.get("shipped_before")),
            "primary_role": meta.get("primary_role"),
            "lat": meta.get("lat"),
            "lng": meta.get("lng"),
        })

    results.sort(key=lambda r: -r["mutual_score"])
    return results[:top_k]


# ---------- Sorting & filtering for the /match/me endpoint ----------

INTELLIGENCE_RANK = {"high": 3, "medium": 2, "low": 1}


def filter_and_sort(
    matches: List[dict],
    *,
    user_coords: Optional[tuple[float, float]] = None,
    sort: str = "mutual_fit",
    market: Optional[str] = None,
    tier: Optional[str] = None,
    role: Optional[str] = None,
    shipped_only: bool = False,
) -> List[dict]:
    """
    Apply filters + a sort mode to a match list, returning the result.
    Designed so the route layer can keep its handler tiny.
    """
    out = list(matches)

    if market and market != "all":
        out = [m for m in out if (m.get("market") or "unclear") == market]
    if tier and tier != "all":
        out = [m for m in out if (m.get("tier") or "") == tier]
    if role and role != "all":
        out = [m for m in out if (m.get("primary_role") or "") == role]
    if shipped_only:
        out = [m for m in out if m.get("shipped_before")]

    # Pre-compute distance once if needed
    if sort == "nearest" or user_coords is not None:
        for m in out:
            lat = m.get("lat")
            lng = m.get("lng")
            if user_coords and lat is not None and lng is not None:
                m["distance_km"] = round(haversine_km(user_coords, (lat, lng)), 1)
            else:
                m["distance_km"] = None

    if sort == "smartest":
        out.sort(
            key=lambda m: (
                INTELLIGENCE_RANK.get(m.get("intelligence") or "medium", 2),
                m.get("rank") or 0,
                m.get("mutual_score") or 0,
            ),
            reverse=True,
        )
    elif sort == "rank":
        out.sort(key=lambda m: (m.get("rank") or 0, m.get("mutual_score") or 0), reverse=True)
    elif sort == "nearest":
        # Unknown distance → sink to the bottom but keep mutual_score as tiebreaker
        out.sort(
            key=lambda m: (
                m.get("distance_km") if m.get("distance_km") is not None else 1e9,
                -(m.get("mutual_score") or 0),
            )
        )
    else:  # mutual_fit (default)
        out.sort(key=lambda m: m.get("mutual_score") or 0, reverse=True)

    return out
