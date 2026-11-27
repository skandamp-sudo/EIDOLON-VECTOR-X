import json
import unittest
from urllib.error import HTTPError

import numpy as np

from backend.atlas import Atlas, Query
from backend.model import Backbone
from test_foundation import read

TEXT = "A telescope records light from a distant star."


def post(port=5173, **overrides):
    params = {"text": TEXT, "target": "Ocean", "strength": 1.2, **overrides}
    return json.loads(read(port, "/api/v1/explore", data=json.dumps(params).encode(),
                           headers={"Content-Type": "application/json"}))


class AtlasTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.atlas = Atlas(Backbone())

    def test_actual_projection_and_ranking_via_proxy(self):
        r = post()
        original = self.atlas.model.encode(TEXT)
        np.testing.assert_allclose(r["original"], original, atol=1e-9)
        for key, vector, index in [("before", original, 0), ("after", r["steered"], -1)]:
            scores = self.atlas.vectors @ vector
            self.assertEqual(r[key], np.argsort(-scores, kind="stable")[:3].tolist())
            np.testing.assert_allclose(r["trajectory"][index], self.atlas.pca.transform([vector])[0])
            np.testing.assert_allclose([d[key] for d in r["documents"]], scores)
        self.assertNotEqual(r["before"], r["after"])
        self.assertEqual(len(r["documents"]), 24)
        self.assertAlmostEqual(r["explained_variance"], self.atlas.pca.explained_variance_ratio_.sum())
        self.assertAlmostEqual(r["neighbor_overlap"], len(set(r["after"]) & set(r["before"])) / 3)
        self.assertAlmostEqual(r["retained_cosine"], np.dot(original, r["steered"]))
        self.assertAlmostEqual(r["displacement"], np.linalg.norm(np.subtract(original, r["steered"])))

    def test_zero_preserves_ranking_and_vector(self):
        r = post(8000, strength=0.0)
        self.assertEqual(r["original"], r["steered"])
        self.assertEqual(r["before"], r["after"])
        self.assertEqual(r["displacement"], 0.0)
        np.testing.assert_allclose(r["trajectory"], np.tile(r["trajectory"][0], (25,1)), atol=1e-12)

    def test_signed_control_changes_direction_in_fixed_frame(self):
        runs = [post(8000, strength=a) for a in (-1.0, 0.0, 1.0)]
        scores = [np.dot(r["steered"], self.atlas.directions["Ocean"]) for r in runs]
        self.assertLess(scores[0], scores[1])
        self.assertLess(scores[1], scores[2])
        self.assertEqual([d["xyz"] for d in runs[0]["documents"]], [d["xyz"] for d in runs[2]["documents"]])

    def test_all_trajectory_samples_use_normalized_steering(self):
        r = post(8000, strength=-1.4)
        for a, xyz in zip(np.linspace(0, -1.4, 25), r["trajectory"]):
            v = r["original"] + a * self.atlas.directions["Ocean"]
            np.testing.assert_allclose(xyz, self.atlas.pca.transform([v / np.linalg.norm(v)])[0], atol=1e-9)

    def test_new_text_changes_original(self):
        self.assertNotEqual(post()["original"], post(text="forest roots in cold soil")["original"])

    def test_each_concept_uses_its_own_annotated_examples(self):
        for topic in self.atlas.directions:
            with self.subTest(topic=topic):
                run = post(8000, target=topic)
                mask = self.atlas.labels == topic
                difference = self.atlas.vectors[mask].mean(0) - self.atlas.vectors[~mask].mean(0)
                expected = np.array(run["original"]) + run["strength"] * difference / np.linalg.norm(difference)
                np.testing.assert_allclose(run["steered"], expected / np.linalg.norm(expected))

    def test_input_errors(self):
        for invalid in [{"text": ""}, {"text": "qzxqzx"}, {"text":"a"*401}, {"target":"unknown"},
                        {"strength":2.01}, {"strength":"1"}, {"unknown":0}]:
            with self.subTest(invalid=list(invalid)), self.assertRaises(HTTPError) as error:
                post(8000, **invalid)
            self.assertEqual(error.exception.code, 422)

    def test_reject_oversized_body_and_wrong_media_type(self):
        for body, media, code in [(b"x"*4097,"application/json",413),(b"{}","text/plain",415)]:
            with self.assertRaises(HTTPError) as error:
                read(8000, "/api/v1/explore", data=body, headers={"Content-Type":media})
            self.assertEqual(error.exception.code, code)
