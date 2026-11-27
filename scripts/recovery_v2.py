"""Evaluate the separately frozen paper-local retrieval protocol. Output is exclusive."""
import argparse
from collections import Counter
from hashlib import sha256
import json
import math
from pathlib import Path
import platform
import re
import resource
import time

import numpy as np

from backend.fidelity import fidelity
from backend.ranking_v2 import Index, POLICY
from backend.recovery_data import DIGEST, ROOT, doc_id, papers, paragraphs
from backend.recovery_models import MODELS, encode, encoder
from backend.recovery_steering import workspace


def retrieval(top,gold):
    if not gold:
        return dict(recall=None,ndcg=None)
    discounts=[1/math.log2(i+2) for i in range(3)]
    return dict(recall=len(set(top)&gold)/len(gold),
                ndcg=sum(d for d,i in zip(discounts,top) if i in gold)/sum(discounts[:min(3,len(gold))]))


def bm25(rows,query):
    terms=lambda text: re.findall(r"\w+",text.lower())
    docs={k:Counter(terms(v[0])) for k,v in rows.items()}
    if not docs:
        return []
    avg=sum(c.total() for c in docs.values())/len(docs) or 1
    query=Counter(terms(query))
    weights={t:math.log1p((len(docs)-df+.5)/(df+.5)) for t in query for df in [sum(t in c for c in docs.values())]}
    def key(i):
        c=docs[i]
        norm=1.2*(.25+.75*c.total()/avg)
        return -sum(weights[t]*n*c[t]*2.2/(c[t]+norm) for t,n in query.items()),i
    return sorted(docs,key=key)[:3]


def fractions(rows, top):
    return [sum(rows[i][1][k] for i in top)/len(top) for k in (0,1)] if top else [None,None]


def measure(name):
    model=encoder(name)
    dev=[]
    for _,p in papers("train")[480:483]:
        if p["abstract"].strip():
            start=time.perf_counter_ns()
            signal=encode(model,p["abstract"])
            dev.append(dict(ms=(time.perf_counter_ns()-start)/1e6,represented=signal is not None))
    w=workspace(name)
    train=papers("train")[:483]
    evaluation=papers("dev")[:16]
    if {k for k,_ in train}&{k for k,_ in evaluation} or (
        {doc_id(p['title'].casefold()) for _,p in train}&{doc_id(p['title'].casefold()) for _,p in evaluation}):
        raise ValueError("Source family overlap.")
    results=[]
    for family,paper in evaluation:
        q=next(iter(paper["qas"]),{})
        text=q.get("question","")
        gold={doc_id(s) for a in q.get("answers",[]) for s in a["answer"]["evidence"] if s.strip()}
        rows=paragraphs(paper)
        encoded={k:p.values for k,(t,_) in rows.items() if (p:=encode(model,t)) is not None}
        index=Index(model.identity,list(encoded),list(encoded.values()))
        query=encode(model,text)
        variants=w.endpoints(query) if query else {}
        if "locked" in variants:
            wanted=w.geometry(query,variants["locked"][0])["gain"]
            match=w.match(query,wanted)
            if match:
                variants["matched"]=match
        measures={}
        baseline=bm25(rows,text)
        measures["bm25"]=dict(top=baseline,**retrieval(baseline,gold))
        for key in ["original","unconstrained","locked","matched"]:
            top=[]
            geo={}
            if key in variants:
                point,strength=variants[key]
                top=index.rank(point)
                geo=dict(applied=strength,**w.geometry(query,point))
            elif key=="matched" or (query and key!="original"):
                continue
            target,protected=fractions(rows,top)
            measures[key]=dict(top=top,target=target,protected=protected,**retrieval(top,gold),**geo)
            if target is not None:
                measures[key].update(target_change=target-measures["original"]["target"],
                                     protected_change=abs(protected-measures["original"]["protected"]))
        frame=None
        if encoded and w.pca:
            matrix=np.array(list(encoded.values()))
            frame=fidelity(matrix,w.pca.transform(matrix),w.pca.explained_variance_ratio_.sum())
            frame.pop("distortion")
        results.append(dict(family=family,question=q.get("question_id"),gold=sorted(gold),gold_indexed=len(gold&encoded.keys()),
                            represented=query is not None,documents=len(rows),indexed=len(encoded),methods=measures,fidelity=frame))
    return dict(name=name,model=model.identity,dimensions=MODELS[name],dataset=DIGEST,ranking=POLICY,
                protocol=sha256((ROOT/"docs/EVALUATION-V2.md").read_bytes()).hexdigest(),platform=platform.platform(),
                encoder_fit_count=384 if name=="expanded" else (24 if name.startswith("legacy") else None),
                section_fit=w.fit_counts,development=dev,rows=results,
                peak_rss_mib=resource.getrusage(resource.RUSAGE_SELF).ru_maxrss/(1048576 if platform.system()=="Darwin" else 1024))


if __name__=="__main__":
    parser=argparse.ArgumentParser()
    parser.add_argument("model",choices=MODELS)
    parser.add_argument("output",type=Path)
    args=parser.parse_args()
    if args.output.exists():
        parser.error("Use a new output path.")
    result=measure(args.model)
    data=json.dumps(result,allow_nan=False,indent=2)
    with args.output.open("x") as stream:
        stream.write(data+"\n")
