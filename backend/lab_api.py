"""Bounded, stateless local integration surface shared by the research views."""
from fastapi import APIRouter, HTTPException, Request
from pydantic import ValidationError

from .concepts import PRESETS, Training, learn, model_id, preset
from .frontier import frontier
from .foundry import local_operation
from .intelligence import Comparison, compare

router = APIRouter(prefix="/api/v1/intelligence")


@router.post("/{operation}")
async def intelligence(operation: str, request: Request):
    if operation not in ("workspace", "learn", "compare", "frontier"):
        raise HTTPException(404, "Unknown lab operation.")
    atlas = request.app.state.atlas

    def process(body):
        if operation == "workspace":
            return {"model_id": model_id(atlas), "presets": [preset(atlas, name) for name in PRESETS],
                    "documents": list(atlas.model.documents), "categories": atlas.labels.tolist()}
        try:
            if operation == "learn":
                return learn(atlas, Training.model_validate_json(body))
            form = Comparison.model_validate_json(body)
            if getattr(request.app.state,"hosted_origin",None) and form.index is not None:
                raise HTTPException(403,"Imported indexes are available locally.")
            return frontier(atlas, form) if operation == "frontier" else compare(atlas, form)
        except ValidationError:
            raise ValueError("Invalid dimensions, example structure, index size or constraint settings.") from None

    limit = {"workspace": 16, "learn": 2_000_000, "compare": 6_000_000, "frontier": 6_000_000}[operation]
    return await local_operation(request, limit, process)
