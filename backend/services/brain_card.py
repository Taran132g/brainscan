import os
import json
import time
import anthropic
from typing import List
from collections import defaultdict

_client = None


def _get_client():
    global _client
    if _client is None:
        _client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
    return _client


BRAIN_CARD_SYSTEM = """You are analyzing someone's personal knowledge base — their notes, projects, ideas, and reflections — to create a "brain card": a professional compatibility profile used for co-founder matching.

Rules:
- Be specific and evidence-based. Only claim things supported by the notes.
- Do not invent, assume, or generalize beyond what is shown.
- Each section should be 3-5 sentences. Be direct, not generic.
- This is a matching profile, not a bio."""


BRAIN_CARD_USER_PROMPT = """Here are excerpts from this person's knowledge base:

<notes>
{notes}
</notes>

{external_signals_block}Return your analysis by calling the `submit_brain_card` tool with these sections:
- who_they_are: Background, domain expertise, where they are in their journey.
- what_theyre_building: Specific projects, ideas, or businesses they're working on.
- how_they_think: Mental models, frameworks, recurring patterns in their thinking.
- what_they_value: Work ethic, risk tolerance, vision, what they care about beyond money.
- what_they_need_in_cofounder: Based on skills/gaps, what would complement them well.
- founder_signal: Specific signals from the notes about founder readiness:
  - domain_obsession: low | medium | high (signs of deep specific interest)
  - shipped_before: true | false (evidence of having shipped a product, side project, or substantial work)
  - emotional_stability_signal: low | medium | high (steady reasoning vs. anxious/reactive writing)
  - market_orientation: b2b | consumer | infrastructure | mixed | unclear
  - implied_intelligence: low | medium | high (judged from writing quality, conceptual depth,
    reasoning sophistication, and ability to handle complex ideas — be calibrated, not generous)"""


BRAIN_CARD_TOOL = {
    "name": "submit_brain_card",
    "description": "Submit the structured brain card analysis.",
    "input_schema": {
        "type": "object",
        "required": [
            "who_they_are",
            "what_theyre_building",
            "how_they_think",
            "what_they_value",
            "what_they_need_in_cofounder",
            "founder_signal",
        ],
        "properties": {
            "who_they_are": {"type": "string"},
            "what_theyre_building": {"type": "string"},
            "how_they_think": {"type": "string"},
            "what_they_value": {"type": "string"},
            "what_they_need_in_cofounder": {"type": "string"},
            "founder_signal": {
                "type": "object",
                "required": [
                    "domain_obsession",
                    "shipped_before",
                    "emotional_stability_signal",
                    "market_orientation",
                    "implied_intelligence",
                ],
                "properties": {
                    "domain_obsession": {"enum": ["low", "medium", "high"]},
                    "shipped_before": {"type": "boolean"},
                    "emotional_stability_signal": {"enum": ["low", "medium", "high"]},
                    "market_orientation": {
                        "enum": ["b2b", "consumer", "infrastructure", "mixed", "unclear"]
                    },
                    "implied_intelligence": {"enum": ["low", "medium", "high"]},
                },
            },
        },
    },
}


# Section keys returned in the response (frontend-friendly titles)
SECTION_TITLES = {
    "who_they_are": "Who They Are",
    "what_theyre_building": "What They're Building",
    "how_they_think": "How They Think",
    "what_they_value": "What They Value",
    "what_they_need_in_cofounder": "What They Likely Need in a Co-Founder",
}


def _sample_diverse_chunks(chunks: List[dict], target: int = 40) -> List[dict]:
    """
    Sample up to `target` chunks with file diversity.

    Strategy:
    1. Group chunks by file_path.
    2. Round-robin one chunk from each file until we hit target or run out.
    3. Then top up by taking additional chunks from files that have more.
    """
    by_file = defaultdict(list)
    for c in chunks:
        by_file[c["file_path"]].append(c)

    selected = []
    file_iterators = {f: iter(file_chunks) for f, file_chunks in by_file.items()}
    active_files = list(file_iterators.keys())

    while active_files and len(selected) < target:
        next_active = []
        for f in active_files:
            try:
                selected.append(next(file_iterators[f]))
                if len(selected) >= target:
                    break
                next_active.append(f)
            except StopIteration:
                continue
        active_files = next_active

    return selected


