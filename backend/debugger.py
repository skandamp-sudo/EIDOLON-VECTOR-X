"""Stateless engineering comparisons. No benchmark or parameter fitting on task labels."""
from collections import Counter
from hashlib import sha256
import json
import math
import re
from typing import Annotated, Literal

import numpy as np
from pydantic import Field

from .concepts import Direction, Strict, model_id
from .foundry import embed
from .intelligence import candidate, govern, metrics
from .ranking_v2 import Index, Point, POLICY

Method = Literal["bm25", "dense", "fusion", "unconstrained", "locked"]
METHODS = ("bm25", "dense", "fusion", "unconstrained", "locked")
Hash = Annotated[str, Field(pattern=r"^[0-9a-f]{64}$")]
Row = Annotated[int, Field(ge=1, le=5000)]
Score = Annotated[float, Field(ge=0, le=1)]


class Document(Strict):
    id: Row
    text: str = Field(min_length=1, max_length=4096)


class Task(Strict):
    query: str = Field(min_length=1, max_length=400)
    relevant: list[Row] = Field(min_length=1, max_length=256)


class Settings(Strict):
    baseline: Method = "dense"
    candidate: Method = "locked"
    k: int = Field(default=3, ge=1, le=20)
    strength: float = Field(default=1, ge=-2, le=2)
    max_drift: float = Field(default=.05, ge=0, le=2)
    min_cosine: float = Field(default=.8, ge=-1, le=1)
    min_recall: Score = 0
    min_ndcg: Score = 0
    block_regressions: bool = True
    block_abstentions: bool = True
    require_geometry: bool = True


class DebugRequest(Strict):
    model_id: Hash
    documents: list[Document] | None = Field(default=None, min_length=1, max_length=256)
    tasks: list[Task] = Field(min_length=1, max_length=16)
    target: Direction
    protection: Direction
    settings: Settings


class LexicalIndex:
    def __init__(self, rows):
        self.counts = {i: Counter(re.findall(r"\w+", text.lower())) for i, text in rows.items()}
        self.df = Counter(t for doc in self.counts.values() for t in doc)
        self.mean_length = sum(d.total() for d in self.counts.values()) / len(rows) or 1

    def rank(self, query):
        terms = Counter(re.findall(r"\w+", query.lower()))
        weights = {t: n * math.log1p((len(self.counts)-self.df[t]+.5)/(self.df[t]+.5))
                   for t, n in terms.items() if self.df[t]}
        scores = {}
        for i, counts in self.counts.items():
            norm = 1.2 * (.25 + .75 * counts.total()/self.mean_length)
            score = sum(w * counts[t] * 2.2/(counts[t]+norm) for t, w in weights.items() if counts[t])
            if score > 0:
                scores[i] = score
        return sorted(scores, key=lambda i: (-scores[i], i))


def fuse(*orders):
    scores = Counter()
    for order in orders:
        for position, row in enumerate(order, 1):
            scores[row] += 1/(60+position)
    return sorted(scores, key=lambda i: (-scores[i], i))


def measure(order, relevant, k):
    top = order[:k]
    gold = set(relevant)
    hits = gold.intersection(top)
    dcg = sum(1/math.log2(rank+2) for rank, row in enumerate(top) if row in gold)
    ideal = sum(1/math.log2(rank+2) for rank in range(min(k, len(gold))))
    return dict(order=order, recall=len(hits)/len(gold), ndcg=dcg/ideal,
                missed=sorted(gold-hits), abstained=not order)


def build_index(atlas, rows, imported):
    if not imported:
        return Index(model_id(atlas), list(rows), atlas.vectors)
    ids, vectors = [], []
    items = list(rows.items())
    for start in range(0, len(items), 64):
        batch = items[start:start+64]
        body = json.dumps([text for _, text in batch]).encode()
        points = embed(body, atlas)["points"]
        for (row, _), point in zip(batch, points, strict=True):
            if point is not None:
                ids.append(row)
                vectors.append(point["vector"])
    return Index(model_id(atlas), ids, vectors)


