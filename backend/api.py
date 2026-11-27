"""Read-only runtime contract for the local research workspace."""
from contextlib import asynccontextmanager
from typing import Literal

from fastapi import FastAPI, HTTPException, Request
from pydantic import BaseModel
from starlette.middleware.trustedhost import TrustedHostMiddleware

from .model import Backbone, DIMENSIONS, PROBES, SEED


class Health(BaseModel):
    service: Literal["eidolon-vector-x"] = "eidolon-vector-x"
    status: Literal["ready"] = "ready"
    version: Literal["0.1.0"] = "0.1.0"


class Sample(BaseModel):
    id: str
    text: str
    vector: list[float]


class Foundation(BaseModel):
    backbone: str
    dimensions: int
    documents: int
    seed: int
    corpus_sha256: str
    samples: list[Sample]


@asynccontextmanager
async def lifespan(app: FastAPI):
    model = Backbone()
    app.state.foundation = Foundation(
        backbone="TF–IDF / LSA", dimensions=DIMENSIONS, documents=model.count,
        seed=SEED, corpus_sha256=model.digest,
        samples=[Sample(id=key, text=text, vector=model.encode(text)) for key, text in PROBES.items()],
    )
    yield
    del app.state.foundation


app = FastAPI(title="EIDOLON VECTOR-X", version="0.1.0", lifespan=lifespan,
              docs_url=None, redoc_url=None)
app.add_middleware(TrustedHostMiddleware, allowed_hosts=["localhost", "127.0.0.1"])


@app.get("/api/v1/health", response_model=Health)
def health(request: Request):
    if not hasattr(request.app.state, "foundation"):
        raise HTTPException(503, "Backbone unavailable")
    return Health()


@app.get("/api/v1/foundation", response_model=Foundation)
def foundation(request: Request):
    return request.app.state.foundation