# Per-dimension retrieval queries. Each brain-card section is grounded in the
# chunks most semantically relevant to that dimension, instead of a flat
# diversity sample. Round-robin merging keeps every section represented.
RETRIEVAL_QUERIES = {
    "who_they_are": "personal background, domain expertise, education, career history, professional journey, where they are in life right now",
    "what_theyre_building": "current projects, startups, products, side projects, business ideas, things being built shipped or launched",
    "how_they_think": "mental models, frameworks, reasoning style, decision making, recurring patterns in thinking, how problems are approached",
    "what_they_value": "core values, work ethic, risk tolerance, long-term vision, motivations, what matters beyond money",
    "what_they_need_in_cofounder": "skills and gaps, strengths and weaknesses, technical versus business ability, blind spots, what would complement them",
    "founder_signal": "founder readiness, obsession with a domain, finishing and shipping products, ambition, emotional steadiness, market focus",
}


def _round_robin_dedup(ranked_lists: List[List[dict]], target: int) -> List[dict]:
    """Merge per-query ranked hit lists, taking one from each in turn, skipping dupes."""
    seen = set()
    selected: List[dict] = []
    iterators = [iter(lst) for lst in ranked_lists]
    active = list(range(len(iterators)))

    while active and len(selected) < target:
        next_active = []
        for i in active:
            try:
                hit = next(iterators[i])
            except StopIteration:
                continue
            key = (hit.get("file_path"), hit.get("heading"), (hit.get("text") or "")[:50])
            if key in seen:
                next_active.append(i)  # consumed a dupe; keep pulling from this list
                continue
            seen.add(key)
            selected.append(hit)
            if len(selected) >= target:
                break
            next_active.append(i)
        active = next_active

    return selected


