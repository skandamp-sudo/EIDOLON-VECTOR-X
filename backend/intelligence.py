"""Measured post-normalization constraints and comparison in one reference frame."""
import numpy as np
from .reductions import ArrayReductions
from pydantic import Field

from .concepts import Direction, Name, Strict, Text, Unit, model_id
from .fidelity import fidelity

GRID = 100


class Index(Strict):
    model_id: Name
    vectors: list[Unit] = Field(min_length=1, max_length=5000)
    categories: list[str] | None = Field(default=None, max_length=5000)


class Comparison(Strict):
    text: Text
    target: Direction
    protected: list[Direction] = Field(max_length=4)
    strength: float = Field(ge=-2, le=2)
    max_drift: float = Field(ge=0, le=2)
    min_cosine: float = Field(ge=-1, le=1)
    index: Index | None = None
    relevant: list[int] | None = Field(default=None, max_length=5000)
    expected_category: Name | None = None


def checked_index(atlas, index):
    if index is None:
        return atlas.vectors, atlas.labels.tolist()
    if index.model_id != model_id(atlas):
        raise ValueError("Index model identity differs from the active encoder.")
    vectors = np.array(index.vectors)
    if not np.allclose(np.linalg.norm(vectors, axis=1), 1, rtol=0, atol=1e-8):
        raise ValueError("Imported index requires unit vectors in this model basis.")
    if index.categories is not None and (len(index.categories) != len(vectors) or any(len(c) > 4096 for c in index.categories)):
        raise ValueError("Provide one bounded category per imported vector.")
    return vectors, index.categories


def candidate(x, direction, alpha, ops=ArrayReductions):
    # Check the closest point on the entire unnormalized segment to avoid a
    # discontinuous trajectory even when the singularity falls between samples.
    step = alpha * direction
    denom = ops.dot(step, step)
    if denom > 0 and ops.norm(x + np.clip(-ops.dot(x, step) / denom, 0, 1) * step) < 1e-9:
        return None
    if alpha == 0:
        return x.copy()
    y = x + step
    return y / ops.norm(y)


def metrics(x, y, protected, ops=ArrayReductions):
    drift = ops.drift(protected, y - x)
    cosine = 1. if np.array_equal(x, y) else float(np.clip(ops.dot(x, y), -1, 1))
    return float(drift), cosine


def govern(x, target, protected, request, max_drift, min_cosine, ops=ArrayReductions):
    safe = target.copy()
    if len(protected):
        _, singular, vh = np.linalg.svd(protected, full_matrices=False)
        basis = vh[singular > singular[0] * max(protected.shape) * np.finfo(float).eps]
        safe -= ops.projection(basis, safe)
    if not request:
        return safe, 0., "Zero strength requested."
    if ops.norm(safe) < 1e-9:
        return safe, 0., "Target lies in the protected subspace."
    reason = "No sampled nonzero strength met the constraints and improved the signed target score."
    # Descending grid finds the largest admissible magnitude on this grid,
    # including disconnected feasible intervals. No monotonicity assumption.
    for a in np.linspace(request, 0, GRID + 1)[:-1]:
        y = candidate(x, safe, a, ops)
        if y is None:
            continue
        drift, cosine = metrics(x, y, protected, ops)
        if drift <= max_drift and cosine >= min_cosine and np.sign(request) * ops.dot(target, y - x) > 1e-12:
            return safe, float(a), "Requested strength accepted." if a == request else "Reduced to satisfy measured endpoint constraints and signed target gain."
    return safe, 0., reason


def ranks(vectors, y):
    scores = np.clip(vectors @ y, -1, 1)
    order = np.argsort(-scores, kind="stable")
    return scores, order


def ndcg(top, relevant):
    if not relevant:
        return None
    discounts = 1 / np.log2(np.arange(2, len(top) + 2))
    return float(sum(w for i, w in zip(top, discounts) if i in relevant) / sum(discounts[:min(len(top), len(relevant))]))


