"""
Seed synthetic people into the per-domain people-matching pools (career +
relationships) so "meet similar people" returns real results pre-launch.

Each person gets a career scan + a relationships scan embedded into
scan_<domain>_{profile,needs}. Deterministic UUIDs → idempotent re-runs.

Run from backend dir:
    source venv/bin/activate && python scripts/seed_scans.py
"""

import os, sys, uuid
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from dotenv import load_dotenv; load_dotenv()
from services.match_service import upsert_scan_match_vectors

NS = uuid.UUID("b2c3d4e5-f6a7-8901-2345-67890abcdef1")
def uid(name): return str(uuid.uuid5(NS, "scan:" + name))

PEOPLE = [
    {
        "name": "Alex Rivera", "city": "Austin, TX", "school": "UT Austin",
        "career": {
            "sections": {
                "Professional Identity": "Senior product manager in B2B SaaS, ~7 years, moving toward a head-of-product role.",
                "How They Execute": "Plans deliberately, writes specs before building, runs tight discovery before committing.",
                "Strengths": "Synthesizing messy input into a clear roadmap; aligning eng + design + sales.",
                "Growth Areas": "Can over-plan and ship slower than scrappier peers; learning to cut scope.",
                "Ideal Next Role": "Head of product at a Series A where strategy and execution both matter.",
            },
            "signal": {"execution_bias":"plan","risk_tolerance":"medium","leadership_lean":"lead","autonomy_need":"medium","growth_drive":"high"},
        },
        "relationships": {
            "sections": {
                "How They Connect": "Warm but measured; builds trust slowly and deeply with a small circle.",
                "Communication Style": "Diplomatic, listens first, frames hard feedback gently.",
                "What They Value": "Loyalty, consistency, people who follow through.",
                "Patterns": "Tends to absorb others' stress; can avoid raising small frictions until they pile up.",
                "What They Need": "Direct partners who say what they mean so nothing festers.",
            },
            "signal": {"communication_style":"diplomatic","conflict_approach":"collaborative","emotional_openness":"medium","support_style":"both","independence":"medium"},
        },
    },
    {
        "name": "Sam Chen", "city": "San Francisco, CA", "school": "UC Berkeley",
        "career": {
            "sections": {
                "Professional Identity": "Staff backend engineer, infra and distributed systems, ~9 years.",
                "How They Execute": "Ships fast, prototypes in code, prefers working software over docs.",
                "Strengths": "Deep technical judgment; unblocks hard problems quickly.",
                "Growth Areas": "Impatient with process; sometimes ships before aligning stakeholders.",
                "Ideal Next Role": "Founding engineer or principal IC at a small fast team.",
            },
            "signal": {"execution_bias":"ship","risk_tolerance":"high","leadership_lean":"ic","autonomy_need":"high","growth_drive":"medium"},
        },
        "relationships": {
            "sections": {
                "How They Connect": "Reserved at first; bonds through shared work and ideas, not small talk.",
                "Communication Style": "Direct and terse; values precision over warmth.",
                "What They Value": "Competence, honesty, low drama.",
                "Patterns": "Withdraws under conflict rather than engaging; needs space to process.",
                "What They Need": "Patience and clear, low-pressure communication.",
            },
            "signal": {"communication_style":"direct","conflict_approach":"avoidant","emotional_openness":"low","support_style":"practical","independence":"high"},
        },
    },
    {
        "name": "Maya Okafor", "city": "New York, NY", "school": "NYU",
        "career": {
            "sections": {
                "Professional Identity": "Growth marketing lead, consumer apps, ~6 years; strong brand instincts.",
                "How They Execute": "Bias to ship and iterate; runs many small experiments, kills losers fast.",
                "Strengths": "Storytelling, channel intuition, rallying a team around a narrative.",
                "Growth Areas": "Can chase shiny tactics; building patience for long compounding bets.",
                "Ideal Next Role": "VP marketing / first marketing hire at a consumer startup.",
            },
            "signal": {"execution_bias":"ship","risk_tolerance":"high","leadership_lean":"lead","autonomy_need":"medium","growth_drive":"high"},
        },
        "relationships": {
            "sections": {
                "How They Connect": "Open and expressive; makes friends easily and shares freely.",
                "Communication Style": "Direct and emotionally open; talks through feelings out loud.",
                "What They Value": "Vulnerability, fun, people who show up.",
                "Patterns": "Gives a lot of energy; can over-extend and burn out on others.",
                "What They Need": "Reciprocity and people who can hold space back for her.",
            },
            "signal": {"communication_style":"direct","conflict_approach":"engaging","emotional_openness":"high","support_style":"emotional","independence":"low"},
        },
    },
    {
        "name": "Devin Park", "city": "Seattle, WA", "school": "University of Washington",
        "career": {
            "sections": {
                "Professional Identity": "Data scientist turned ML lead, ~8 years, research-leaning.",
                "How They Execute": "Methodical and rigorous; validates before acting, prefers depth.",
                "Strengths": "Analytical depth, modeling, turning ambiguity into measurable bets.",
                "Growth Areas": "Slow to commit; can analyze past the point of useful action.",
                "Ideal Next Role": "Applied research lead where rigor is valued over speed.",
            },
            "signal": {"execution_bias":"plan","risk_tolerance":"low","leadership_lean":"ic","autonomy_need":"high","growth_drive":"medium"},
        },
        "relationships": {
            "sections": {
                "How They Connect": "Selective and steady; a few deep, long relationships.",
                "Communication Style": "Reserved and thoughtful; says less but means it.",
                "What They Value": "Depth, reliability, intellectual companionship.",
                "Patterns": "Keeps feelings private; partners can feel shut out.",
                "What They Need": "Gentle prompting to open up and patience with his pace.",
            },
            "signal": {"communication_style":"reserved","conflict_approach":"avoidant","emotional_openness":"low","support_style":"practical","independence":"high"},
        },
    },
    {
        "name": "Priya Nair", "city": "Toronto, ON", "school": "University of Toronto",
        "career": {
            "sections": {
                "Professional Identity": "Operations lead scaling startups from 10→100, ~7 years.",
                "How They Execute": "Balanced — plans enough to de-risk, then moves; great at systems.",
                "Strengths": "Turning chaos into process; calm under pressure; people leadership.",
                "Growth Areas": "Takes on too much; learning to delegate and say no.",
                "Ideal Next Role": "COO / head of ops at a fast-scaling company.",
            },
            "signal": {"execution_bias":"balanced","risk_tolerance":"medium","leadership_lean":"lead","autonomy_need":"medium","growth_drive":"high"},
        },
        "relationships": {
            "sections": {
                "How They Connect": "Generous and dependable; the friend who organizes everyone.",
                "Communication Style": "Diplomatic and collaborative; seeks consensus.",
                "What They Value": "Mutual care, dependability, harmony.",
                "Patterns": "Avoids conflict to keep the peace; resentment can build quietly.",
                "What They Need": "Partners who make space for her needs, not just everyone else's.",
            },
            "signal": {"communication_style":"diplomatic","conflict_approach":"collaborative","emotional_openness":"high","support_style":"both","independence":"medium"},
        },
    },
]


