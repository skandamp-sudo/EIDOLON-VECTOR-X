"""Read-only runtime contract for the local research workspace."""
import asyncio
from contextlib import asynccontextmanager
from typing import Literal

from fastapi import FastAPI, HTTPException, Request
from pydantic import BaseModel, ValidationError
from starlette.middleware.trustedhost import TrustedHostMiddleware

from .model import Backbone, DIMENSIONS, PROBES, SEED
from .foundry import router as foundry_router
from .atlas import Atlas, Query, Result


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
    app.state.atlas = Atlas(model)
    app.state.foundation = Foundation(
        backbone="TF–IDF / LSA", dimensions=DIMENSIONS, documents=model.count,
        seed=SEED, corpus_sha256=model.digest,
        samples=[Sample(id=key, text=text, vector=model.encode(text)) for key, text in PROBES.items()],
    )
    yield
    del app.state.foundation
    del app.state.atlas


app = FastAPI(title="EIDOLON VECTOR-X", version="0.1.0", lifespan=lifespan,
              docs_url=None, redoc_url=None)
app.include_router(foundry_router)
app.add_middleware(TrustedHostMiddleware, allowed_hosts=["localhost", "127.0.0.1"])


@app.get("/api/v1/health", response_model=Health)
def health(request: Request):
    if not hasattr(request.app.state, "foundation"):
        raise HTTPException(503, "Backbone unavailable")
    return Health()


@app.get("/api/v1/foundation", response_model=Foundation)
def foundation(request: Request):
    return request.app.state.foundation


@app.post("/api/v1/explore", response_model=Result, openapi_extra={
    "requestBody": {"required": True, "content": {"application/json": {"schema": Query.model_json_schema()}}}
})
async def explore(request: Request):
    if request.headers.get("content-type", "").split(";")[0].lower() != "application/json":
        raise HTTPException(415, "Send JSON")
    body = bytearray()
    try:
        async with asyncio.timeout(4):
            async for chunk in request.stream():
                if len(body) + len(chunk) > 4096:
                    raise HTTPException(413, "Query exceeds the size limit")
                body.extend(chunk)
    except TimeoutError:
        raise HTTPException(408, "Request timed out")
    try:
        query = Query.model_validate_json(body)
    except ValidationError:
        raise HTTPException(422, "Use 1–400 characters, a known target and strength from −2 to +2")
    try:
        return request.app.state.atlas.explore(query)
    except ValueError as error:
        raise HTTPException(422, str(error)) from error
