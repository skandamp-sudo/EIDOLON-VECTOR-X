import { SlidersHorizontal, Dna, Orbit, ShieldCheck, GitCompareArrows, FlaskConical } from 'lucide-react'

export const modules = [
  { status: 'Implemented · linear baseline', name: 'Vector Forge', icon: SlidersHorizontal, brief: 'Compare learned and protected steering.', detail: 'Intelligence compares class-balanced ridge and centroid directions. Signed strength controls their effect, and zero preserves the query.' },
  { status: 'Implemented · baseline', name: 'Concept DNA', icon: Dna, brief: 'Inspect example-derived directions.', detail: 'The atlas provides four normalized topic-minus-rest centroid directions. Intelligence fits custom regularized readouts and reports validation confusion counts.' },
  { status: 'Implemented', name: 'Semantic Universe', icon: Orbit, brief: 'Explore embedding neighborhoods in 3D.', detail: 'The atlas renders the corpus and query trajectory in one training-fitted PCA frame. Held-out neighborhood fidelity is scheduled for Phase 3.' },
  { status: 'Implemented · proxy constraints', name: 'Drift Guardian', icon: ShieldCheck, brief: 'Measure and constrain semantic drift.', detail: 'Semantic Lock measures protected score drift and query cosine after normalization. Its governor reports reductions and neighborhood changes.' },
  { status: 'Implemented · baseline', name: 'Counterfactual Engine', icon: GitCompareArrows, brief: 'Compare retrieval under steering.', detail: 'Rank the same fixed index for the original and steered query. Compare both top-three lists and inspect both cosine scores for any point.' },
  { status: 'Planned', name: 'Research Lab', icon: FlaskConical, brief: 'Reproduce baselines and evaluation runs.', detail: 'Record split hashes, seeds, settings and package versions. Compare paired outcomes for identity, fixed-direction and learned baselines.' },
]
export const protocol = [
  ['Split before fitting', 'Group paraphrases and source families. Freeze separate train, validation and test manifests. The startup samples are calibration probes only.'],
  ['Compare on equal terms', 'Evaluate identity, mean-difference steering and the learned transform against the same query set, candidate index and strength grid.'],
  ['Measure four outcomes', 'Report signed concept response, neutral retrieval retention, neighborhood overlap and projection trustworthiness. Show per-concept results and uncertainty.'],
  ['Preserve the evidence', 'Record corpus and model hashes, seeds, dependency lockfiles and hardware. Freeze thresholds on validation data before final evaluation.'],
]
