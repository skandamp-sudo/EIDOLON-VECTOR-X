"""Canonical binary64 ranking for finite unit embeddings in one pinned basis."""
from dataclasses import dataclass
import math
import numpy as np

QUANTUM = 2.0 ** -40
POLICY = "cosine-fsum-rne-q40-id-v2"


def unit(values):
    values = np.asarray(values, dtype=np.float64)
    if values.ndim != 1 or not 0 < len(values) <= 384 or not np.isfinite(values).all():
        raise ValueError("Invalid embedding.")
    norm = math.sqrt(math.fsum(float(v) ** 2 for v in values))
    if norm < 1e-12:
        raise ValueError("No representable signal")
    return values / norm


@dataclass(frozen=True)
class Point:
    model: str
    values: np.ndarray


class Index:
    def __init__(self, model, ids, vectors):
        if not model or len(set(ids)) != len(ids) or len(ids) != len(vectors):
            raise ValueError("Invalid model or duplicate document IDs.")
        self.model = model
        self.ids = tuple(ids)
        self.rows = tuple(tuple(unit(v).tolist()) for v in vectors)
        if len({len(v) for v in self.rows}) > 1:
            raise ValueError("Mixed embedding dimensions.")

    def rank(self, query, k=3):
        if query.model != self.model:
            raise ValueError("Embedding model identity mismatch.")
        y = unit(query.values).tolist()
        if self.rows and len(y) != len(self.rows[0]):
            raise ValueError("Query dimension mismatch.")
        def key(i):
            score = math.fsum(a*b for a,b in zip(self.rows[i], y))
            return -round(score / QUANTUM), self.ids[i]
        return [self.ids[i] for i in sorted(range(len(self.rows)), key=key)[:k]]
