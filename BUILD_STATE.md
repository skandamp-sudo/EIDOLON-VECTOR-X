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

## Phase 3 scientific stop · 27 November 2026, 12:12 IST

The independent process reproduction changed three 16D third-place document IDs on claims 589 and 1107. Stopped at the required scientific gate. Both snapshots, checksums and affected comparisons are recorded in REVIEW_PHASE_3.md. An exact floating-point equality assertion also failed; the discrete document-ID differences independently establish the reproducibility issue. The first run remains intact. No ranking rule or frozen evaluation parameter was changed after scoring. The live frontier, evidence viewer, restricted hosting entry point and local document tools are working-tree changes. The Phase 3 release and hosted verification are pending.

### Recovery v2 protocol freeze

On Intel AVX2, all four CPU encoders ran before evaluation. Three disjoint development abstracts took 94–127 ms each through MiniLM and 2.9–4.5 ms through expanded LSA. Each produced three finite unit embeddings. Both legacy variants abstained once. These timings include first inference and exclude model construction. CPU dependencies are optional. Both SciFact originals and the diagnosis are archived. Evaluation and release status follow separately.

### Recovery v2 measured outcomes

Protocol commit 0f3aa419443fe698e4c084876880a379e8e8f27c preceded scoring. Expanded LSA represented 16/16 questions and 826/839 paragraphs. MiniLM represented 16/16 and 839/839. Both legacy models abstained on every question. Among 15 questions with evidence, unsteered nDCG@3 was .22295 BM25, .14355 expanded LSA and .02044 MiniLM. The independent target-section change was zero for both new models. All measured comparisons and limitations are in REVIEW_PHASE_3.md. Optional CPU wheels totaled 42,829,163 bytes. No raw QASPER text, weights or user imports are staged for publication.

Independent reruns reproduced all four model hashes and all 64 per-family result rows exactly. The initial live 128D fit used a different Accelerate thread setting. The launcher now pins it and the live endpoint checks the selected evidence hash. Through the local proxy, all four models matched their recorded basis, returned three neighbors per variant, and rejected a mismatched identity. Dataset, model/configs and wheels totaled 77,179,260 artifact bytes. Credit telemetry is unavailable.

The release checks exercised 46 Python tests, TypeScript, Vite, Chrome model switching, the live 128D before/after probe, historical evidence export and mobile layout. The hosted-mode build passed with a fixture Railway origin. The read-only hosted service rejected imports and live research probes. The local fallback is http://localhost:5173. Public URLs and account-specific trial capacity are unverified. Phase 3 remains untagged.
