"""Keep export-only controllers out of Game's promoted sprite method set.

Every SPX sprite embeds Game. Hundreds of Game methods cause ixgo/SSA to keep
thousands of forwarding methods alive. Controllers share the original Game
fields but own their methods once. No runtime patch or GC setting is required.
"""
import json
import re


def code_mask(source):
    """Preserve offsets/newlines while masking Go/XGo strings and comments."""
    chars = list(source)
    i = 0
    while i < len(source):
        start = i
        if source.startswith("//", i):
            i = source.find("\n", i)
            if i < 0:
                i = len(source)
        elif source.startswith("/*", i):
            end = source.find("*/", i + 2)
            if end < 0:
                raise ValueError("Unterminated source comment")
            i = end + 2
        elif source[i] in "\"'`":
            quote = source[i]
            i += 1
            while i < len(source):
                if source[i] == "\\" and quote != "`":
                    i += 2
                    continue
                if source[i] == quote:
                    i += 1
                    break
                i += 1
            else:
                raise ValueError("Unterminated source literal")
        else:
            i += 1
            continue
        for j in range(start, min(i, len(chars))):
            if chars[j] != "\n":
                chars[j] = " "
    return "".join(chars)


def methods(source):
    masked = code_mask(source)
    found = []
    for match in re.finditer(r"(?m)^func (\w+)\(", masked):
        opening = masked.index("{", match.end())
        depth = 1
        end = opening + 1
        while end < len(masked) and depth:
            if masked[end] == "{":
                depth += 1
            elif masked[end] == "}":
                depth -= 1
            end += 1
        if depth:
            raise ValueError("Unterminated function: " + match[1])
        found.append((match[1], match.start(), end))
    return found


def qualify_calls(source, owners):
    # A sprite's own methods take precedence over promoted Game methods.
    own = {name for name, _, _ in methods(source)}
    names = set(owners) - own
    if not names:
        return source
    pattern = re.compile(r"(?<![.\w])(" + "|".join(sorted(names, key=len, reverse=True)) + r")(?=\s*\()")
    changes = [(m.start(), owners[m[1]] + ".") for m in pattern.finditer(code_mask(source))]
    for offset, prefix in reversed(changes):
        source = source[:offset] + prefix + source[offset:]
    return source


def optimize_native_runtime(config, files):
    main = files["main.spx"].decode()
    # Thirty-two dormant rope/telegraph clones used to wake every frame. Keep
    # their exact drawing code, but dispatch it only while visible and once
    # when hiding. Active ropes and boss telegraphs still draw every frame.
    for sprite, message in (("Rope", "nativeRopeFrame"), ("KeeperLine", "nativeKeeperFrame")):
        source = files[sprite + ".spx"].decode()
        header, loop = source.split("onCloned data => {", 1)
        assert "sceneBorn++" in loop and "i:=data.(int)" in loop
        body = loop.split("waitNextFrame()", 1)[1].rstrip()
        assert body.endswith("}\n}")
        body = body[:-3].rstrip()  # remove the enclosing loop and event braces
        assert body.endswith("}")
        header = header.replace("var (", "var (\n nativeViewSlot int\n nativeViewClone bool", 1)
        source = header + "onCloned data => {sceneBorn++; nativeViewSlot=data.(int); nativeViewClone=true; renderHide()}\n"
        source += 'onMsg "' + message + '", => {if !nativeViewClone {return}; i:=nativeViewSlot; ' + body + "\n}\n"
        files[sprite + ".spx"] = source.encode()
    main = main.replace("var (", "var (\n nativeRopeVisible bool\n nativeKeeperVisible bool", 1)
    marker = "  updateMenuMotion(dt)"
    assert main.count(marker) == 1
    main = main.replace(marker, '  if Hero.hook>=0 || nativeRopeVisible {broadcastAndWait "nativeRopeFrame"; nativeRopeVisible=Hero.hook>=0}\n'
                               '  if segment==1 || nativeKeeperVisible {broadcastAndWait "nativeKeeperFrame"; nativeKeeperVisible=segment==1}\n' + marker)
    functions = methods(main)
    assert len(functions) > 100, "Unexpected native project layout"
    owners = {
        name: "NativeLogic" if name.startswith(("native", "initNative", "updateNative", "syncNative")) else "WorldLogic"
        for name, _, _ in functions
    }
    assert len(owners) == len(functions), "Duplicate Game methods"
    for controller in ("NativeLogic", "WorldLogic"):
        assert controller + ".spx" not in files
        source = 'import "math"\nimport "fmt"\nimport "strings"\n\n'
        if controller == "NativeLogic":
            source += 'import "encoding/json"\nimport "net/http"\nimport "syscall/js"\n\n'
        source += "\n".join(main[a:b] for name, a, b in functions if owners[name] == controller)
        source += "\nonStart => {hide}\n"
        files[controller + ".spx"] = source.encode()
        # A non-cloned, noninteractive owner; the publishing cover stays first.
        folder = "assets/sprites/" + controller
        sprite = json.loads(files["assets/sprites/NativeBgm/index.json"])
        sprite.pop("builder_id", None)
        files[folder + "/index.json"] = json.dumps(sprite).encode()
        files[folder + "/pixel.png"] = files["assets/sprites/NativeBgm/pixel.png"]
        config["zorder"].append(controller)
    for _, a, b in reversed(functions):
        main = main[:a] + main[b:]
    files["main.spx"] = main.encode()
    for path, content in list(files.items()):
        if path.endswith(".spx"):
            files[path] = qualify_calls(content.decode(), owners).encode()
    files["native-runtime-manifest.json"] = json.dumps({
        "version": 1,
        "controllers": {name: sum(v == name for v in owners.values()) for name in ("NativeLogic", "WorldLogic")},
        "methodOwners": owners,
        "gcPolicy": "platform-default",
        "worldCloneBudget": 121,
    }, ensure_ascii=False, indent=2).encode()
