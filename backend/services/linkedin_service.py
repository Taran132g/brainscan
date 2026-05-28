"""
LinkedIn lookup — accepts a profile URL + a few optional fields and grades
the founder's LinkedIn quality with a simple deterministic heuristic.

We don't fetch LinkedIn directly (their public API doesn't allow it without
approved permissions, and scraping violates their TOS). The grade is based
on user-submitted "latest company", "previous employers", and "years of
experience" — matched against a big-tech / notable-startup keyword list.

UI flags this as "self-reported" until we can verify via OAuth or an
enrichment API in a later phase.
"""

import re
import time
from typing import Optional


LINKEDIN_URL_RE = re.compile(r"^https?://(www\.)?linkedin\.com/in/[A-Za-z0-9\-_/]+/?$", re.I)


# Companies that meaningfully signal "big-tech employer" per First Round's
# 160% outperformance finding. Kept short and high-signal — adding too many
# would dilute the signal.
BIG_TECH = {
    "google", "alphabet", "meta", "facebook", "instagram", "whatsapp",
    "amazon", "aws", "apple", "microsoft", "netflix", "nvidia",
    "stripe", "shopify", "salesforce", "oracle",
    "openai", "anthropic", "databricks", "snowflake", "datadog",
    "twitter", "x corp", "linkedin", "uber", "lyft", "airbnb",
    "tesla", "spacex", "palantir", "tiktok", "bytedance",
}

# Other strong-signal employers (recognized startups, funds, prestigious R&D)
NOTABLE = {
    "y combinator", "yc", "a16z", "andreessen horowitz", "sequoia",
    "founders fund", "first round", "thiel fellowship",
    "deepmind", "google brain", "fair", "mistral",
    "vercel", "supabase", "linear", "notion", "figma", "canva",
    "robinhood", "coinbase", "ramp", "brex", "plaid", "rippling",
    "scale ai", "hugging face", "perplexity",
}


def validate_url(url: str) -> str:
    """Normalize + validate a LinkedIn URL. Returns the cleaned URL or raises."""
    if not url:
        raise ValueError("LinkedIn URL is required")
    url = url.strip().rstrip("/")
    # Allow paste forms like "linkedin.com/in/foo" (add scheme)
    if not url.startswith(("http://", "https://")):
        url = "https://" + url
    if not LINKEDIN_URL_RE.match(url + "/"):
        # Try matching without trailing slash too (regex allows optional)
        if not LINKEDIN_URL_RE.match(url):
            raise ValueError("Invalid LinkedIn URL — must look like https://linkedin.com/in/your-handle")
    return url


def _normalize_company(name: Optional[str]) -> str:
    if not name:
        return ""
    return re.sub(r"[^a-z0-9 ]", "", name.lower()).strip()


def _matches_set(name: str, lookup: set[str]) -> bool:
    if not name:
        return False
    for candidate in lookup:
        if candidate in name:
            return True
    return False


def grade(
    latest_company: Optional[str] = None,
    latest_role: Optional[str] = None,
    previous_employers: Optional[str] = None,
    years_experience: Optional[int] = None,
) -> tuple[str, bool]:
    """
    Return (quality_grade, big_tech_employer_flag).

    quality_grade ∈ {"low", "medium", "high"}
    big_tech_employer_flag is True when latest_company OR a previous employer
    matches the BIG_TECH set — surfaced separately so the founder rank rubric
    can apply its +6 bonus distinct from the quality grade.
    """
    latest_norm = _normalize_company(latest_company)
    prev_norm = _normalize_company(previous_employers)
    role_norm = _normalize_company(latest_role)

    is_big_tech = _matches_set(latest_norm, BIG_TECH) or _matches_set(prev_norm, BIG_TECH)
    is_notable = _matches_set(latest_norm, NOTABLE) or _matches_set(prev_norm, NOTABLE)
    has_founder_title = "founder" in role_norm or "ceo" in role_norm or "cto" in role_norm

    yrs = years_experience or 0

    # HIGH: clear big-tech employer OR (founder + 5+ yrs experience)
    if is_big_tech and yrs >= 2:
        return "high", True
    if is_big_tech:
        return "high", True
    if has_founder_title and yrs >= 5:
        return "high", False

    # MEDIUM: notable employer, OR latest_company + 2+ yrs, OR founder + 2+ yrs
    if is_notable:
        return "medium", False
    if latest_norm and yrs >= 2:
        return "medium", False
    if has_founder_title and yrs >= 2:
        return "medium", False

    # LOW: URL only, or sparse data
    return "low", False


def persist_to_profile(
    user_id: str,
    linkedin_url: str,
    latest_company: Optional[str],
    latest_role: Optional[str],
    previous_employers: Optional[str],
    years_experience: Optional[int],
    quality: str,
    big_tech_employer: bool,
) -> None:
    from services.db import get_client
    payload = {
        "linkedin": linkedin_url,
        "linkedin_connected": True,
        "linkedin_connected_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "linkedin_quality": quality,
        "linkedin_data": {
            "url": linkedin_url,
            "latest_company": latest_company,
            "latest_role": latest_role,
            "previous_employers": previous_employers,
            "years_experience": years_experience,
            "self_reported": True,
        },
        "big_tech_employer": big_tech_employer,
    }
    get_client().table("profiles").update(payload).eq("id", user_id).execute()


def disconnect(user_id: str) -> None:
    from services.db import get_client
    get_client().table("profiles").update({
        "linkedin_connected": False,
        "linkedin_quality": None,
        "linkedin_data": None,
        "big_tech_employer": False,
        "linkedin_connected_at": None,
    }).eq("id", user_id).execute()


def get_profile_linkedin(user_id: str) -> Optional[dict]:
    from services.db import get_client
    res = (
        get_client()
        .table("profiles")
        .select("linkedin, linkedin_connected, linkedin_quality, linkedin_data, big_tech_employer, linkedin_connected_at")
        .eq("id", user_id)
        .limit(1)
        .execute()
    )
    return (res.data or [None])[0]
