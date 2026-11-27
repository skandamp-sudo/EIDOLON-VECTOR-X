import asyncio
import json
import os
import socket
import subprocess
import sys
import time
import unittest
from unittest.mock import patch
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from backend.hosted import create
from test_intelligence import api


class FrontierTests(unittest.TestCase):
    def test_measured_frontier_and_dominance(self):
        base = api("workspace", {})
        t, p = [v["direction"] for v in base["presets"]]
        form = dict(text="forest canopy gathers distant light",target=t,protected=[p],strength=-2.,
                    max_drift=.035,min_cosine=.65,relevant=[0,1])
        rows = api("frontier",form)["points"]
        self.assertEqual(len(rows),69)
        reference = api("compare",form)["variants"]
        for name in reference:
            last = [r for r in rows if r["method"]==name][-1]
            self.assertAlmostEqual(last["gain"],-reference[name]["target_delta"])
            self.assertAlmostEqual(last["ndcg"],reference[name]["ndcg"])
        for row in rows:
            self.assertEqual(row["feasible"],row["cosine"] >= .65 and row["drift"] <= .035)
            if row["frontier"]:
                self.assertTrue(row["feasible"])
                obj = lambda r:(r["gain"],-r["drift"],r["cosine"],r["ndcg"])
                self.assertFalse(any(r["feasible"] and obj(r)!=obj(row) and
                                 all(x>=y for x,y in zip(obj(r),obj(row))) for r in rows))

    def test_no_positive_gain_in_exact_self_lock(self):
        d=api("workspace",{})["presets"][0]["direction"]
        rows=api("frontier",dict(text="forest light",target=d,protected=[d],strength=2.,max_drift=0.,min_cosine=1.))["points"]
        self.assertFalse(any(r["feasible"] and r["gain"]>1e-9 for r in rows))
        self.assertTrue(all(r["ndcg"] is None for r in rows))


class HostedTests(unittest.TestCase):
    origin="https://fixture.vercel.app"
    host="fixture.up.railway.app"

    @classmethod
    def setUpClass(cls):
        sock=socket.socket(); sock.bind(("127.0.0.1",0)); sock.listen()
        cls.port=sock.getsockname()[1]
        cls.worker=subprocess.Popen([sys.executable,"-m","uvicorn","backend.hosted:create","--factory","--fd",str(sock.fileno()),
                                     "--no-access-log","--log-level","warning"],pass_fds=(sock.fileno(),),
                                    env={**os.environ,"VECTOR_X_FRONTEND_ORIGIN":cls.origin,"RAILWAY_PUBLIC_DOMAIN":cls.host})
        sock.close()
        cls.addClassCleanup(cls.shutdown)
        for _ in range(60):
            try:
                with cls.request("/health"): return
            except (OSError,URLError):
                if cls.worker.poll() is not None: break
                time.sleep(.1)
        raise RuntimeError("Hosted worker did not start")

    @classmethod
    def shutdown(cls):
        cls.worker.terminate(); cls.worker.wait(timeout=8)

    @classmethod
    def request(cls,path,body=None,origin=None,method=None,extra=None):
        headers={"Host":cls.host,"Origin":origin or cls.origin,"X-Vector-X-Client":"foundry","Content-Type":"application/json",**(extra or {})}
        req=Request(f"http://127.0.0.1:{cls.port}/api/v1"+path,data=body,headers=headers,method=method)
        return urlopen(req,timeout=8)

    def test_allowed_origin_and_calibration_inference(self):
        with self.request("/explore",json.dumps(dict(text="ocean light",target="Ocean",strength=1.)).encode()) as res:
            self.assertEqual(res.headers["Access-Control-Allow-Origin"],self.origin)
            self.assertEqual(len(json.load(res)["steered"]),8)
        with self.request("/intelligence/workspace",b"{}") as res:
            t,p=[s["direction"] for s in json.load(res)["presets"]]
        form=dict(text="ocean",target=t,protected=[p],strength=1.,min_cosine=.7,max_drift=.03)
        with self.request("/intelligence/frontier",json.dumps(form).encode()) as res:
            self.assertEqual(len(json.load(res)["points"]),69)
        form["index"]={"model_id":t["model_id"],"vectors":[t["linear"]]}
        with self.assertRaises(HTTPError) as err:self.request("/intelligence/compare",json.dumps(form).encode())
        self.assertEqual(err.exception.code,403)

    def test_no_hosted_imports_or_training_and_bounded_body(self):
        for route,body,code in [("/foundry/csv",b"private",404),("/intelligence/learn",b"{}",403),
                                ("/intelligence/compare",b" "*32769,413)]:
            with self.assertRaises(HTTPError) as err:self.request(route,body)
            self.assertEqual(err.exception.code,code)
        with self.assertRaises(HTTPError) as err:self.request("/intelligence/workspace",b"{}",origin="https://other.invalid")
        self.assertEqual(err.exception.code,403)
        self.assertIsNone(err.exception.headers.get("Access-Control-Allow-Origin"))
        with self.assertRaises(HTTPError) as err:self.request("/health",extra={"Host":"malformed.invalid"})
        self.assertEqual(err.exception.code,400)
        with patch.dict(os.environ,{"VECTOR_X_FRONTEND_ORIGIN":"*","RAILWAY_PUBLIC_DOMAIN":self.host}), self.assertRaises(RuntimeError):
            create()
