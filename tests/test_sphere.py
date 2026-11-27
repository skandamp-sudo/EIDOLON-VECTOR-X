import unittest
import numpy as np
from backend.sphere import rotate


class SphereTests(unittest.TestCase):
    def test_generated_spheres(self):
        rng=np.random.default_rng(813)
        for n in (2, 3, 8, 16, 128, 384):
            for _ in range(24):
                x,d=rng.normal(size=(2,n))
                x/=np.linalg.norm(x)
                d/=np.linalg.norm(d)
                p=rng.normal(size=(min(3,n-1),n))
                p/=np.linalg.norm(p,axis=1)[:,None]
                p=np.vstack([p,p[0]])
                floor=rng.uniform(-1,1)
                for a in (-2.,0.,1.2):
                    y,step,_=rotate(x,d,p,a,floor)
                    self.assertAlmostEqual(np.linalg.norm(y),1.,places=9)
                    np.testing.assert_allclose(p@y,p@x,atol=1e-10,rtol=0)
                    self.assertGreaterEqual(x@y,floor-1e-10)
                    self.assertGreaterEqual(np.sign(a)*(d@(y-x)),-1e-12)
                    self.assertLessEqual(abs(step),abs(a))
    def test_degenerate_cases(self):
        x,d=np.eye(2)
        for target,p,a,c in [(d,np.eye(2),2,0),(d,[x],1,0),(d,[d],1,0),
                             (-x,[],2,-1),(d,[],0,-1),(d,[],2,1)]:
            y,step,_=rotate(x,target,np.asarray(p).reshape(-1,2),a,c)
            np.testing.assert_array_equal(y,x)
            self.assertEqual(step,0)
    def test_known_arc(self):
        x,d=np.eye(2)
        for a in (-2,2):
            y,angle,_=rotate(x,d,np.empty((0,2)),a,.8)
            np.testing.assert_allclose(y,[.8,np.sign(a)*.6],atol=1e-12)
            self.assertAlmostEqual(abs(angle),np.arccos(.8))
