"""
Generate your Brain Card locally (free, self-hosted) and print it as JSON.

Then paste the output into the site: BrainScan → Brain Card → "Import a card"
to store it on your own account for free (no scan charge — you ran the compute).

Usage:
    python scripts/scan_local.py /path/to/your/vault          # a folder
    python scripts/scan_local.py /path/to/vault.zip           # or a zip

Requires (in backend/.env): ANTHROPIC_API_KEY, PINECONE_API_KEY, PINECONE_INDEX_NAME.
Your notes are embedded into a throwaway namespace that is deleted when the scan
finishes — nothing of yours is left in the index.
"""

import sys
import os
import io
import json
import uuid
import zipfile

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from dotenv import load_dotenv  # noqa: E402
load_dotenv()

from services.vault_parser import parse_vault_zip  # noqa: E402
from services.chunker import chunk_document  # noqa: E402
from services.embedder import embed_chunks  # noqa: E402
from services.vector_store import upsert_chunks, delete_user_namespace  # noqa: E402
from services.brain_card import generate_brain_card  # noqa: E402


def _zip_bytes_from_path(path: str) -> bytes:
    if path.lower().endswith(".zip"):
        with open(path, "rb") as f:
            return f.read()
    if not os.path.isdir(path):
        print(f"Not a folder or .zip: {path}", file=sys.stderr)
        sys.exit(1)
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
        for root, _, files in os.walk(path):
            for fn in files:
                if fn.lower().endswith((".md", ".markdown", ".txt")):
                    full = os.path.join(root, fn)
                    z.write(full, os.path.relpath(full, path))
    return buf.getvalue()


def main():
    if len(sys.argv) < 2:
        print("usage: python scripts/scan_local.py <vault-folder-or-zip>", file=sys.stderr)
        sys.exit(1)

    zip_bytes = _zip_bytes_from_path(sys.argv[1])
    docs = parse_vault_zip(zip_bytes)
    if not docs:
        print("No readable markdown found.", file=sys.stderr)
        sys.exit(1)

    print(f"[scan] {len(docs)} notes → chunking + embedding…", file=sys.stderr)
    chunks = []
    for d in docs:
        chunks.extend(chunk_document(d))
    chunks = embed_chunks(chunks)

    uid = f"local-{uuid.uuid4().hex[:8]}"
    upsert_chunks(uid, chunks)
    try:
        print("[scan] analyzing your brain (this calls Claude — a minute or two)…", file=sys.stderr)
        card = generate_brain_card(chunks, user_id=uid, domain="brainscan")
    finally:
        delete_user_namespace(uid)  # leave nothing of yours in the index

    out = {
        "sections": card.get("sections", {}),
        "signal": card.get("signal") or card.get("founder_signal") or {},
    }
    # The JSON to paste into the site's "Import a card" box:
    print(json.dumps(out, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
