"""Small, fitted CPU backbone. Only the versioned calibration file is fit input."""
from hashlib import sha256
from pathlib import Path

import numpy as np
from sklearn.decomposition import TruncatedSVD
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.preprocessing import normalize

CORPUS = Path(__file__).with_name("data") / "calibration.txt"
PROBES = {
    "stellar": "A telescope gathers light from a distant star.",
    "ocean": "Cold ocean currents carry water through the deep.",
    "acoustic": "The vibrating string produces sound in the concert hall.",
}
DIMENSIONS = 8
SEED = 17


class Backbone:
    def __init__(self, dimensions=DIMENSIONS):
        raw = CORPUS.read_bytes()
        documents = raw.decode("utf-8").splitlines()
        self.documents = tuple(documents)
        self.digest = sha256(raw).hexdigest()
        self.count = len(documents)
        self.vectorizer = TfidfVectorizer(stop_words="english", sublinear_tf=True)
        features = self.vectorizer.fit_transform(documents)
        self.svd = TruncatedSVD(n_components=dimensions, random_state=SEED)
        self.svd.fit(features)

    def encode(self, sentence: str) -> list[float]:
        vector = self.svd.transform(self.vectorizer.transform([sentence]))
        if not np.isfinite(vector).all() or np.linalg.norm(vector) < 1e-12:
            raise ValueError("No representable signal")
        return normalize(vector)[0].tolist()
