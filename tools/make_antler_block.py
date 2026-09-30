"""Generates the placeable deer antler block: one pair of big mounted antlers, hung on a wall, lying on the floor or hanging from a ceiling.

    python -B mods/lothlorien/tools/make_antler_block.py

Output (overwritten every run): lothlorien_rp/models/blocks/deer_antler_{wall,floor,ceiling}.geo.json and
lothlorien_rp/textures/blocks/deer_antler.png.

The wall model is authored once (back against the wall at +z, tips up, width filling the 16-unit block). The floor
model is the SAME cube list turned onto its back by coordinates (skull on the floor, tips pointing to -z), so both
placements show one model. It is a coordinate swap, not a block transformation: the sign of block rotations under the
mirrored-x rule is unverified, and the pair is symmetric in x so the swap's mirroring is invisible.

Geometry uses per-face UV strips of one small palette-like texture, so no box-UV layout is needed. Slants are stepped
cubes on purpose. Texture: four column groups (antler, skull, muzzle, burr), each four columns wide = four face shades
(down, south/west, north/east, up). Rows are a length ramp for the antler: row 0 ivory tip ... row 15 red-brown near the
skull. Each cube samples the rows that match its height on the WALL model (tips up), so the floor and ceiling models,
made from the same cubes, keep the colour where it belongs.
"""
import json
from pathlib import Path
from PIL import Image

RP = Path(__file__).resolve().parents[1] / "lothlorien_rp"


def hexc(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4)) + (255,)


def mix(c1, c2, t):
    return tuple(round(a + (b - a) * t) for a, b in zip(c1[:3], c2[:3])) + (255,)


def ramp(keys, n=16):
    """n colours through (row, hex) keys."""
    out = []
    for r in range(n):
        for (r0, c0), (r1, c1) in zip(keys, keys[1:]):
            if r0 <= r <= r1:
                out.append(mix(hexc(c0), hexc(c1), (r - r0) / (r1 - r0)))
                break
    return out


# Row ramps (0 = top of a face / tip end). Shadows shift warm, lights shift towards cream.
ANTLER = ramp([(0, "#f6eed8"), (3, "#e4d2a6"), (7, "#c3a06c"), (11, "#9a714a"), (15, "#6e4a32")])
BURR = ramp([(0, "#8a6444"), (15, "#5a3c28")])
GROUPS = {"antler": 0, "burr": 4}  # strip groups; columns 8-15 hold the painted skull (SKULL_ART)

# The skull is painted, not striped: a strip is one texel wide and stretched over the face, so a big flat face
# shows one flat colour (seen in Blockbench 2026-09-30). Skull faces are mapped 1 texel = 1 unit onto these
# regions. Bone ramp with warm shadows; light from the top-left (top faces brightest, then front, then sides).
BONE = {"H": "#f6f0de", "L": "#e8dec3", "M": "#d4c5a2", "S": "#b39f7b", "D": "#8c775a",
        "e": "#6a5340", "E": "#3b2b22", "X": "#6e5c46"}
SKULL_ART = {  # name: (x, y, rows); rows are top-to-bottom as seen from outside the face
    "cranium_front": (8, 0, ["MHHHM",
                             "LLHLL",
                             "EMLME",
                             "eSMSe"]),
    "cranium_top": (8, 4, ["HHLHH",     # front edge first
                           "HLSLH",     # centre seam between the frontal bones
                           "LLSLL",
                           "MLSLM"]),
    "cranium_side": (8, 8, ["MLLH",     # east view: front on the right (west mirrors it)
                            "SMLL",
                            "SMeE",
                            "DSSe"]),
    "cranium_down": (8, 12, ["SSSSS",
                             "DSSSD",
                             "DDSDD",
                             "DDDDD"]),
    "nasal_front": (13, 0, ["LHL",      # paired nasal bones with a lit centre ridge
                            "MHM",
                            "SLS"]),
    "nasal_side": (13, 3, ["SMM",
                           "SML",
                           "DSM"]),
    "nasal_down": (13, 6, ["SSS",
                           "SDS",
                           "DDD"]),
    "hidden": (13, 9, ["XXX",           # faces against the wall / inside
                       "XXX",
                       "XXX"]),
}
# wall-model face -> region; "-" mirrors horizontally (negative uv width)
SKULL_FACES = {
    "cranium": {"north": "cranium_front", "up": "cranium_top", "east": "cranium_side", "west": "-cranium_side",
                "down": "cranium_down", "south": "hidden"},
    "nasal": {"north": "nasal_front", "up": "hidden", "east": "nasal_side", "west": "-nasal_side",
              "down": "nasal_down", "south": "hidden"},
}
SHADE = [(0.62, "#3a2418"), (0.82, "#4a2c1c"), (1.0, None), (1.1, "#fff6dc")]  # down, south/west, north/east, up


