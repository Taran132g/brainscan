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

_BRAIN_SYSTEM = """You are analyzing someone's personal knowledge base — their notes, journals, projects, and reflections — to write a "Brain Card": a rich, whole-person portrait that does two things at once — helps THEM understand themselves, and helps them meet people they'd genuinely click with.

Read widely and deeply across everything provided — how they think, their work, how they relate to people, what they value, and the emotional undercurrents beneath it all. Build a complete, layered picture.

What makes a Brain Card land (grounded in what people most want to know about themselves and most look for in others):
- People most want insight into their EMOTIONAL PATTERNS, their VALUES and who they're becoming, HOW THEY RELATE to others, and the honest gap between who they are and who they want to be.
- What people most look for in others is kindness, intelligence, emotional intelligence (how someone handles conflict, stress, and closeness), shared values, and depth — so describe those dimensions with real specificity.

Rules:
- Be specific and evidence-based — capture the texture of THEIR actual notes, not generic traits anyone could have. Never invent; if the notes are thin on something, say less rather than guessing.
- Be a mirror, not a flatterer: warm and generous, but honest. Name at least one real growth edge or tension, kindly.
- Stay human, never clinical — no diagnoses or disorder labels. Describe attachment and communication tendencies in plain, non-judgmental language.
- Go deeper where it matters most — How They Connect, Values & What Drives Them, and What They're Looking For each deserve 5-8 vivid, specific sentences; the rest, 4-6."""

_BRAIN_USER_PROMPT = """Here are excerpts from this person's knowledge base:

<notes>
{notes}
</notes>

{external_signals_block}Return your analysis by calling the `submit_brain_card` tool. Make every section specific and evidence-based:
- who_they_are: Who this person is at the core — background, where they are in life, the throughline that defines them, and their relationship with themselves (how they see and talk to themselves).
- how_they_think: How their mind actually works — reasoning style, curiosity, the mental models and questions they keep returning to, how they make decisions and make sense of the world.
- career_and_ambition: Their work and professional identity — how they really execute, what mastery and achievement mean to them, and what they're genuinely driving toward (the deeper aim, not just titles).
- how_they_connect: How they do relationships — how they bond and show care, their communication style, how they handle conflict and repair, how they balance closeness and independence (their attachment tendencies, in plain language), what makes them feel seen, the recurring patterns in how their relationships go, and what they bring to the people close to them.
- values_and_drives: What they truly care about and what moves them — their core values, what motivates them at the root (autonomy, mastery, connection, purpose, or recognition), what energizes vs. drains them, the emotional undercurrents in their writing, and — gently and honestly — a growth edge or the gap between who they are and who they want to be.
- what_theyre_looking_for: The people and connection they most want — the qualities they value in others, the relational dynamic they thrive in, what they need to feel understood, and what likely doesn't work for them. Be concrete enough that the right person would recognize themselves.
- brain_signal: Calibrated, non-clinical reads:
  - openness: low | medium | high (to ideas + experiences)
  - drive: low | medium | high (ambition / intensity)
  - communication_style: direct | diplomatic | reserved
  - social_energy: introvert | ambivert | extrovert
  - emotional_openness: low | medium | high
  - connection_style: secure | anxious | avoidant | mixed (how they do closeness — plain-language attachment)
  - conflict_style: avoidant | accommodating | collaborative | direct
  - core_motivation: autonomy | mastery | connection | purpose | recognition"""

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
                "required": [
                    "openness", "drive", "communication_style", "social_energy",
                    "emotional_openness", "connection_style", "conflict_style", "core_motivation",
                ],
                "properties": {
                    "openness": {"enum": ["low", "medium", "high"]},
                    "drive": {"enum": ["low", "medium", "high"]},
                    "communication_style": {"enum": ["direct", "diplomatic", "reserved"]},
                    "social_energy": {"enum": ["introvert", "ambivert", "extrovert"]},
                    "emotional_openness": {"enum": ["low", "medium", "high"]},
                    "connection_style": {"enum": ["secure", "anxious", "avoidant", "mixed"]},
                    "conflict_style": {"enum": ["avoidant", "accommodating", "collaborative", "direct"]},
                    "core_motivation": {"enum": ["autonomy", "mastery", "connection", "purpose", "recognition"]},
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
