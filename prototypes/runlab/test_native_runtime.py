"""Regression checks for source relocation; strings/comments must stay literal."""
import unittest
from native_runtime import code_mask, methods, qualify_calls


class NativeRuntimeTests(unittest.TestCase):
    def test_braces_in_literals_and_comments(self):
        source = '''// func fake() { }
func alpha() string {return "} alpha()" /* } */}
func beta() {s:=`{ beta() }`; c:='}'; alpha()}
onStart => {beta()}
'''
        found = methods(source)
        self.assertEqual([name for name, _, _ in found], ["alpha", "beta"])
        self.assertTrue(source[found[0][1]:found[0][2]].endswith('/* } */}'))
        self.assertEqual(len(code_mask(source)), len(source))

    def test_qualified_calls_and_own_methods(self):
        source = '''func local() {startRun(); Hero.startRun(); label:="startRun()"}
// startRun()
onStart => {local(); startRun ()}
'''
        transformed = qualify_calls(source, {"startRun": "WorldLogic", "local": "NativeLogic"})
        self.assertEqual(transformed.count("WorldLogic.startRun"), 2)
        self.assertIn('label:="startRun()"', transformed)
        self.assertIn("Hero.startRun()", transformed)
        self.assertIn("// startRun()", transformed)
        self.assertNotIn("NativeLogic.local", transformed)

    def test_cross_controller_calls(self):
        source = 'func nativeStart() {startRun(); nativeShuffle()}\nfunc nativeShuffle() {}'
        transformed = qualify_calls(source, {"startRun": "WorldLogic", "nativeStart": "NativeLogic", "nativeShuffle": "NativeLogic"})
        self.assertIn("WorldLogic.startRun()", transformed)
        self.assertIn("nativeShuffle()", transformed)
        self.assertNotIn("NativeLogic.", transformed)

    def test_malformed_source_is_rejected(self):
        with self.assertRaises(ValueError):
            methods('func broken() {println "unterminated')
        with self.assertRaises(ValueError):
            methods('func broken() {if true {}')


if __name__ == "__main__":
    unittest.main()
