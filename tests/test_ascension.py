import unittest
from backend.debug_api import Experiment, basis, run_experiment


class ModelContractTests(unittest.TestCase):
    def test_identity_and_direction_do_not_cross_models(self):
        name="legacy16"
        model,_,_,_=basis(name)
        form=Experiment(encoder=name,model_id=model.identity,target="Ocean affinity",
                        protection="Botanical affinity",tasks=[{"query":"telescope light","relevant":[6]}],
                        settings={"candidate":"spherical","strength":-1})
        report=run_experiment(form)
        self.assertEqual(report["dimensions"],16)
        self.assertEqual(report["protocol"],"ascension-retrieval-v1")
        self.assertEqual(report,run_experiment(Experiment.model_validate(report["replay"])))
        point=report["tasks"][0]["methods"]["spherical"]["geometry"]
        self.assertGreater(point["signed_gain"],0)
        self.assertLessEqual(point["drift"],1e-10)
        with self.assertRaisesRegex(ValueError,"identity"):
            run_experiment(form.model_copy(update={"encoder":"legacy8"}))
