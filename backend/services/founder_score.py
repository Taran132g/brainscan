from typing import Optional

# Founder scoring rubric — revised for FindingFounders context.
#
# Key context: every user on this platform is BY DEFINITION solo and looking for
# a co-founder. So traditional "2+ founders" and "solo penalty" signals are
# useless here — they apply to either 0% or 100% of users. We replaced them
# with verifiable platform signals (GitHub, LinkedIn) and an LLM-derived
# implied intelligence signal from the vault.
#
# Sources: PNAS (2023, n=10,541), First Round Capital 10-Year Study,
# Kauffman Foundation, YC/Paul Graham, HBS, NFX

SIGNAL_WEIGHTS = {
    # github_quality is REQUIRED (every user must connect GitHub before upload),
    # so it's a modifier, not a major signal. Tight range so a thin GitHub
    # doesn't tank a founder, and a strong one doesn't carry the whole score.
    "github_quality_high": 2.5,    # bonus for proven shipping
    "github_quality_low": -2.5,    # penalty for thin / abandoned profile
    # github_quality_medium = 0 (no adjustment)

    "founder_market_fit": 15,      # 230% more likely to grow (NFX) — derived from vault + LinkedIn
    "linkedin_quality": 12,        # Employer prestige + role progression (subsumes big-tech employer signal)
    "technical_background": 12,    # +230% for B2B (First Round)

    # Medium signals
    "emotional_stability": 10,     # Only Big Five trait consistent across ALL stages (PNAS)
    "prior_shipped_product": 10,   # 34% vs 22% success rate (HBS) — verifiable from GitHub/App Store/PH

    # Small signals
    "female_founder": 8,           # 63% outperformance (First Round)
    "elite_school": 8,             # ~220% outperformance — but mostly a network signal, not ability
    "implied_intelligence": 6,     # Claude-derived from vault writing quality / conceptual depth
    "age_under_25": 5,             # ~30% above average (First Round) — venture-backed software bias

    # Penalty
    "high_neuroticism_penalty": -10,  # Consistent negative predictor across all stages (PNAS)
}

# Max theoretical lift above baseline: 15+15+12+12+10+10+8+8+6+5 = 101
# Min realistic floor below baseline: -10
# Baseline: 50 → score capped at 0-100


def compute_founder_score(
    technical_background: bool = False,
    female_founder: bool = False,
    elite_school: bool = False,
    age_under_25: bool = False,
    prior_shipped_product: bool = False,
    github_quality: Optional[str] = None,      # "low" | "medium" | "high"
    linkedin_quality: Optional[str] = None,    # "low" | "medium" | "high"
    founder_market_fit: Optional[str] = None,  # "low" | "medium" | "high"
    emotional_stability: Optional[str] = None, # "low" | "medium" | "high"
    implied_intelligence: Optional[str] = None,# "low" | "medium" | "high"
) -> dict:
    """
    Compute a founder readiness score (0-100) from structured profile signals.
    Returns score + breakdown for display on the brain card.

    Note: graded signals scale with grade:
      high   → full weight
      medium → half weight
      low    → 0 points (no penalty)
    """
    score = 50  # baseline
    breakdown = {}

    if github_quality:
        # Tight ±2.5 range — github is required so we modify, not dominate
        if github_quality == "high":
            score += SIGNAL_WEIGHTS["github_quality_high"]
            breakdown["GitHub (high)"] = f"+{SIGNAL_WEIGHTS['github_quality_high']}"
        elif github_quality == "low":
            score += SIGNAL_WEIGHTS["github_quality_low"]
            breakdown["GitHub (low)"] = f"{SIGNAL_WEIGHTS['github_quality_low']} (thin / abandoned profile)"
        # medium → no change

    if founder_market_fit:
        pts = _graded(founder_market_fit, SIGNAL_WEIGHTS["founder_market_fit"])
        if pts:
            score += pts
            breakdown[f"Founder-market fit ({founder_market_fit})"] = f"+{pts}"

    if linkedin_quality:
        pts = _graded(linkedin_quality, SIGNAL_WEIGHTS["linkedin_quality"])
        if pts:
            score += pts
            breakdown[f"LinkedIn ({linkedin_quality})"] = f"+{pts}"

    if technical_background:
        score += SIGNAL_WEIGHTS["technical_background"]
        breakdown["Technical background"] = f"+{SIGNAL_WEIGHTS['technical_background']}"

    if emotional_stability == "low":
        score += SIGNAL_WEIGHTS["high_neuroticism_penalty"]
        breakdown["Emotional stability (low)"] = f"{SIGNAL_WEIGHTS['high_neuroticism_penalty']} (neuroticism signal)"
    elif emotional_stability == "high":
        score += SIGNAL_WEIGHTS["emotional_stability"]
        breakdown["Emotional stability (high)"] = f"+{SIGNAL_WEIGHTS['emotional_stability']}"
    elif emotional_stability == "medium":
        score += SIGNAL_WEIGHTS["emotional_stability"] // 2
        breakdown["Emotional stability (medium)"] = f"+{SIGNAL_WEIGHTS['emotional_stability'] // 2}"

    if prior_shipped_product:
        score += SIGNAL_WEIGHTS["prior_shipped_product"]
        breakdown["Prior shipped product"] = f"+{SIGNAL_WEIGHTS['prior_shipped_product']}"

    if female_founder:
        score += SIGNAL_WEIGHTS["female_founder"]
        breakdown["Diverse team"] = f"+{SIGNAL_WEIGHTS['female_founder']}"

    if elite_school:
        score += SIGNAL_WEIGHTS["elite_school"]
        breakdown["Elite school network"] = f"+{SIGNAL_WEIGHTS['elite_school']}"

    if implied_intelligence:
        pts = _graded(implied_intelligence, SIGNAL_WEIGHTS["implied_intelligence"])
        if pts:
            score += pts
            breakdown[f"Implied intelligence ({implied_intelligence})"] = f"+{pts}"

    if age_under_25:
        score += SIGNAL_WEIGHTS["age_under_25"]
        breakdown["Under 25"] = f"+{SIGNAL_WEIGHTS['age_under_25']}"

    return {
        "score": max(0, min(100, score)),
        "breakdown": breakdown,
        "label": _score_label(score),
    }


def _graded(grade: str, max_pts: int) -> int:
    """Scale points by grade: high=full, medium=half, low=0."""
    if grade == "high":
        return max_pts
    if grade == "medium":
        return max_pts // 2
    return 0


def _score_label(score: int) -> str:
    if score >= 80:
        return "Strong"
    elif score >= 65:
        return "Promising"
    elif score >= 50:
        return "Developing"
    else:
        return "Early Stage"
