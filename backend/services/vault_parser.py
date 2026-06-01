import zipfile
import io
import frontmatter
from pathlib import Path
from typing import List, Dict


# Folders excluded from the brain card. The dot-dirs are Obsidian internals.
# "Chats", "ChatGPT Archive", and "Raw Learnings" are raw AI session logs /
# trivial dated exports — high-volume, low-signal (grocery receipts, weather,
# "activate Tinder Gold", "get Nike receipt") that were flooding the old
# diversity sampler. Retrieval already sidesteps them, but skipping at parse
# time keeps both code paths clean and the index lean.
SKIP_DIRS = {".obsidian", ".trash", ".git", "Chats", "ChatGPT Archive", "Raw Learnings"}
SKIP_FILES = {"CLAUDE.md", "log.md"}


def parse_vault_zip(zip_bytes: bytes) -> List[Dict]:
    """
    Extract and parse all .md files from an Obsidian vault zip.
    Returns a list of dicts: {path, title, tags, content}
    """
    documents = []

    with zipfile.ZipFile(io.BytesIO(zip_bytes)) as zf:
        for name in zf.namelist():
            path = Path(name)

            if not name.endswith(".md"):
                continue
            if any(part in SKIP_DIRS for part in path.parts):
                continue
            if path.name in SKIP_FILES:
                continue

            with zf.open(name) as f:
                raw = f.read().decode("utf-8", errors="ignore")

            try:
                post = frontmatter.loads(raw)
                tags = post.metadata.get("tags", [])
                if isinstance(tags, str):
                    tags = [tags]
                content = post.content.strip()
            except Exception:
                tags = []
                content = raw.strip()

            if len(content) < 50:
                continue

            documents.append({
                "path": name,
                "title": path.stem,
                "tags": tags,
                "content": content,
            })

    return documents
