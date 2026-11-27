# EIDOLON VECTOR-X

A local embedding research workspace for RESURRECT 2026, PS-05. Mission 001 provides the CPU backbone, startup interface, runtime contracts and evaluation design.

## Local development

From the checkout, run `./scripts/start`. Prerequisites are Node 24, npm, uv and CPython 3.12. The first start installs the locked dependencies in `.venv` and `frontend/node_modules`. No checkpoint download is needed. After editing dependency manifests, refresh using `uv sync --frozen` and `npm ci --prefix frontend --ignore-scripts`.

Open [the workspace](http://localhost:5173). The frontend proxies `/api/v1` to the [loopback API](http://localhost:8000/api/v1/health). Vite provides hot replacement and Uvicorn reloads backend Python changes. Restart after editing the calibration text. Run `./scripts/stop` to shut down both process groups. Logs persist under `.runtime/backend.log` and `.runtime/frontend.log`, with two 1 MB backups per service. The latest launcher output is in `.runtime/startup.log`.

Run `./scripts/verify` for the model tests, live HTTP tests, typecheck, build, browser smoke test and Git whitespace checks. The browser test launches installed Google Chrome with a temporary profile and saves desktop and mobile screenshots under `.runtime/`. At an authorized milestone, stage its files and run `./scripts/milestone "commit message"`. A failed check stops the commit.

## Runtime contract

| Method and endpoint | Successful response |
| --- | --- |
| GET `/api/v1/health` | Service identifier, version and readiness after a successful model fit and probe encoding |
| GET `/api/v1/foundation` | Backbone name, dimensions, seed, training document count, SHA-256 of training bytes and probe IDs, text and normalized vectors |
| GET `/openapi.json` on port 8000 | Machine-readable response schemas |

The service fits once per worker startup. Failure prevents startup. There is no database, public inference input or serialized model loader. The viewer polls both endpoints and clears stale readings on failure. Arrow keys and labeled buttons rotate the glyph. The coefficient list gives its numeric equivalent. In each of eight sectors, tube radius encodes the corresponding signed coefficient. Styling has no scientific interpretation.

[Research design](docs/RESEARCH.md) · [Verified build state](BUILD_STATE.md)
