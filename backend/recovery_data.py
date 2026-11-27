"""Named, bounded members of the licensed QASPER release. No archive extraction."""
from functools import lru_cache
from hashlib import sha256
import json
from pathlib import Path
import re
import tarfile

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / ".runtime/recovery-v2"
DIGEST = "a28fdf966db827bcee3d873107d6b6669864fb7ca8fbf73a192f5e39191bdb5a"


@lru_cache(maxsize=2)
def papers(split):
    if split not in {"train", "dev"}:
        raise ValueError("Unknown split.")
    path = CACHE / "qasper.tgz"
    if not path.is_file() or path.stat().st_size > 35_000_000 or sha256(path.read_bytes()).hexdigest() != DIGEST:
        raise ValueError("Install the pinned QASPER archive.")
    with tarfile.open(path, "r:gz") as archive:
        member = archive.getmember(f"qasper-{split}-v0.3.json")
        if not member.isfile() or member.size > 35_000_000:
            raise ValueError("Invalid dataset member.")
        return sorted(json.load(archive.extractfile(member)).items())


def doc_id(text):
    return sha256(" ".join(text.split()).encode()).hexdigest()


def paragraphs(paper):
    rows = {}
    for section in paper["full_text"]:
        heading = (section["section_name"] or "").lower()
        labels = (bool(re.search(r"\b(methods?|methodology)\b", heading)),
                  bool(re.search(r"\bresults?\b", heading)))
        for text in section["paragraphs"]:
            if text.strip():
                rows.setdefault(doc_id(text), (text, labels))
    return rows
