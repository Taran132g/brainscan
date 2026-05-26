import os
import json
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


def generate_brain_card(chunks: List[dict], external_signals: dict | None = None) -> dict:
    """
    Generate a structured brain card from vault chunks.

    `external_signals`: optional dict of public profile signals (github_url,
    linkedin_url). We don't fetch the actual content here — that's Phase 2
    GitHub OAuth work — but knowing the person has these profiles raises
    Claude's confidence on signals like founder_market_fit and adjusts
    "what they need in a co-founder" appropriately.

    Returns {sections: dict, founder_signal: dict, raw: dict}.
    """
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
        model="claude-opus-4-7",
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
