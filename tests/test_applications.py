import unittest

from backend.applications import Search, explore
from backend.atlas import Atlas
from backend.model import Backbone


class ApplicationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.atlas = Atlas(Backbone())

    def test_clarification_and_relationships(self):
        first = explore(self.atlas, Search(text="light and waves"))
        self.assertEqual(first["before"], first["after"])
        for reading in first["interpretations"]:
            result = explore(self.atlas, Search(text="light and waves", interpretation=reading))
            self.assertEqual(first["before"], result["before"])
            self.assertNotEqual(result["before"], result["after"])
        for item in first["items"]:
            self.assertEqual(len(set(item["peers"])), 3)
            self.assertNotIn(item["id"], item["peers"])

    def test_fixture_anomaly_and_abstention(self):
        result = explore(self.atlas, Search(text="mirror", corpus="inventory"))
        item = next(i for i in result["items"] if i["name"] == "Unreviewed mirror blank")
        self.assertTrue(item["anomalous"])
        self.assertEqual(item["majority"], "Optics")
        with self.assertRaisesRegex(ValueError, "No representable signal"):
            explore(self.atlas, Search(text="zzzzzz"))
