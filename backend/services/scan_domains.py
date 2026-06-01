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
    # The section key whose text represents "what would complement this person"
    # (used to build the needs vector for complementary matching)
    needs_section_key: str = ""
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
    needs_section_key="what_they_need_in_cofounder",
    sensitivity="low",
)


# ============================================================
# CAREER — how someone works, where they're headed
# ============================================================

_CAREER_SYSTEM = """You are analyzing someone's personal knowledge base — their notes, projects, and reflections — to create a "career card": a profile of how they work and where they're headed.

Rules:
- Be specific and evidence-based. Only claim things supported by the notes.
- Do not invent or generalize beyond what is shown.
- Each section should be 3-5 sentences. Direct, not generic.
- This is a working-style profile, not a resume."""

_CAREER_USER_PROMPT = """Here are excerpts from this person's knowledge base:

<notes>
{notes}
</notes>

{external_signals_block}Return your analysis by calling the `submit_career_card` tool with these sections:
- professional_identity: Their domain, level, and the trajectory their work suggests.
- how_they_execute: How they actually get things done — planning vs shipping, depth vs speed.
- strengths: What they're demonstrably strong at, grounded in the notes.
- growth_areas: Gaps or blind spots the writing reveals, stated constructively.
- ideal_next_role: The kind of role / environment that would fit and stretch them.
- career_signal: Calibrated signals about their working style:
  - execution_bias: ship | plan | balanced
  - risk_tolerance: low | medium | high
  - leadership_lean: ic | lead | either (individual contributor vs leading others)
  - autonomy_need: low | medium | high
  - growth_drive: low | medium | high"""

_CAREER_TOOL = {
    "name": "submit_career_card",
    "description": "Submit the structured career card analysis.",
    "input_schema": {
        "type": "object",
        "required": [
            "professional_identity", "how_they_execute", "strengths",
            "growth_areas", "ideal_next_role", "career_signal",
        ],
        "properties": {
            "professional_identity": {"type": "string"},
            "how_they_execute": {"type": "string"},
            "strengths": {"type": "string"},
            "growth_areas": {"type": "string"},
            "ideal_next_role": {"type": "string"},
            "career_signal": {
                "type": "object",
                "required": [
                    "execution_bias", "risk_tolerance", "leadership_lean",
                    "autonomy_need", "growth_drive",
                ],
                "properties": {
                    "execution_bias": {"enum": ["ship", "plan", "balanced"]},
                    "risk_tolerance": {"enum": ["low", "medium", "high"]},
                    "leadership_lean": {"enum": ["ic", "lead", "either"]},
                    "autonomy_need": {"enum": ["low", "medium", "high"]},
                    "growth_drive": {"enum": ["low", "medium", "high"]},
                },
            },
        },
    },
}

CAREER = ScanDomain(
    id="career",
    retrieval_queries={
        "professional_identity": "career, job, role, profession, industry, expertise, seniority, what they do for work",
        "how_they_execute": "how they work, planning, shipping, execution style, productivity, getting things done, process",
        "strengths": "strengths, skills, what they are good at, accomplishments, wins, talents",
        "growth_areas": "weaknesses, struggles, gaps, things they want to improve, blind spots, frustrations",
        "ideal_next_role": "career goals, ambitions, what they want next, ideal job, environment they thrive in",
        "career_signal": "risk tolerance, leadership, autonomy, ambition, drive, working independently vs leading teams",
    },
    system_prompt=_CAREER_SYSTEM,
    user_prompt_template=_CAREER_USER_PROMPT,
    tool_name="submit_career_card",
    tool_schema=_CAREER_TOOL,
    section_titles={
        "professional_identity": "Professional Identity",
        "how_they_execute": "How They Execute",
        "strengths": "Strengths",
        "growth_areas": "Growth Areas",
        "ideal_next_role": "Ideal Next Role",
    },
    signal_key="career_signal",
    needs_section_key="growth_areas",
    sensitivity="low",
)


# ============================================================
# RELATIONSHIPS — how someone connects (sensitive, non-clinical)
# ============================================================

