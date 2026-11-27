# Retrieval debugging protocol v1

This engineering protocol starts at OBSIDIAN production commit `3356e97e0db83a5f2f689c4b04c48995dc374ee8`. It uses the built-in calibration documents and operator-labeled local records. Labels entered after viewing a ranking are exploratory. The protocol supplies no independent validation dataset.

Use one-based source row IDs, binary relevance judgments and the same corpus, queries, K and labels for all methods. Keep all labeled queries in the denominator, including empty rankings. BM25 uses positive term matches, k1=1.2 and b=0.75. Reciprocal rank fusion sums 1/(60+rank) over full positive-match BM25 and represented dense rankings. A missing branch contributes nothing. The dense, unconstrained and locked variants use the same frozen 8D basis. Break lexical and fusion ties by ascending row ID. Dense ties follow the registered q40 ranking policy.

Record per-query Recall@K, nDCG@K, rank movement, missed positives, abstention and endpoint geometry where available. A release rule applies to each labeled task individually. When a required measurement is unavailable, the gate blocks. A passing operator-defined rule makes no claim about unseen queries, human meaning or customer demand.

Engineering fixtures exercise exact matches, out-of-vocabulary queries, incomplete indexes, conflicting directions, retrieval regressions, gate failures and report replay. Keep settings fixed for these checks. Independent scientific work requires a separate preregistration and unseen family-separated data. The frozen SciFact and QASPER protocols and records are outside this workflow.
