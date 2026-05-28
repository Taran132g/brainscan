import os
import hashlib
from typing import List
from pinecone import Pinecone, ServerlessSpec
from services.embedder import EMBED_DIM

_pc = None
_index = None


def _get_index():
    global _pc, _index
    if _index is not None:
        return _index

    _pc = Pinecone(api_key=os.getenv("PINECONE_API_KEY"))
    # New index name so the dimension change (384 → 1024) auto-provisions a
    # fresh index instead of colliding with the old MiniLM one.
    index_name = os.getenv("PINECONE_INDEX_NAME", "finding-founders-v2")

    existing = [i.name for i in _pc.list_indexes()]
    if index_name not in existing:
        _pc.create_index(
            name=index_name,
            dimension=EMBED_DIM,  # multilingual-e5-large (Pinecone hosted)
            metric="cosine",
            spec=ServerlessSpec(cloud="aws", region="us-east-1"),
        )

    _index = _pc.Index(index_name)
    return _index


def upsert_chunks(user_id: str, chunks: List[dict]) -> int:
    """
    Upsert embedded chunks into the user's private namespace.
    Returns the number of vectors upserted.
    """
    index = _get_index()
    namespace = f"user_{user_id}"
    vectors = []

    for chunk in chunks:
        vec_id = hashlib.md5(
            f"{chunk['file_path']}::{chunk['heading']}::{chunk['text'][:50]}".encode()
        ).hexdigest()

        vectors.append({
            "id": vec_id,
            "values": chunk["embedding"],
            "metadata": {
                "file_path": chunk["file_path"],
                "title": chunk["title"],
                "heading": chunk["heading"],
                "tags": chunk["tags"],
                "text": chunk["text"][:1000],  # store preview for retrieval
            },
        })

    # Pinecone upsert in batches of 100
    for i in range(0, len(vectors), 100):
        index.upsert(vectors=vectors[i : i + 100], namespace=namespace)

    return len(vectors)


def delete_user_namespace(user_id: str):
    index = _get_index()
    try:
        index.delete(delete_all=True, namespace=f"user_{user_id}")
    except Exception:
        pass  # namespace doesn't exist yet on first upload


def query_namespace(user_id: str, query_vector: List[float], top_k: int = 20) -> List[dict]:
    index = _get_index()
    result = index.query(
        vector=query_vector,
        top_k=top_k,
        namespace=f"user_{user_id}",
        include_metadata=True,
    )
    return [m.metadata for m in result.matches]
