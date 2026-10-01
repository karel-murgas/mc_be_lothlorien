"""Mallorn boat, vanilla-style variant: few elements, the pointed ends made of ROTATED planks (no stairs).

  python -B tools/make_mallorn_boat_planks.py [--out DIR]

Built after the owner asked whether the stepped model (make_mallorn_boat.py, kept as the "stepped" variant) follows
the Minecraft style guide (2026-10-01). The guide (`.claude/skills/bedrock-art/references/style.md`): keep the
element count as low as possible, and depict slants and curves by rotating elements, not as stairs. So: a straight
midship (bottom + two side planks), and a bow and a stern section, each a child bone tilted up (the sheer), made of
two side planks turned in to meet at a stem post, a bottom turned 45 degrees, and at the bow a swan neck of three
elements. Same palette, same paddles, same box-UV packer as the stepped model; painted in each cube's LOCAL
coordinates (the cubes are rotated). Writes the same output files as make_mallorn_boat.py.
"""
import argparse
import json
import math
import os
import sys

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import make_mallorn_boat as stepped  # noqa: E402
from make_mallorn_boat import BARK, GOLD, SEAM, PEG, CLEAR, LEAF, TEX_W, face_texels, pack  # noqa: E402

MID = 8          # midship from -MID to +MID
HALF_W = 7       # outer half-width amidships
TIP = 20         # the planks meet at x = +-TIP (before the tilt)
SIDE_H = 7       # side plank height (on a 2-high bottom)
TILT = 16        # sheer: degrees each end section is tilted up (Bedrock: -z rotation lifts +x)
PLANK_LEN = round(math.hypot(TIP - MID, HALF_W))
TURN = round(math.degrees(math.atan2(HALF_W, TIP - MID)))


def end_section(e):
    """Cubes of the bow (e = +1) or stern (e = -1) bone: (kind, origin, size, rotation, pivot)."""
    cubes = []
    for side in (1, -1):
        x0 = MID if e > 0 else -MID - PLANK_LEN
        z0 = HALF_W - 1 if side > 0 else -HALF_W
        cubes.append(("side_end", [x0, 2, z0], [PLANK_LEN, SIDE_H, 1], [0, e * side * TURN, 0],
                      [e * MID, 2, side * HALF_W]))
    a = 10  # bottom: a square turned 45 degrees, its far corner near the stem
    cubes.append(("bottom", [e * MID - a / 2, -0.01, -a / 2], [a, 2, a], [0, 45, 0], [e * MID, 0, 0]))
    stem_x = TIP - 3 if e > 0 else -TIP - 1
    cubes.append(("stem", [stem_x, 0, -1], [4, SIDE_H + 2 + (1 if e < 0 else 0), 2], None, None))
    if e > 0:  # swan neck: a post leaning forward, a head bending back, a hanging gold tip
        cubes.append(("neck", [TIP - 1, SIDE_H + 1, -1], [2, 7, 2], [0, 0, 15], [TIP, SIDE_H + 1, 0]))
        cubes.append(("head", [TIP - 4, SIDE_H + 7, -1], [5, 2, 2], [0, 0, -10], [TIP + 1, SIDE_H + 8, 0]))
        cubes.append(("finial", [TIP - 4, SIDE_H + 5, -1], [2, 2, 2], [0, 0, -10], [TIP + 1, SIDE_H + 8, 0]))
    return cubes


def mid_section():
    return [("bottom", [-MID, 0, -HALF_W], [2 * MID, 2, 2 * HALF_W], None, None),
            ("side", [-MID, 2, HALF_W - 1], [2 * MID, SIDE_H, 1], None, None),
            ("side", [-MID, 2, -HALF_W], [2 * MID, SIDE_H, 1], None, None)]


# ---------------------------------------------------------------- painting (local coordinates)
def leaf(lx, ly, h, at):
    """Gold leaf texel on an outer bow plank (lx along the plank from the tip end), or None."""
    for x0, mirror in at:
        c, r = int(lx - x0), int(h - 2 - ly)  # leaf rows from the top, under the trim
        if 0 <= c < 4 and 0 <= r < 5:
            ch = LEAF[r][c if mirror else 3 - c]
            if ch != ".":
                return {"A": GOLD[2], "B": GOLD[1], "C": GOLD[0], "S": SEAM}[ch]
    return None


def side_face(kind, face, l, size, outward, bow):
    w, h, _ = size
    lx, ly = l[0], l[1]
    r = h - 1 - int(ly)  # row from the top
    if r == 0:
        return GOLD[1] if outward else GOLD[0]
    if outward and kind == "side_end" and bow:
        tip_x = w - lx  # distance from the tip end of the plank
        lf = leaf(tip_x, ly, h, [(3, False), (8, True)])
        if lf:
            return lf
    board = (r - 1) // 3
    row = (r - 1) % 3
    if row == 2 or (int(lx + board * 5) % 11 == 0 and row == 0):
        return PEG if row == 0 else SEAM
    k = (4 if row == 0 else 3) - (0 if outward else 1)
    return BARK[k]


