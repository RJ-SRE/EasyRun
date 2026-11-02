"""Build-only AI injection. Public/default builds never contain a credential."""
import json
import os
import re
from pathlib import Path


def echo_bundle(root: Path):
    mode = os.environ.get("ECHO_BUILD_MODE", "disabled")
    config = {"mode": "disabled"}
    if mode == "embedded-test":
        path = Path(os.environ.get("ECHO_CONFIG_FILE", str(root.parent.parent / ".local/ai/maas.json")))
        config = json.loads(path.read_text())
        if not config.get("apiKey") or not config.get("model") or not config.get("baseUrl", "").startswith("https://"):
            raise ValueError("Incomplete private AI configuration")
        config = {k: config[k] for k in ("baseUrl", "model", "apiKey")}
        config["mode"] = mode
    elif mode != "disabled":
        raise ValueError("ECHO_BUILD_MODE must be disabled or embedded-test")
    core = (root / "public/echo-core.js").read_text().replace("export ", "")
    ui = (root / "public/echo-journal.js").read_text()
    # Bundle the shared module; fail if any new dependency is left unresolved.
    ui, removed = re.subn(r'^import[\s\S]*?from "\./echo-core\.js";\s*', "", ui, count=1)
    if removed != 1:
        raise ValueError("Missing shared echo import")
    ui = ui.replace("export ", "")
    if "import " in ui or "export " in ui:
        raise ValueError("Unexpected echo bundle dependency")
    script = '"use strict";\n' + core + '\n' + ui + '\nreturn new EchoJournal(JSON.parse(config),css);'
    css = (root / "public/echo-journal.css").read_text()
    encode = lambda value: json.dumps(value, ensure_ascii=False).replace("$", "$$")
    init = 'nativeEchoBridge=js.Global().Get("Function").New("config","css",' + encode(script) + ').Invoke(' + encode(json.dumps(config)) + ',' + encode(css) + ')'
    manifest = json.dumps({"version": 1, "feature": "echo-journal", "mode": mode, "privateTestOnly": mode == "embedded-test", "credentialInTrackedSource": False, "credentialInPackage": mode == "embedded-test"}, ensure_ascii=False).encode()
    return init, manifest
