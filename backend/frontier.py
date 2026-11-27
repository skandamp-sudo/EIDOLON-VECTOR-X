"""Bounded shared-index tradeoff sweep; relevance is optional and never inferred."""
import numpy as np

from .intelligence import candidate, checked_index, compare, govern, metrics, ndcg, ranks


def frontier(atlas, form):
    # Reuse the four-method comparison for model binding and input validation.
    reference = compare(atlas, form)
    x = np.array(reference["variants"]["original"]["vector"])
    vectors, _ = checked_index(atlas, form.index)
    target = np.array(form.target.linear)
    protected = np.array([d.linear for d in form.protected]).reshape(-1, len(x))
    relevant = set(form.relevant or [])
    sign = -1 if form.strength < 0 else 1
    rows = []
    for method in ("original","naive","learned","locked","ungoverned"):
        for request in ([0.] if method == "original" else np.linspace(0,form.strength,17)):
            axis = np.array(form.target.centroid) if method == "naive" else target
            applied = float(request)
            if method in ("locked","ungoverned"):
                axis, limited, _ = govern(x,target,protected,request,form.max_drift,form.min_cosine)
                if method == "locked":
                    applied = limited
            y = candidate(x,axis,applied)
            if y is None:
                rows.append(dict(method=method,requested=float(request),applied=None,gain=None,drift=None,cosine=None,
                                 ndcg=None,feasible=False,frontier=False,top=[]))
                continue
            drift, cosine = metrics(x,y,protected)
            top = ranks(vectors,y)[1][:3].tolist()
            rows.append(dict(method=method,requested=float(request),applied=applied,gain=float(sign * (target @ (y-x))),
                             drift=drift,cosine=cosine,ndcg=ndcg(top,relevant),feasible=drift<=form.max_drift and cosine>=form.min_cosine,
                             frontier=False,top=top))
    feasible = [r for r in rows if r["feasible"]]
    objectives = np.array([[r["gain"],-r["drift"],r["cosine"]] + ([r["ndcg"]] if relevant else []) for r in feasible])
    for r, point in zip(feasible, objectives):
        dominates = np.all(objectives >= point,axis=1) & np.any(objectives > point,axis=1)
        r["frontier"] = not bool(np.any(dominates))
    return {"points":rows,"model_id":reference["model_id"]}
