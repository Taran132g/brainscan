import os
import time
import anthropic
from typing import List
from collections import defaultdict

from services.scan_domains import get_domain

_client = None


def _get_client():
    global _client
    if _client is None:
        _client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
    return _client


# ---------- Domain-neutral chunk selection (works for any scan domain) ----------

def _sample_diverse_chunks(chunks: List[dict], target: int = 40) -> List[dict]:
    """
    Sample up to `target` chunks with file diversity.

    Strategy:
    1. Group chunks by file_path.
    2. Round-robin one chunk from each file until we hit target or run out.
    3. Then top up by taking additional chunks from files that have more.
    """
    by_file = defaultdict(list)
    for c in chunks:
        by_file[c["file_path"]].append(c)

    selected = []
    file_iterators = {f: iter(file_chunks) for f, file_chunks in by_file.items()}
    active_files = list(file_iterators.keys())

    while active_files and len(selected) < target:
        next_active = []
        for f in active_files:
            try:
                selected.append(next(file_iterators[f]))
                if len(selected) >= target:
                    break
                next_active.append(f)
            except StopIteration:
                continue
        active_files = next_active

    return selected


def _round_robin_dedup(ranked_lists: List[List[dict]], target: int) -> List[dict]:
    """Merge per-query ranked hit lists, taking one from each in turn, skipping dupes."""
    seen = set()
    selected: List[dict] = []
    iterators = [iter(lst) for lst in ranked_lists]
    active = list(range(len(iterators)))

    while active and len(selected) < target:
        next_active = []
        for i in active:
            try:
                hit = next(iterators[i])
            except StopIteration:
                continue
            key = (hit.get("file_path"), hit.get("heading"), (hit.get("text") or "")[:50])
            if key in seen:
                next_active.append(i)  # consumed a dupe; keep pulling from this list
                continue
            seen.add(key)
            selected.append(hit)
            if len(selected) >= target:
                break
            next_active.append(i)
        active = next_active

    return selected


def _retrieve_chunks(
    user_id: str, queries: dict, target: int = 40, min_chunks: int = 10, max_attempts: int = 3
) -> List[dict]:
    """
    Retrieval-driven chunk selection: one semantic query per section (from the
    domain's `retrieval_queries`) against the user's private Pinecone namespace,
    round-robin merged + deduped. Retries with backoff while the index catches up
    after a just-completed upsert. Domain-agnostic — the queries decide the lens.
    """
    from services.embedder import embed_query
    from services.vector_store import query_namespace

    query_list = list(queries.values())
    per_query_k = max(10, (target // max(len(query_list), 1)) + 6)

    selected: List[dict] = []
    for attempt in range(max_attempts):
        ranked_lists = []
        for q in query_list:
            try:
                hits = query_namespace(user_id, embed_query(q), top_k=per_query_k)
            except Exception as e:
                print(f"[brain_card] retrieval query failed: {e}")
                hits = []
            ranked_lists.append(hits)

        selected = _round_robin_dedup(ranked_lists, target)

        if len(selected) >= min_chunks or attempt == max_attempts - 1:
            return selected

        wait = 2.0 * (attempt + 1)
        print(
            f"[brain_card] retrieval thin ({len(selected)} chunks); "
            f"waiting {wait}s for index (attempt {attempt + 1}/{max_attempts})"
        )
        time.sleep(wait)

    return selected


def _build_external_block(external_signals: dict | None) -> str:
    """Founder-domain GitHub/LinkedIn enrichment block (empty when not provided)."""
    if not external_signals:
        return ""
    signals_lines = []
    if external_signals.get("github_url"):
        signals_lines.append(f"- GitHub profile: {external_signals['github_url']}")
    if external_signals.get("linkedin_url"):
        signals_lines.append(f"- LinkedIn profile: {external_signals['linkedin_url']}")

    gh_data = external_signals.get("github_data")
    if gh_data:
        stats = gh_data.get("stats") or {}
        signals_lines.append(
            f"- GitHub stats: {stats.get('non_fork_repos', 0)} non-fork repos, "
            f"{stats.get('total_stars', 0)} total stars, "
            f"{stats.get('language_count', 0)} languages "
            f"({', '.join((stats.get('languages') or [])[:6])})"
        )
        quality = external_signals.get("github_quality")
        if quality:
            signals_lines.append(f"- GitHub quality grade: {quality}")
        top_repos = gh_data.get("top_repos") or []
        if top_repos:
            signals_lines.append("- Top repos (use to ground 'What They're Building'):")
            for r in top_repos[:6]:
                lang = f" · {r.get('language')}" if r.get("language") else ""
                stars = f" · ⭐{r.get('stars', 0)}" if r.get("stars") else ""
                desc = f": {r['description']}" if r.get("description") else ""
                signals_lines.append(f"    • {r.get('name', '?')}{lang}{stars}{desc}")

    if not signals_lines:
        return ""
    return (
        "External signals (public profiles + verified GitHub data — incorporate into the brain card):\n"
        + "\n".join(signals_lines)
        + "\n\n"
    )


def generate_brain_card(
    chunks: List[dict],
    external_signals: dict | None = None,
    user_id: str | None = None,
    domain: str = "brainscan",
) -> dict:
    """
    Generate a structured brain card for the given scan `domain` (default
    "brainscan" — the whole-person card). The domain config decides the
    retrieval queries, prompt, tool schema, sections, and signal block, so the
    same engine produces any domain's card.

    Chunk selection is retrieval-driven when `user_id` is provided, falling back
    to flat diversity sampling over `chunks` if retrieval is thin.

    Returns {sections, signal, raw, domain}. `founder_signal` is mirrored from
    `signal` for backward compatibility — the persistence + UI layers read the
    `founder_signal` key (and the reused `profiles.founder_signal` column).
    """
    dom = get_domain(domain)
    target = dom.chunk_target

    selected: List[dict] = []
    if user_id:
        selected = _retrieve_chunks(user_id, dom.retrieval_queries, target=target)
        if len(selected) < 10:
            print(
                f"[brain_card] retrieval yielded {len(selected)} chunks; "
                "falling back to diversity sampling"
            )
            selected = []
    if not selected:
        selected = _sample_diverse_chunks(chunks, target=target)

    notes = "\n\n---\n\n".join(
        f"[{c['title']} / {c.get('heading', '')}]\n{c['text']}" for c in selected
    )
    external_block = _build_external_block(external_signals)

    message = _get_client().messages.create(
        model="claude-opus-4-8",
        max_tokens=4800,
        system=dom.system_prompt,
        tools=[dom.tool_schema],
        tool_choice={"type": "tool", "name": dom.tool_name},
        messages=[
            {"role": "user", "content": dom.user_prompt_template.format(
                notes=notes,
                external_signals_block=external_block,
            )}
        ],
    )

    tool_use_block = next((b for b in message.content if b.type == "tool_use"), None)
    if tool_use_block is None:
        raise RuntimeError("Brain card generation failed — no tool_use block in response.")

    payload = tool_use_block.input

    sections = {
        dom.section_titles[key]: payload[key]
        for key in dom.section_titles
        if key in payload
    }
    signal = payload.get(dom.signal_key, {})

    result = {
        "sections": sections,
        "signal": signal,
        "raw": payload,
        "domain": dom.id,
    }
    # Back-compat: callers (upload, profile, matching) read `founder_signal`,
    # and the reused `profiles.founder_signal` column stores it for every domain.
    result["founder_signal"] = signal
    return result
