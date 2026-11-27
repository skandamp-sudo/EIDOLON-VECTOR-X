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
from .reductions import ArrayReductions, OrderedReductions
from .sphere import rotate
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
    relevant: list[Row] = Field(max_length=256)


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
    return dict(order=order, recall=len(hits)/len(gold) if gold else None, ndcg=dcg/ideal if gold else None,
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


def score_task(model, idx, lexical, task, form, target, protected, methods):
    cfg = form.settings
    ops = OrderedReductions if "spherical" in methods else ArrayReductions
    orders = {method: [] for method in methods}
    geometry = dict.fromkeys(methods)
    orders["bm25"] = lexical.rank(task.query)
    reason = None
    sphere_reason = None
    try:
        x = np.array(model.encode(task.query))
    except ValueError as error:
        if str(error) != "No representable signal":
            raise
        reason = str(error)
    else:
        axis, applied, reason = govern(x, target, protected, cfg.strength, cfg.max_drift, cfg.min_cosine, ops)
        endpoints = [("dense", x, 0), ("unconstrained", candidate(x, target, cfg.strength, ops), cfg.strength),
                                  ("locked", candidate(x, axis, applied, ops), applied)]
        if "spherical" in methods:
            y, angle, sphere_reason = rotate(x, target, protected, cfg.strength, cfg.min_cosine)
            endpoints.append(("spherical", y, angle))
        for name, y, strength in endpoints:
            if y is None:
                continue
            orders[name] = idx.rank(Point(form.model_id, y), len(idx.ids))
            drift, cosine = metrics(x, y, protected, ops)
            geometry[name] = dict(drift=drift, cosine=cosine, target_gain=float(ops.dot(target, y-x)), applied=strength,
                                  violated=drift>cfg.max_drift or cosine<cfg.min_cosine)
            if "spherical" in methods:
                tolerance = 1e-10
                geometry[name]["signed_gain"] = float(np.sign(cfg.strength) * ops.dot(target, y-x))
                geometry[name]["violated"] = drift > cfg.max_drift+tolerance or cosine < cfg.min_cosine-tolerance
    orders["fusion"] = fuse(orders["bm25"], orders["dense"])
    methods = {m: {**measure(order, task.relevant, cfg.k), "geometry": geometry[m]} for m, order in orders.items()}
    base, cand = methods[cfg.baseline], methods[cfg.candidate]
    delta = {key: cand[key]-base[key] if task.relevant else None for key in ("recall", "ndcg")}
    change = "unlabeled"
    if task.relevant:
        gain = max(delta.values()) > 1e-12
        loss = min(delta.values()) < -1e-12
        change = "mixed" if gain and loss else "improved" if gain else "regressed" if loss else "unchanged"
    old = {row: rank for rank, row in enumerate(base["order"], 1)}
    new = {row: rank for rank, row in enumerate(cand["order"], 1)}
    movements = [{"id": row, "baseline": old.get(row), "candidate": new.get(row)}
                 for row in sorted(old.keys() | new.keys()) if old.get(row) != new.get(row)]
    reasons = [] if task.relevant else ["Relevance judgments required"]
    if task.relevant and cand["recall"] < cfg.min_recall:
        reasons.append("Recall below minimum")
    if task.relevant and cand["ndcg"] < cfg.min_ndcg:
        reasons.append("nDCG below minimum")
    if task.relevant and cfg.block_regressions and min(delta.values()) < -1e-12:
        reasons.append("Ranking metric regressed")
    if cfg.block_abstentions and cand["abstained"]:
        reasons.append("Candidate abstained")
    if cfg.require_geometry:
        if cand["geometry"] is None:
            reasons.append("Required geometry unavailable")
        elif cand["geometry"]["violated"]:
            reasons.append("Endpoint violates a geometric limit")
    return dict(query=task.query, relevant=task.relevant, methods=methods, delta=delta, gate_reasons=reasons,
                governor_reason=reason, **({"sphere_reason":sphere_reason} if "spherical" in methods else {}), change=change, rank_changes=movements)


def run(atlas, form):
    if form.model_id != model_id(atlas):
        raise ValueError("Encoder identity has changed.")
    for d in (form.target, form.protection):
        if d.model_id != form.model_id or any(abs(np.linalg.norm(v)-1)>1e-8 for v in (d.linear, d.centroid)):
            raise ValueError("Direction is incompatible with this encoder.")
    rows = validated_rows(form, atlas.model.documents)
    idx = build_index(atlas, rows, form.documents is not None)
    return comparison(atlas.model, form, rows, idx, form.target.linear, form.protection.linear, METHODS)


def validated_rows(form, default_documents):
    docs = form.documents
    rows = {d.id: d.text for d in docs} if docs else dict(enumerate(default_documents, 1))
    if docs and (len(rows) != len(docs) or any(not t.strip() for t in rows.values())):
        raise ValueError("Use distinct document IDs and nonempty texts.")
    for task in form.tasks:
        if not task.query.strip() or len(set(task.relevant)) != len(task.relevant) or not set(task.relevant)<=rows.keys():
            raise ValueError("Each query requires distinct relevant IDs in the selected corpus.")
    if len({task.query.strip() for task in form.tasks}) != len(form.tasks):
        raise ValueError("Keep one judgment set per query.")
    return rows


def comparison(model, form, rows, idx, target, protection, method_names):
    lexical = LexicalIndex(rows)
    tasks = [score_task(model, idx, lexical, task, form, np.asarray(target), np.asarray([protection]), method_names) for task in form.tasks]
    fingerprint = sha256(json.dumps(sorted(rows.items()), ensure_ascii=False, separators=(",",":")).encode()).hexdigest()
    summary = {}
    for method in method_names:
        results = [t["methods"][method] for t in tasks]
        measured = [r["geometry"] for r in results if r["geometry"] is not None]
        labeled = [r for r in results if r["recall"] is not None]
        summary[method] = dict(labeled=len(labeled), recall=sum(r["recall"] for r in labeled)/len(labeled) if labeled else None,
                               ndcg=sum(r["ndcg"] for r in labeled)/len(labeled) if labeled else None,
                               abstentions=sum(r["abstained"] for r in results), geometry_measured=len(measured),
                               violations=sum(g["violated"] for g in measured) if measured else None)
    return dict(protocol="focus-retrieval-v1", evidence_scope="Exploratory operator labels / engineering verification",
                limitations=["8D calibration encoder", "Binary relevance labels", "Geometric limits measure model directions",
                             "Operator release gate only; independent retrieval effectiveness and commercial demand unvalidated"],
                dataset_sha256=fingerprint, model_id=form.model_id, documents=len(rows), represented=len(idx.ids),
                ranking_policy=POLICY, rrf_constant=60, bm25={"k1":1.2,"b":.75,"positive_matches_only":True},
                changes=dict(Counter(t["change"] for t in tasks)),
                gate="BLOCK" if any(t["gate_reasons"] for t in tasks) else "PASS", summary=summary, tasks=tasks,
                replay=form.model_dump())