def _brainscan_card(p):
    """Compose a whole-person Brain Card from a person's career + relationships."""
    c, r = p["career"]["sections"], p["relationships"]["sections"]
    cs, rs = p["career"]["signal"], p["relationships"]["signal"]
    return {
        "sections": {
            "Who They Are": c["Professional Identity"],
            "How They Think": c["How They Execute"],
            "Career & Ambition": f'{c["Strengths"]} {c["Ideal Next Role"]}',
            "How They Connect": f'{r["How They Connect"]} {r["Communication Style"]}',
            "Values & What Drives Them": r["What They Value"],
            "What They're Looking For": r["What They Need"],
        },
        "signal": {
            "openness": "high" if cs["growth_drive"] == "high" else "medium",
            "drive": cs["growth_drive"],
            "communication_style": rs["communication_style"],
            "social_energy": "extrovert" if rs["emotional_openness"] == "high" else "introvert" if rs["independence"] == "high" else "ambivert",
            "emotional_openness": rs["emotional_openness"],
        },
    }


def main():
    for p in PEOPLE:
        user_id = uid(p["name"])
        meta = {"full_name": p["name"], "city": p["city"], "school": p["school"], "avatar_url": ""}
        cards = {"career": p["career"], "relationships": p["relationships"], "brainscan": _brainscan_card(p)}
        for domain, card in cards.items():
            ok = upsert_scan_match_vectors(user_id, domain, card, meta)
            print(f"  {'✓' if ok else 'x'} {p['name']} · {domain}")
    print("\nDone seeding scan people.")


if __name__ == "__main__":
    main()
