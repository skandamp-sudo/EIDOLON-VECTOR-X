# Build state

## Mission 001 • 27 November 2026

Verified on macOS x86_64, Intel i9-9880H, eight physical cores and 16 GiB RAM. Project Python 3.12.14, Node 24.22.1, Vite 7.3.6. Standalone Codex thread metadata reported GPT-6.2 Astra.

The 24-document TF–IDF/LSA backbone returns actual unit vectors with eight components. The frontend and API ran on loopback ports 5173 and 8000. Verified startup, shutdown, port release, restart, Vite hot update and Uvicorn worker reload. The gate passed 11 model and live HTTP tests, TypeScript, Vite production build and Chrome smoke checks at desktop and mobile widths. Chrome verified backend outage and recovery. Vite flagged the lazy Three.js chunk above 500 kB. Held-out steering and visualization quality were unmeasured.

## Continuation 002 · recovery

Recovered the uncommitted atlas on top of 49b4e48. The named public GitHub repository advertised no refs. Reused Python 3.12.14 and the installed locked frontend tree including Three.js 0.181.2. No physics engine was required. The recovered slice passed 18 model and live HTTP tests. Search, query coefficient inspection, displacement and repeatable latency evidence remain for the review gate.

## Phase 1 review · 27 November 2026

Recovery commit fc61b4f was verified on public main. Added searchable corpus points, full-dimensional inspection, displacement and a reproducible timing command. Added Data Foundry with local transient imports, mapped fields, batch cancellation, fixed-frame PCA, imported retrieval and CSV export. Reused the existing model, dependencies and loopback services. Passed 27 Python tests, TypeScript, Vite and Chrome desktop/mobile coverage. Browser checks covered actual file selection and drop, quality counts, signed steering, partial-batch cancellation, deletion and formula-escaped export. No external HTTP origin appeared during the Foundry smoke. The 10,000,001-byte request returned 413. The source-only publication excludes runtime state. See REVIEW_PHASE_1.md for measurements and limits.

## Phase 2 · semantic intelligence engine

Entry gate verified public main and review-phase-1 at b73c164. Added model-bound concept training, split validation, SVD-projected controls, a measured endpoint governor, synchronized comparison views and bounded projection fidelity diagnostics. Integrated the lab with the imported index. The gate passed 34 Python tests, TypeScript, Vite and Chrome. Fixed a local-worker contention race found during browser testing. Six development cases and effectiveness-matched comparisons are summarized in REVIEW_PHASE_2.md. No second compatible backend in the project environment. No final-test access or model downloads.

## Phase 2 review · 27 November 2026

Engine milestone 5f4ea84 was verified on public main. Added SHA-256 dataset identity, two-dataset session selection, one model-bound mapped index per dataset, a quality report and cancellable batch export of original and steered vectors. Chrome verified cache reuse without another embedding request, mapping restoration, exact export fingerprint and removal. The source-only gate passed 35 Python tests, TypeScript, Vite and desktop/mobile Chrome. The build emitted a chunk-size warning. Phase 3 remains planned.

## Phase 3 protocol freeze

Verified clean HEAD and public review-phase-2 at 295123814d855e6cabd2b8727fa8e709f0d81ec4. Verified the published SciFact archive checksum. Chose independent external relevance labels and a second calibration-only 16D LSA fit. The frozen selection and scoring rules are in docs/EVALUATION.md. No held-out outcomes were inspected before this checkpoint.
