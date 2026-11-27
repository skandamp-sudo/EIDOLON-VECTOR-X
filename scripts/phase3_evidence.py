"""External holdout evaluation. Read only pinned public data, emit IDs and measurements."""
from hashlib import sha256
from itertools import combinations
import json
from pathlib import Path
import platform
import resource
import subprocess
import sys
import tarfile
from time import perf_counter_ns

import numpy as np

from backend.atlas import Atlas
from backend.concepts import PRESETS, key, model_id, preset
from backend.fidelity import fidelity
from backend.intelligence import candidate, govern, metrics, ndcg, ranks
from backend.model import Backbone, PROBES
from scripts.phase2_evidence import CASES

ARCHIVE = Path(".runtime/scifact-data.tar.gz")
DIGEST = "11c621288d41ac144d29b13b0f8503b3820b7d6e8b1f6ff24dff335c196d76be"
METHODS = ("original", "naive", "ridge", "locked", "ungoverned")
LIMITS = (.035, .65)
STRENGTH = 1.5
FREEZE_FILES = ["docs/EVALUATION.md", "scripts/phase3_evidence.py", "backend/atlas.py", "backend/model.py",
                "backend/concepts.py", "backend/intelligence.py", "backend/fidelity.py",
                "scripts/phase2_evidence.py", "backend/data/calibration.txt", "uv.lock"]
OUTPUT = Path("frontend/public/evidence/phase3.json")


def source():
    if ARCHIVE.stat().st_size > 4_000_000 or sha256(ARCHIVE.read_bytes()).hexdigest() != DIGEST:
        raise ValueError("External dataset checksum mismatch")
    rows, hashes = {}, {}
    with tarfile.open(ARCHIVE, "r:gz") as archive:
        for name in ("corpus", "claims_dev"):
            member = archive.getmember("data/" + name + ".jsonl")
            if not member.isfile() or member.size > 20_000_000:
                raise ValueError("Unexpected dataset member")
            raw = archive.extractfile(member).read()
            hashes[name] = sha256(raw).hexdigest()
            rows[name] = [json.loads(line) for line in raw.splitlines()]
    return rows["corpus"], rows["claims_dev"], hashes


def select_groups(claims, existing):
    parents = {}
    def root(node):
        while parents.setdefault(node, node) != node:
            parents[node] = parents[parents[node]]
            node = parents[node]
        return node
    groups = {}
    for claim in claims:
        ids = sorted(set(claim["cited_doc_ids"]) | {int(i) for i in claim["evidence"]})
        if not ids:
            continue
        for doc in ids[1:]:
            parents[root(doc)] = root(ids[0])
        groups[claim["id"]] = ids[0]
    chosen = {}
    for c in sorted(claims, key=lambda c: c["id"]):
        if c["evidence"]:
            chosen.setdefault(root(groups[c["id"]]), c)
    seen = [set(key(s).split()) for s in existing]
    selected = []
    for c in sorted(chosen.values(), key=lambda c: c["id"]):
        tokens = set(key(c["claim"]).split())
        if any(len(tokens & t) >= .75 * len(tokens | t) for t in seen):
            continue
        seen.append(tokens)
        selected.append(c)
    return selected, len(chosen)


def summary(values):
    values = np.array([v for v in values if v is not None], dtype=float)
    if not len(values):
        return {"n": 0, "mean": None, "ci95": None}
    rng = np.random.default_rng(17)
    means = rng.choice(values, (1000, len(values)), replace=True).mean(axis=1)
    return {"n": len(values), "mean": float(values.mean()), "ci95": np.quantile(means, [.025,.975]).tolist()}


