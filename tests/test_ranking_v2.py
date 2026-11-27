import unittest
import numpy as np
from backend.ranking_v2 import Index, Point, QUANTUM

class RankingTests(unittest.TestCase):
    def test_ties_and_alignment(self):
        q = Point('one', np.array([1.,0.]))
        for offset in range(8):
            raw = np.zeros(12)
            vect = raw[offset:offset+2]
            vect[:] = [.5, np.sqrt(.75)]
            near = np.array([.5 + QUANTUM/16, np.sqrt(.75)])
            for ids,rows in [(['b','a','c'],[vect,near,vect]),(['c','a','b'],[vect,near,vect])]:
                index=Index('one',ids,rows)
                for _ in range(3):
                    self.assertEqual(index.rank(q), ['a','b','c'])

    def test_model_boundary(self):
        index=Index('one',['x'],[[1,0]])
        for q in [Point('two',[1,0]),Point('one',[1,0,0]),Point('one',[0,0]),Point('one',[np.nan,0])]:
            with self.assertRaises(ValueError): index.rank(q)
