"""
Founder scoring rubric — server-side computation.

Re-calibrated 2026-05-27 to give realistic ranks:
  5/10  = average platform user
  6-7   = solid track record (shipped something, real domain, mid-tier school)
  8-9   = top 10%
  10/10 = top 1% (all signals high + elite school OR big-tech OR prior exit)

Lower baseline + smaller per-signal weights so no single field dominates.

Key context: every user on this platform is solo by definition (that's why
they're here), so "2+ founders" / "solo penalty" signals don't apply.

Sources: PNAS (2023, n=10,541), First Round Capital 10-Year Study,
Kauffman Foundation, YC/Paul Graham, HBS, NFX.
"""

from typing import Optional


BASELINE = 45

SIGNAL_WEIGHTS = {
    # Brain-card-derived signals — graded with explicit low/high asymmetry
    "shipped_before": 5,               # HBS: 34% vs 22% success rate
    "emotional_stability_high": 4,     # PNAS — only Big Five trait consistent across stages
    "emotional_stability_low": -3,     # explicit neuroticism penalty
    "domain_obsession_high": 6,        # NFX: founder-market fit
    "domain_obsession_medium": 3,
    "domain_obsession_low": -2,
    "implied_intelligence_high": 2,
    "implied_intelligence_low": -1,

    # GitHub — high rewarded, low neutral. We don't want to penalize
    # non-technical co-founders (designers, operators, sales) whose GitHub
    # is naturally thin even though they're great matches for technical builders.
    "github_quality_high": 5,
    "github_quality_low": 0,

    # Profile completeness — small bonuses
    "linkedin_presence": 2,
    "school_presence": 1,
    "elite_school_bonus": 5,           # on top of school_presence
    "age_under_25": 2,

    # Verified-from-elsewhere signals (require GitHub OAuth or LinkedIn parse — not wired yet)
    "technical_background": 6,         # +230% for B2B (First Round)
    "linkedin_quality_high": 8,        # Big-tech employer / role progression (First Round +160%)
    "linkedin_quality_medium": 3,
    "big_tech_employer": 6,            # First Round
    "prior_shipped_product_verified": 5,  # On top of shipped_before brain card signal
    "female_founder": 5,               # First Round +63%
    "founder_market_fit_high": 8,
    "founder_market_fit_medium": 3,
}

# Max theoretical lift above baseline (all positives): ~70 → caps at 100.
# Realistic strong founder: 65-75 (6-7/10).
# Average founder: 45-55 (5/10).


ELITE_SCHOOLS = [
    "stanford", "mit", "harvard", "caltech", "princeton", "yale",
    "columbia", "cornell", "dartmouth", "brown", "upenn",
    "university of pennsylvania", "berkeley", "uc berkeley",
    "carnegie mellon", "cmu", "oxford", "cambridge",
]


def is_elite_school(school: Optional[str]) -> bool:
    if not school:
        return False
    s = school.lower()
    return any(e in s for e in ELITE_SCHOOLS)


def compute_founder_score(
    # Brain card signals
    domain_obsession: Optional[str] = None,            # "low" | "medium" | "high"
    emotional_stability: Optional[str] = None,         # "low" | "medium" | "high"
    shipped_before: bool = False,
    implied_intelligence: Optional[str] = None,        # "low" | "medium" | "high"

    # Profile fields
    school: Optional[str] = None,
    linkedin_present: bool = False,
    age: Optional[int] = None,
    github_quality: Optional[str] = None,              # "low" | "medium" | "high"

    # Optional verified signals (defaulted off; wire in when we have data)
    technical_background: bool = False,
    linkedin_quality: Optional[str] = None,            # "low" | "medium" | "high"
    big_tech_employer: bool = False,
    prior_shipped_product_verified: bool = False,
    female_founder: bool = False,
    founder_market_fit: Optional[str] = None,
) -> dict:
    """
    Return {score, rank, tier, breakdown} for a given set of signals.

    rank = 1-10, tier = Visionary/Builder/Operator/Explorer/Newcomer.
    breakdown is a list of (label, points) for explainability.
    """
    score = BASELINE
    breakdown: list[tuple[str, float]] = []

    def add(label: str, pts: float) -> None:
        nonlocal score
        if pts == 0:
            return
        score += pts
        breakdown.append((label, pts))

    # Brain card signals
    if shipped_before:
        add("Shipped before", SIGNAL_WEIGHTS["shipped_before"])

    if emotional_stability == "high":
        add("Emotional stability (high)", SIGNAL_WEIGHTS["emotional_stability_high"])
    elif emotional_stability == "low":
        add("Emotional stability (low)", SIGNAL_WEIGHTS["emotional_stability_low"])

    if domain_obsession == "high":
        add("Domain obsession (high)", SIGNAL_WEIGHTS["domain_obsession_high"])
    elif domain_obsession == "medium":
        add("Domain obsession (medium)", SIGNAL_WEIGHTS["domain_obsession_medium"])
    elif domain_obsession == "low":
        add("Domain obsession (low)", SIGNAL_WEIGHTS["domain_obsession_low"])

    if implied_intelligence == "high":
        add("Implied intelligence (high)", SIGNAL_WEIGHTS["implied_intelligence_high"])
    elif implied_intelligence == "low":
        add("Implied intelligence (low)", SIGNAL_WEIGHTS["implied_intelligence_low"])

    # GitHub — bonus only, no penalty for sparse/non-technical profiles
    if github_quality == "high":
        add("GitHub (high)", SIGNAL_WEIGHTS["github_quality_high"])

    # Profile completeness
    if linkedin_present:
        add("LinkedIn provided", SIGNAL_WEIGHTS["linkedin_presence"])
    if school:
        add("School provided", SIGNAL_WEIGHTS["school_presence"])
        if is_elite_school(school):
            add(f"Elite school ({school})", SIGNAL_WEIGHTS["elite_school_bonus"])
    if age is not None and age < 25:
        add("Under 25", SIGNAL_WEIGHTS["age_under_25"])

    # Verified signals
    if technical_background:
        add("Technical background", SIGNAL_WEIGHTS["technical_background"])
    if linkedin_quality == "high":
        add("LinkedIn quality (high)", SIGNAL_WEIGHTS["linkedin_quality_high"])
    elif linkedin_quality == "medium":
        add("LinkedIn quality (medium)", SIGNAL_WEIGHTS["linkedin_quality_medium"])
    if big_tech_employer:
        add("Big-tech employer", SIGNAL_WEIGHTS["big_tech_employer"])
    if prior_shipped_product_verified:
        add("Prior shipped product (verified)", SIGNAL_WEIGHTS["prior_shipped_product_verified"])
    if female_founder:
        add("Female founder", SIGNAL_WEIGHTS["female_founder"])
    if founder_market_fit == "high":
        add("Founder-market fit (high)", SIGNAL_WEIGHTS["founder_market_fit_high"])
    elif founder_market_fit == "medium":
        add("Founder-market fit (medium)", SIGNAL_WEIGHTS["founder_market_fit_medium"])

    score = max(0, min(100, round(score)))
    rank = max(1, min(10, round(score / 10)))
    tier = _tier_for_rank(rank)

    return {
        "score": score,
        "rank": rank,
        "tier": tier,
        "breakdown": breakdown,
    }


def _tier_for_rank(rank: int) -> str:
    if rank >= 9:
        return "Visionary"
    if rank >= 7:
        return "Builder"
    if rank >= 5:
        return "Operator"
    if rank >= 3:
        return "Explorer"
    return "Newcomer"
