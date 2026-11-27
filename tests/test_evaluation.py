import unittest
from scripts.phase3_evidence import evaluate, select_groups, summary


class EvidenceTests(unittest.TestCase):
    def test_connected_groups_and_fit_overlap(self):
        def c(i, refs, text, gold=True):
            return dict(id=i,cited_doc_ids=refs,claim=text,evidence={str(refs[0]):[1]} if gold else {})
        rows = [c(1,[1],"cold water"), c(2,[1,2],"bridge",False), c(3,[2],"water pressure"),
                c(4,[3],"singing forest"), c(5,[4],"singing forest")]
        selected, groups = select_groups(rows,["water cold"])
        self.assertEqual(groups,3)
        self.assertEqual([r["id"] for r in selected],[4])

    def test_abstention_retains_gold_and_true_sample_counts(self):
        corpus = [dict(doc_id=i,title=text,abstract=[]) for i,text in enumerate(["ocean","star","forest","qqzzyy"])]
        claims = [dict(id=i,claim=text,cited_doc_ids=[3],evidence={"3":[]}) for i,text in enumerate(["ocean wave","qqzzyy"])]
        report = evaluate(8,corpus,claims)
        self.assertEqual(report["indexed"],3)
        self.assertEqual(report["represented"],1)
        self.assertEqual(report["methods"]["locked"]["recall"]["mean"],0)
        self.assertEqual(report["methods"]["locked"]["gain"]["n"],1)
        self.assertEqual(report["methods"]["locked"]["recall"]["n"],2)
        self.assertEqual(report["methods"]["locked"]["violation"]["mean"],0)
        self.assertIsNone(summary([])["mean"])
