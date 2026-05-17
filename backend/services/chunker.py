import re
import tiktoken
from typing import List, Dict

MAX_TOKENS = 400
OVERLAP_TOKENS = 50
enc = tiktoken.get_encoding("cl100k_base")


def _token_len(text: str) -> int:
    return len(enc.encode(text))


def _split_by_headings(content: str) -> List[tuple[str, str]]:
    """Split markdown into (heading_path, section_content) pairs."""
    pattern = re.compile(r"^(#{1,3})\s+(.+)$", re.MULTILINE)
    matches = list(pattern.finditer(content))

    if not matches:
        return [("", content)]

    sections = []
    for i, match in enumerate(matches):
        heading = match.group(2).strip()
        start = match.end()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(content)
        body = content[start:end].strip()
        if body:
            sections.append((heading, body))

    return sections if sections else [("", content)]


def _sliding_window(text: str, heading: str) -> List[Dict]:
    """Chunk a long section using a sliding window."""
    tokens = enc.encode(text)
    chunks = []
    start = 0

    while start < len(tokens):
        end = min(start + MAX_TOKENS, len(tokens))
        chunk_text = enc.decode(tokens[start:end])
        chunks.append({"heading": heading, "text": chunk_text})
        if end == len(tokens):
            break
        start += MAX_TOKENS - OVERLAP_TOKENS

    return chunks


def chunk_document(doc: Dict) -> List[Dict]:
    """
    Chunk a parsed document into embeddable units.
    Returns list of {file_path, title, tags, heading, text}
    """
    chunks = []
    sections = _split_by_headings(doc["content"])

    for heading, body in sections:
        if _token_len(body) <= MAX_TOKENS:
            chunks.append({
                "file_path": doc["path"],
                "title": doc["title"],
                "tags": doc["tags"],
                "heading": heading,
                "text": body,
            })
        else:
            for window in _sliding_window(body, heading):
                chunks.append({
                    "file_path": doc["path"],
                    "title": doc["title"],
                    "tags": doc["tags"],
                    "heading": window["heading"],
                    "text": window["text"],
                })

    return chunks
