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

## Recovery addendum

Continuation 005 confirmed the floating-point mechanism suspected above. Both original evidence files and exact replay scores are archived under evidence/scifact-v1. Continuation 006 registered the separate QASPER protocol and implementation in 0f3aa419443fe698e4c084876880a379e8e8f27c before examining its evaluation outputs. The Phase 3 historical stop and tags are preserved.

### Registered recovery results

All 16 paper families are reported. Fifteen had gold evidence for retrieval. Across 839 paragraphs there were three target-section paragraphs, one in each of three families. Unsteered and governed top-three results contained none of these paragraphs for either expanded LSA or MiniLM. The small evaluation provides no evidence of improved retrieval of the target section type.

| Encoder / baseline | Queries represented | Paragraphs indexed | Unsteered Recall@3 | Unsteered nDCG@3 | Governed Recall@3 | Governed nDCG@3 |
|---|---:|---:|---:|---:|---:|---:|
| Lexical BM25 | — | 839 | .25556 | .22295 | — | — |
| Legacy 8D / 16D (each) | 0/16 | 201 | 0 | 0 | 0 | 0 |
| Expanded LSA | 16/16 | 826 | .15556 | .14355 | .23333 | .18813 |
| Quantized MiniLM | 16/16 | 839 | .03333 | .02044 | .07778 | .05582 |

All 16 represented queries per new encoder matched. At matched target gain, mean protected-axis drift (unconstrained → governed) was .33340 → .02267 for LSA and .30323 → .01977 for MiniLM. Independent absolute change in retrieved results-section fraction increased from .04167 → .06250 and .12500 → .18750 respectively. Semantic Lock met its geometric constraints on all 32 represented endpoints. The independent attribute evidence limits the interpretation of that result. The experiment did not establish a general steering or neural retrieval advantage.