def _retrieve_brain_card_chunks(
    user_id: str, target: int = 40, min_chunks: int = 10, max_attempts: int = 3
) -> List[dict]:
    """
    Retrieval-driven chunk selection for the brain card.

    Runs one semantic query per brain-card dimension against the user's private
    Pinecone namespace, then round-robin merges the hits (deduped) so the card
    is grounded in each section's most relevant notes rather than a flat sample.

    Because vectors are frequently upserted moments before this runs (during the
    upload flow), Pinecone's serverless index can lag — so we retry the whole
    sweep a few times with backoff when the first pass comes back thin.
    """
    from services.embedder import embed_query
    from services.vector_store import query_namespace

    queries = list(RETRIEVAL_QUERIES.values())
    per_query_k = max(10, (target // len(queries)) + 6)

    selected: List[dict] = []
    for attempt in range(max_attempts):
        ranked_lists = []
        for q in queries:
            try:
                hits = query_namespace(user_id, embed_query(q), top_k=per_query_k)
            except Exception as e:
                print(f"[brain_card] retrieval query failed: {e}")
                hits = []
            ranked_lists.append(hits)

        selected = _round_robin_dedup(ranked_lists, target)

        if len(selected) >= min_chunks or attempt == max_attempts - 1:
            return selected

        # Index probably still catching up after the upsert — back off and retry.
        wait = 2.0 * (attempt + 1)
        print(
            f"[brain_card] retrieval thin ({len(selected)} chunks); "
            f"waiting {wait}s for index (attempt {attempt + 1}/{max_attempts})"
        )
        time.sleep(wait)

    return selected


def generate_brain_card(
    chunks: List[dict],
    external_signals: dict | None = None,
    user_id: str | None = None,
) -> dict:
    """
    Generate a structured brain card from vault chunks.

    Chunk selection is retrieval-driven when `user_id` is provided: one semantic
    query per brain-card dimension runs against the user's namespace, so each
    section is grounded in its most relevant notes. Falls back to flat diversity
    sampling over `chunks` if retrieval is unavailable or comes back thin (e.g.
    before Pinecone's index has caught up with a just-completed upsert).

    `external_signals`: optional dict of public profile signals (github_url,
    linkedin_url). We don't fetch the actual content here — that's Phase 2
    GitHub OAuth work — but knowing the person has these profiles raises
    Claude's confidence on signals like founder_market_fit and adjusts
    "what they need in a co-founder" appropriately.

    Returns {sections: dict, founder_signal: dict, raw: dict}.
    """
    selected: List[dict] = []
    if user_id:
        selected = _retrieve_brain_card_chunks(user_id, target=40)
        if len(selected) < 10:
            print(
                f"[brain_card] retrieval yielded {len(selected)} chunks; "
                "falling back to diversity sampling"
            )
            selected = []
    if not selected:
        selected = _sample_diverse_chunks(chunks, target=40)

    notes = "\n\n---\n\n".join(
        f"[{c['title']} / {c.get('heading', '')}]\n{c['text']}" for c in selected
    )

    # Build the optional external-signals block. When GitHub OAuth has been
    # connected, we include the actual top repos / languages / stats so Claude
    # can reference specific projects in "What They're Building" instead of
    # treating the GitHub URL as a black box.
    signals_lines = []
    if external_signals:
        if external_signals.get("github_url"):
            signals_lines.append(f"- GitHub profile: {external_signals['github_url']}")
        if external_signals.get("linkedin_url"):
            signals_lines.append(f"- LinkedIn profile: {external_signals['linkedin_url']}")

        gh_data = external_signals.get("github_data")
        if gh_data:
            stats = gh_data.get("stats") or {}
            signals_lines.append(
                f"- GitHub stats: {stats.get('non_fork_repos', 0)} non-fork repos, "
                f"{stats.get('total_stars', 0)} total stars, "
                f"{stats.get('language_count', 0)} languages "
                f"({', '.join((stats.get('languages') or [])[:6])})"
            )
            quality = external_signals.get("github_quality")
            if quality:
                signals_lines.append(f"- GitHub quality grade: {quality}")
            top_repos = gh_data.get("top_repos") or []
            if top_repos:
                signals_lines.append("- Top repos (use to ground 'What They're Building'):")
                for r in top_repos[:6]:
                    lang = f" · {r.get('language')}" if r.get("language") else ""
                    stars = f" · ⭐{r.get('stars', 0)}" if r.get("stars") else ""
                    desc = f": {r['description']}" if r.get("description") else ""
                    signals_lines.append(f"    • {r.get('name', '?')}{lang}{stars}{desc}")

    external_block = (
        "External signals (public profiles + verified GitHub data — incorporate into the brain card):\n"
        + "\n".join(signals_lines)
        + "\n\n"
    ) if signals_lines else ""

    message = _get_client().messages.create(
        model="claude-opus-4-8",
        max_tokens=2500,
        system=BRAIN_CARD_SYSTEM,
        tools=[BRAIN_CARD_TOOL],
        tool_choice={"type": "tool", "name": "submit_brain_card"},
        messages=[
            {"role": "user", "content": BRAIN_CARD_USER_PROMPT.format(
                notes=notes,
                external_signals_block=external_block,
            )}
        ],
    )

    # Find the tool_use block
    tool_use_block = next(
        (b for b in message.content if b.type == "tool_use"), None
    )
    if tool_use_block is None:
        raise RuntimeError("Brain card generation failed — no tool_use block in response.")

    payload = tool_use_block.input

    # Translate snake_case keys into pretty titles for the frontend
    sections = {
        SECTION_TITLES[key]: payload[key]
        for key in SECTION_TITLES
        if key in payload
    }

    return {
        "sections": sections,
        "founder_signal": payload.get("founder_signal", {}),
        "raw": payload,
    }
