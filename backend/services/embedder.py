import os
from typing import List
from pinecone import Pinecone

# Pinecone-hosted embedding model — runs server-side, so the backend needs no
# torch / sentence-transformers (keeps the Oracle micro box light).
EMBED_MODEL = "multilingual-e5-large"  # 1024-dim
EMBED_DIM = 1024
BATCH_SIZE = 96  # Pinecone inference accepts up to 96 inputs per call

_pc = None


def _client() -> Pinecone:
    global _pc
    if _pc is None:
        _pc = Pinecone(api_key=os.getenv("PINECONE_API_KEY"))
    return _pc


def _embed(texts: List[str], input_type: str) -> List[List[float]]:
    """Call Pinecone hosted inference. input_type is 'passage' or 'query'."""
    out: List[List[float]] = []
    pc = _client()
    for i in range(0, len(texts), BATCH_SIZE):
        batch = texts[i : i + BATCH_SIZE]
        res = pc.inference.embed(
            model=EMBED_MODEL,
            inputs=batch,
            parameters={"input_type": input_type, "truncate": "END"},
        )
        out.extend([d.values for d in res.data])
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
