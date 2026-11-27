# Phase 3 scientific stop · 27 November 2026

**Status: blocked at reproducibility review.** Two fresh Python processes on the same Intel Mac used frozen source 8080490377411e7b51b44861d5d3b16d7a6a16c6, the same SciFact archive, seed and single-thread environment. Three 16D top-three lists disagree in their third document. The frozen runner and original evidence have been preserved.

| Claim | Comparison | First third-place ID | Reproduction ID |
| --- | --- | ---: | ---: |
| 589 | Matched-gain centroid | 2359152 | 13732033 |
| 1107 | Equal-strength ridge | 13732033 | 2359152 |
| 1107 | Matched-gain ridge | 2359152 | 13732033 |

The two exchanged IDs carry no positive relevance judgment for either claim. Aggregate retrieval metrics and all 8D ranked IDs matched. The largest non-timing floating metric difference was 3.34×10⁻¹⁶ or less. A numerical near-tie is a hypothesis. The underlying cause is unverified.

**Provisional findings.** Of 164 source-separated claims, 16 produced vectors. Both configurations indexed 3,534 of 5,183 abstracts. Original Recall@3 was 0.00610 and nDCG@3 was 0.00305. Every steered method scored zero on both metrics. Eight-dimensional Lock violated zero of 16 endpoint limits. Naive, learned and ungoverned steering each violated ten.

**Preserved local records** under `.runtime/phase3-stop/`:

| File | SHA-256 |
| --- | --- |
| first.json | 0bec8f1aad44be2520b470541d01c96510abf3ae62cbb8a365649606abef3310 |
| reproduction.json | 7d6331ec742537df52e701173ac3d020092e632f7111984f39449c0db7dbda69 |

The preceding engineering checkpoint passed 41 Python tests, TypeScript, Vite and Chrome. The latest document-exploration changes passed TypeScript only. Hosted deployment and the Phase 3 tag remain pending. Diagnosis and any revised tie policy require authorization and a separately versioned protocol. [Frozen protocol](docs/EVALUATION.md)