def score_task(atlas, idx, lexical, task, form):
    cfg = form.settings
    orders = {method: [] for method in METHODS}
    geometry = dict.fromkeys(METHODS)
    orders["bm25"] = lexical.rank(task.query)
    reason = None
    try:
        x = np.array(atlas.model.encode(task.query))
    except ValueError as error:
        if str(error) != "No representable signal":
            raise
        reason = str(error)
    else:
        target = np.array(form.target.linear)
        protected = np.array([form.protection.linear])
        axis, applied, reason = govern(x, target, protected, cfg.strength, cfg.max_drift, cfg.min_cosine)
        for name, y, strength in [("dense", x, 0), ("unconstrained", candidate(x, target, cfg.strength), cfg.strength),
                                  ("locked", candidate(x, axis, applied), applied)]:
            if y is None:
                continue
            orders[name] = idx.rank(Point(form.model_id, y), len(idx.ids))
            drift, cosine = metrics(x, y, protected)
            geometry[name] = dict(drift=drift, cosine=cosine, target_gain=float(target @ (y-x)), applied=strength,
                                  violated=drift>cfg.max_drift or cosine<cfg.min_cosine)
    orders["fusion"] = fuse(orders["bm25"], orders["dense"])
    methods = {m: {**measure(order, task.relevant, cfg.k), "geometry": geometry[m]} for m, order in orders.items()}
    base, cand = methods[cfg.baseline], methods[cfg.candidate]
    delta = {key: cand[key]-base[key] for key in ("recall", "ndcg")}
    reasons = []
    if cand["recall"] < cfg.min_recall:
        reasons.append("Recall below minimum")
    if cand["ndcg"] < cfg.min_ndcg:
        reasons.append("nDCG below minimum")
    if cfg.block_regressions and min(delta.values()) < -1e-12:
        reasons.append("Ranking metric regressed")
    if cfg.block_abstentions and cand["abstained"]:
        reasons.append("Candidate abstained")
    if cfg.require_geometry:
        if cand["geometry"] is None:
            reasons.append("Required geometry unavailable")
        elif cand["geometry"]["violated"]:
            reasons.append("Endpoint violates a geometric limit")
    return dict(query=task.query, relevant=task.relevant, methods=methods, delta=delta, gate_reasons=reasons,
                governor_reason=reason)


def run(atlas, form):
    if form.model_id != model_id(atlas):
        raise ValueError("Encoder identity has changed.")
    for d in (form.target, form.protection):
        if d.model_id != form.model_id or any(abs(np.linalg.norm(v)-1)>1e-8 for v in (d.linear, d.centroid)):
            raise ValueError("Direction is incompatible with this encoder.")
    docs = form.documents
    rows = {d.id: d.text for d in docs} if docs else dict(enumerate(atlas.model.documents, 1))
    if docs and (len(rows) != len(docs) or any(not t.strip() for t in rows.values())):
        raise ValueError("Use distinct document IDs and nonempty texts.")
    for task in form.tasks:
        if not task.query.strip() or len(set(task.relevant)) != len(task.relevant) or not set(task.relevant)<=rows.keys():
            raise ValueError("Each query requires distinct relevant IDs in the selected corpus.")
    if len({task.query.strip() for task in form.tasks}) != len(form.tasks):
        raise ValueError("Keep one judgment set per query.")
    idx = build_index(atlas, rows, docs is not None)
    lexical = LexicalIndex(rows)
    tasks = [score_task(atlas, idx, lexical, task, form) for task in form.tasks]
    fingerprint = sha256(json.dumps(sorted(rows.items()), ensure_ascii=False, separators=(",",":")).encode()).hexdigest()
    summary = {}
    for method in METHODS:
        results = [t["methods"][method] for t in tasks]
        measured = [r["geometry"] for r in results if r["geometry"] is not None]
        summary[method] = dict(recall=sum(r["recall"] for r in results)/len(results),
                               ndcg=sum(r["ndcg"] for r in results)/len(results),
                               abstentions=sum(r["abstained"] for r in results), geometry_measured=len(measured),
                               violations=sum(g["violated"] for g in measured) if measured else None)
    return dict(protocol="focus-retrieval-v1", evidence_scope="Exploratory operator labels / engineering verification",
                limitations=["8D calibration encoder", "Binary relevance labels", "Geometric limits measure model directions",
                             "Operator release gate only; independent retrieval effectiveness and commercial demand unvalidated"],
                dataset_sha256=fingerprint, model_id=form.model_id, documents=len(rows), represented=len(idx.ids),
                ranking_policy=POLICY, rrf_constant=60, bm25={"k1":1.2,"b":.75,"positive_matches_only":True},
                gate="BLOCK" if any(t["gate_reasons"] for t in tasks) else "PASS", summary=summary, tasks=tasks,
                replay=form.model_dump())
