"""
Scan domains — the "config not code" core of BrainScan.

A ScanDomain is pure configuration for one lens on a person's digital brain:
which sections to extract, how to prompt for them, the tool schema, the signal
block, and a sensitivity level. The same engine (brain_card.py) runs ANY domain
— adding one is a new dict entry here, not new code.

The product ships a single whole-person domain, BRAINSCAN, which combines
career, relationships, and how-they-think into one card. (Earlier founder /
career / relationships domains were removed when the product consolidated.)
"""

from dataclasses import dataclass
from typing import Optional


@dataclass(frozen=True)
class ScanDomain:
    id: str
    # One semantic retrieval query per section, against the user's vault namespace
    retrieval_queries: dict
    system_prompt: str
    # Template with {notes} and {external_signals_block} placeholders
    user_prompt_template: str
    tool_name: str
    tool_schema: dict
    # snake_case payload key -> human title for the section
    section_titles: dict
    # The payload key holding the structured signal object for this domain
    signal_key: str
    # The section key whose text represents "what would complement this person"
    # (used to build the needs vector for complementary matching)
    needs_section_key: str = ""
    # How many vault chunks to retrieve/analyze (richer domains pull more)
    chunk_target: int = 40
    sensitivity: str = "low"        # low | medium | high
    disclaimer: str = ""            # shown in UI for sensitive domains


# ============================================================
# BRAINSCAN — the single, comprehensive whole-person scan
# (career + relationships + how they think, all in one card)
# ============================================================

_BRAIN_SYSTEM = """You are analyzing someone's personal knowledge base — their notes, journals, projects, and reflections — to create a "Brain Card": a rich, whole-person portrait used to connect them with people they'd genuinely click with.

Read widely and deeply across everything provided — their work and career, how they relate to people, how they think, what they care about. Build a complete picture.

Rules:
- Be specific and evidence-based. Only claim what the notes support; never invent.
- Be warm and human, not clinical. No diagnoses or labels.
- Each section should be 3-6 sentences. Honest and vivid, not generic."""

_BRAIN_USER_PROMPT = """Here are excerpts from this person's knowledge base:

<notes>
{notes}
</notes>

{external_signals_block}Return your analysis by calling the `submit_brain_card` tool with these sections:
- who_they_are: Who this person is — background, where they are in life, what defines them.
- how_they_think: Mental models, reasoning style, curiosity, recurring patterns in thought.
- career_and_ambition: Their work and professional identity, how they execute, what they're driving toward.
- how_they_connect: How they relate to people — communication, what they value in others, social patterns.
- values_and_drives: What they care about most, their motivations, what moves them.
- what_theyre_looking_for: The kind of people and connections they'd most want to meet.
- brain_signal: Calibrated, non-clinical tendencies:
  - openness: low | medium | high (to ideas + experiences)
  - drive: low | medium | high (ambition / intensity)
  - communication_style: direct | diplomatic | reserved
  - social_energy: introvert | ambivert | extrovert
  - emotional_openness: low | medium | high"""

_BRAIN_TOOL = {
    "name": "submit_brain_card",
    "description": "Submit the structured whole-person Brain Card.",
    "input_schema": {
        "type": "object",
        "required": [
            "who_they_are", "how_they_think", "career_and_ambition",
            "how_they_connect", "values_and_drives", "what_theyre_looking_for",
            "brain_signal",
        ],
        "properties": {
            "who_they_are": {"type": "string"},
            "how_they_think": {"type": "string"},
            "career_and_ambition": {"type": "string"},
            "how_they_connect": {"type": "string"},
            "values_and_drives": {"type": "string"},
            "what_theyre_looking_for": {"type": "string"},
            "brain_signal": {
                "type": "object",
                "required": ["openness", "drive", "communication_style", "social_energy", "emotional_openness"],
                "properties": {
                    "openness": {"enum": ["low", "medium", "high"]},
                    "drive": {"enum": ["low", "medium", "high"]},
                    "communication_style": {"enum": ["direct", "diplomatic", "reserved"]},
                    "social_energy": {"enum": ["introvert", "ambivert", "extrovert"]},
                    "emotional_openness": {"enum": ["low", "medium", "high"]},
                },
            },
        },
    },
}

BRAINSCAN = ScanDomain(
    id="brainscan",
    retrieval_queries={
        "who_they_are": "who they are, background, identity, life story, where they are in life, personal history",
        "how_they_think": "how they think, mental models, reasoning, ideas, curiosity, decision making, worldview",
        "career_and_ambition": "career, work, job, projects, ambitions, goals, what they are building or doing professionally",
        "how_they_connect": "relationships, friends, family, communication, how they relate to people, social life, connection",
        "values_and_drives": "values, what they care about, motivations, what drives them, beliefs, what matters",
        "what_theyre_looking_for": "what they want, who they want to meet, ideal people, connection they seek, loneliness, community",
    },
    system_prompt=_BRAIN_SYSTEM,
    user_prompt_template=_BRAIN_USER_PROMPT,
    tool_name="submit_brain_card",
    tool_schema=_BRAIN_TOOL,
    section_titles={
        "who_they_are": "Who They Are",
        "how_they_think": "How They Think",
        "career_and_ambition": "Career & Ambition",
        "how_they_connect": "How They Connect",
        "values_and_drives": "Values & What Drives Them",
        "what_theyre_looking_for": "What They're Looking For",
    },
    signal_key="brain_signal",
    needs_section_key="what_theyre_looking_for",
    chunk_target=60,
    sensitivity="low",
)


# The registry. The product uses a single whole-person scan.
DOMAINS: dict[str, ScanDomain] = {
    "brainscan": BRAINSCAN,
}

DEFAULT_DOMAIN = "brainscan"


def get_domain(domain: Optional[str]) -> ScanDomain:
    """Resolve a domain id to its config, defaulting to the whole-person scan."""
    return DOMAINS.get(domain or DEFAULT_DOMAIN, BRAINSCAN)
