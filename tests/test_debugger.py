import asyncio
import json
import unittest
from unittest.mock import patch

from pydantic import ValidationError

from backend.atlas import Atlas
from backend.concepts import model_id, preset
from backend.debugger import DebugRequest, LexicalIndex, fuse, measure, run
from backend.hosted import create
from backend.model import Backbone


class RetrievalDebuggerTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.atlas = Atlas(Backbone())
        cls.identity = model_id(cls.atlas)
        cls.params = dict(model_id=cls.identity, target=preset(cls.atlas, "Ocean affinity")["direction"],
                          protection=preset(cls.atlas, "Botanical affinity")["direction"],
                          tasks=[dict(query="telescope light", relevant=[6])], settings={})

    def report(self, **changes):
        return run(self.atlas, DebugRequest.model_validate(self.params | changes))

    def test_binary_metrics_include_missing_gold_and_empty_rankings(self):
        self.assertEqual(measure([2], [2,4], 3)["recall"], .5)
        self.assertAlmostEqual(measure([2], [2,4], 3)["ndcg"], 1/(1+1/1.584962500721156))
        self.assertEqual(measure([], [4], 3)["ndcg"], 0)
        self.assertEqual(measure([1,2], [2], 1)["missed"], [2])

    def test_lexical_and_fusion_preserve_ties_and_branch_abstention(self):
        lexical = LexicalIndex({4:"wave", 1:"wave", 2:"sand"})
        self.assertEqual(lexical.rank("wave"), [1,4])
        self.assertEqual(lexical.rank("lighthouse"), [])
        self.assertEqual(fuse([1,4],[4,1]), [1,4])
        self.assertEqual(fuse([], [3,1]), [3,1])

    def test_lexical_only_document_survives_dense_abstention(self):
        report = self.report(documents=[dict(id=4,text="xylolith"),dict(id=7,text="ocean tide")],
                             tasks=[dict(query="xylolith", relevant=[4])])
        self.assertEqual(report["represented"], 1)
        self.assertEqual(report["summary"]["fusion"]["recall"], 1)
        self.assertEqual(report["summary"]["dense"]["abstentions"], 1)
        self.assertEqual(report["gate"], "BLOCK")
        self.assertEqual(report["tasks"][0]["methods"]["locked"]["missed"], [4])

    def test_replay_and_ordered_source_identity(self):
        original = self.report()
        replay = run(self.atlas, DebugRequest.model_validate(original["replay"]))
        self.assertEqual(original, replay)
        changed = self.report(documents=[dict(id=6,text="telescope light")])
        self.assertNotEqual(original["dataset_sha256"], changed["dataset_sha256"])
        self.assertEqual(len(original["tasks"][0]["methods"]), 5)

    def test_conflict_zero_step_and_explicit_unmeasured_gate(self):
        conflict = self.report(protection=self.params["target"])
        self.assertEqual(conflict["gate"], "PASS")
        self.assertEqual(conflict["tasks"][0]["methods"]["locked"]["geometry"]["applied"], 0)
        lexical = self.report(settings={"candidate":"bm25","require_geometry":True})
        self.assertIn("Required geometry unavailable",lexical["tasks"][0]["gate_reasons"])
        self.assertIsNone(lexical["summary"]["bm25"]["violations"])

    def test_bad_labels_or_model_cannot_produce_report(self):
        for change in [dict(model_id="0"*64),dict(tasks=[dict(query="star",relevant=[999])]),
                       dict(tasks=[dict(query="star",relevant=[1,1])])]:
            with self.assertRaises(ValueError):
                self.report(**change)
        with self.assertRaises(ValidationError):
            self.report(settings={"k":100})

    def test_operator_gate_applies_per_query(self):
        r = self.report(settings={"baseline":"dense","candidate":"dense","min_recall":1},
                        tasks=[dict(query="telescope light",relevant=[6]),dict(query="telescope light star",relevant=[24])])
        self.assertEqual(r["gate"], "BLOCK")
        self.assertFalse(r["tasks"][0]["gate_reasons"])
        self.assertIn("Recall below minimum",r["tasks"][1]["gate_reasons"])

    def test_public_debugger_rejects_custom_documents(self):
        host,origin="debug-demo.up.railway.app","https://debug-demo.vercel.app"
        with patch.dict("os.environ", RAILWAY_PUBLIC_DOMAIN=host,VECTOR_X_FRONTEND_ORIGIN=origin):
            app = create()

        async def request(params):
            async def receive():
                return {"type":"http.request","body":json.dumps(params).encode(),"more_body":False}
            messages = []
            async def send(message):
                messages.append(message)
            scope = {"type":"http","method":"POST","scheme":"https","path":"/api/v1/intelligence/debug",
                     "query_string":b"","headers":[(b"host",host.encode()),(b"origin",origin.encode()),
                                                   (b"x-vector-x-client",b"foundry")]}
            async with app.router.lifespan_context(app):
                await app(scope,receive,send)
            return messages[0]["status"]

        params = self.params | {"documents":[{"id":1,"text":"telescope starlight"}]}
        self.assertEqual(asyncio.run(request(params)),403)
        self.assertEqual(asyncio.run(request(self.params)),200)
