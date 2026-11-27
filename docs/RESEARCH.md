# Research design

## Implemented baseline

Word-level TF–IDF with English stop-word removal and sublinear term frequency feeds seeded randomized truncated SVD. L2 normalization produces eight-dimensional vectors. The 24 authored English calibration sentences cover astronomy, oceans, acoustics and botany. They provide a small reproducible CPU baseline with limited vocabulary. Unknown-only input has no representation. Three separately worded calibration probes exercise inference. These probes share subject matter and wording with training and cannot establish generalization.

The startup glyph encodes one vector in eight angular sectors with linearly interpolated tube radii. Fixed orientation, twist and color are rendering choices. Semantic-space fidelity requires a cross-document evaluation in a later mission. [Scikit-learn LSA reference](https://scikit-learn.org/stable/modules/generated/sklearn.decomposition.TruncatedSVD.html)

## Planned learning and preservation

For each concept, estimate an oriented mean difference between matched positive and negative training anchors. Train a rank-four residual map for a frozen unit embedding x. For signed strength a in [-1,1], use y = normalize(x + a(d + UVᵀx)). Return x exactly at zero and reject a degenerate norm. Learn d, U and V on training pairs. Combine a directional paired ranking loss with an angular drift penalty on neutral queries, a penalty on changes to neutral pairwise cosine similarities, and weight decay. Limit residual norm. Tune regularization and strength bounds using validation only. A freeze of the corpus vocabulary and basis precedes any comparisons.

## Proposed evaluation protocol

1. Group source documents, concepts' paired variants and paraphrase families before assigning train, validation and final test manifests. Preserve conceptual coverage across splits and audit normalized-text duplicates. Fit text preprocessing, concept directions and PCA only on train. Fit an independent attribute readout on disjoint, labeled training anchors. Orient its scores before evaluation.
2. Compare identity, the fixed training mean difference and the learned transformation at strengths -1, -0.5, 0, 0.5 and 1. Use the same base embeddings, candidate index, queries, deterministic ID tie breaks and exclusion of self-matches. Include a seeded random-direction control.
3. For controllability, report per-concept signed readout change and Spearman correlation against strength, plus target retrieval changes. Record constant-response cases separately. For preservation report neutral nDCG@10 with relevance labels, paired change from identity, top-10 neighbor overlap and cosine drift. Report out-of-vocabulary and rejected counts.
4. Use one training-fitted PCA frame for original and steered points. Compare cosine k-neighbors in source space against Euclidean neighbors in 3D using overlap@k and trustworthiness with k smaller than half the evaluation population. Publish k, distance choices, sample counts and per-concept breakdowns.
5. Pre-register minimum steering effect and acceptable neutral degradation on validation, freeze settings and record split hashes before opening final test. Report paired bootstrap 95% intervals resampled by source family, seeds, versions, corpus hashes, model settings, wall time and raw counts. Null marks unmeasured outcomes. A reproducible scientific defect halts the gated run for review.

## Deployment boundary

A future Vercel static build can use `frontend/dist`. A future Railway ASGI service will need a production server command, explicit trusted hosts, dependency setup, health checks and a same-origin API rewrite. Local development enables reload and loopback binding. Remote deployment is outside Mission 001.