def compare(atlas, form):
    identity = model_id(atlas)
    protected_names = [d.name for d in form.protected]
    if len(set(protected_names)) != len(protected_names):
        raise ValueError("Give each protected direction a distinct name.")
    for d in [form.target, *form.protected]:
        if d.model_id != identity or any(abs(np.linalg.norm(v) - 1) > 1e-8 for v in (d.linear, d.centroid)):
            raise ValueError("Direction is incompatible with this model or has invalid normalization.")
    vectors, categories = checked_index(atlas, form.index)
    relevant = set(form.relevant or [])
    if any(i < 0 or i >= len(vectors) for i in relevant):
        raise ValueError("Relevance labels must identify rows in the active index.")
    x = np.array(atlas.model.encode(form.text))
    target = np.array(form.target.linear)
    protected = np.array([d.linear for d in form.protected]).reshape(-1, len(x))
    safe, applied, reason = govern(x, target, protected, form.strength, form.max_drift, form.min_cosine)
    _, original_order = ranks(vectors, x)
    k = min(3, len(vectors))
    original_top = original_order[:k].tolist()
    original_rank = np.argsort(original_order) + 1
    positions = atlas.pca.transform(vectors)
    variants = {}
    for mode, direction, a in [("original", target, 0.), ("naive", np.array(form.target.centroid), form.strength),
                               ("learned", target, form.strength), ("locked", safe, applied)]:
        y = candidate(x, direction, a)
        rejection = None
        if y is None:
            a, y, rejection = 0., x.copy(), "Requested path crosses an undefined vector."
        scores, order = ranks(vectors, y)
        top = order[:k].tolist()
        drift, cosine = metrics(x, y, protected)
        new_rank = np.argsort(order) + 1
        changes = [{"id": i, "before": int(original_rank[i]), "after": int(new_rank[i])}
                   for i in dict.fromkeys(original_top + top)]
        alerts = []
        projected_query = atlas.pca.transform([y])[0]
        projected_top = np.argsort(np.linalg.norm(positions - projected_query, axis=1), kind="stable")[:k]
        for i in projected_top:
            if i not in top:
                alerts.append({"id": int(i), "reason": "Near the query in 3D but outside its full-space top neighbors"})
        for i in top:
            if form.relevant is not None and i not in relevant:
                alerts.append({"id": i, "reason": "Outside supplied relevant set"})
            if categories and form.expected_category and categories[i] != form.expected_category:
                alerts.append({"id": i, "reason": "Category differs from expected category"})
            if abs(int(new_rank[i] - original_rank[i])) >= 3:
                alerts.append({"id": i, "reason": "Rank shifted by at least three places"})
        trajectory = [candidate(x, direction, s) for s in np.linspace(0, a, 25)]
        attributes = [{"name": name, "role": role, "before": float(v @ x), "after": float(v @ y)}
                      for name, role, v in [(form.target.name, "target", target),
                                             *((d.name, "protected", np.asarray(d.linear)) for d in form.protected),
                                             *((name, "diagnostic", v) for name, v in atlas.directions.items())]]
        variants[mode] = {"vector": y.tolist(), "trajectory": atlas.pca.transform(trajectory).tolist(),
                          "applied": a, "target_delta": float(target @ (y - x)), "drift": drift, "cosine": cosine,
                          "satisfied": drift <= form.max_drift and cosine >= form.min_cosine,
                          "reason": rejection or (reason if mode == "locked" else None),
                          "neighbors": [{"id": i, "score": float(scores[i])} for i in top],
                          "gained": sorted(set(top) - set(original_top)), "lost": sorted(set(original_top) - set(top)),
                          "changes": changes, "attributes": attributes, "suspicions": alerts, "ndcg": ndcg(top, relevant)}
    all_dirs = [form.target, *form.protected]
    conflicts = [{"a": d.name, "b": other.name, "cosine": float(np.clip(np.dot(d.linear, other.linear), -1, 1))}
                 for i, d in enumerate(all_dirs) for other in all_dirs[i+1:]]
    return {"model_id": identity, "requested": form.strength, "variants": variants, "conflicts": conflicts,
            "points": positions.tolist(), "fidelity": fidelity(vectors, positions, atlas.pca.explained_variance_ratio_.sum())}