_REL_DISCLAIMER = (
    "A reflective, non-clinical sketch generated from your own writing — not a "
    "psychological assessment, diagnosis, or advice."
)

_REL_SYSTEM = f"""You are analyzing someone's personal knowledge base — their notes, journals, and reflections — to create a gentle, non-clinical "relationships card": how they tend to connect with others.

Rules:
- Be warm, specific, and evidence-based. Only reflect what the notes show.
- Do NOT diagnose, label with clinical terms, or give advice.
- This is a self-reflection mirror, not an assessment. {_REL_DISCLAIMER}
- Each section should be 3-5 sentences. Kind and honest, not generic."""

_REL_USER_PROMPT = """Here are excerpts from this person's knowledge base:

<notes>
{notes}
</notes>

{external_signals_block}Return your analysis by calling the `submit_relationship_card` tool with these sections:
- how_they_connect: How they tend to relate to and bond with others.
- communication_style: How they express themselves and listen.
- what_they_value: What they seem to care about most in their relationships.
- patterns: Recurring relational patterns the writing gently suggests (non-judgmental).
- what_they_need: What tends to help them feel understood and supported.
- relationship_signal: Calibrated, non-clinical tendencies:
  - communication_style: direct | diplomatic | reserved
  - conflict_approach: avoidant | engaging | collaborative
  - emotional_openness: low | medium | high
  - support_style: practical | emotional | both
  - independence: low | medium | high"""

_REL_TOOL = {
    "name": "submit_relationship_card",
    "description": "Submit the structured, non-clinical relationships card.",
    "input_schema": {
        "type": "object",
        "required": [
            "how_they_connect", "communication_style", "what_they_value",
            "patterns", "what_they_need", "relationship_signal",
        ],
        "properties": {
            "how_they_connect": {"type": "string"},
            "communication_style": {"type": "string"},
            "what_they_value": {"type": "string"},
            "patterns": {"type": "string"},
            "what_they_need": {"type": "string"},
            "relationship_signal": {
                "type": "object",
                "required": [
                    "communication_style", "conflict_approach",
                    "emotional_openness", "support_style", "independence",
                ],
                "properties": {
                    "communication_style": {"enum": ["direct", "diplomatic", "reserved"]},
                    "conflict_approach": {"enum": ["avoidant", "engaging", "collaborative"]},
                    "emotional_openness": {"enum": ["low", "medium", "high"]},
                    "support_style": {"enum": ["practical", "emotional", "both"]},
                    "independence": {"enum": ["low", "medium", "high"]},
                },
            },
        },
    },
}

RELATIONSHIPS = ScanDomain(
    id="relationships",
    retrieval_queries={
        "how_they_connect": "relationships, friends, family, partner, connecting with people, bonding, social life",
        "communication_style": "communication, expressing feelings, listening, conversations, how they talk to people",
        "what_they_value": "what they value in people, loyalty, trust, honesty, what matters in relationships",
        "patterns": "recurring patterns, conflict, distance, closeness, how relationships tend to go",
        "what_they_need": "what they need from others, support, feeling understood, what helps them",
        "relationship_signal": "openness, conflict, independence, emotional expression, how they handle closeness and distance",
    },
    system_prompt=_REL_SYSTEM,
    user_prompt_template=_REL_USER_PROMPT,
    tool_name="submit_relationship_card",
    tool_schema=_REL_TOOL,
    section_titles={
        "how_they_connect": "How They Connect",
        "communication_style": "Communication Style",
        "what_they_value": "What They Value",
        "patterns": "Patterns",
        "what_they_need": "What They Need",
    },
    signal_key="relationship_signal",
    needs_section_key="what_they_need",
    sensitivity="medium",
    disclaimer=_REL_DISCLAIMER,
)


# The registry. Adding a domain = one entry here.
DOMAINS: dict[str, ScanDomain] = {
    "founder": FOUNDER,
    "career": CAREER,
    "relationships": RELATIONSHIPS,
}

DEFAULT_DOMAIN = "founder"


def get_domain(domain: Optional[str]) -> ScanDomain:
    """Resolve a domain id to its config, defaulting to founder."""
    return DOMAINS.get(domain or DEFAULT_DOMAIN, FOUNDER)
