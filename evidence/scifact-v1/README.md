# Frozen SciFact evidence
Both byte-for-byte original records, the independent alignment replay and the coverage audit refer to commit `8080490377411e7b51b44861d5d3b16d7a6a16c6`. Compare the stored ranks of claims 589 and 1107. The three 16D rank-three swaps reproduced with a margin of zero or one binary64 ULP. The original files omitted raw cosines. Aggregate Recall@3 and nDCG@3 agree exactly. Only 16/164 claims had vocabulary overlap. This experiment established no evidence retrieval benefit from steering.

From the project root, with the verified SciFact archive installed as in docs/EVALUATION.md, use new output names for each replay. The alignment control calls the frozen evaluator and observes the returned scores. The coverage script reads the first run from .runtime/phase3-stop/first.json (copy the archived first.json there on a fresh checkout).

```sh
(cd evidence/scifact-v1 && shasum -a 256 -c SHA256SUMS)
VECLIB_MAXIMUM_THREADS=1 OMP_NUM_THREADS=1 OPENBLAS_NUM_THREADS=1 PYTHONPATH=. .venv/bin/python evidence/scifact-v1/norm_control.py /tmp/vector-x-alignment-new.json
PYTHONPATH=. .venv/bin/python evidence/scifact-v1/coverage.py /tmp/vector-x-coverage-new.json
```
