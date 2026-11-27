import asyncio
import json
import unittest
from urllib.error import HTTPError
from urllib.request import Request, urlopen

import numpy as np

from backend.atlas import Atlas
from backend.foundry import foundry, parse, slot
from fastapi import HTTPException
from starlette.requests import Request as LocalRequest
from backend.model import Backbone
from test_foundation import read


def api(kind, body, **headers):
    return read(5173, "/api/v1/foundry/" + kind, data=body, headers={"X-Vector-X-Client": "foundry", **headers})


class FoundryTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.atlas = Atlas(Backbone())

    def test_equivalent_formats(self):
        samples = {"csv": b'caption,note\n"Ocean, deep",A\n', "json": b'[{"caption":"Ocean, deep","note":"A"}]',
                   "jsonl": b'{"caption":"Ocean, deep","note":"A"}\n'}
        for kind, raw in samples.items():
            with self.subTest(kind=kind):
                self.assertEqual(json.loads(api(kind, raw)), {"columns": ["caption", "note"], "rows": [["Ocean, deep", "A"]]})
        self.assertEqual(parse(b"\xef\xbb\xbfocean\r\n\nforest\n", "txt")["rows"], [["ocean"], [""], ["forest"]])

    def test_sparse_columns_and_multiline_csv(self):
        self.assertEqual(parse(b'[{"a":1},{"b":2}]', "json")["rows"], [["1", ""], ["", "2"]])
        self.assertEqual(parse(b'text,meta\n"a\nb","c,d"', "csv")["rows"], [["a\nb", "c,d"]])

    def test_bounded_structure_and_encoding(self):
        cases = [("csv", b"x,x\na,b"), ("csv", b'x,y\n"broken'), ("csv", b"x,y\na,b,c"),
                 ("txt", b"x\x00y"), ("txt", b"\xff"), ("txt", b"a" * 4097),
                 ("json", b'[{"x":1,"x":2}]'), ("json", b'[[[[1]]]]'), ("json", b'[{"x":NaN}]'),
                 ("json", b'[{"x":"\\ud800"}]'), ("jsonl", b'{}\n[]'), ("json", b'{"x":1}')]
        for kind, raw in cases:
            with self.subTest(kind=kind, size=len(raw)), self.assertRaises(HTTPError) as caught:
                api(kind, raw)
            self.assertEqual(caught.exception.code, 422)

    def test_size_record_and_batch_limits(self):
        self.assertEqual(len(parse(b"ocean\n" * 5000, "txt")["rows"]), 5000)
        for kind, raw, status in [("txt", b"x\n"*5001, 422), ("txt", b"a"*10_000_001, 413),
                                  ("embed", json.dumps(["ocean"]*65).encode(), 422)]:
            with self.subTest(kind=kind), self.assertRaises(HTTPError) as caught:
                api(kind, raw)
            self.assertEqual(caught.exception.code, status)

    def test_batch_matches_model_and_fixed_pca_for_new_records(self):
        texts = ["ocean currents below a strange moon", "orchestra exploring the forest", "zzqzx"]
        result = json.loads(api("embed", json.dumps(texts).encode()))
        self.assertEqual(result["corpus_sha256"], self.atlas.model.digest)
        for item, text in zip(result["points"][:2], texts):
            expected = self.atlas.model.encode(text)
            np.testing.assert_allclose(item["vector"], expected, atol=1e-10)
            np.testing.assert_allclose(item["xyz"], self.atlas.pca.transform([expected])[0], atol=1e-10)
        self.assertIsNone(result["points"][2])

    def test_imported_steering_shares_atlas_direction(self):
        text = "A research microphone records the concert in a forest."
        vector = self.atlas.model.encode(text)
        for strength in (-1, 0, 1):
            run = json.loads(api("steer", json.dumps(dict(text=text, target="Ocean", strength=strength)).encode()))
            expected = self.atlas.steering_path(np.array(vector), "Ocean", strength)
            np.testing.assert_allclose(run["steered"], expected[-1], atol=1e-10)
            np.testing.assert_allclose(run["trajectory"], self.atlas.pca.transform(expected), atol=1e-10)

    def test_origin_header_no_cache_and_no_readback(self):
        path = "/api/v1/foundry/txt"
        for headers in [{}, {"X-Vector-X-Client":"foundry","Origin":"https://example.invalid"}]:
            with self.assertRaises(HTTPError) as caught:
                read(8000, path, data=b"private test", headers=headers)
            self.assertEqual(caught.exception.code, 403)
        req = Request("http://127.0.0.1:8000"+path, data=b"private test", headers={"X-Vector-X-Client":"foundry"})
        with urlopen(req, timeout=5) as response:
            self.assertEqual(response.headers["Cache-Control"], "no-store")
        with self.assertRaises(HTTPError) as caught:
            read(8000, path)
        self.assertEqual(caught.exception.code, 405)

    def test_busy_worker_rejects_before_reading_body(self):
        request = LocalRequest({"type": "http", "headers": [(b"x-vector-x-client", b"foundry")]})
        with slot, self.assertRaises(HTTPException) as caught:
            asyncio.run(foundry("embed", request))
        self.assertEqual(caught.exception.status_code, 429)
