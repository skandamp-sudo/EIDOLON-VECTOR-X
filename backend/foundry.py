"""Transient local imports. No dataset registry, filenames or filesystem access."""
import asyncio
import csv
import io
import json
import math
from threading import BoundedSemaphore

import numpy as np
from fastapi import APIRouter, HTTPException, Request
from pydantic import Field, ValidationError
from starlette.concurrency import run_in_threadpool
from starlette.responses import JSONResponse

from .concepts import Name, Strict, Unit, model_id
from .atlas import Query, Topic

router = APIRouter(prefix="/api/v1/foundry")
MAX_BYTES = 10_000_000
MAX_ROWS = 5_000
MAX_COLUMNS = 32
MAX_FIELD = 4096
BATCH_SIZE = 64
# A request owns this slot through parsing/inference and response serialization.
slot = BoundedSemaphore(1)
LOCAL_ORIGINS = {f"http://{host}:{port}" for host in ("localhost", "127.0.0.1") for port in (5173, 8000)}


def checked_cell(value):
    if value is None:
        return ""
    if isinstance(value, (list, dict)) or isinstance(value, float) and not math.isfinite(value):
        raise ValueError("Use flat records with finite scalar values.")
    cell = str(value)
    if len(cell) > MAX_FIELD or any(ord(c) < 32 and c not in "\t\r\n" or 0xD800 <= ord(c) <= 0xDFFF for c in cell):
        raise ValueError("Cells must contain valid text of at most 4096 characters.")
    return cell


def column_names(names):
    if not 1 <= len(names) <= MAX_COLUMNS:
        raise ValueError("Use between 1 and 32 columns.")
    if any(not key.strip() or len(key) > 128 or checked_cell(key) != key for key in names):
        raise ValueError("Use nonempty column names of at most 128 characters.")
    if len(set(names)) != len(names):
        raise ValueError("Column names must be unique.")
    return list(names)


def unique_object(pairs):
    column_names([key for key, _ in pairs])
    return dict(pairs)


def bounded_json(text):
    # Reject large/deep structures before allocating the Python object graph.
    quoted = escaped = False
    depth = separators = objects = 0
    for char in text:
        if quoted:
            if escaped:
                escaped = False
            elif char == "\\":
                escaped = True
            elif char == '"':
                quoted = False
        elif char == '"':
            quoted = True
        elif char in "[{":
            depth += 1
            objects += char == "{"
            if objects > MAX_ROWS:
                raise ValueError("The limit is 5000 records.")
            if depth > 2:
                raise ValueError("Nested JSON fields are unsupported.")
        elif char in "]}":
            depth -= 1
        elif char in ",:":
            separators += 1
            if separators > 2 * MAX_ROWS * MAX_COLUMNS:
                raise ValueError("JSON exceeds the structural limit.")
    return json.loads(text, object_pairs_hook=unique_object)


def objects_as_rows(records):
    columns = {}
    rows = []
    for record in records:
        if len(rows) >= MAX_ROWS:
            raise ValueError("The limit is 5000 records.")
        if not isinstance(record, dict) or not record:
            raise ValueError("Each JSON record must be a nonempty object.")
        for key in record:
            columns.setdefault(key, len(columns))
        column_names(columns)
        rows.append([checked_cell(record.get(key)) for key in columns])
    for row in rows:
        row.extend([""] * (len(columns) - len(row)))
    return list(columns), rows


def parse(raw, kind):
    if len(raw) > MAX_BYTES:
        raise ValueError("The limit is 10 MB.")
    text = raw.decode("utf-8-sig")
    if "\x00" in text:
        raise ValueError("Binary content is unsupported.")
    stream = io.StringIO(text, newline=None)
    if kind == "csv":
        # Bound delimiter amplification before invoking the C reader.
        if text.count(",") > (MAX_ROWS + 1) * MAX_COLUMNS:
            raise ValueError("CSV exceeds the delimiter limit.")
        reader = csv.reader(stream, strict=True)
        columns = column_names(next(reader, []))
        rows = []
        for row in reader:
            if len(rows) >= MAX_ROWS or len(row) != len(columns):
                raise ValueError("CSV requires consistent row widths and at most 5000 records.")
            rows.append([checked_cell(cell) for cell in row])
    elif kind == "json":
        records = bounded_json(text)
        if not isinstance(records, list):
            raise ValueError("JSON must contain an array of records.")
        columns, rows = objects_as_rows(records)
    elif kind == "jsonl":
        columns, rows = objects_as_rows(bounded_json(line) for line in stream if line.strip())
    elif kind == "txt":
        columns, rows = ["text"], []
        for line in stream:
            if len(rows) >= MAX_ROWS:
                raise ValueError("The limit is 5000 records.")
            rows.append([checked_cell(line.rstrip("\n"))])
    else:
        raise ValueError("Choose CSV, JSON, JSONL or TXT.")
    if not rows:
        raise ValueError("The dataset has no records.")
    return {"columns": columns, "rows": rows}


