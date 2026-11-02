import json
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from native_echo import echo_bundle

ROOT = Path(__file__).parent

class EchoBuildTest(unittest.TestCase):
    def test_default_build_never_reads_private_config(self):
        with patch.dict(os.environ, {"ECHO_BUILD_MODE": "disabled", "ECHO_CONFIG_FILE": "/does/not/exist"}):
            source, manifest = echo_bundle(ROOT)
        data = json.loads(manifest)
        self.assertFalse(data["credentialInPackage"])
        self.assertNotIn("Bearer local-test-secret", source)
        self.assertIn("EchoJournal", source)
        self.assertNotIn('import {', source)
        self.assertIn('$$', source)  # XGo literal dollar escaping.

    def test_explicit_private_build_injects_only_allowed_configuration(self):
        with tempfile.TemporaryDirectory() as directory:
            file = Path(directory) / "test.json"
            file.write_text(json.dumps({"apiKey":"local-test-secret","baseUrl":"https://example.test/v1","model":"fixture","unrelated":"do-not-embed"}))
            with patch.dict(os.environ, {"ECHO_BUILD_MODE":"embedded-test","ECHO_CONFIG_FILE":str(file)}):
                source, manifest = echo_bundle(ROOT)
            self.assertIn("local-test-secret", source)
            self.assertNotIn("do-not-embed", source)
            self.assertTrue(json.loads(manifest)["privateTestOnly"])

    def test_invalid_mode_fails_closed(self):
        with patch.dict(os.environ, {"ECHO_BUILD_MODE":"public-with-key"}):
            with self.assertRaises(ValueError):
                echo_bundle(ROOT)

if __name__ == "__main__":
    unittest.main()
