"""Public calibration demo. Hosted processes register no file or training routes."""
import os
import re

from fastapi import FastAPI, HTTPException, Request
from starlette.middleware.cors import CORSMiddleware
from starlette.middleware.trustedhost import TrustedHostMiddleware

from .api import Health, Foundation, lifespan, health, foundation, explore
from .atlas import Result
from .lab_api import intelligence


def create():
    host = os.environ.get("RAILWAY_PUBLIC_DOMAIN", "")
    origin = os.environ.get("VECTOR_X_FRONTEND_ORIGIN", "")
    if not re.fullmatch(r"[a-z0-9][a-z0-9-]{0,62}\.up\.railway\.app", host):
        raise RuntimeError("Configure the Railway public domain before startup.")
    if not re.fullmatch(r"https://[a-z0-9][a-z0-9-]{0,62}\.vercel\.app", origin):
        raise RuntimeError("Configure the exact authorized Vercel frontend origin.")
    app = FastAPI(lifespan=lifespan, docs_url=None, redoc_url=None, openapi_url=None)
    app.state.hosted_origin = origin
    app.add_api_route("/api/v1/health", health, methods=["GET"], response_model=Health)
    app.add_api_route("/api/v1/foundation", foundation, methods=["GET"], response_model=Foundation)
    app.add_api_route("/api/v1/explore", explore, methods=["POST"], response_model=Result)

    @app.post("/api/v1/intelligence/{operation}")
    async def public_lab(operation: str, request: Request):
        if operation not in {"workspace","compare","frontier"}:
            raise HTTPException(403,"Training and dataset uploads are available locally.")
        return await intelligence(operation,request)

    app.add_middleware(CORSMiddleware, allow_origins=[origin], allow_methods=["GET","POST"],
                       allow_headers=["content-type","x-vector-x-client"], allow_credentials=False)
    app.add_middleware(TrustedHostMiddleware, allowed_hosts=[host,"healthcheck.railway.app"])
    return app
