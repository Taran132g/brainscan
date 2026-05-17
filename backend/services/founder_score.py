from typing import Optional

# Founder scoring rubric based on empirical research:
# Sources: PNAS (2023, n=10,541), First Round Capital 10-Year Study,
#          Kauffman Foundation, YC/Paul Graham, HBS, Carta 2025, NFX

# Signal weights (all deltas from baseline, normalized to 0-100 score)
SIGNAL_WEIGHTS = {
    "has_co_founder": 20,          # 163% outperformance (First Round)
    "technical_background": 12,    # 230% for B2B, -31% for consumer — context-dependent
    "female_founder": 8,           # 63% outperformance (First Round)
    "big_tech_employer": 12,       # 160% outperformance (First Round)
    "elite_school": 8,             # ~220% outperformance — network signal, not ability
    "age_under_25": 5,             # ~30% above average (First Round)
    "prior_shipped_product": 10,   # 34% vs 22% success rate (HBS)
    "founder_market_fit": 15,      # 230% more likely to grow (NFX)
    "emotional_stability": 10,     # Only trait consistent across ALL stages (PNAS)
    # Penalties
    "solo_founder_penalty": -10,   # 25% lower seed valuation (Carta 2025)
    "high_neuroticism_penalty": -10, # Consistent negative predictor (PNAS)
}


def compute_founder_score(
    has_co_founder: bool = False,
    technical_background: bool = False,
    female_founder: bool = False,
    big_tech_employer: bool = False,
    elite_school: bool = False,
    age_under_25: bool = False,
    prior_shipped_product: bool = False,
    founder_market_fit: Optional[str] = None,  # "low" | "medium" | "high"
    emotional_stability: Optional[str] = None,  # "low" | "medium" | "high"
) -> dict:
    """
    Compute a founder readiness score (0-100) from structured profile signals.
    Returns score + breakdown for display on the brain card.
    """
    score = 50  # baseline
    breakdown = {}

    if has_co_founder:
        score += SIGNAL_WEIGHTS["has_co_founder"]
        breakdown["Co-founder"] = f"+{SIGNAL_WEIGHTS['has_co_founder']} (team vs. solo)"
    else:
        score += SIGNAL_WEIGHTS["solo_founder_penalty"]
        breakdown["Solo founder"] = f"{SIGNAL_WEIGHTS['solo_founder_penalty']} (lower valuation signal)"

    if technical_background:
        score += SIGNAL_WEIGHTS["technical_background"]
        breakdown["Technical background"] = f"+{SIGNAL_WEIGHTS['technical_background']}"

    if female_founder:
        score += SIGNAL_WEIGHTS["female_founder"]
        breakdown["Diverse team"] = f"+{SIGNAL_WEIGHTS['female_founder']}"

    if big_tech_employer:
        score += SIGNAL_WEIGHTS["big_tech_employer"]
        breakdown["Big-tech experience"] = f"+{SIGNAL_WEIGHTS['big_tech_employer']}"

    if elite_school:
        score += SIGNAL_WEIGHTS["elite_school"]
        breakdown["Elite school network"] = f"+{SIGNAL_WEIGHTS['elite_school']}"

    if age_under_25:
        score += SIGNAL_WEIGHTS["age_under_25"]
        breakdown["Under 25"] = f"+{SIGNAL_WEIGHTS['age_under_25']}"

    if prior_shipped_product:
        score += SIGNAL_WEIGHTS["prior_shipped_product"]
        breakdown["Prior shipped product"] = f"+{SIGNAL_WEIGHTS['prior_shipped_product']}"

    if founder_market_fit == "high":
        score += SIGNAL_WEIGHTS["founder_market_fit"]
        breakdown["Founder-market fit"] = f"+{SIGNAL_WEIGHTS['founder_market_fit']} (strong domain obsession)"
    elif founder_market_fit == "medium":
        score += SIGNAL_WEIGHTS["founder_market_fit"] // 2
        breakdown["Founder-market fit"] = f"+{SIGNAL_WEIGHTS['founder_market_fit'] // 2} (moderate)"

    if emotional_stability == "low":
        score += SIGNAL_WEIGHTS["high_neuroticism_penalty"]
        breakdown["Emotional stability"] = f"{SIGNAL_WEIGHTS['high_neuroticism_penalty']} (neuroticism signal)"
    elif emotional_stability == "high":
        score += SIGNAL_WEIGHTS["emotional_stability"]
        breakdown["Emotional stability"] = f"+{SIGNAL_WEIGHTS['emotional_stability']}"

    return {
        "score": max(0, min(100, score)),
        "breakdown": breakdown,
        "label": _score_label(score),
    }


def _score_label(score: int) -> str:
    if score >= 80:
        return "Strong"
    elif score >= 65:
        return "Promising"
    elif score >= 50:
        return "Developing"
    else:
        return "Early Stage"
