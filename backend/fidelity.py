"""Deterministic bounded diagnostics for the shared calibration PCA frame."""
import numpy as np
from scipy.spatial.distance import pdist, squareform
from scipy.stats import spearmanr
from sklearn.manifold import trustworthiness


def fidelity(vectors, positions, explained):
    n = len(vectors)
    ids = np.linspace(0, n - 1, min(n, 128), dtype=int)
    k = min(3, (len(ids) - 1) // 2)
    result = {"population": n, "sample": len(ids), "k": k, "calibration_variance": float(explained),
              "trustworthiness": None, "overlap": None, "distance_rho": None, "distortion": {}}
    if not k:
        return result
    high = pdist(vectors[ids], metric="cosine")
    low = pdist(positions[ids], metric="euclidean")
    if np.ptp(high) < 1e-12 or np.ptp(low) < 1e-12:
        return result
    ranks = []
    for distances in (high, low):
        matrix = squareform(distances)
        np.fill_diagonal(matrix, np.inf)
        ranks.append(np.argsort(matrix, axis=1, kind="stable")[:, :k])
    overlap = np.array([len(set(a) & set(b)) / k for a, b in zip(*ranks)])
    result.update(trustworthiness=float(trustworthiness(vectors[ids], positions[ids], n_neighbors=k, metric="cosine")),
                  overlap=float(overlap.mean()), distance_rho=float(spearmanr(high, low).statistic),
                  distortion={str(i): float(1 - o) for i, o in zip(ids, overlap)})
    return result
