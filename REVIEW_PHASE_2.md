# Phase 2 review

Open [Intelligence](http://localhost:5173/#intelligence). Inspect Ocean affinity while protecting Botanical affinity. Change the drift limit and orbit a comparison view. Protect Ocean itself to see the incompatible objective return zero. Open Concept DNA, edit source-grouped examples, train and save a direction. In Data Foundry, generate an index and open dataset intelligence to train or steer using imported records.

| Method | Mean signed target gain | Mean protected drift | Violations | Mean nDCG@3 |
| --- | ---: | ---: | ---: | ---: |
| Original | 0 | 0 | 0/6 | 0.245 |
| Naive centroid | 0.804 | 0.1202 | 6/6 | 0.665 |
| Learned ridge | 0.813 | 0.1250 | 6/6 | 0.653 |
| Semantic Lock | 0.549 | 0.0242 | 0/6 | 0.475 |

Six authored development queries used explicit relevance sets, strengths ±1.5, drift ≤0.035 and cosine ≥0.65. Matching each locked gain within 0.01 gave six comparisons per control. All methods averaged 0.475 nDCG@3. Matched centroid drift averaged 0.0206 with two violations. Matched ridge drift averaged 0.0248 with one violation. The locked seed/water query retrieved no labeled result in its top three.

Both concept fixtures classified four validation examples correctly after fitting six. At k=3, calibration projection trustworthiness was 0.855, neighbor overlap 0.667 and distance rank correlation 0.440. These small fixtures measure proxy behavior. Source-family assignment requires human review. The final test set was untouched.

```sh
./scripts/start
OPENBLAS_NUM_THREADS=1 OMP_NUM_THREADS=1 .venv/bin/python -m scripts.phase2_evidence
./scripts/verify
```

The evidence command prints per-query outcomes, labels, matched strengths and confusion counts. A second compatible encoder was unavailable in the project environment.

The final gate passed 35 Python tests, TypeScript, Vite and desktop/mobile Chrome checks. Vite reported a chunk over 500 kB.
