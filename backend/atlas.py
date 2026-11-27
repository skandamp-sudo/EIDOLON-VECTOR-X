"""Fit a shared PCA frame and corpus-derived concept directions once per startup."""
from typing import Literal

import numpy as np
from pydantic import BaseModel, ConfigDict, Field
from sklearn.decomposition import PCA

from .model import Backbone, DIMENSIONS

Topic = Literal["Astronomy", "Ocean", "Acoustics", "Botany"]
TOPICS = ("Astronomy", "Ocean", "Acoustics", "Botany")
# The four consecutive groups of six are human annotations of this exact fixture.
LABELLED_CORPUS = "4534b34b8dd78f0fb10ff4374f1db003da3b2277e668c840a056260375a20c77"


class Query(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    text: str = Field(min_length=1, max_length=400)
    target: Topic
    strength: float = Field(ge=-2, le=2, allow_inf_nan=False)


class Document(BaseModel):
    id: int
    topic: Topic
    text: str
    xyz: list[float]
    before: float
    after: float


class Result(BaseModel):
    model: str
    dimensions: int
    target: Topic
    strength: float
    documents: list[Document]
    original: list[float]
    steered: list[float]
    trajectory: list[list[float]]
    before: list[int]
    after: list[int]
    retained_cosine: float
    explained_variance: float
    neighbor_overlap: float


class Atlas:
    def __init__(self, model: Backbone):
        if model.digest != LABELLED_CORPUS:
            raise ValueError("Review topic annotations for changed calibration corpus")
        self.model = model
        self.labels = np.repeat(TOPICS, 6)
        self.vectors = np.array([model.encode(doc) for doc in model.documents])
        self.pca = PCA(n_components=3, svd_solver="full").fit(self.vectors)
        self.coordinates = self.pca.transform(self.vectors).tolist()
        self.directions = {}
        for topic in TOPICS:
            mask = self.labels == topic
            delta = self.vectors[mask].mean(axis=0) - self.vectors[~mask].mean(axis=0)
            self.directions[topic] = delta / np.linalg.norm(delta)

    def explore(self, request: Query) -> Result:
        original = np.array(self.model.encode(request.text))
        steps = np.linspace(0, request.strength, 25)[:, None]
        path = original + steps * self.directions[request.target]
        norms = np.linalg.norm(path, axis=1, keepdims=True)
        if np.any(norms < 1e-10):
            raise ValueError("The requested path crosses an undefined vector")
        path /= norms
        path[0] = original
        if request.strength == 0:
            path[:] = original
        steered = path[-1]
        before = np.clip(self.vectors @ original, -1, 1)
        after = np.clip(self.vectors @ steered, -1, 1)
        top_before = np.argsort(-before, kind="stable")[:3].tolist()
        top_after = np.argsort(-after, kind="stable")[:3].tolist()
        documents = [
            Document(id=i, topic=self.labels[i], text=text, xyz=self.coordinates[i],
                     before=before[i], after=after[i])
            for i, text in enumerate(self.model.documents)
        ]
        return Result(model="TF–IDF / LSA", dimensions=DIMENSIONS, target=request.target,
                      strength=request.strength, original=original.tolist(), steered=steered.tolist(),
                      documents=documents, trajectory=self.pca.transform(path).tolist(),
                      before=top_before, after=top_after,
                      retained_cosine=float(np.clip(original @ steered, -1, 1)),
                      explained_variance=float(self.pca.explained_variance_ratio_.sum()),
                      neighbor_overlap=len(set(top_before) & set(top_after)) / 3)
