# Frozen Phase 3 protocol

Phase 2 baseline 295123814d855e6cabd2b8727fa8e709f0d81ec4. Freeze this file and the runner in Git before scoring. Report all results. Final scores cannot change the model, sample, thresholds or matching rules.

**Population.** Use Allen AI SciFact's published labeled dev split as VECTOR-X's external holdout. The original authors independently annotated evidence documents. Supporting and refuting evidence both count as binary relevance. This evaluates preservation of evidence retrieval under externally imposed steering. SciFact provides no ground truth for Ocean or Botanical attributes. Claims and annotations are CC BY 4.0. The corpus database is ODC-By 1.0. Distribute identifiers and measurements. [Dataset and license](https://github.com/allenai/scifact/blob/master/LICENSE.md) · [Wadden et al., 2020](https://aclanthology.org/2020.emnlp-main.609/)

**Separation.** Fit on the unchanged 24 calibration documents and Phase 2 concept anchors only. Keep the six development cases separate. Use all connected components formed by shared cited or evidence document IDs across the external dev split. Choose the lowest numeric evidence-labeled claim ID in each component. Remove exact normalized text and near duplicates (word-set Jaccard ≥0.75) against existing fit, validation, development texts and previously selected claims. No filtering on model coverage. Group metadata and this conservative lexical check cannot prove absence of all semantic paraphrases.

**Index and settings.** Index title plus abstract for every SciFact document in ascending numeric ID order. Retain unrepresentable gold IDs in retrieval denominators. Compare independent 8D and 16D calibration-only LSA fits, seed 17, ridge alpha 0.25, Ocean target and Botanical protection. Use +1.5 requested strength for every query, absolute drift ≤0.035 and cosine ≥0.65. Compare identity, centroid, ridge, projected ridge with governor and projected ridge without governor. Match each control to the governed gain using the closest sampled magnitude among 101 uniformly spaced strengths including zero, tolerance 0.01. Report unmatched counts and exclude trivial matches at governed gain ≤0.01.

**Metrics.** Evaluate in-basis target gain, adjacent nondecreasing gain fraction at strengths 0, 0.375, 0.75, 1.125, 1.5, max protected drift, cosine, violations, original top-three overlap, binary Recall@3 and nDCG@3. Abstentions return an empty ranking with zero retrieval credit and null geometric measures. Publish per-query ranks and matched outcomes. Bootstrap query-group means using 1,000 resamples and seed 17. Apply paired resampling for locked-minus-naive retrieval. These are descriptive intervals for this holdout. Report fidelity on up to 128 evenly spaced represented documents, using calibration-fitted PCA, and common-query neighbor agreement by document ID. Measure query encoding and method endpoint-plus-ranking wall time, and process peak resident memory. Hardware timings vary.

**Reproduce.** Download the public archive into the ignored runtime directory. The runner checks SHA-256 before reading named JSONL members in memory. No archive paths are extracted or code executed.

```sh
mkdir -p .runtime
curl -fL --max-filesize 4000000 https://scifact.s3-us-west-2.amazonaws.com/release/latest/data.tar.gz -o .runtime/scifact-data.tar.gz
OPENBLAS_NUM_THREADS=1 OMP_NUM_THREADS=1 .venv/bin/python -m scripts.phase3_evidence
```
