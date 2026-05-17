from typing import List

# Vault quality thresholds
MIN_NOTES_STRICT = 1000          # Pass with any average length
MIN_NOTES_RELAXED = 200          # Pass only if average words per note >= MIN_AVG_WORDS
MIN_AVG_WORDS = 300              # For relaxed threshold
MIN_TOTAL_WORDS = 80_000         # Absolute floor — brain card needs content to work with


def assess_vault_quality(documents: List[dict]) -> dict:
    """
    Check whether an uploaded vault meets minimum quality requirements.
    Returns {passes: bool, quality_score: int (0-100), reason: str, stats: dict}

    documents: list of {title: str, text: str, file_path: str}
    """
    note_count = len(documents)
    word_counts = [len(doc["text"].split()) for doc in documents]
    total_words = sum(word_counts)
    avg_words = total_words / note_count if note_count > 0 else 0

    stats = {
        "note_count": note_count,
        "total_words": total_words,
        "avg_words_per_note": round(avg_words, 1),
    }

    # Gate 1: strict threshold
    if note_count >= MIN_NOTES_STRICT and total_words >= MIN_TOTAL_WORDS:
        quality_score = _compute_quality_score(note_count, total_words, avg_words, tier="strict")
        return {"passes": True, "quality_score": quality_score, "reason": "Vault meets quality requirements", "stats": stats}

    # Gate 2: relaxed threshold (fewer notes but substantive)
    if note_count >= MIN_NOTES_RELAXED and avg_words >= MIN_AVG_WORDS and total_words >= MIN_TOTAL_WORDS:
        quality_score = _compute_quality_score(note_count, total_words, avg_words, tier="relaxed")
        return {"passes": True, "quality_score": quality_score, "reason": "Vault meets quality requirements (fewer but substantive notes)", "stats": stats}

    # Fail — explain why
    if note_count < MIN_NOTES_RELAXED:
        reason = f"Vault has {note_count} notes — minimum is {MIN_NOTES_RELAXED} (ideally {MIN_NOTES_STRICT}+). Add more notes about your projects, thinking, and ideas."
    elif avg_words < MIN_AVG_WORDS:
        reason = f"Notes are too short on average ({round(avg_words)} words/note). Write more substantive entries — aim for {MIN_AVG_WORDS}+ words per note."
    else:
        reason = f"Total content is too sparse ({total_words:,} words). Need at least {MIN_TOTAL_WORDS:,} words for a reliable brain card."

    return {"passes": False, "quality_score": 0, "reason": reason, "stats": stats}


def _compute_quality_score(note_count: int, total_words: int, avg_words: float, tier: str) -> int:
    """
    Score 0-100 based on vault richness. Used to show confidence on the brain card.
    """
    score = 0

    # Note count component (max 40 pts)
    if note_count >= 2000:
        score += 40
    elif note_count >= 1000:
        score += 30
    elif note_count >= 500:
        score += 20
    else:
        score += 10

    # Total words component (max 35 pts)
    if total_words >= 500_000:
        score += 35
    elif total_words >= 200_000:
        score += 25
    elif total_words >= 100_000:
        score += 15
    else:
        score += 8

    # Average depth component (max 25 pts)
    if avg_words >= 600:
        score += 25
    elif avg_words >= 400:
        score += 18
    elif avg_words >= 300:
        score += 12
    else:
        score += 5

    # Slight bonus for relaxed tier (fewer but richer notes)
    if tier == "relaxed":
        score = int(score * 0.85)  # cap at 85% for relaxed threshold

    return min(100, score)
