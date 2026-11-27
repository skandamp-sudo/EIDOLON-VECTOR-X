"""Run with .venv/bin/python -m scripts.phase1_evidence from the repository root."""
import json
from statistics import median
from time import perf_counter_ns

import numpy as np

from backend.atlas import Atlas, Query
from backend.model import Backbone


def median_ms(operation):
    for _ in range(10):
        operation()
    durations = []
    for _ in range(100):
        start = perf_counter_ns()
        operation()
        durations.append(perf_counter_ns() - start)
    return median(durations) / 1_000_000


def main():
    backbone = Backbone()
    atlas = Atlas(backbone)
    query = Query(text="A telescope records light from a distant star.", target="Ocean", strength=1.2)
    run = atlas.explore(query)
    original = np.array(run.original)
    evidence = {
        "query": query.model_dump(), "model": run.model, "corpus_sha256": backbone.digest,
        "dimensions": run.dimensions, "documents": len(run.documents),
        "warmups": 10, "samples_per_operation": 100,
        "encode_median_ms": median_ms(lambda: backbone.encode(query.text)),
        "steering_path_median_ms": median_ms(lambda: atlas.steering_path(original, query.target, query.strength)),
        "retained_cosine": run.retained_cosine, "displacement": run.displacement,
        "pca_explained_variance": run.explained_variance,
    }
    for side in ("before", "after"):
        evidence[side] = [
            {"point": i + 1, "text": run.documents[i].text, "cosine": getattr(run.documents[i], side)}
            for i in getattr(run, side)
        ]
    print(json.dumps(evidence, indent=2))


if __name__ == "__main__":
    main()
