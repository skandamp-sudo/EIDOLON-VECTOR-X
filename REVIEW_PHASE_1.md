# Phase 1 review

Start with `./scripts/start` and open [the local atlas](http://localhost:5173). With the default telescope query, select Ocean at +1.20. Inspect the X-Ray, search for “orchestra”, rotate the cloud and select Zero. Zero restores both the original vector and ranking.

| Default query · Ocean +1.20 | Measured |
| --- | --- |
| Model / corpus | CPU TF–IDF / truncated SVD, eight dimensions, 24 authored records |
| Original-to-steered cosine / L2 displacement | 0.504372 / 0.995618 |
| Top three before · one-based point and cosine | 1 (0.999849), 6 (0.647720), 4 (0.620976) |
| Top three after | 7 (0.735480), 10 (0.604476), 8 (0.593333) |
| Three-component PCA variance | 50.5080% |
| Median encode / normalized 25-step steering path | 1.3521 ms / 0.0444 ms |

Reproduce on this Intel Mac with ten warmups and 100 in-process measurements per operation. Timings exclude network, fitting and rendering.

```sh
OPENBLAS_NUM_THREADS=1 OMP_NUM_THREADS=1 .venv/bin/python -m scripts.phase1_evidence
./scripts/verify
```

In **Data Foundry**, drop a CSV with a text field such as “ocean current” or “forest roots”. Map text and metadata. Generate embeddings, select a row, adjust strength, compare retrieval, export and delete. The Chrome fixture exercised seven rows, including one duplicate and one missing text. Five rows reached inference and four produced vectors.

The gate passed 27 tests, TypeScript, Vite and Chrome at 1400 and 390 pixels. Vite warned about a chunk exceeding 500 kB. A separate 5,000-row synthetic CPU check encoded all rows in 144.53 ms across 79 batches, excluding HTTP and rendering. These are engineering fixtures. Held-out quality is unmeasured.
