import os
import anthropic
from typing import List

_client = None


def _get_client():
    global _client
    if _client is None:
        _client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
    return _client

BRAIN_CARD_PROMPT = """You are analyzing someone's personal knowledge base (a collection of their notes, projects, ideas, and reflections) to create a "brain card" — a professional compatibility profile used for co-founder matching.

Here are excerpts from their knowledge base:

<notes>
{notes}
</notes>

Generate a brain card with these exact sections. Be specific and evidence-based — only claim things supported by the notes. Do not invent or assume.

## Who They Are
2-3 sentences: background, domain expertise, where they are in their journey.

## What They're Building
What projects, ideas, or businesses are they working on or thinking about?

## How They Think
Their mental models, frameworks, recurring themes in their thinking. What patterns show up?

## What They Value
Work ethic, risk tolerance, long-term vision, what they care about beyond money.

## What They Likely Need in a Co-Founder
Based on their skills and gaps, what would complement them well?

Keep each section to 3-5 sentences. Be direct, not generic. This is a matching profile, not a bio."""


def generate_brain_card(chunks: List[dict]) -> dict:
    """
    Generate a brain card from a sample of a user's vault chunks.
    Returns {summary: str, sections: dict}
    """
    # Sample diverse chunks — prioritize variety over top score
    # Take up to 40 chunks, spread across different files
    seen_files = set()
    selected = []

    for chunk in chunks:
        if chunk["file_path"] not in seen_files or len(selected) < 10:
            selected.append(chunk)
            seen_files.add(chunk["file_path"])
        if len(selected) >= 40:
            break

    notes = "\n\n---\n\n".join(
        f"[{c['title']} / {c['heading']}]\n{c['text']}" for c in selected
    )

    message = _get_client().messages.create(
        model="claude-opus-4-7",
        max_tokens=1500,
        messages=[{"role": "user", "content": BRAIN_CARD_PROMPT.format(notes=notes)}],
    )

    brain_card_text = message.content[0].text

    # Parse sections out of the markdown response
    sections = {}
    current_section = None
    current_lines = []

    for line in brain_card_text.split("\n"):
        if line.startswith("## "):
            if current_section:
                sections[current_section] = "\n".join(current_lines).strip()
            current_section = line[3:].strip()
            current_lines = []
        else:
            current_lines.append(line)

    if current_section:
        sections[current_section] = "\n".join(current_lines).strip()

    return {
        "raw": brain_card_text,
        "sections": sections,
    }
