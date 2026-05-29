"""
Seed the match pool with 10 synthetic founders so the /dashboard/matches
page renders meaningfully before we have a real user base.

Each fake founder gets:
  - A deterministic UUID (so re-running is idempotent)
  - An auth.users row (Supabase admin API)
  - A profiles row with brain card + signal + rank
  - match_profiles + match_needs vectors embedded via Pinecone hosted inference

Run from backend dir:
    source venv/bin/activate
    python scripts/seed_matches.py

Designed mix:
  4 strong matches for a young technical AI-focused founder (Taran's profile):
      Maya Patel        — Stanford business + B2B AI sales tool, NEEDS technical
      Marcus Williams   — Penn State business + consumer app, NEEDS technical
      Sofia Garcia      — UPenn growth marketing, NEEDS technical co-founder
      Hiroshi Sato      — Tokyo CS + design/frontend specialist, NEEDS backend/AI

  Medium matches (different but compatible):
      Riya Sharma       — IIT Bombay growth + GTM, NEEDS technical
      Daniel Cohen      — CMU ML researcher, NEEDS business/ops

  Weaker matches (other technical solo founders):
      Priya Krishnan    — UC Berkeley CS infra, NEEDS marketing/DevRel
      Jordan Kim        — MIT ML infra, NEEDS enterprise sales
      Yuki Tanaka       — Self-taught design, NEEDS sales/ops
      Ethan Park        — Yale finance, NEEDS technical (insurance domain — narrow)
"""

import os
import sys
import uuid

# Resolve backend root so `services.*` imports work
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
load_dotenv()

from services.db import get_client
from services.match_service import upsert_match_vectors


# Deterministic UUID namespace so re-runs don't duplicate
NAMESPACE = uuid.UUID("a1b2c3d4-e5f6-7890-1234-567890abcdef")
DOMAIN = "findingfounders.app"


def synthetic_id(name: str) -> str:
    return str(uuid.uuid5(NAMESPACE, name))


def synthetic_email(name: str) -> str:
    handle = name.lower().replace(" ", ".")
    return f"seed.{handle}@{DOMAIN}"


# ---------- The 10 founders ----------

