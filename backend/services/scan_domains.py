"""
Scan domains — the "config not code" core of BrainScan.

A ScanDomain is pure configuration for one lens on a person's digital brain:
which sections to extract, how to prompt for them, the tool schema, the signal
block, and a sensitivity level. The same engine (brain_card.py) runs ANY domain
— adding one (career, relationships, …) is a new dict entry here, not new code.

Phase 1 ships only the `founder` domain (a faithful lift of the existing brain
card), so behavior is identical and nothing regresses. The matching layer is
wired to the founder domain's signals only.
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
    sensitivity: str = "low"        # low | medium | high
    disclaimer: str = ""            # shown in UI for sensitive domains


# ============================================================
# FOUNDER — the original brain card, now expressed as a domain
# ============================================================

_FOUNDER_SYSTEM = """You are analyzing someone's personal knowledge base — their notes, projects, ideas, and reflections — to create a "brain card": a professional compatibility profile used for co-founder matching.

Rules:
- Be specific and evidence-based. Only claim things supported by the notes.
- Do not invent, assume, or generalize beyond what is shown.
- Each section should be 3-5 sentences. Be direct, not generic.
- This is a matching profile, not a bio."""

_FOUNDER_USER_PROMPT = """Here are excerpts from this person's knowledge base:

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

_FOUNDER_TOOL = {
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

_FOUNDER_SECTION_TITLES = {
    "who_they_are": "Who They Are",
    "what_theyre_building": "What They're Building",
    "how_they_think": "How They Think",
    "what_they_value": "What They Value",
    "what_they_need_in_cofounder": "What They Likely Need in a Co-Founder",
}

_FOUNDER_RETRIEVAL_QUERIES = {
    "who_they_are": "personal background, domain expertise, education, career history, professional journey, where they are in life right now",
    "what_theyre_building": "current projects, startups, products, side projects, business ideas, things being built shipped or launched",
    "how_they_think": "mental models, frameworks, reasoning style, decision making, recurring patterns in thinking, how problems are approached",
    "what_they_value": "core values, work ethic, risk tolerance, long-term vision, motivations, what matters beyond money",
    "what_they_need_in_cofounder": "skills and gaps, strengths and weaknesses, technical versus business ability, blind spots, what would complement them",
    "founder_signal": "founder readiness, obsession with a domain, finishing and shipping products, ambition, emotional steadiness, market focus",
}


FOUNDER = ScanDomain(
    id="founder",
    retrieval_queries=_FOUNDER_RETRIEVAL_QUERIES,
    system_prompt=_FOUNDER_SYSTEM,
    user_prompt_template=_FOUNDER_USER_PROMPT,
    tool_name="submit_brain_card",
    tool_schema=_FOUNDER_TOOL,
    section_titles=_FOUNDER_SECTION_TITLES,
    signal_key="founder_signal",
    sensitivity="low",
)


# The registry. Adding a domain = one entry here (career, relationships, …).
DOMAINS: dict[str, ScanDomain] = {
    "founder": FOUNDER,
}

DEFAULT_DOMAIN = "founder"


def get_domain(domain: Optional[str]) -> ScanDomain:
    """Resolve a domain id to its config, defaulting to founder."""
    return DOMAINS.get(domain or DEFAULT_DOMAIN, FOUNDER)
