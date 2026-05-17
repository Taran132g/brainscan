from typing import List
from sentence_transformers import SentenceTransformer

EMBED_MODEL = "all-MiniLM-L6-v2"  # 384-dim, runs locally, no API needed
BATCH_SIZE = 64

_model = None


def _get_model():
    global _model
    if _model is None:
        _model = SentenceTransformer(EMBED_MODEL)
    return _model


def embed_chunks(chunks: List[dict]) -> List[dict]:
    """
    Add an 'embedding' field to each chunk using a local sentence-transformers model.
    First call downloads the model (~90MB), subsequent calls are instant.
    """
    texts = [f"{c['title']} — {c['heading']}\n\n{c['text']}" for c in chunks]
    model = _get_model()
    embeddings = model.encode(texts, batch_size=BATCH_SIZE, show_progress_bar=True)

    for chunk, vector in zip(chunks, embeddings):
        chunk["embedding"] = vector.tolist()

    return chunks