FOUNDERS = [
    # ===== STRONG matches for a young technical AI/crypto-focused founder =====
    {
        "name": "Maya Patel",
        "city": "Palo Alto, CA",
        "school": "Stanford University",
        "tier": "Builder",
        "rank": 8,
        "brain_card": {
            "sections": {
                "Who They Are": "A Stanford undergrad studying business and CS, with internships at two B2B SaaS startups (one Series B, one YC W23). Spent the last two summers running outbound sales for a vertical AI tool. Knows the GTM playbook for selling AI to mid-market companies.",
                "What They're Building": "Researching an AI-powered sales-research agent that pulls public signals from a target account (recent funding, leadership changes, job postings, tech stack shifts) and writes a tailored intro the rep can send in one click. Has 40+ design partners lined up from her network.",
                "How They Think": "Pragmatic. Frames every decision as 'which lever moves revenue fastest'. Tracks her week in a Notion dashboard with weekly OKRs. Treats sales calls as primary product research.",
                "What They Value": "Speed over polish. Honest feedback loops. Customer obsession. Quiet ambition — wants to build a real company, not chase status. Strong personal ethic around shipping something useful, not just 'AI for X' theater.",
                "What They Likely Need in a Co-Founder": "A deeply technical co-founder who can build the ML pipeline and agent infrastructure from scratch — ideally someone with hands-on experience with LLM agents, vector databases, and production AI systems. Comfortable owning the entire backend so she can own GTM end-to-end.",
            },
            "founder_signal": {
                "domain_obsession": "high",
                "emotional_stability_signal": "high",
                "shipped_before": True,
                "market_orientation": "b2b",
                "implied_intelligence": "high",
            },
        },
        "primary_role": "business",
    },
    {
        "name": "Marcus Williams",
        "city": "State College, PA",
        "school": "Penn State University",
        "tier": "Builder",
        "rank": 7,
        "brain_card": {
            "sections": {
                "Who They Are": "Penn State business student, junior. Co-led the campus entrepreneurship club for two years, hosted 14 founder talks and ran a small student venture fund that deployed $25K into three undergrad startups. Was VP of growth at a campus food-delivery app that scaled to 8 schools before pivoting.",
                "What They're Building": "Working on a consumer app that turns a user's group chats into a private 'highlights reel' — a way for friend groups to remember inside jokes, big moments, and shared context without scrolling. Has 200 alpha users from his Penn State network and the pull-through metrics look promising.",
                "How They Think": "Heavy systems thinker. Maps every problem as a flow diagram before writing code or copy. Believes most distribution is solved by giving the user a story to tell about themselves.",
                "What They Value": "Community over scale. Patient capital. Real friendships over networking. Believes the next wave of consumer apps will be small, specific, and run by 2-3 people who deeply understand one community.",
                "What They Likely Need in a Co-Founder": "A technical co-founder who can build a mobile-first consumer app end-to-end — comfortable with React Native or Swift, backend infra, and shipping fast. Bonus if they share a similar age/college context and want to grow into a CTO role on a serious consumer product.",
            },
            "founder_signal": {
                "domain_obsession": "high",
                "emotional_stability_signal": "high",
                "shipped_before": True,
                "market_orientation": "consumer",
                "implied_intelligence": "medium",
            },
        },
        "primary_role": "business",
    },
    {
        "name": "Sofia Garcia",
        "city": "Philadelphia, PA",
        "school": "University of Pennsylvania",
        "tier": "Builder",
        "rank": 7,
        "brain_card": {
            "sections": {
                "Who They Are": "Wharton senior, growth marketing focus. Ran paid acquisition at a Series A consumer fintech for 9 months, scaled CAC from $84 to $31 across Meta and TikTok. Built a personal Substack on growth tactics (3,400 subscribers, paid newsletter).",
                "What They're Building": "Earliest stages of a creator-economy SaaS — a tool for newsletter writers to A/B test subject lines, intros, and CTAs without code. Has talked to 60 writers; clear willingness to pay for the right product.",
                "How They Think": "Data-driven to a fault. Every claim gets a regression. Treats writing as engineering — has templates and tests for everything. Believes good growth marketing is 80% mechanical and 20% taste.",
                "What They Value": "Substance over hype. The respect of operators she admires. Long compounding bets — willing to build for 3 years if the customer pain is real.",
                "What They Likely Need in a Co-Founder": "A technical co-founder who can ship a real product fast — comfortable with full-stack web, ideally with experience in analytics-heavy SaaS tools. Someone who wants to own product and infra so she can own growth and customer development.",
            },
            "founder_signal": {
                "domain_obsession": "high",
                "emotional_stability_signal": "high",
                "shipped_before": True,
                "market_orientation": "b2b",
                "implied_intelligence": "high",
            },
        },
        "primary_role": "business",
    },
    {
        "name": "Hiroshi Sato",
        "city": "Tokyo, Japan",
        "school": "University of Tokyo",
        "tier": "Builder",
        "rank": 7,
        "brain_card": {
            "sections": {
                "Who They Are": "Computer science student at Tokyo, focus on HCI and frontend systems. Previously interned at a Japanese fintech designing their iOS app. Strong design portfolio with 4 well-reviewed indie iOS apps in personal projects, 50K+ combined downloads.",
                "What They're Building": "Prototyping a personal-finance app focused on visualizing spending the way games show progression — XP bars, streaks, level-ups. Targeting Japanese millennials initially, expanding to other markets later.",
                "How They Think": "Visual-first. Believes most products fail not at the engineering layer but at the moment-of-truth UX. Sketches every screen on paper before writing code. Deep respect for Bret Victor and Jonathan Ive.",
                "What They Value": "Craft, beauty, restraint. A product that 'feels right' is worth shipping; one that doesn't isn't. Believes great teams are small (2-3) and care viscerally about the work.",
                "What They Likely Need in a Co-Founder": "A technical co-founder strong in backend, AI/ML, and data infrastructure — someone who can own everything Hiroshi can't, so the two can move at speed. Ideally builds in public, is comfortable with English, and wants a globally distributed team.",
            },
            "founder_signal": {
                "domain_obsession": "high",
                "emotional_stability_signal": "high",
                "shipped_before": True,
                "market_orientation": "consumer",
                "implied_intelligence": "high",
            },
        },
        "primary_role": "design",
    },
    # ===== MEDIUM matches =====
    {
        "name": "Riya Sharma",
        "city": "Mumbai, India",
        "school": "IIT Bombay",
        "tier": "Builder",
        "rank": 8,
        "brain_card": {
            "sections": {
                "Who They Are": "IIT Bombay senior, electrical engineering. Ran growth at a YC-backed Indian B2B startup that hit $3M ARR in 18 months — managed a team of 4, owned content + paid + partnerships. Speaker at three Asia growth conferences.",
                "What They're Building": "An AI-powered competitive intelligence tool for Indian SaaS founders — pulls pricing, positioning, and feature shipping cadence from 1000+ Indian B2B companies into a daily digest. Currently 80 paying customers at $19/mo.",
                "How They Think": "Operator mindset. Strong taste for unsexy but high-leverage problems. Believes most growth comes from a 12-month obsession with one channel, not a multi-channel scattershot.",
                "What They Value": "Compounding focus. Operator-led companies over investor-led ones. Long-term thinking with quarterly execution rigor. Believes India is the next great market for B2B SaaS founders.",
                "What They Likely Need in a Co-Founder": "A strong technical co-founder who can own the AI scraping + analysis pipeline. Someone who's comfortable with messy data, owns the entire backend, and can move fast. Bonus if they have any context on the Indian market.",
            },
            "founder_signal": {
                "domain_obsession": "high",
                "emotional_stability_signal": "high",
                "shipped_before": True,
                "market_orientation": "b2b",
                "implied_intelligence": "high",
            },
        },
        "primary_role": "business",
    },
    {
        "name": "Daniel Cohen",
        "city": "Pittsburgh, PA",
        "school": "Carnegie Mellon University",
        "tier": "Visionary",
        "rank": 9,
        "brain_card": {
            "sections": {
                "Who They Are": "CMU PhD student in ML, third year. Published two papers at NeurIPS on synthetic data generation for vision. Previously a research engineer at Google Brain for two years before grad school. Active maintainer of two open-source ML libraries (3K + 1.2K stars).",
                "What They're Building": "A platform for generating synthetic training data for computer vision models — initial market is autonomous driving and robotics. Pilot conversations with two well-funded autonomy startups; technical demo is strong.",
                "How They Think": "Deep, slow, rigorous. Treats every product decision like a research paper. Tends to overthink go-to-market because his instinct is to keep refining the model. Honest about this gap.",
                "What They Value": "Technical excellence. Open source. Long-term scientific impact over short-term metrics. Honest collaboration with people who push back.",
                "What They Likely Need in a Co-Founder": "A business co-founder who can own sales, partnerships, and operations — someone who's sold deep-tech products into enterprise before, can navigate procurement, and has the patience for 6-month sales cycles. Ideally older / more experienced than Daniel.",
            },
            "founder_signal": {
                "domain_obsession": "high",
                "emotional_stability_signal": "medium",
                "shipped_before": True,
                "market_orientation": "infrastructure",
                "implied_intelligence": "high",
            },
        },
        "primary_role": "technical",
    },
    # ===== WEAKER matches (similar profiles or specialized) =====
    {
        "name": "Priya Krishnan",
        "city": "Berkeley, CA",
        "school": "UC Berkeley",
        "tier": "Builder",
        "rank": 8,
        "brain_card": {
            "sections": {
                "Who They Are": "Berkeley CS senior, focus on distributed systems. Two internships at infrastructure companies (Datadog and a stealth-mode observability startup). Heavy open-source contributor — 500+ commits to two major projects last year.",
                "What They're Building": "Open-source observability for LLM agents — captures every tool call, every prompt mutation, every retry, and surfaces them in a flame graph debugger. Already 800 GitHub stars and a small but vocal Discord community.",
                "How They Think": "Engineering-first. Strong belief that the future of software is fewer, deeper tools, not more broad ones. Highly suspicious of growth hacks. Will spend 6 hours benchmarking before writing one line of marketing.",
                "What They Value": "Open source as a moral commitment. Builder-first communities. Long-term reputation in the engineering community. Not motivated by money beyond a comfortable life.",
                "What They Likely Need in a Co-Founder": "A DevRel / community-builder co-founder who can own the relationship with developers — runs Discord, ships docs, gives talks at AI infrastructure conferences. Bonus if they have a strong personal brand in the open-source world already.",
            },
            "founder_signal": {
                "domain_obsession": "high",
                "emotional_stability_signal": "medium",
                "shipped_before": True,
                "market_orientation": "infrastructure",
                "implied_intelligence": "high",
            },
        },
        "primary_role": "technical",
    },
    {
        "name": "Jordan Kim",
        "city": "Cambridge, MA",
        "school": "MIT",
        "tier": "Visionary",
        "rank": 9,
        "brain_card": {
            "sections": {
                "Who They Are": "MIT CS undergrad, focused on systems and compilers. Two summers at Anthropic on the inference team, one summer at Modular. Published a benchmark paper on small-model serving that got picked up in HN twice.",
                "What They're Building": "Earliest exploration of a new ML serving infrastructure — making it possible to serve hundreds of small fine-tuned models on a single GPU efficiently. Already has interest from two AI agent startups.",
                "How They Think": "Deeply technical. Resistant to compromise on architecture decisions. Believes the next big infrastructure shifts will come from people who deeply understand both ML and compilers.",
                "What They Value": "Technical depth. Quiet conviction. Builders over operators. Willing to spend years on one technical problem if it matters.",
                "What They Likely Need in a Co-Founder": "A senior enterprise sales executive who has sold infrastructure to AI companies before — someone with a Rolodex of CTOs at top model labs and the patience to close 6-figure ARR deals. This is mission-critical for the business.",
            },
            "founder_signal": {
                "domain_obsession": "high",
                "emotional_stability_signal": "high",
                "shipped_before": True,
                "market_orientation": "infrastructure",
                "implied_intelligence": "high",
            },
        },
        "primary_role": "technical",
    },
    {
        "name": "Yuki Tanaka",
        "city": "Brooklyn, NY",
        "school": "Self-taught",
        "tier": "Operator",
        "rank": 6,
        "brain_card": {
            "sections": {
                "Who They Are": "Self-taught designer turned founder. Spent four years at a creator-economy startup running brand and product design before going independent. Strong portfolio in consumer apps and brand identity. 18K Twitter followers in the design community.",
                "What They're Building": "A voice AI for independent restaurants — handles phone reservations, takeout orders, and basic FAQs in the restaurant's own voice (cloned from a 30-second sample). Already piloting with 4 NYC restaurants.",
                "How They Think": "Visual-first, taste-driven. Believes most consumer products fail because they look generic. Sketches everything first. Allergic to over-engineering; wants to ship the simplest version that works.",
                "What They Value": "Craft. The respect of designers she admires. Real customer love. Believes the next wave of AI products will be won by the teams with the strongest taste, not the strongest models.",
                "What They Likely Need in a Co-Founder": "A sales-first operator co-founder who can own restaurant outreach, demos, and onboarding. Someone with restaurant industry connections, or willing to grind 100+ cold calls/week to grow distribution. Tech is secondary; taste and grit are primary.",
            },
            "founder_signal": {
                "domain_obsession": "medium",
                "emotional_stability_signal": "high",
                "shipped_before": True,
                "market_orientation": "b2b",
                "implied_intelligence": "medium",
            },
        },
        "primary_role": "design",
    },
    {
        "name": "Ethan Park",
        "city": "New Haven, CT",
        "school": "Yale University",
        "tier": "Builder",
        "rank": 7,
        "brain_card": {
            "sections": {
                "Who They Are": "Yale undergrad, double major in economics and computer science. Previously interned at a top quant fund and a climate-tech VC firm. Built a personal investment-tracking tool that won a hackathon at Yale.",
                "What They're Building": "An insurance-pricing platform that uses climate data to model property risk more accurately — initially targeting reinsurers and large carriers in flood-prone states. Has signed two LOIs and ongoing conversations with three more.",
                "How They Think": "Quantitative and patient. Approaches every problem like a hedge-fund analyst — what are the unknowns, what's the expected value, what would invalidate the thesis. Comfortable with long timelines.",
                "What They Value": "Intellectual honesty. The reputation of working with serious people. Long-term compounding bets in real industries (insurance, climate, finance).",
                "What They Likely Need in a Co-Founder": "A technical co-founder with deep experience in geospatial data, climate modeling, or insurance-tech. Someone who can own the entire technical platform end-to-end while Ethan owns sales, partnerships, and capital. Insurance domain knowledge is a strong bonus.",
            },
            "founder_signal": {
                "domain_obsession": "high",
                "emotional_stability_signal": "high",
                "shipped_before": True,
                "market_orientation": "b2b",
                "implied_intelligence": "high",
            },
        },
        "primary_role": "domain",
    },
]


