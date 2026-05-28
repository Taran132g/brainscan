import os
import time
from typing import List, Optional
from pinecone import Pinecone

# Pinecone-hosted embedding model — runs server-side, so the backend needs no
# torch / sentence-transformers (keeps the Oracle micro box light).
EMBED_MODEL = "multilingual-e5-large"  # 1024-dim
EMBED_DIM = 1024
BATCH_SIZE = 96  # Pinecone inference accepts up to 96 inputs per call

# Pinecone hosted-inference free-tier rate limit for passage input_type.
# Documented at 250K tokens/minute as of 2024-10. We pace ourselves at
# ~85% of that to leave headroom for the brain card call and the match
# vector embedding that follow the chunk batch.
TOKENS_PER_MINUTE_LIMIT = int(os.getenv("PINECONE_TOKEN_LIMIT_PER_MIN", "250000"))
SAFE_TOKEN_BUDGET = int(TOKENS_PER_MINUTE_LIMIT * 0.85)

_pc: Optional[Pinecone] = None
_enc = None


def _client() -> Pinecone:
    global _pc
    if _pc is None:
        _pc = Pinecone(api_key=os.getenv("PINECONE_API_KEY"))
    return _pc


def _estimate_tokens(texts: List[str]) -> int:
    """Cheap upper-bound token count using tiktoken (already a dep for chunker)."""
    global _enc
    if _enc is None:
        import tiktoken
        _enc = tiktoken.get_encoding("cl100k_base")
    return sum(len(_enc.encode(t)) for t in texts)


# Rolling-window state for soft rate limiting
_window_start_ts = 0.0
_window_tokens_used = 0


def _wait_for_capacity(batch_tokens: int) -> None:
    """
    Reserve space in the current 60-second window before sending a batch.
    Sleeps if we'd exceed SAFE_TOKEN_BUDGET, then resets the window.
    """
    global _window_start_ts, _window_tokens_used
    now = time.time()
    elapsed = now - _window_start_ts

    if elapsed >= 60:
        # Window has rolled over
        _window_start_ts = now
        _window_tokens_used = 0
        elapsed = 0

    if _window_tokens_used + batch_tokens > SAFE_TOKEN_BUDGET:
        sleep_for = max(0.0, 60 - elapsed) + 0.5
        print(
            f"[embedder] window full ({_window_tokens_used} tok); "
            f"sleeping {sleep_for:.1f}s before next batch ({batch_tokens} tok)"
        )
        time.sleep(sleep_for)
        _window_start_ts = time.time()
        _window_tokens_used = 0

    _window_tokens_used += batch_tokens


def _embed_with_retry(batch: List[str], input_type: str, *, attempt: int = 0) -> List[List[float]]:
    """One batch with explicit 429 backoff (in case our soft throttle misses)."""
    try:
        res = _client().inference.embed(
            model=EMBED_MODEL,
            inputs=batch,
            parameters={"input_type": input_type, "truncate": "END"},
        )
        return [d.values for d in res.data]
    except Exception as e:
        msg = str(e)
        is_429 = "429" in msg or "RESOURCE_EXHAUSTED" in msg or "Too Many Requests" in msg
        if is_429 and attempt < 3:
            backoff = 65 * (attempt + 1)  # 65s, 130s, 195s — covers a full window each retry
            print(f"[embedder] 429 from Pinecone, sleeping {backoff}s (attempt {attempt + 1}/3)")
            time.sleep(backoff)
            # Reset window so next batch starts fresh
            global _window_start_ts, _window_tokens_used
            _window_start_ts = time.time()
            _window_tokens_used = 0
            return _embed_with_retry(batch, input_type, attempt=attempt + 1)
        raise


def _embed(texts: List[str], input_type: str) -> List[List[float]]:
    """
    Call Pinecone hosted inference. input_type is 'passage' or 'query'.
    Paces requests across batches to stay under the per-minute token budget.
    """
    out: List[List[float]] = []
    total = len(texts)
    for i in range(0, total, BATCH_SIZE):
        batch = texts[i : i + BATCH_SIZE]
        batch_tokens = _estimate_tokens(batch)
        _wait_for_capacity(batch_tokens)
        vectors = _embed_with_retry(batch, input_type)
        out.extend(vectors)
        # Light progress log — useful when watching backend.log during big uploads
        done = min(i + BATCH_SIZE, total)
        if total > BATCH_SIZE:
            print(f"[embedder] {done}/{total} chunks embedded")
    return out


def embed_chunks(chunks: List[dict]) -> List[dict]:
    """
    Add an 'embedding' field to each chunk using Pinecone hosted embeddings.
    Chunks are 'passage' input type (the corpus being indexed).
    """
    texts = [f"{c['title']} — {c['heading']}\n\n{c['text']}" for c in chunks]
    embeddings = _embed(texts, input_type="passage")
    for chunk, vector in zip(chunks, embeddings):
        chunk["embedding"] = vector
    return chunks


def embed_query(text: str) -> List[float]:
    """Embed a single search query (uses 'query' input type for asymmetric e5 models)."""
    return _embed([text], input_type="query")[0]
