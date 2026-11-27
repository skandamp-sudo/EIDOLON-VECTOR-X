"""Loopback-only interactive inference against the selected model's research reference index."""
from functools import lru_cache
from typing import Literal
from fastapi import APIRouter, Request
from pydantic import BaseModel, ConfigDict, Field, ValidationError
from .foundry import local_operation
from .recovery_data import paragraphs, papers
from .recovery_models import encode
from .recovery_steering import workspace

router = APIRouter(prefix="/api/v1/research-v2")


class Probe(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    encoder: Literal["legacy8","legacy16","expanded","minilm"]
    expected_model: str = Field(pattern=r"^[a-f0-9]{64}$")
    text: str = Field(min_length=1, max_length=1600)
    strength: float = Field(ge=-2, le=2, allow_inf_nan=False)


@lru_cache(maxsize=1)
def sources():
    result = {}
    for family, paper in papers("train")[384:480]:
        for key,(text,_) in paragraphs(paper).items():
            result.setdefault(key, dict(family=family, excerpt=text[:220]))
    return result


@router.post("/probe")
async def probe(request: Request):
    def process(raw):
        try:
            form=Probe.model_validate_json(raw)
        except ValidationError:
            raise ValueError("Choose a supported encoder, bounded text and strength.") from None
        w=workspace(form.encoder)
        if w.identity != form.expected_model:
            raise ValueError("Live basis differs from the selected evidence. Start with the registered CPU settings.")
        query=encode(w.model,form.text)
        if query is None:
            raise ValueError("No representable signal")
        reference=sources()
        variants={}
        for name,(point,applied) in w.endpoints(query,form.strength).items():
            variants[name]=dict(applied=applied,**w.geometry(query,point),
                neighbors=[dict(id=i,**reference[i]) for i in w.reference.rank(point)])
        return dict(model=w.identity,dimensions=len(query.values),variants=variants)
    return await local_operation(request,16_384,process)
