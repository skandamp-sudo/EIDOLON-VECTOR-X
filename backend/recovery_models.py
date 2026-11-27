"""Separate CPU research models. Loading uses local hash-verified assets only."""
from functools import lru_cache
from hashlib import sha256
from importlib.metadata import version
import json
import platform

import numpy as np
import sklearn
from sklearn.decomposition import TruncatedSVD
from sklearn.feature_extraction.text import TfidfVectorizer

from .atlas import Atlas
from .concepts import model_id
from .model import Backbone
from .ranking_v2 import Point, unit
from .recovery_data import CACHE, DIGEST, ROOT, papers

MODELS = {"legacy8": 8, "legacy16": 16, "expanded": 128, "minilm": 384}


def masked_mean(tokens, mask):
    if tokens.shape != (1, mask.shape[1], 384) or mask.shape[0] != 1 or not mask.any():
        raise ValueError("Invalid MiniLM output.")
    return unit(np.average(tokens[0], axis=0, weights=mask[0]))


class MiniLM:
    def __init__(self):
        from numpy._core._multiarray_umath import __cpu_features__
        if platform.machine().lower() not in {"x86_64","amd64"} or not __cpu_features__.get("AVX2"):
            raise ValueError("MiniLM requires an x86-64 AVX2 CPU.")
        try:
            import onnxruntime as ort
            from tokenizers import Tokenizer
        except ImportError as exc:
            raise ValueError("Install the pinned CPU runtime and tokenizer.") from exc
        if (ort.__version__, version("tokenizers")) != ("1.20.1","0.21.4"):
            raise ValueError("The CPU runtime versions differ from the protocol.")
        manifest = (ROOT / "backend/data/minilm-v2.json").read_bytes()
        paths = {}
        for name, expected in json.loads(manifest)["files"].items():
            path = CACHE / "minilm" / name
            if not path.is_file() or path.stat().st_size > 24_000_000 or sha256(path.read_bytes()).hexdigest() != expected:
                raise ValueError("Install the hash-verified MiniLM artifacts.")
            paths[name] = path
        self.tokenizer = Tokenizer.from_file(str(paths["tokenizer.json"]))
        self.tokenizer.no_padding()
        self.tokenizer.enable_truncation(max_length=256)
        options = ort.SessionOptions()
        options.intra_op_num_threads = options.inter_op_num_threads = 1
        self.session = ort.InferenceSession(str(paths["onnx/model_quint8_avx2.onnx"]),
                                            options, providers=["CPUExecutionProvider"])
        self.identity = sha256(manifest+b"/ort1.20.1/tok0.21.4/masked-mean-f64/256/single-v2").hexdigest()

    def encode(self, text):
        t = self.tokenizer.encode(text)
        feeds = {k:np.array([v], dtype=np.int64) for k,v in
                 [("input_ids",t.ids),("attention_mask",t.attention_mask),("token_type_ids",t.type_ids)]}
        tokens, = self.session.run(["last_hidden_state"], feeds)
        return masked_mean(tokens, feeds["attention_mask"])


class Expanded:
    def __init__(self):
        abstracts = [p["abstract"] for _,p in papers("train")[:384] if p["abstract"].strip()]
        self.vectorizer = TfidfVectorizer(sublinear_tf=True, stop_words="english", max_features=8192)
        features = self.vectorizer.fit_transform(abstracts)
        self.svd = TruncatedSVD(n_components=128, random_state=17).fit(features)
        h = sha256(f"qasper/{DIGEST}/128/384/17/{sklearn.__version__}".encode())
        h.update(json.dumps(self.vectorizer.get_feature_names_out().tolist()).encode())
        for array in (self.vectorizer.idf_, self.svd.components_):
            h.update(array.astype("<f8").tobytes())
        self.identity = h.hexdigest()

    def encode(self, text):
        return unit(self.svd.transform(self.vectorizer.transform([text]))[0])


@lru_cache(maxsize=4)
def encoder(name):
    if name == "expanded":
        return Expanded()
    if name == "minilm":
        return MiniLM()
    if name not in MODELS:
        raise ValueError("Unknown research encoder.")
    model = Backbone(MODELS[name])
    model.identity = model_id(Atlas(model))
    return model


def encode(model, text):
    if not text.strip():
        return None
    try:
        return Point(model.identity, unit(model.encode(text)))
    except ValueError as error:
        if str(error) == "No representable signal":
            return None
        raise
