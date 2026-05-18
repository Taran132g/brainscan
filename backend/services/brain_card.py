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

Return your analysis by calling the `submit_brain_card` tool with these sections:
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


def generate_brain_card(chunks: List[dict]) -> dict:
    """
    Generate a structured brain card from vault chunks.
    Returns {sections: dict, founder_signal: dict, raw: dict}.
    """
    selected = _sample_diverse_chunks(chunks, target=40)

    notes = "\n\n---\n\n".join(
        f"[{c['title']} / {c.get('heading', '')}]\n{c['text']}" for c in selected
    )

    message = _get_client().messages.create(
        model="claude-opus-4-7",
        max_tokens=2500,
        system=BRAIN_CARD_SYSTEM,
        tools=[BRAIN_CARD_TOOL],
        tool_choice={"type": "tool", "name": "submit_brain_card"},
        messages=[
            {"role": "user", "content": BRAIN_CARD_USER_PROMPT.format(notes=notes)}
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