def embed(raw, atlas):
    items = bounded_json(raw.decode("utf-8"))
    if not isinstance(items, list) or not 1 <= len(items) <= BATCH_SIZE:
        raise ValueError("Send 1 to 64 text records per batch.")
    for item in items:
        if not isinstance(item, str) or not checked_cell(item).strip():
            raise ValueError("Each batch item needs nonempty text.")
    features = atlas.model.vectorizer.transform(items)
    vectors = atlas.model.svd.transform(features)
    norms = np.linalg.norm(vectors, axis=1)
    valid = np.isfinite(norms) & (norms >= 1e-12)
    vectors[valid] /= norms[valid, None]
    xyz = atlas.pca.transform(vectors)
    return {"model": "TF–IDF / LSA", "model_id": model_id(atlas), "corpus_sha256": atlas.model.digest,
            "points": [{"vector": vector.tolist(), "xyz": point.tolist()} if ok else None
                       for ok, vector, point in zip(valid, vectors, xyz)]}


class FoundryQuery(Query):
    text: str = Field(min_length=1, max_length=MAX_FIELD)


def steer(raw, atlas):
    try:
        query = FoundryQuery.model_validate_json(raw)
    except ValidationError:
        raise ValueError("Use valid query text, a known direction and strength between −2 and +2.") from None
    original = np.array(atlas.model.encode(query.text))
    path = atlas.steering_path(original, query.target, query.strength)
    return {"original": original.tolist(), "steered": path[-1].tolist(),
            "trajectory": atlas.pca.transform(path).tolist(), "model_id": model_id(atlas), "corpus_sha256": atlas.model.digest}


class ExportBatch(Strict):
    model_id: Name
    vectors: list[Unit] = Field(min_length=1, max_length=BATCH_SIZE)
    target: Topic
    strength: float = Field(ge=-2, le=2)


def export_vectors(raw, atlas):
    try:
        batch = ExportBatch.model_validate_json(raw)
    except ValidationError:
        raise ValueError("Invalid vector export request.") from None
    if batch.model_id != model_id(atlas):
        raise ValueError("Vector export requires the original model basis.")
    vectors = np.array(batch.vectors)
    if not np.allclose(np.linalg.norm(vectors, axis=1), 1, rtol=0, atol=1e-8):
        raise ValueError("Vector export requires normalized inputs.")
    return {"model_id": batch.model_id, "steered": [
        atlas.steering_path(v, batch.target, batch.strength)[-1].tolist() for v in vectors
    ]}


async def local_operation(request, limit, process_body):
    app = request.scope.get("app")
    hosted_origin = getattr(app.state, "hosted_origin", None) if app is not None else None
    allowed = {hosted_origin} if hosted_origin else LOCAL_ORIGINS | {None}
    if hosted_origin:
        limit = min(limit, 32_768)
    if request.headers.get("x-vector-x-client") != "foundry" or request.headers.get("origin") not in allowed:
        raise HTTPException(403, "Use the local Data Foundry.")
    if not slot.acquire(blocking=False):
        raise HTTPException(429, "Another Foundry operation is running. Try again.")
    try:
        body = bytearray()
        async with asyncio.timeout(30):
            async for chunk in request.stream():
                if len(body) + len(chunk) > limit:
                    raise HTTPException(413, "Request exceeds the size limit.")
                body.extend(chunk)

        def process():
            result = process_body(body)
            return JSONResponse(result, headers={"Cache-Control": "no-store"})

        return await run_in_threadpool(process)
    except TimeoutError:
        raise HTTPException(408, "Upload timed out.") from None
    except UnicodeError:
        raise HTTPException(422, "Use UTF-8 encoded text.") from None
    except (json.JSONDecodeError, csv.Error):
        raise HTTPException(422, "Malformed file. Check delimiters, quoting and record structure.") from None
    except ValueError as error:
        # JSON numeric conversion errors can contain input-derived information.
        detail = "Query has no known vocabulary." if str(error) == "No representable signal" else str(error)
        if not detail.endswith("."):
            detail = "Invalid record content."
        raise HTTPException(422, detail) from None
    finally:
        slot.release()

@router.post("/{operation}")
async def foundry(operation: str, request: Request):
    if operation not in {"csv", "json", "jsonl", "txt", "embed", "steer", "export"}:
        raise HTTPException(404, "Unknown Foundry operation.")

    def process(body):
        if operation == "embed":
            return embed(body, request.app.state.atlas)
        if operation == "steer":
            return steer(body, request.app.state.atlas)
        if operation == "export":
            return export_vectors(body, request.app.state.atlas)
        return parse(body, operation)

    return await local_operation(request, {"embed": 2_000_000, "steer": 32_768, "export": 64_000}.get(operation, MAX_BYTES), process)
