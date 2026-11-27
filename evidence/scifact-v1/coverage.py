import collections, json, sys
from pathlib import Path
import numpy as np
from scripts import phase3_evidence as e

corpus,claims,hashes=e.source()
corpus.sort(key=lambda r:r['doc_id'])
m=e.Backbone(16)
existing=list(m.documents)+list(e.PROBES.values())+[r[0] for r in e.CASES]
existing.extend(t for groups in e.PRESETS.values() for group in groups for t in group)
qs,groups=e.select_groups(claims,existing)
vocab=set(m.vectorizer.vocabulary_)
analyze=m.vectorizer.build_analyzer()
def coverage(rows):
    occ=collections.Counter()
    types=set()
    indexed=set()
    empty=zero=0
    for i in range(0,len(rows),64):
        batch=rows[i:i+64]
        for _,text in batch:
            terms=analyze(text)
            occ.update(terms)
            types.update(terms)
        X=m.vectorizer.transform([t for _,t in batch])
        nonempty=X.getnnz(axis=1)>0
        represented=np.linalg.norm(m.svd.transform(X),axis=1)>=1e-12
        empty+=int(sum(~nonempty))
        zero+=int(sum(nonempty & ~represented))
        indexed.update(id for (id,_),ok in zip(batch,represented) if ok)
    return indexed,dict(tokens=occ.total(),oov_tokens=sum(v for k,v in occ.items() if k not in vocab),
      types=len(types),oov_types=len(types-vocab),empty_tfidf=empty,svd_only_abstentions=zero,represented=len(indexed))
Q,q=coverage([(r['id'],r['claim']) for r in qs])
D,d=coverage([(r['doc_id'],' '.join([r['title'],*r['abstract']])) for r in corpus])
gold={r['id']:{int(k) for k in r['evidence']} for r in qs}
G=set.union(*gold.values())
docs={r['doc_id']:' '.join([r['title'],*r['abstract']]) for r in corpus}
pair={k:m.vectorizer.inverse_transform(m.vectorizer.transform([docs[k]]))[0].tolist() for k in (2359152,13732033)}
data=dict(training_documents=m.count,calibration_sha256=m.digest,archive_sha256=e.DIGEST,member_sha256=hashes,
 vocabulary=len(vocab),queries=q,documents=d,unique_gold_count=len(G),unique_gold_indexed=len(G&D),
 claims_with_any_gold_indexed=sum(bool(g&D) for g in gold.values()),claims_with_all_gold_indexed=sum(g<=D for g in gold.values()),
 represented_claims_with_any_gold_indexed=sum(bool(gold[k]&D) for k in Q),represented_claims_with_all_gold_indexed=sum(gold[k]<=D for k in Q),
 pair_recognized_terms=pair,pair_gold_for_affected={k:sorted(gold[k]) for k in (589,1107)})
p=Path('.runtime/phase3-stop/first.json')
r=json.loads(p.read_bytes())
for model in r['models']:
 assert Q=={x['id'] for x in model['queries'] if x['represented']} and len(D)==model['indexed'] and set(gold)=={x['id'] for x in model['queries']}
with open(sys.argv[1],'x') as f: json.dump(data,f,indent=2)
print(json.dumps(data,indent=1))
