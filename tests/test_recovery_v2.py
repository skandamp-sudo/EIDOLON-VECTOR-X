import unittest
import numpy as np
from backend.ranking_v2 import unit
from backend.recovery_models import MiniLM, masked_mean
from scripts.recovery_v2 import bm25, retrieval


class RecoveryTests(unittest.TestCase):
    def test_padding_excluded(self):
        sequence=np.ones((1,3,384))
        sequence[0,2,0]=400
        np.testing.assert_allclose(masked_mean(sequence,np.array([[1,1,0]])),unit(np.ones(384)))

    def test_partial_index_and_abstention(self):
        self.assertAlmostEqual(retrieval(['x'],{'x','y'})['ndcg'],1/(1+1/np.log2(3)))
        self.assertEqual(retrieval([],{'x'}),dict(recall=0.,ndcg=0.))
        self.assertIsNone(retrieval([],set())['ndcg'])
        self.assertEqual(bm25({'a':('sea',()),'b':('a new method',())},'method'),['b','a'])

    def test_optional_neural_truncation(self):
        from backend.recovery_data import CACHE
        if not (CACHE/'minilm/tokenizer.json').exists():
            self.skipTest('Optional local MiniLM artifacts absent')
        model=MiniLM()
        text='science '*300
        tokens=model.tokenizer.encode(text)
        self.assertEqual((len(tokens.ids),tokens.ids[0],tokens.ids[-1]),(256,101,102))
        a=model.encode(text)
        self.assertEqual(a.shape,(384,))
        self.assertAlmostEqual(np.linalg.norm(a),1.)
        np.testing.assert_array_equal(a,model.encode(text+'different suffix'))