def shade(c, k):
    f, tint = SHADE[k]
    base = tuple(min(255, round(v * f)) for v in c[:3]) + (255,)
    return mix(base, hexc(tint), 0.12) if tint else base


def texture():
    img = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
    for group, col in GROUPS.items():
        rows = {"antler": ANTLER, "burr": BURR}[group]
        for k in range(4):
            for y in range(16):
                c = shade(rows[y], k)
                if group == "antler" and y >= 6 and (y * 3 + k) % 5 == 0:   # pearling: small dark grooves on the beam
                    c = mix(c, hexc("#4a3020"), 0.25)
                if group == "burr" and (y + k) % 2 == 0:                     # knobbly coronet
                    c = mix(c, hexc("#b08a5e"), 0.45)
                img.putpixel((col + k, y), c)
    for x0, y0, rows in SKULL_ART.values():
        for j, row in enumerate(rows):
            for i, ch in enumerate(row):
                img.putpixel((x0 + i, y0 + j), hexc(BONE[ch]))
    return img


# Wall layout in block coordinates (x -8..8, y 0..16, z -8..8; wall behind at z = +8, tips up).
# A cube is (x, y, z, sx, sy, sz).
def wall_layout():
    cubes = [
        (-2.5, 3.0, 4.0, 5.0, 4.0, 4.0, "cranium"),  # frontal plate; the antlers grow from its top corners
        (-1.5, 0.0, 5.0, 3.0, 3.0, 3.0, "nasal"),    # narrower snout below it
    ]
    for s in (1, -1):
        def add(cx, y, z, sx, sy, sz, part="antler"):
            x = cx if s == 1 else -cx - sx
            cubes.append((x, y, z, sx, sy, sz, part))
        for i in range(7):                                      # main beam: stepped slant, outward and up
            add(1.6 + 0.8 * i, 6.5 + 1.25 * i, 6.4, 1.6, 2.0, 1.6, "burr" if i == 0 else "antler")
        add(1.0, 7.4, 4.0, 1.4, 1.4, 2.6)                       # brow tine, forward
        add(2.8, 9.6, 4.2, 1.4, 1.4, 2.4)                       # bez tine, forward
        for cx, y, h in ((3.3, 9.6, 4.6), (4.9, 11.4, 3.9), (6.4, 13.2, 2.8)):  # upright crown tines
            add(cx, y, 6.4, 1.3, h, 1.6)
        add(3.6, 8.3, 6.4, 2.4, 1.3, 1.6)                       # side tine
    # tag each cube with the texture row its top samples: from its height on this wall model (tips up)
    return [c[:6] + (c[6], row_for(c[1] + c[4])) for c in cubes]


def row_for(top):
    """Wall-model height of a cube's top -> first texture row: the tips (y 16) are row 0, the beam base (y 6.5) row 15."""
    return max(0, min(15, round((16.0 - top) / 9.5 * 15)))


def to_floor(cubes):
    """Lay the wall model on its back: wall y (up) -> floor -z (forward), wall z (depth) -> floor y (height)."""
    out = []
    for x, y, z, sx, sy, sz, *tag in cubes:
        out.append((x, 8.0 - (z + sz), 8.0 - (y + sy), sx, sz, sy, *tag))
    return out


def to_ceiling(floor_cubes):
    """The floor model flipped upside down, hanging from the ceiling (skull against it, tips still pointing to -z)."""
    return [(x, 16.0 - (y + sy), z, sx, sy, sz, *tag) for x, y, z, sx, sy, sz, *tag in floor_cubes]


def clamp(cubes):
    """Keep every cube inside the block (-8..8, 0..16): a block geometry outside it is cut off."""
    out = []
    for x, y, z, sx, sy, sz, *tag in cubes:
        x0, x1 = max(-8.0, x), min(8.0, x + sx)
        y0, y1 = max(0.0, y), min(16.0, y + sy)
        z0, z1 = max(-8.0, z), min(8.0, z + sz)
        out.append((x0, y0, z0, x1 - x0, y1 - y0, z1 - z0, *tag))
    return out


