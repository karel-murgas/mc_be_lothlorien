"""Gate variants sheet: each variant closed and open, between two Mallorn fence posts, rendered in Blockbench.
Uses the pack generators (tools/make_mallorn_gate.py, make_mallorn_fence.py) and the pack's post textures.

  python -B temp/mallorn_wood/gate/design_gate.py [round_tag] [variants] [textures]
"""
import json
import os
import subprocess
import sys

from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
WS = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
MOD = os.path.join(WS, "mods", "lothlorien")
sys.path.insert(0, os.path.join(MOD, "tools"))
import make_mallorn_fence as fence  # noqa: E402
import make_mallorn_gate as gate  # noqa: E402

TEX = {"silver": os.path.join(MOD, "lothlorien_rp", "textures", "blocks", "mallorn_fence_post.png"),
       "heartwood": os.path.join(MOD, "lothlorien_rp", "textures", "blocks", "mallorn_heartwood_fence_post.png")}
RENDER = os.path.join(WS, ".claude", "skills", "bedrock-art", "scripts", "bb_render.py")


def shift(cubes, dx, dz=0):
    out = []
    for c in cubes:
        c = json.loads(json.dumps(c))
        c["origin"][0] += dx
        c["origin"][2] += dz
        if "pivot" in c:
            c["pivot"][0] += dx
            c["pivot"][2] += dz
        out.append(c)
    return out


def fence_block(sides):
    cs = fence.post_cubes()
    for s in sides:
        cs += [fence.turn(c, fence.SIDES[s]) for c in fence.north_rails()]
    return cs


def scene(variant, state):
    closed, opn = gate.geometries(variant)
    g = (closed if state == "closed" else opn)["minecraft:geometry"][0]
    cubes = [c for b in g["bones"] for c in b["cubes"]]
    # geo +x = world west: fence west of the gate at geo +16, east of it at geo -16
    cubes += shift(fence_block(["east_rails", "west_rails"]), 16) + shift(fence_block(["west_rails", "east_rails"]), -16)
    return {"format_version": "1.26.50", "minecraft:geometry": [{
        "description": {"identifier": "geometry.design.gate", "texture_width": 16, "texture_height": 16},
        "bones": [{"name": "scene", "pivot": [0, 0, 0], "cubes": cubes}]}]}


def render(geo_path, tex, out, views, dist, look=None):
    cmd = [sys.executable, "-B", RENDER, geo_path, tex, out, "--views", views, "--dist", str(dist), "--size", "520"]
    if look:
        cmd += ["--look", look]
    subprocess.run(cmd, check=True, capture_output=True)


def main():
    tag = sys.argv[1] if len(sys.argv) > 1 else "r1"
    variants = sys.argv[2].split(",") if len(sys.argv) > 2 else ["A", "B", "C"]
    textures = sys.argv[3].split(",") if len(sys.argv) > 3 else ["silver"]
    rows = []
    for tname in textures:
        for v in variants:
            shots = []
            for state in ("closed", "open"):
                geo = os.path.join(HERE, f"{tag}_{v}_{state}_{tname}.geo.json")
                with open(geo, "w") as f:
                    json.dump(scene(v, state), f)
                out = os.path.join(HERE, f"{tag}_{v}_{state}_{tname}")
                render(geo, TEX[tname], out, "front_left,back_right", 62, "0,10,0")
                shots += [os.path.join(out, "front_left.png"), os.path.join(out, "back_right.png")]
            # the icon: the closed gate alone from the inventory pose
            closed, _ = gate.geometries(v)
            geo = os.path.join(HERE, f"{tag}_{v}_icon_{tname}.geo.json")
            with open(geo, "w") as f:
                json.dump(closed, f)
            out = os.path.join(HERE, f"{tag}_{v}_icon_{tname}")
            render(geo, TEX[tname], out, "gui135,front", 34)
            shots += [os.path.join(out, "gui135.png"), os.path.join(out, "front.png")]
            rows.append((f"{v} ({tname})", shots))
    w, h = 520, 520
    labels = ["closed", "closed, back", "open", "open, back", "icon pose", "gate front"]
    sheet = Image.new("RGB", (w * 6, (h + 30) * len(rows) + 30), (236, 236, 236))
    d = ImageDraw.Draw(sheet)
    for i, lab in enumerate(labels):
        d.text((i * w + 10, 8), lab, fill=(0, 0, 0))
    for r, (name, shots) in enumerate(rows):
        y = 30 + r * (h + 30)
        d.text((10, y + 6), name, fill=(0, 0, 0))
        for i, p in enumerate(shots):
            sheet.paste(Image.open(p).convert("RGB").resize((w, h)), (i * w, y + 24))
    path = os.path.join(HERE, f"gate_{tag}.png")
    sheet.save(path)
    print(path)


if __name__ == "__main__":
    main()
