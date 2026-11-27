import { SlidersHorizontal, Dna, Orbit, ShieldCheck, GitCompareArrows, FlaskConical } from 'lucide-react'

export const modules = [
  { name: 'Vector Forge', icon: SlidersHorizontal, brief: 'Train a controlled steering transform.', detail: 'Fit a low-rank update on paired examples. The signed control sets its strength and zero preserves the baseline exactly.' },
  { name: 'Concept DNA', icon: Dna, brief: 'Learn directions from concept pairs.', detail: 'Estimate oriented directions from matched training anchors. Record pair provenance and direction stability across seeds.' },
  { name: 'Semantic Universe', icon: Orbit, brief: 'Explore embedding neighborhoods in 3D.', detail: 'Fit a shared projection on training vectors. Measure neighborhood fidelity in the same coordinate frame before and after steering.' },
  { name: 'Drift Guardian', icon: ShieldCheck, brief: 'Measure and constrain semantic drift.', detail: 'Constrain movement on neutral anchors and measure retrieval retention. Select drift limits on validation examples before final evaluation.' },
  { name: 'Counterfactual Engine', icon: GitCompareArrows, brief: 'Compare retrieval under steering.', detail: 'Rank the same fixed index for the original and steered query. Expose rank changes and signed score differences with stable tie breaking.' },
  { name: 'Research Lab', icon: FlaskConical, brief: 'Reproduce baselines and evaluation runs.', detail: 'Record split hashes, seeds, settings and package versions. Compare paired outcomes for identity, fixed-direction and learned baselines.' },
]
export const protocol = [
  ['Split before fitting', 'Group paraphrases and source families. Freeze separate train, validation and test manifests. The startup samples are calibration probes only.'],
  ['Compare on equal terms', 'Evaluate identity, mean-difference steering and the learned transform against the same query set, candidate index and strength grid.'],
  ['Measure four outcomes', 'Report signed concept response, neutral retrieval retention, neighborhood overlap and projection trustworthiness. Show per-concept results and uncertainty.'],
  ['Preserve the evidence', 'Record corpus and model hashes, seeds, dependency lockfiles and hardware. Freeze thresholds on validation data before final evaluation.'],
]
