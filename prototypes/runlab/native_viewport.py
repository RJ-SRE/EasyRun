"""Native-only full-bleed scenery; preserve the authored gameplay/UI scale."""
import json
import re
import struct


def full_bleed_native(files):
    def image_info(name):
        folder = f"assets/sprites/{name}/"
        config = json.loads(files[folder + "index.json"])
        costume = config["costumes"][0]
        image = files[folder + costume["path"]]
        assert image[:8] == b"\x89PNG\r\n\x1a\n", name
        width, height = struct.unpack(">II", image[16:24])
        return config, width, height

    # The existing 960x600 UI remains centered, with the same hit coordinates.
    # Only decorative paintings expand, never actors or collision geometry.
    for i in range(5):
        name = f"District{i}"
        config, width, height = image_info(name)
        source = files[name + ".spx"].decode()
        pattern = r"renderPosition 480,cameraY\+\(([-\d.]+)-cameraY\)\*0\.045"
        match = re.search(pattern, source)
        assert match, name
        replacement = (
            f"offset:=clamp(({match[1]}-cameraY)*0.045,-72,72); "
            f"scale:=max({config['size']},max((max(viewWidth,960)+8)/{width},"
            f"(max(viewHeight,600)+152)/{height})); "
            "renderSize scale; renderPosition viewCenterX,viewCenterY+offset"
        )
        files[name + ".spx"] = re.sub(pattern, replacement, source).encode()

    # Use one transform for the still picture and registered local effects.
    # Left alignment protects the embedded logo and hero in 4:3 / tall hosts.
    _, width, height = image_info("MenuScene")
    transform = (
        f"scale:=max(max(viewWidth,960)/{width},max(viewHeight,600)/{height}); "
        "left:=viewCenterX-max(viewWidth,960)/2; "
        "top:=viewCenterY+max(viewHeight,600)/2"
    )
    validation = json.loads(files.pop("native-menu-geometry.json"))
    rects = {
        "MenuScene": (0, 0, width, height),
        "MenuClothLocal": validation["cloth"],
        "MenuWaterLocal": validation["water"],
        "MenuLightning": validation["lightning"],
        "MenuFogBase": validation["fog"],
        "MenuFogBlend": validation["fog"],
    }
    for name, (x, y, w, h) in rects.items():
        source = files[name + ".spx"].decode()
        start = source.index("func menuPaint()")
        if name.startswith("MenuFog"):
            _, patch_width, _ = image_info(name)
            pixel_scale = w / patch_width
            field = "menuFogFrame" if name == "MenuFogBase" else "menuFogNext"
            ghost = "menuFogBlend" if name == "MenuFogBase" else "100-menuFogBlend"
            source = source[:start] + (
                "func menuPaint() {if menuEntering {setLayer Front}; if phase==0 && !menuReduced {renderShow(); "
                + transform + "; "
                f"renderSize scale*{pixel_scale}; renderPosition left+{x+w/2}*scale,top-{y+h/2}*scale; "
                f"renderCostume {field}; renderGhost {ghost}"
                "} else {renderHide()}}\n"
            )
            files[name + ".spx"] = source.encode()
            continue
        animation = ""
        if name != "MenuScene":
            field = "menuFrame" if name == "MenuClothLocal" else "menuWaterFrame"
            animation = f"; renderCostume {field}"
        if name == "MenuLightning":
            source = source[:start] + (
                "func menuPaint() {if menuEntering {setLayer Front}; if phase==0 && menuStormActive {renderShow(); "
                + transform + "; "
                f"renderSize scale; renderPosition left+{x+w/2}*scale,top-{y+h/2}*scale; "
                "renderCostume menuStormFrame; renderGhost menuStormGhost} else {renderHide()}}\n"
            )
            files[name + ".spx"] = source.encode()
            continue
        source = source[:start] + (
            "func menuPaint() {if phase==0 {renderShow(); " + transform + "; "
            f"renderSize scale; renderPosition left+{x+w/2}*scale,top-{y+h/2}*scale"
            + animation + "; if menuEntering {setLayer Front}} else {renderHide()}}\n"
        )
        files[name + ".spx"] = source.encode()

    # The subtle depth tint also covers the extended viewport, avoiding a
    # rectangular grading seam at the former letterbox edge. Cache scale writes.
    _, width, height = image_info("Depth")
    files["Depth.spx"] = (
        "var appliedScale float64\n"
        "onStart => {for {waitNextFrame(); "
        f"scale:=max(1,max((viewWidth+8)/{width},(viewHeight+8)/{height})); "
        "if scale!=appliedScale {appliedScale=scale; setSize scale}; "
        "setXYpos viewCenterX,viewCenterY}}\n"
    ).encode()

    # Expand only renderer visibility margins for tall windows. Pool limits,
    # enemy AI, physics and the logical camera field remain unchanged.
    for name in ("main.spx", "Enemy.spx", "ExpeditionNode.spx"):
        if name not in files:  # retired mechanism sprites are absent in hunt builds
            continue
        source = files[name].decode()
        source = re.sub(
            r"(abs\([^\n;{}]+-cameraY\)[<>])700",
            r"\1max(700,viewHeight/2+200)",
            source,
        )
        files[name] = source.encode()
