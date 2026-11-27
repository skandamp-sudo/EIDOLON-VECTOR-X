"""Registered ascension-fixture-v1. Run from the root with single-thread BLAS."""
from pathlib import Path
import json
import sys
from time import perf_counter
import numpy as np

sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from backend.debug_api import basis, Experiment, run_experiment
from backend.recovery_models import MODELS, encode
from backend.sphere import rotate


def evaluate():
    results = {}
    tasks = [{"query":q,"relevant":[i]} for q,i in
             [("telescope light",6),("ocean waves",9),("xylolith",24)]]
    for name in MODELS:
        model, _, _, axes = basis(name)
        form = Experiment(encoder=name,model_id=model.identity,target="Ocean affinity",
                          protection="Botanical affinity",tasks=tasks,settings={"candidate":"spherical"})
        start = perf_counter()
        report = run_experiment(form)
        milliseconds = (perf_counter()-start)*1000
        target, protected = axes[form.target], np.array([axes[form.protection]])
        matched = []
        for t in report["tasks"]:
            x = encode(model,t["query"])
            geometry = t["methods"]["locked"]["geometry"]
            if x is None or geometry is None or geometry["signed_gain"]<=1e-12:
                matched.append(None)
                continue
            wanted = geometry["signed_gain"]
            best = None
            for strength in np.linspace(0,2,101):
                y,angle,_ = rotate(x.values,target,protected,strength,.8)
                gain = float(target@(y-x.values))
                gap = abs(gain-wanted)
                if best is None or gap<best["gap"]:
                    best=dict(gap=gap,angle=angle,gain=gain,locked_gain=wanted,
                              locked_drift=geometry["drift"],sphere_drift=float(abs(protected@(y-x.values)).max()))
            matched.append(best if best["gap"]<=.01 else None)
        results[name]=dict(warm_suite_ms=milliseconds,matched=matched,report=report)
    return results


if __name__=="__main__":
    print(json.dumps(evaluate(),indent=2,allow_nan=False))
