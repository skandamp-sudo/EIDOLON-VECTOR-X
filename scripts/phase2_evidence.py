"""Fixed development cases. Uses no final-test file or user dataset."""
import json
from statistics import mean

import numpy as np

from backend.atlas import Atlas
from backend.concepts import Direction, PRESETS, preset
from backend.intelligence import Comparison, candidate, compare, metrics, ndcg, ranks
from backend.model import Backbone

# Query, signed strength, explicit intended retrieval rubric, relevant zero-based IDs.
CASES = [
    ("forest canopy gathers distant light", 1.5, "measurements taken by a vessel", [6, 9]),
    ("sensor records pressure in the concert hall", 1.5, "deep ocean conditions", [7, 10]),
    ("seed grows in the cold water", 1.5, "ocean surface motion and tides", [8, 9, 11]),
    ("cold current in the night sky", -1.5, "night-sky observation", [1, 5]),
    ("water pressure around the planet", -1.5, "orbit or planetary motion", [1, 2, 3]),
    ("ocean waves reflect the stellar spectrum", -1.5, "stellar light or spectra", [0, 3, 4]),
]
TOLERANCE = .01


def experiment():
    atlas = Atlas(Backbone())
    presets = [preset(atlas, name) for name in PRESETS]
    target, protected = [Direction(**p["direction"]) for p in presets]
    results, matches = [], []
    for text, strength, rubric, relevant in CASES:
        form = Comparison(text=text, target=target, protected=[protected], strength=strength,
                          max_drift=.035, min_cosine=.65, relevant=relevant)
        variants = compare(atlas, form)["variants"]
        row = {"text": text, "intent": rubric, "relevant_ids": relevant, "modes": {}}
        for mode, v in variants.items():
            row["modes"][mode] = {"gain": float(np.sign(strength) * v["target_delta"]), "drift": v["drift"],
                                  "violation": int(not v["satisfied"]), "ndcg": v["ndcg"], "applied": v["applied"]}
        results.append(row)
        x = np.array(atlas.model.encode(text))
        wanted = row["modes"]["locked"]["gain"]
        if wanted <= TOLERANCE:
            continue
        for method, direction in [("naive", target.centroid), ("learned", target.linear)]:
            options = []
            for a in np.linspace(0, strength, 101)[1:]:
                y = candidate(x, np.array(direction), a)
                if y is None:
                    continue
                gain = float(np.sign(strength) * (target.linear @ (y - x)))
                options.append((abs(gain - wanted), float(a), gain, y))
            if not options:
                continue
            gap, a, gain, y = min(options, key=lambda m: m[0])
            if gap <= TOLERANCE:
                drift, cosine = metrics(x, y, np.array([protected.linear]))
                matches.append({"query": text, "control": method, "strength": a, "gain_gap": gap,
                                "control_gain": gain, "locked_gain": wanted, "control_drift": drift,
                                "locked_drift": variants["locked"]["drift"], "control_ndcg": ndcg(ranks(atlas.vectors, y)[1][:3], set(relevant)),
                                "locked_ndcg": variants["locked"]["ndcg"], "control_violates": drift > .035 or cosine < .65})
    summary = {mode: {key: mean(r["modes"][mode][key] for r in results) for key in ("gain", "drift", "violation", "ndcg")}
               for mode in results[0]["modes"]}
    return {"fixture": "authored development v1", "max_drift": .035, "min_cosine": .65, "match_tolerance": TOLERANCE,
            "summary": summary, "cases": results, "matched": matches, "validation": [p["validation"] for p in presets]}


if __name__ == "__main__":
    print(json.dumps(experiment(), indent=2))
