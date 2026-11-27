"""Each workspace owns its calibration, directions, index and projection."""
from functools import lru_cache
import numpy as np
from sklearn.decomposition import PCA

from .intelligence import candidate, govern, metrics
from .ranking_v2 import Index, Point, unit
from .recovery_data import paragraphs, papers
from .recovery_models import encode, encoder

DRIFT, COSINE, STRENGTH = .035, .65, 1.5


class Workspace:
    def __init__(self, name):
        self.model = encoder(name)
        self.identity = self.model.identity
        classes = [[{}, {}], [{}, {}]]
        for _,paper in papers("train")[384:480]:
            for key,(text,labels) in paragraphs(paper).items():
                for i,flag in enumerate(labels):
                    bucket = classes[i][int(flag)]
                    if len(bucket) < 32:
                        bucket.setdefault(key, text)
        cache = {}
        self.axes = []
        self.fit_counts = []
        for classes_for_axis in classes:
            means, counts = [], []
            for examples in classes_for_axis:
                represented = []
                for key,text in examples.items():
                    if key not in cache:
                        cache[key] = encode(self.model, text)
                    if cache[key] is not None:
                        represented.append(cache[key].values)
                counts.append(len(represented))
                if represented:
                    means.append(np.mean(represented,axis=0))
            self.fit_counts.append(counts)
            axis = means[1]-means[0] if len(means)==2 else None
            self.axes.append(unit(axis) if axis is not None and np.linalg.norm(axis)>1e-12 else None)
        ids = [i for i,p in cache.items() if p is not None]
        rows = [cache[i].values for i in ids]
        self.reference = Index(self.identity, ids, rows)
        self.pca = PCA(n_components=3, svd_solver="full").fit(rows) if len(rows)>=3 else None

    def endpoints(self, query, strength=STRENGTH):
        if query.model != self.identity:
            raise ValueError("Query belongs to a different encoder.")
        result = {"original": (query, 0.)}
        if any(a is None for a in self.axes):
            return result
        x, (target, protected) = query.values, self.axes
        safe, applied, _ = govern(x, target, np.array([protected]), strength, DRIFT, COSINE)
        for key,axis,amount in [("unconstrained",target,strength), ("locked",safe,applied)]:
            y = candidate(x,axis,amount)
            if y is not None:
                result[key] = Point(self.identity, unit(y)), float(amount)
        return result

    def geometry(self, before, after):
        if before.model != self.identity or after.model != self.identity:
            raise ValueError("Cross-model geometry is undefined.")
        if any(a is None for a in self.axes):
            return {}
        target, protected = self.axes
        x,y = before.values,after.values
        drift,cosine = metrics(x,y,np.array([protected]))
        return dict(gain=float(target@(y-x)),drift=drift,cosine=cosine,violation=int(drift>DRIFT or cosine<COSINE))

    def match(self, query, wanted):
        if wanted <= .01:
            return None
        best = None
        for strength in np.linspace(0,STRENGTH,101):
            y = candidate(query.values,self.axes[0],strength)
            if y is None:
                continue
            point = Point(self.identity, unit(y))
            gap = abs(self.geometry(query,point)["gain"]-wanted)
            if best is None or gap<best[0]:
                best = gap,point,float(strength)
        return best[1:] if best and best[0]<=.01 else None


@lru_cache(maxsize=4)
def workspace(name):
    return Workspace(name)
