"""Local ASCENSION gate. Run with the verified models installed and single-thread BLAS."""
import hashlib
import json
import math
import subprocess
import sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))


def digest(data):
    return hashlib.sha256(data).hexdigest()


def canonical(report):
    return json.dumps(report, sort_keys=True, separators=(",", ":"), allow_nan=False).encode()


def decision_view(report):
    """Exclude continuous geometry only. Keep violations, orders, metrics and release decisions."""
    record = json.loads(canonical(report))
    record.pop("reduction_policy", None)
    for task in record["tasks"]:
        for method in task["methods"].values():
            if method["geometry"]:
                method["geometry"] = {"violated": method["geometry"]["violated"]}
    return record


def check_archive():
    scifact = ROOT / "evidence/scifact-v1"
    for line in (scifact / "SHA256SUMS").read_text().splitlines():
        expected, filename = line.split()
        assert digest((scifact / filename).read_bytes()) == expected, filename
    manifest = json.loads((ROOT / "evidence/recovery-v2/reproduction.json").read_text())
    for name, entry in manifest["models"].items():
        for tag, directory in (("first", "frontend/public/evidence/recovery-v2"), ("repeat", ".runtime/recovery-v2/repeat")):
            assert digest((ROOT / directory / (name + ".json")).read_bytes()) == entry[tag + "_file_sha256"], name


def verify_reports():
    from backend.debug_api import Experiment, basis, run_experiment

    archive = ROOT / "docs/ascension/replay-stop"
    originals = json.loads((archive / "runs.json").read_text())["runs"]
    assert len(originals) == 16
    assert digest((ROOT / "tests/test_ascension.py").read_bytes()) == "6ea49159950d859d47bec2f762b6a97f556b05db8471e1a806429003d20b1432"
    reference = json.loads((ROOT / "docs/ascension/exploratory.json").read_text())
    hashes = {}
    for name, fixture in reference.items():
        old = fixture["report"]
        form = Experiment.model_validate(old["replay"])
        assert decision_view(old) == decision_view(run_experiment(form)), name
        for strength in (-1, 0, 1):
            form = Experiment(encoder=name, model_id=basis(name)[0].identity,
                              target="Ocean affinity", protection="Botanical affinity",
                              tasks=[{"query": "telescope light", "relevant": [6]}],
                              settings={"candidate": "spherical", "strength": strength})
            count = 100 if (name, strength) == ("legacy16", -1) else 3
            seen = Counter()
            for _ in range(count):
                report = run_experiment(form)
                seen[digest(canonical(report))] += 1
                form = Experiment.model_validate(report["replay"])
            assert len(seen) == 1, (name, strength, seen)
            hashes[f"{name}/{strength}"] = dict(seen)
            if (name, strength) == ("legacy16", -1):
                for original in originals:
                    raw = (archive / (original["sha256"] + ".json")).read_bytes()
                    assert digest(raw) == original["sha256"]
                    assert decision_view(json.loads(raw)) == decision_view(report)
        # Exercise the actual release gate immediately across its measured drift boundary.
        original = Experiment.model_validate(old["replay"])
        cfg = original.settings.model_copy(update={"candidate":"unconstrained", "strength":1.,
                    "max_drift":2., "min_cosine":-1., "block_regressions":False})
        single = original.model_copy(update={"tasks":original.tasks[:1], "settings":cfg})
        result = run_experiment(single)
        drift = result["tasks"][0]["methods"]["unconstrained"]["geometry"]["drift"]
        limit = drift - result["geometry_tolerance"]
        assert limit > 0
        for step, expected in ((math.inf, "PASS"), (-math.inf, "BLOCK")):
            cfg = cfg.model_copy(update={"max_drift":math.nextafter(limit,step)})
            assert run_experiment(single.model_copy(update={"settings":cfg}))["gate"] == expected
    return hashes


if __name__ == "__main__":
    if "--worker" in sys.argv:
        print(json.dumps(verify_reports(), sort_keys=True))
    else:
        check_archive()
        outputs = [subprocess.check_output([sys.executable, __file__, "--worker"]) for _ in range(3)]
        assert len(set(outputs)) == 1, "Fresh processes disagree"
        print(json.dumps({"processes":3, "archived_files":13, "runs_per_process":json.loads(outputs[0])}, indent=2))
