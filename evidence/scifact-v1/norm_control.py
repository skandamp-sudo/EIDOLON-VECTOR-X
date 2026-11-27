"""Run from checkout with PYTHONPATH=. and pass an unused output filename."""
import hashlib, inspect, json, os, platform, sys, sysconfig
from fractions import Fraction
from pathlib import Path
import numpy as np, sklearn, scipy, threadpoolctl
from scripts import phase3_evidence as exp
from importlib.metadata import version

def hasharr(a):
    return hashlib.sha256(np.asarray(a).tobytes()).hexdigest()

def aligned(a, rest):
    storage = np.empty(a.size + 8, dtype=a.dtype)
    offset = ((rest - storage.ctypes.data) % 64) // a.itemsize
    result = storage[offset:offset+a.size].reshape(a.shape)
    result[:] = a
    return result

corpus, claims, _ = exp.source()
corpus.sort(key=lambda d:d['doc_id'])
claims = sorted([q for q in claims if q['id'] in (589,1107)],key=lambda c:c['id'])
out = {'environment':{'system':platform.platform(), 'python':platform.python_version(),
    'packages':{n:version(n) for n in ('numpy','scipy','scikit-learn','threadpoolctl')},
    'blas':np.show_config(mode='dicts')['Build Dependencies']['blas'],
    'threads':{k:os.getenv(k) for k in ('VECLIB_MAXIMUM_THREADS','OMP_NUM_THREADS','OPENBLAS_NUM_THREADS','MKL_NUM_THREADS')},
    'pools':[{k:v for k,v in p.items() if k!='filepath'} for p in threadpoolctl.threadpool_info()]},'cases':{}}
original = exp.ranks
def inspect_rank(v,y):
    scores, order = original(v,y)
    frame = inspect.currentframe().f_back
    if frame.f_code.co_name != 'outcome':
        return scores,order
    frame = frame.f_back
    local = frame.f_locals
    method = local['method']
    claim = local['c']['id']
    matched = '["matched"]' in inspect.getframeinfo(frame,context=1).code_context[0]
    if (claim,method,matched) not in ((589,'naive',True),(1107,'ridge',False),(1107,'ridge',True)):
        return scores,order
    ids = local['ids']
    i,j = [ids.index(d) for d in (2359152,13732033)]
    def measure(sc):
        a,b = map(float,(sc[i],sc[j]))
        return {'scores':[a,b],'hex':[a.hex(),b.hex()],'delta':a-b,'ulps':(a-b)/np.spacing(a)}
    numerical = measure(scores)
    stable = [ids[int(k)] for k in order[:3]]
    exact = [sum(Fraction(float(a))*Fraction(float(b)) for a,b in zip(v[k],y)) for k in (i,j)]
    distinct = {}
    for mat_addr in (0,16,32,48):
        vv = aligned(v,mat_addr)
        for vec_addr in (0,16,32,48):
            yy = aligned(y,vec_addr)
            sc,_ = original(vv,yy)
            result = measure(sc)
            key = '/'.join(result['hex'])
            distinct.setdefault(key,dict(result,alignments=[]))['alignments'].append([mat_addr,vec_addr])
    out['cases'][f'{claim}-{"matched" if matched else "requested"}-{method}'] = dict(
       numerical, doc_ids=[2359152,13732033],top=stable,
       ranks=[int(np.where(order==k)[0][0])+1 for k in (i,j)], exact_dot_delta=str(exact[0]-exact[1]),
       exact_dot_delta_float=float(exact[0]-exact[1]), exact_dot_rounded=[float(val).hex() for val in exact],
       endpoint_hash=hasharr(y),input_hash=hasharr(local['x']),axis_hash=hasharr(local['axes'][method]),
       alignments=[v.ctypes.data%64,y.ctypes.data%64],alignment_experiment=list(distinct.values()))
    alpha = local['best'][1] if matched else local['a']
    raw = local['x'] + alpha*local['axes'][method]
    variants = []
    for offset in range(0,64,8):
        addr = aligned(raw,offset)
        norm = np.linalg.norm(addr)
        point = addr/norm
        sc,o = original(v,point)
        variants.append(dict(offset=offset,raw_hash=hasharr(addr),norm=float(norm).hex(),endpoint_hash=hasharr(point),top3=ids[o[2]],**measure(sc)))
    out['cases'][f'{claim}-{"matched" if matched else "requested"}-{method}']['normalization_alignment']=variants
    out['basis_hash']=hasharr(local['atlas'].model.svd.components_)
    out['indexed_matrix_hash']=hasharr(v)
    out['doc_order_hash']=hasharr(np.array(ids,dtype='<i8'))
    out['doc_order_ascending']=ids==sorted(ids)
    out['max_doc_coordinate_difference']=float(np.max(abs(v[i]-v[j])))
    out['exchanged_row_hashes']=[hasharr(v[k]) for k in (i,j)]
    return scores,order
exp.ranks=inspect_rank
result=exp.evaluate(16,corpus,claims)
assert len(out['cases'])==3
out['model_id']=result['model_id']
with open(sys.argv[1],'x') as f: json.dump(out,f,indent=2)
