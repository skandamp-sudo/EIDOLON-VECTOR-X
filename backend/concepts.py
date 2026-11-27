"""Train class-balanced concept readouts in the fixed calibration embedding basis."""
from hashlib import sha256
import re
from typing import Annotated, Literal

import numpy as np
from pydantic import BaseModel, ConfigDict, Field
from sklearn.linear_model import Ridge
import sklearn

from .model import DIMENSIONS, SEED

Name = Annotated[str, Field(min_length=1, max_length=64)]
Text = Annotated[str, Field(min_length=1, max_length=4096)]
Unit = Annotated[list[float], Field(min_length=DIMENSIONS, max_length=DIMENSIONS)]


class Strict(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True, allow_inf_nan=False)


class Example(Strict):
    text: Text
    family: Name
    positive: bool
    split: Literal["fit", "validation"]


class Training(Strict):
    name: Name
    examples: list[Example] = Field(min_length=8, max_length=128)


class Direction(Strict):
    name: Name
    model_id: Name
    linear: Unit
    centroid: Unit


def model_id(atlas):
    # Bind directions to the actual fitted basis as well as the training recipe.
    h = sha256(f"tfidf-sublinear-english/lsa-{DIMENSIONS}/{SEED}/{sklearn.__version__}/{atlas.model.digest}".encode())
    h.update(atlas.model.svd.components_.astype("<f8").tobytes())
    h.update(atlas.model.vectorizer.idf_.astype("<f8").tobytes())
    return h.hexdigest()


def key(text):
    return " ".join(re.findall(r"\w+", text.casefold()))


def unit(v):
    length = np.linalg.norm(v)
    if length < 1e-9:
        raise ValueError("The examples produce a degenerate direction.")
    return v / length


def learn(atlas, form):
    families, texts, vectors = {}, set(), set()
    base_text = {key(text) for text in atlas.model.documents}
    base_vectors = {tuple(np.round(v, 9)) for v in atlas.vectors}
    x, y, fit = [], [], []
    for example in form.examples:
        family, text = key(example.family), key(example.text)
        if not family or not text or text in texts:
            raise ValueError("Each example needs distinct text and an identified source family.")
        if families.setdefault(family, example.split) != example.split:
            raise ValueError("Keep each source family in a single split.")
        texts.add(text)
        v = np.array(atlas.model.encode(example.text))
        signature = tuple(np.round(v, 9))
        if signature in vectors:
            raise ValueError("Two examples have indistinguishable embeddings.")
        if example.split == "validation" and (text in base_text or signature in base_vectors):
            raise ValueError("Validation overlaps encoder calibration.")
        vectors.add(signature); x.append(v); y.append(1 if example.positive else -1); fit.append(example.split == "fit")
    x, y, fit = np.array(x), np.array(y), np.array(fit)
    if any(np.sum((fit == split) & (y == label)) < 2 for label in (-1, 1) for split in (True, False)):
        raise ValueError("Supply at least two distinct examples per class in each split.")
    train, labels = x[fit], y[fit]
    centroid = unit(train[labels == 1].mean(0) - train[labels == -1].mean(0))
    weights = np.where(labels == 1, .5 / np.mean(labels == 1), .5 / np.mean(labels == -1))
    classifier = Ridge(alpha=.25, solver="svd").fit(train, labels, sample_weight=weights)
    linear = unit(classifier.coef_)
    predictions = np.where(classifier.predict(x[~fit]) >= 0, 1, -1)
    actual = y[~fit]
    confusion = {name: int(np.sum((actual == a) & (predictions == b)))
                 for name, a, b in [("tp", 1, 1), ("tn", -1, -1), ("fp", -1, 1), ("fn", 1, -1)]}
    balanced = np.mean([np.mean(predictions[actual == v] == v) for v in (-1, 1)])
    return {"direction": Direction(name=form.name, model_id=model_id(atlas), linear=linear.tolist(),
                                   centroid=centroid.tolist()).model_dump(),
            "validation": {"fit": int(sum(fit)), "held_out": int(sum(~fit)), "balanced_accuracy": float(balanced),
                           "confusion": confusion, "threshold": float(-classifier.intercept_ / np.linalg.norm(classifier.coef_))}}


# Authored development anchors. Family IDs must be retained when editing a split.
PRESETS = {
    "Ocean affinity": [
        ["ocean currents and tides", "deep water pressure sensor", "research vessel crosses cold waves"],
        ["stellar telescope and mirror", "night sky tracks planet", "satellite spectrum in orbit"],
        ["cold tides near the ocean shore", "surface vessel measures pressure"],
        ["distant planets around a star", "observatory gathers stellar light"],
    ],
    "Botanical affinity": [
        ["forest canopy grows leaves", "soil roots of a seed", "plant captures energy"],
        ["concert instrument vibration", "microphone records orchestra", "resonant frequency and sound"],
        ["moist roots under growing leaves", "seed in a forest canopy"],
        ["string vibration in the hall", "orchestra reflects acoustic sound"],
    ],
}


def preset(atlas, name):
    examples = []
    for group, texts in enumerate(PRESETS[name]):
        for i, text in enumerate(texts):
            examples.append(Example(text=text, family=f"{name}-{group}-{i}", positive=group % 2 == 0,
                                    split="fit" if group < 2 else "validation"))
    form = Training(name=name, examples=examples)
    return {**learn(atlas, form), "examples": form.model_dump()["examples"]}
