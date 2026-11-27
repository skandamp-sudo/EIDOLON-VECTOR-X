"""Loopback-only multi-encoder comparison. Derive each axis in the verified basis."""
from functools import lru_cache
import json
from typing import Literal

import numpy as np
from fastapi import APIRouter, Request
from pydantic import ConfigDict, Field

from .atlas import TOPICS
from .concepts import Strict
from .debugger import Document, Hash, METHODS, Settings, Task, comparison, validated_rows
from .foundry import local_operation
from .model import CORPUS
from .ranking_v2 import Index, unit
from .recovery_data import ROOT
from .recovery_models import MODELS, encode, encoder

router = APIRouter(prefix="/api/v1/research-v2")
EncoderName = Literal["legacy8", "legacy16", "expanded", "minilm"]
Axis = Literal["Astronomy affinity", "Ocean affinity", "Acoustics affinity", "Botanical affinity"]
Method = Literal["dense", "bm25", "fusion", "locked", "unconstrained", "spherical"]
AXES = ("Astronomy affinity", "Ocean affinity", "Acoustics affinity", "Botanical affinity")


class Selection(Strict):
    encoder: EncoderName


class ResearchSettings(Settings):
    model_config = ConfigDict(validate_default=True)
    baseline: Method = "dense"
    candidate: Method = "locked"


class Experiment(Selection):
    model_id: Hash
    target: Axis
    protection: Axis
    documents: list[Document] | None = Field(default=None, min_length=1, max_length=256)
    tasks: list[Task] = Field(min_length=1, max_length=16)
    settings: ResearchSettings


def index_rows(model, rows):
    vectors = {}
    for key, text in rows.items():
        point = encode(model, text)
        if point is not None:
            vectors[key] = point.values
    return Index(model.identity, list(vectors), list(vectors.values())), vectors


@lru_cache(maxsize=4)
def basis(name):
    model = encoder(name)
    manifest = json.loads((ROOT / "evidence/recovery-v2/reproduction.json").read_text())
    if model.identity != manifest["models"][name]["model_sha256"]:
        raise ValueError("Local encoder differs from the verified model identity.")
    texts = CORPUS.read_text().splitlines()
    index, vectors = index_rows(model, dict(enumerate(texts, 1)))
    axes = {}
    for group, axis in enumerate(AXES):
        pos = [v for i,v in vectors.items() if (i-1)//6 == group]
        neg = [v for i,v in vectors.items() if (i-1)//6 != group]
        if pos and neg:
            axes[axis] = unit(np.mean(pos,axis=0)-np.mean(neg,axis=0))
    return model, texts, index, axes


def metadata(name):
    model, texts, _, axes = basis(name)
    return dict(model_id=model.identity, dimensions=MODELS[name], documents=texts, axes=list(axes))


def run_experiment(form):
    model, texts, index, axes = basis(form.encoder)
    if model.identity != form.model_id:
        raise ValueError("Selected encoder and report model identity differ.")
    if form.target not in axes or form.protection not in axes:
        raise ValueError("The selected basis cannot represent these directions.")
    rows = validated_rows(form, texts)
    if form.documents is not None:
        index, _ = index_rows(model, rows)
    report = comparison(model, form, rows, index, axes[form.target], axes[form.protection],
                        METHODS+("spherical",))
    report.update(protocol="ascension-retrieval-v1",encoder=form.encoder,dimensions=MODELS[form.encoder],
                  direction_recipe="calibration-group-centroid-difference-v1",
                  geometry_tolerance=1e-10, reduction_policy="binary64-product-fsum-v1")
    report["limitations"][0] = "Calibration-derived directions; authored or operator relevance judgments."
    return report


@router.post("/debug-workspace")
async def debug_workspace(request: Request):
    return await local_operation(request, 512, lambda raw: metadata(Selection.model_validate_json(raw).encoder))


@router.post("/debug")
async def debug(request: Request):
    return await local_operation(request, 1_500_000, lambda raw: run_experiment(Experiment.model_validate_json(raw)))
