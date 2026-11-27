import hashlib
import json
import math
import unittest
from urllib.error import HTTPError
from urllib.request import Request, urlopen

import numpy as np

from backend.model import Backbone, CORPUS, DIMENSIONS, PROBES


class ModelTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.model = Backbone()

    def test_fit_excludes_probes(self):
        documents = CORPUS.read_text().casefold().splitlines()
        self.assertEqual(len(documents), len(set(documents)))
        self.assertTrue(all(text.casefold() not in documents for text in PROBES.values()))

    def test_normalized_finite_dimensions(self):
        for text in PROBES.values():
            values = self.model.encode(text)
            self.assertEqual(len(values), DIMENSIONS)
            self.assertTrue(all(map(math.isfinite, values)))
            self.assertAlmostEqual(np.linalg.norm(values), 1.0)

    def test_independent_fit_is_repeatable(self):
        other = Backbone()
        for text in PROBES.values():
            np.testing.assert_allclose(other.encode(text), self.model.encode(text), atol=1e-9)

    def test_input_changes_representation(self):
        a, b = list(PROBES.values())[:2]
        self.assertFalse(np.allclose(self.model.encode(a), self.model.encode(b)))

    def test_absent_vocabulary_rejected(self):
        for text in ("", "qxzqxzqxz", "the and"):
            with self.assertRaises(ValueError):
                self.model.encode(text)


def read(port, path, **kwargs):
    with urlopen(Request(f"http://127.0.0.1:{port}{path}", **kwargs), timeout=5) as response:
        return response.read()


class LiveTests(unittest.TestCase):
    def test_health_direct_and_proxy(self):
        for port in (8000, 5173):
            self.assertEqual(json.loads(read(port, "/api/v1/health")), {
                "service":"eidolon-vector-x", "version":"0.1.0", "status":"ready"})

    def test_served_vectors_match_fresh_fit(self):
        payload = json.loads(read(5173, "/api/v1/foundation"))
        model = Backbone()
        self.assertEqual(payload["corpus_sha256"], hashlib.sha256(CORPUS.read_bytes()).hexdigest())
        self.assertEqual(payload["documents"], model.count)
        self.assertEqual(payload["dimensions"], DIMENSIONS)
        self.assertEqual([s["id"] for s in payload["samples"]], list(PROBES))
        for sample in payload["samples"]:
            self.assertEqual(sample["text"], PROBES[sample["id"]])
            np.testing.assert_allclose(sample["vector"], model.encode(sample["text"]), atol=1e-9)

    def test_vite_serves_page_and_hot_client(self):
        self.assertIn(b"/@vite/client", read(5173, "/"))
        self.assertIn(b"createHotContext", read(5173, "/@vite/client"))

    def test_invalid_host_rejected(self):
        with self.assertRaises(HTTPError) as caught:
            read(8000, "/api/v1/health", headers={"Host":"untrusted.invalid"})
        self.assertEqual(caught.exception.code, 400)

    def test_no_training_route(self):
        with self.assertRaises(HTTPError) as caught:
            read(8000, "/api/v1/train", method="POST")
        self.assertEqual(caught.exception.code, 404)

    def test_api_read_only(self):
        with self.assertRaises(HTTPError) as caught:
            read(8000, "/api/v1/foundation", method="POST")
        self.assertEqual(caught.exception.code, 405)