def paint(kind, face, l, size, cube):
    if kind in ("shaft", "rib", "blade"):
        return stepped.paint(kind, face, l)
    lx, ly, lz = l
    w, h, d = size
    if kind in ("side", "side_end"):
        if face == "up":
            return GOLD[3] if int(lx) % 5 == 2 else GOLD[2]
        if face == "down":
            return BARK[1]
        if face in ("east", "west"):
            return BARK[3]
        zc = cube[1][2] + d / 2  # outer face: south on the +z plank, north on the -z plank
        outward = (face == "south") == (zc > 0)
        return side_face(kind, face, l, size, outward, cube[1][0] > 0)
    if kind == "bottom":
        if face == "up":
            col = int(lz) % 3
            return SEAM if col == 0 else BARK[3] if col == 1 else BARK[2]
        if face == "down":
            return BARK[1] if int(lz) % 3 else BARK[0]
        return BARK[2] if ly < 1 else BARK[3]
    if kind == "stem":
        if face == "up":
            return GOLD[2]
        if face == "down":
            return BARK[1]
        if ly >= h - 2:
            return GOLD[1]
        return BARK[4] if face in ("north", "west") else BARK[3]
    if kind == "neck":
        if face in ("up", "down"):
            return BARK[3]
        return BARK[4] if ly < h - 2 else GOLD[1]
    if kind == "head":
        return {"up": GOLD[3], "down": GOLD[0]}.get(face, GOLD[2])
    if kind == "finial":
        return {"up": GOLD[2], "down": GOLD[0]}.get(face, GOLD[1])
    raise ValueError(kind)


# ---------------------------------------------------------------- outputs
def build():
    bones = [("hull", c) for c in mid_section()]
    bones += [("bow", c) for c in end_section(1)] + [("stern", c) for c in end_section(-1)]
    for s in (1, -1):
        bones += [(stepped.paddle_bone(s, HALF_W)["name"], (*c, None, None)) for c in stepped.paddle_cubes(s, HALF_W)]
    cubes = [c for _, c in bones]
    uvs, tex_h = pack([(k, o, s) for k, o, s, _, _ in cubes])
    img = Image.new("RGBA", (TEX_W, tex_h), CLEAR)
    px = img.load()
    for cube, uv in zip(cubes, uvs):
        kind, o, s, _, _ = cube
        for face, tx, ty, p in face_texels(o, s, uv):
            local = (p[0] - o[0], p[1] - o[1], p[2] - o[2])
            px[tx, ty] = (*paint(kind, face, local, s, cube)[:3], 255)
    geo_bones = [
        {"name": "hull", "pivot": [0, 0, 0]},
        {"name": "bow", "parent": "hull", "pivot": [MID, 0, 0], "rotation": [0, 0, -TILT],
         "locators": {"lead": [TIP, SIDE_H, 0]}},
        {"name": "stern", "parent": "hull", "pivot": [-MID, 0, 0], "rotation": [0, 0, TILT]},
        stepped.paddle_bone(1, HALF_W), stepped.paddle_bone(-1, HALF_W),
    ]
    for b in geo_bones:
        b["cubes"] = []
        for (bn, (_, o, s, rot, piv)), uv in zip(bones, uvs):
            if bn == b["name"]:
                c = {"origin": o, "size": s, "uv": list(uv)}
                if rot:
                    c["rotation"], c["pivot"] = rot, piv
                b["cubes"].append(c)
    geo = {
        "format_version": "1.12.0",
        "minecraft:geometry": [{
            "description": {
                "identifier": "geometry.lothlorien.mallorn_boat",
                "texture_width": TEX_W, "texture_height": tex_h,
                "visible_bounds_width": 4, "visible_bounds_height": 2, "visible_bounds_offset": [0, 0.5, 0],
            },
            "bones": geo_bones,
        }],
    }
    return geo, img, len(cubes)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", help="write into this folder instead of the resource pack")
    a = ap.parse_args()
    geo, tex, n = build()
    out = a.out or None
    if out:
        os.makedirs(out, exist_ok=True)
        paths = [os.path.join(out, f) for f in ("mallorn_boat.geo.json", "mallorn_boat.png")]
    else:
        paths = [os.path.join(stepped.RP, "models", "entity", "mallorn_boat.geo.json"),
                 os.path.join(stepped.RP, "textures", "entity", "mallorn_boat.png")]
    with open(paths[0], "w", encoding="utf-8", newline="\n") as f:
        json.dump(geo, f, indent=1)
        f.write("\n")
    tex.save(paths[1])
    print(f"{n} cubes, texture {tex.size[0]}x{tex.size[1]} ->", os.path.dirname(paths[0]))


if __name__ == "__main__":
    main()
