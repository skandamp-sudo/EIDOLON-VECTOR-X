import json
import unittest
from urllib.error import HTTPError

import numpy as np
from scipy.spatial.distance import pdist, squareform
from scipy.stats import spearmanr

from backend.atlas import Atlas
from backend.concepts import Direction, PRESETS, Training, learn, preset
from backend.fidelity import fidelity
from backend.intelligence import Comparison, candidate, compare, govern, metrics
from backend.model import Backbone
from test_foundation import read


def api(route, body):
    return json.loads(read(5173, "/api/v1/intelligence/" + route, data=json.dumps(body).encode(),
                           headers={"X-Vector-X-Client": "foundry"}))


class LabTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.atlas = Atlas(Backbone())
        cls.boot = api("workspace", {})
        cls.target, cls.protect = [Direction(**p["direction"]) for p in cls.boot["presets"]]
        cls.form = Comparison(text="forest canopy gathers distant light", target=cls.target, protected=[cls.protect],
                              strength=1.5, max_drift=.035, min_cosine=.65)

    def test_fit_only_learning_and_heldout_predictions(self):
        base = self.boot["presets"][0]
        trained = api("learn", {"name":"lab", "examples":base["examples"]})
        self.assertEqual(trained["validation"]["held_out"], 4)
        for field in ("linear", "centroid"):
            self.assertAlmostEqual(np.linalg.norm(trained["direction"][field]), 1.)
        changed = [dict(e, positive=not e["positive"]) if e["split"]=="validation" else e for e in base["examples"]]
        flipped = api("learn", {"name":"lab","examples":changed})
        self.assertEqual(trained["direction"], flipped["direction"])
        self.assertAlmostEqual(flipped["validation"]["balanced_accuracy"], 1-trained["validation"]["balanced_accuracy"])

    def test_leakage_degenerate_and_insufficient_rejected(self):
        examples = self.boot["presets"][0]["examples"]
        for updates in [{"family":examples[0]["family"]}, {"text":examples[0]["text"]},
                        {"text":"zzqxzz"}, {"text":self.atlas.model.documents[0]}, {"text":examples[0]["text"]+" zzqxzz"}]:
            data = [dict(e) for e in examples]
            data[-1].update(updates)
            with self.subTest(updates=list(updates)), self.assertRaises(HTTPError) as error:
                api("learn", {"name":"invalid","examples":data})
            self.assertEqual(error.exception.code,422)
        with self.assertRaises(HTTPError):
            api("learn", {"name":"invalid","examples":examples[:7]})

    def test_all_modes_post_normalization_and_ranking(self):
        run = api("compare", self.form.model_dump())
        x = np.array(run["variants"]["original"]["vector"])
        p = np.array(self.protect.linear)
        for mode, v in run["variants"].items():
            y = np.array(v["vector"])
            self.assertAlmostEqual(np.linalg.norm(y),1)
            self.assertAlmostEqual(v["target_delta"], np.dot(self.target.linear, y-x))
            self.assertAlmostEqual(v["drift"], abs(p @ (y-x)))
            self.assertAlmostEqual(v["cosine"], np.dot(x,y))
            expected = np.argsort(-(self.atlas.vectors @ y),kind="stable")[:3].tolist()
            self.assertEqual(expected, [item["id"] for item in v["neighbors"]])
            np.testing.assert_allclose(v["trajectory"][0], self.atlas.pca.transform([x])[0],atol=1e-9)
            np.testing.assert_allclose(v["trajectory"][-1], self.atlas.pca.transform([y])[0],atol=1e-9)
            if mode=="locked":
                self.assertLessEqual(v["drift"], self.form.max_drift)
                self.assertGreaterEqual(v["cosine"], self.form.min_cosine)
        self.assertEqual(run["fidelity"]["sample"],24)

    def test_rank_deficient_protection_conflict_and_zero(self):
        x = np.eye(8)[0]; d = np.eye(8)[1]
        _, a, reason = govern(x,d,np.array([d,d]),1,1,-1)
        self.assertEqual(a,0); self.assertIn("protected subspace",reason)
        form = self.form.model_copy(update={"strength":0.})
        v = api("compare", form.model_dump())["variants"]
        for item in v.values():
            self.assertEqual(item["vector"], v["original"]["vector"])
            self.assertEqual(item["cosine"],1)
            self.assertEqual(item["drift"],0)

    def test_disconnected_feasible_strengths_and_negative_request(self):
        # Projecting onto y leaves the x readout unchanged again at a later
        # strength, after the path has violated and re-entered the drift budget.
        x = np.array([.8, -.6]); target = np.array([.1, np.sqrt(.99)]); protected = np.array([[1.,0.]])
        safe, a, _ = govern(x,target,protected,1.4,.02,-1.)
        feasible = []
        for strength in np.linspace(1.4,0,101):
            y = candidate(x,safe,strength)
            if y is not None and metrics(x,y,protected)[0] <= .02 and target @ (y-x)>1e-12:
                feasible.append(strength)
        self.assertAlmostEqual(a,max(feasible))
        self.assertGreater(a,1.)
        self.assertGreater(metrics(x,candidate(x,safe,.6),protected)[0],.02)
        _, negative, _ = govern(x,-target,protected,-1.4,.02,-1.)
        self.assertAlmostEqual(a,-negative)
        self.assertIsNone(candidate(np.array([1.,0]),np.array([-1.,0]),1.1))

    def test_projection_fidelity_matches_independent_neighbors(self):
        vectors = self.atlas.vectors; xyz = self.atlas.pca.transform(vectors)
        f = fidelity(vectors,xyz,.5)
        high, low = pdist(vectors, "cosine"), pdist(xyz)
        self.assertAlmostEqual(f["distance_rho"], spearmanr(high,low).statistic)
        distances = [squareform(d) for d in (high,low)]
        for i in range(len(vectors)):
            rows = []
            for matrix in distances:
                rows.append(sorted((j for j in range(len(vectors)) if i!=j),key=lambda j:matrix[i,j])[:3])
            self.assertAlmostEqual(f["distortion"][str(i)],1-len(set(rows[0]) & set(rows[1]))/3)
        self.assertIsNone(fidelity(vectors[:2],xyz[:2],.5)["trustworthiness"])
        self.assertEqual(fidelity(np.tile(vectors,(8,1)),np.tile(xyz,(8,1)),.5)["sample"],128)

    def test_imported_relevance_debugger_and_identity(self):
        form = self.form.model_dump()
        form.update(index={"model_id":self.boot["model_id"],"vectors":self.atlas.vectors[:5].tolist(),"categories":["A"]*5},
                    relevant=[0],expected_category="B")
        result = api("compare", form)
        self.assertEqual(len(result["points"]),5)
        v = result["variants"]["locked"]
        self.assertIsNotNone(v["ndcg"])
        self.assertTrue(any("Category" in a["reason"] for a in v["suspicions"]))
        for change in v["changes"]:
            self.assertIn(change["id"], range(5))
        form["target"] = {**form["target"], "model_id":"other"}
        with self.assertRaises(HTTPError) as error:
            api("compare", form)
        self.assertEqual(error.exception.code,422)
