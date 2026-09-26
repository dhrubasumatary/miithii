import unittest
from pathlib import Path

from miithii_voice.contracts import load_contract


class VoiceContractTests(unittest.TestCase):
    def test_assamese_contract(self):
        contract = load_contract("as")
        self.assertEqual(contract.voice, "Prastuti")
        self.assertEqual(contract.script, "assamese")
        self.assertEqual(contract.max_input_chars, 360)
        self.assertEqual(contract.generation_max_tokens, 512)

    def test_bodo_contract_is_isolated(self):
        contract = load_contract("brx")
        self.assertEqual(contract.voice, "Gwrbw")
        self.assertEqual(contract.script, "devanagari")
        self.assertEqual(contract.display_script, "latin")
        self.assertEqual(contract.max_input_chars, 180)
        self.assertEqual(contract.generation_max_tokens, 4096)

    def test_unknown_language_fails_closed(self):
        with self.assertRaises(ValueError):
            load_contract("hi")

    def test_generated_contract_exists(self):
        path = Path(__file__).resolve().parent.parent / "contracts" / "voice-contracts.json"
        self.assertTrue(path.is_file())


if __name__ == "__main__":
    unittest.main()