def evaluate(dim, corpus, claims):
    atlas = Atlas(Backbone(dim))
    directions = [preset(atlas, name)["direction"] for name in PRESETS]
    target, naive = [np.array(directions[0][k]) for k in ("linear","centroid")]
    protected = np.array([directions[1]["linear"]])
    ids, blocks = [], []
    for offset in range(0, len(corpus), 64):
        batch = corpus[offset:offset+64]
        texts = [" ".join([d["title"], *d["abstract"]]) for d in batch]
        batch_v = atlas.model.svd.transform(atlas.model.vectorizer.transform(texts))
        norm = np.linalg.norm(batch_v, axis=1)
        ok = norm >= 1e-12
        blocks.append(batch_v[ok] / norm[ok,None])
        ids.extend(d["doc_id"] for d, good in zip(batch, ok) if good)
    vectors = np.vstack(blocks)
    results = []
    for c in claims:
        relevant = {int(i) for i in c["evidence"]}
        row = {"id": c["id"], "sources": c["cited_doc_ids"], "gold": sorted(relevant), "methods": {}, "matched": {}}
        start = perf_counter_ns()
        try:
            x = np.array(atlas.model.encode(c["claim"]))
        except ValueError as error:
            if str(error) != "No representable signal":
                raise
            x = None
        row["encode_ms"] = (perf_counter_ns()-start)/1e6
        row["represented"] = x is not None
        if x is None:
            for method in METHODS:
                row["methods"][method] = dict(top=[], recall=0., ndcg=0., gain=None, drift=None, cosine=None,
                                              violation=None, stability=None, monotonicity=None, latency_ms=None, applied=None)
            results.append(row)
            continue
        original_top = {ids[i] for i in ranks(vectors,x)[1][:3]}
        safe, _, _ = govern(x,target,protected,0,*LIMITS)
        axes = dict(original=target, naive=naive, ridge=target, locked=safe, ungoverned=safe)
        def endpoint(method, strength):
            applied = strength
            if method == "original":
                applied = 0.
            elif method == "locked":
                _, applied, _ = govern(x,target,protected,strength,*LIMITS)
            y = candidate(x,axes[method],applied)
            return (x,0.) if y is None else (y,float(applied))
        def outcome(y):
            top = [ids[i] for i in ranks(vectors,y)[1][:3]]
            drift, cosine = metrics(x,y,protected)
            return dict(top=top, recall=len(relevant.intersection(top))/len(relevant), ndcg=ndcg(top,relevant),
                        gain=float(target @ (y-x)), drift=drift, cosine=cosine,
                        violation=int(drift>LIMITS[0] or cosine<LIMITS[1]), stability=len(original_top.intersection(top))/3)
        for method in METHODS:
            start = perf_counter_ns()
            y, a = endpoint(method, STRENGTH)
            item = outcome(y)
            item["latency_ms"] = (perf_counter_ns()-start)/1e6
            gains = [target @ (endpoint(method,s)[0]-x) for s in np.linspace(0,STRENGTH,5)]
            item.update(applied=a, monotonicity=float(np.mean(np.diff(gains)>=-1e-12)))
            row["methods"][method] = item
        wanted = row["methods"]["locked"]["gain"]
        if wanted > .01:
            for method in ("original","naive","ridge","ungoverned"):
                best = None
                for a in np.linspace(0,STRENGTH,101):
                    y, used = endpoint(method,a)
                    gap = abs(float(target @ (y-x))-wanted)
                    if best is None or gap < best[0]:
                        best = gap,used,y
                if best[0] <= .01:
                    row["matched"][method] = dict(gap=best[0], applied=best[1], **outcome(best[2]))
        results.append(row)
    summaries = {}
    for method in METHODS:
        items = [r["methods"][method] for r in results]
        summaries[method] = {k:summary(i[k] for i in items) for k in
            ("gain","drift","cosine","violation","ndcg","recall","stability","monotonicity","latency_ms")}
    matched = {}
    for method in ("original","naive","ridge","ungoverned"):
        subset = [r for r in results if method in r["matched"]]
        matched[method] = {"n":len(subset), "unmatched":len(results)-len(subset),
            "control":{k:summary(r["matched"][method][k] for r in subset) for k in ("gain","drift","violation","recall","ndcg")},
            "locked":{k:summary(r["methods"]["locked"][k] for r in subset) for k in ("gain","drift","violation","recall","ndcg")}}
    return {"dimensions":dim,"model_id":model_id(atlas),"corpus_count":len(corpus),"indexed":len(ids),
            "query_count":len(results),"represented":sum(r["represented"] for r in results),
            "encoding_ms":summary(r["encode_ms"] for r in results),"methods":summaries,"matched":matched,
            "fidelity":fidelity(vectors,atlas.pca.transform(vectors),atlas.pca.explained_variance_ratio_.sum()),
            "paired_ndcg_delta":summary(r["methods"]["locked"]["ndcg"]-r["methods"]["naive"]["ndcg"] for r in results),
            "queries":results}


def main():
    if subprocess.run(["git","diff","--quiet","HEAD","--",*FREEZE_FILES]).returncode:
        raise SystemExit("Commit the frozen protocol and runner before evaluation.")
    for f in FREEZE_FILES:
        subprocess.run(["git","ls-files","--error-unmatch",f], check=True, stdout=subprocess.DEVNULL)
    corpus, claims, hashes = source()
    existing = list(Backbone().documents) + list(PROBES.values()) + [row[0] for row in CASES]
    existing.extend(t for groups in PRESETS.values() for group in groups for t in group)
    selected, groups = select_groups(claims,existing)
    corpus.sort(key=lambda d:d["doc_id"])
    models = [evaluate(d,corpus,selected) for d in (8,16)]
    common = [(a,b) for a,b in zip(*(m["queries"] for m in models)) if a["represented"] and b["represented"]]
    agreement = {m:summary(len(set(a["methods"][m]["top"]) & set(b["methods"][m]["top"]))/3 for a,b in common) for m in METHODS}
    record = {"dataset":"Allen AI SciFact · published dev, external VECTOR-X holdout","archive_sha256":DIGEST,
              "member_hashes":hashes,"source_commit":subprocess.check_output(["git","log","-1","--format=%H","--",*FREEZE_FILES],text=True).strip(),
              "protocol_sha256":sha256(Path(FREEZE_FILES[0]).read_bytes()).hexdigest(),"seed":17,
              "config":{"strength":STRENGTH,"max_drift":LIMITS[0],"min_cosine":LIMITS[1],"k":3,"match_tolerance":.01},
              "split":{"encoder_fit":24,"concept_fit_each":6,"concept_validation_each":4,"development":6,
                       "external_raw":len(claims),"evidence_groups":groups,"external_selected":len(selected)},
              "host":platform.system()+" "+platform.machine(),"models":models,"agreement":agreement,
              "peak_rss_mib":resource.getrusage(resource.RUSAGE_SELF).ru_maxrss/(1024**2 if sys.platform=="darwin" else 1024)}
    OUTPUT.parent.mkdir(parents=True,exist_ok=True)
    temp = OUTPUT.with_suffix(".tmp")
    temp.write_text(json.dumps(record,allow_nan=False,separators=(",",":"))+"\n")
    temp.replace(OUTPUT)
    print(record["split"], [(m["dimensions"],m["represented"],m["indexed"]) for m in models])


if __name__ == "__main__":
    main()