def bootstrap_existing_user_vector(user_id: str) -> None:
    """
    Pull a real user's brain card from Postgres and write their match vectors
    into Pinecone. Useful when their last upload predated the matching system
    so they have a brain card on file but no match vectors yet.
    """
    supabase = get_client()
    res = (
        supabase.table("profiles")
        .select("full_name, city, school, founder_tier, founder_rank, brain_card, founder_signal")
        .eq("id", user_id)
        .limit(1)
        .execute()
    )
    row = (res.data or [None])[0]
    if not row or not row.get("brain_card"):
        print(f"  ! {user_id}: no brain card on file, skipping match vector bootstrap")
        return
    brain_card = {
        "sections": row.get("brain_card") or {},
        "founder_signal": row.get("founder_signal") or {},
    }
    ok = upsert_match_vectors(
        user_id=user_id,
        brain_card=brain_card,
        profile_meta={
            "full_name": row.get("full_name") or "Founder",
            "city": row.get("city") or "",
            "school": row.get("school") or "",
            "founder_tier": row.get("founder_tier"),
            "founder_rank": row.get("founder_rank"),
        },
    )
    print(f"  ✓ {row.get('full_name') or user_id}: match vectors {'stored' if ok else 'SKIPPED'}")


def seed():
    supabase = get_client()

    # Bootstrap any pre-existing real users whose brain card was generated
    # before the matching system existed. (Taran is the obvious one.)
    print("Bootstrapping match vectors for existing real users...")
    existing_real = (
        supabase.table("profiles")
        .select("id, email, full_name")
        .not_.is_("brain_card", "null")
        .execute()
    )
    seeded_emails_prefix = "seed."
    for row in (existing_real.data or []):
        email = row.get("email") or ""
        if email.startswith(seeded_emails_prefix):
            continue
        bootstrap_existing_user_vector(row["id"])
    print()

    # Find existing fake users so we don't recreate auth records
    existing = supabase.auth.admin.list_users()
    existing_emails = {u.email: u.id for u in existing}

    for f in FOUNDERS:
        name = f["name"]
        email = synthetic_email(name)

        # Get or create auth.users entry
        if email in existing_emails:
            user_id = existing_emails[email]
            print(f"↺ {name}: auth user exists ({user_id})")
        else:
            user_id = synthetic_id(name)
            try:
                supabase.auth.admin.create_user({
                    "email": email,
                    "password": "seeded-fake-not-for-login",
                    "email_confirm": True,
                    "user_metadata": {"full_name": name, "seeded": True},
                })
                # Re-fetch to get the actual id assigned by Supabase
                refreshed = supabase.auth.admin.list_users()
                actual_user = next((u for u in refreshed if u.email == email), None)
                if actual_user:
                    user_id = actual_user.id
                print(f"+ {name}: created auth user ({user_id})")
            except Exception as e:
                print(f"x {name}: auth create failed: {e}")
                continue

        # Upsert profile row
        try:
            supabase.table("profiles").upsert({
                "id": user_id,
                "email": email,
                "full_name": name,
                "city": f["city"],
                "school": f["school"],
                "founder_tier": f["tier"],
                "founder_rank": f["rank"],
                "founder_score": f["rank"] * 10,
                "brain_card": f["brain_card"]["sections"],
                "founder_signal": f["brain_card"]["founder_signal"],
                "brain_confidence": 85,
            }, on_conflict="id").execute()
        except Exception as e:
            print(f"  ! {name}: profile upsert failed: {e}")
            continue

        # Embed + upsert match vectors
        try:
            ok = upsert_match_vectors(
                user_id=user_id,
                brain_card=f["brain_card"],
                profile_meta={
                    "full_name": name,
                    "city": f["city"],
                    "school": f["school"],
                    "founder_tier": f["tier"],
                    "founder_rank": f["rank"],
                },
                primary_role=f.get("primary_role"),
            )
            print(f"  ✓ {name}: match vectors {'stored' if ok else 'SKIPPED (no text)'}")
        except Exception as e:
            print(f"  ! {name}: match vector upsert failed: {e}")

    print("\nDone seeding.")


if __name__ == "__main__":
    seed()