# (mirror h, mirror v, uv_rotation) for the skull side faces on the turned-over models; found by rendering all
# four sides in Blockbench (tools/bb_render.py): the eye socket must sit at the skull front, next to the snout.
EAST_FLOOR, WEST_FLOOR = (True, False, 90), (False, True, 90)
EAST_CEIL, WEST_CEIL = (False, False, 90), (True, True, 90)


# Which WALL-model face ends up on each face of the floor and ceiling models (they are the wall cubes turned over),
# so painted skull faces follow the skull: on the floor the skull lies on its back, front facing up. Each entry is
# (wall face, mirror horizontally, mirror vertically, uv_rotation). The turn-over is a coordinate swap, i.e. a
# mirror, so some faces need a flip AND a rotation; the values were checked by rendering in Blockbench.
FACE_FROM_WALL = {
    "wall": {f: (f, False, False, 0) for f in ("up", "down", "north", "south", "east", "west")},
    "floor": {"up": ("north", False, True, 0), "north": ("up", False, False, 0), "down": ("south", False, False, 0),
              "south": ("down", False, False, 0), "east": ("east", *EAST_FLOOR), "west": ("west", *WEST_FLOOR)},
    "ceiling": {"down": ("north", False, False, 0), "north": ("up", False, False, 0), "up": ("south", False, False, 0),
                "south": ("down", False, False, 0), "east": ("east", *EAST_CEIL), "west": ("west", *WEST_CEIL)},
}


def painted(region, flip_h=False, flip_v=False, rot=0):
    if region.startswith("-"):
        region, flip_h = region[1:], not flip_h
    x0, y0, rows = SKULL_ART[region]
    w, h = len(rows[0]), len(rows)
    out = {"uv": [x0 + w if flip_h else x0, y0 + h if flip_v else y0], "uv_size": [-w if flip_h else w, -h if flip_v else h]}
    if rot:
        out["uv_rotation"] = rot
    return out


def cube(c, model):
    x, y, z, sx, sy, sz, part, row = c
    out = {"origin": [round(x, 3), round(y, 3), round(z, 3)], "size": [round(sx, 3), round(sy, 3), round(sz, 3)]}
    if part in SKULL_FACES:
        out["uv"] = {face: painted(SKULL_FACES[part][wf], fh, fv, rot)
                     for face, (wf, fh, fv, rot) in FACE_FROM_WALL[model].items()}
        return out
    col = GROUPS[part]

    def strip(k, h):
        h = max(1, min(16, round(h)))
        return {"uv": [col + k, min(row, 16 - h)], "uv_size": [1, h]}
    out["uv"] = {
        "up": strip(3, sz), "down": strip(0, sz),
        "north": strip(2, sy), "south": strip(1, sy),
        "east": strip(2, sy), "west": strip(1, sy),
    }
    return out


def geo(ident, cubes, model):
    return {
        "format_version": "1.21.0",  # per-face uv_rotation (Blockbench writes 1.21.0 for it)
        "minecraft:geometry": [{
            "description": {"identifier": ident, "texture_width": 16, "texture_height": 16,
                            "visible_bounds_width": 2, "visible_bounds_height": 2, "visible_bounds_offset": [0, 0.5, 0]},
            "bones": [{"name": "antler", "pivot": [0, 0, 0], "cubes": [cube(c, model) for c in cubes]}],
        }],
    }


def bounds(cubes):
    cubes = [c[:6] for c in cubes]
    xs = [c[0] for c in cubes] + [c[0] + c[3] for c in cubes]
    ys = [c[1] for c in cubes] + [c[1] + c[4] for c in cubes]
    zs = [c[2] for c in cubes] + [c[2] + c[5] for c in cubes]
    return (min(xs), min(ys), min(zs)), (max(xs), max(ys), max(zs))


def main():
    (RP / "models/blocks").mkdir(parents=True, exist_ok=True)
    wall = clamp(wall_layout())
    floor = clamp(to_floor(wall_layout()))
    ceiling = clamp(to_ceiling(to_floor(wall_layout())))
    for name, cubes in (("wall", wall), ("floor", floor), ("ceiling", ceiling)):
        (RP / f"models/blocks/deer_antler_{name}.geo.json").write_text(
            json.dumps(geo(f"geometry.lothlorien.deer_antler_{name}", cubes, name), indent=2) + "\n")
        lo, hi = bounds(cubes)
        print(name, "bounds", [round(v, 2) for v in lo], [round(v, 2) for v in hi])
    texture().save(RP / "textures/blocks/deer_antler.png")
    print("antler block art written")


if __name__ == "__main__":
    main()
