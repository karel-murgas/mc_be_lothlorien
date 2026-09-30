"""Generates the placeable deer antler block: one pair of big mounted antlers, hung on a wall, lying on the floor or hanging from a ceiling.

    python -B mods/lothlorien/tools/make_antler_block.py

Output (overwritten every run): lothlorien_rp/models/blocks/deer_antler_{wall,floor,ceiling}.geo.json and
lothlorien_rp/textures/blocks/deer_antler.png.

The wall model is authored once (back against the wall at +z, tips up, width filling the 16-unit block). The floor
model is the SAME cube list turned onto its back by coordinates (skull on the floor, tips pointing to -z), so both
placements show one model. It is a coordinate swap, not a block transformation: the sign of block rotations under the
mirrored-x rule is unverified, and the pair is symmetric in x so the swap's mirroring is invisible.

Geometry uses per-face UV strips of one small palette-like texture (left to right: bone shadow -> light,
wood shadow -> light), so no box-UV layout is needed. Slants are stepped cubes on purpose.
"""
import json
from pathlib import Path
from PIL import Image

RP = Path(__file__).resolve().parents[1] / "lothlorien_rp"


def hexc(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4)) + (255,)


BONE = [hexc(c) for c in ("#6e5a3e", "#9a8459", "#c4ae80", "#e0cfa4")]   # columns 0-3
WOOD = [hexc(c) for c in ("#4a3422", "#6b4a30", "#8c6640", "#a8814f")]   # columns 4-7 (spare)


def texture():
    img = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
    for x in range(16):
        pal = BONE if x < 4 else WOOD
        for y in range(16):
            c = pal[x % 4]
            if x < 4 and y % 6 == 5:  # faint growth rings
                c = pal[max(0, x % 4 - 1)]
            img.putpixel((x, y), c)
    return img


# Wall layout in block coordinates (x -8..8, y 0..16, z -8..8; wall behind at z = +8, tips up).
# A cube is (x, y, z, sx, sy, sz).
def wall_layout():
    cubes = [
        (-2.0, 1.5, 5.0, 4.0, 5.0, 3.0),   # skull against the wall
        (-2.0, 6.0, 4.6, 4.0, 1.0, 3.4),   # brow ridge
        (-1.0, 0.5, 5.6, 2.0, 1.2, 2.4),   # muzzle tip under the skull
    ]
    for s in (1, -1):
        def add(cx, y, z, sx, sy, sz):
            x = cx if s == 1 else -cx - sx
            cubes.append((x, y, z, sx, sy, sz))
        for i in range(7):                                      # main beam: stepped slant, outward and up
            add(1.6 + 0.8 * i, 6.5 + 1.25 * i, 6.4, 1.6, 2.0, 1.6)
        add(1.0, 7.4, 4.0, 1.4, 1.4, 2.6)                       # brow tine, forward
        add(2.8, 9.6, 4.2, 1.4, 1.4, 2.4)                       # bez tine, forward
        for cx, y, h in ((3.3, 9.6, 4.6), (4.9, 11.4, 3.9), (6.4, 13.2, 2.8)):  # upright crown tines
            add(cx, y, 6.4, 1.3, h, 1.6)
        add(3.6, 8.3, 6.4, 2.4, 1.3, 1.6)                       # side tine
    return cubes


def to_floor(cubes):
    """Lay the wall model on its back: wall y (up) -> floor -z (forward), wall z (depth) -> floor y (height)."""
    out = []
    for x, y, z, sx, sy, sz in cubes:
        out.append((x, 8.0 - (z + sz), 8.0 - (y + sy) , sx, sz, sy))
    return [(x, y, z, sx, sy, sz) for x, y, z, sx, sy, sz in out]


def to_ceiling(floor_cubes):
    """The floor model flipped upside down, hanging from the ceiling (skull against it, tips still pointing to -z)."""
    return [(x, 16.0 - (y + sy), z, sx, sy, sz) for x, y, z, sx, sy, sz in floor_cubes]


def clamp(cubes):
    """Keep every cube inside the block (-8..8, 0..16): a block geometry outside it is cut off."""
    out = []
    for x, y, z, sx, sy, sz in cubes:
        x0, x1 = max(-8.0, x), min(8.0, x + sx)
        y0, y1 = max(0.0, y), min(16.0, y + sy)
        z0, z1 = max(-8.0, z), min(8.0, z + sz)
        out.append((x0, y0, z0, x1 - x0, y1 - y0, z1 - z0))
    return out


def cube(c):
    x, y, z, sx, sy, sz = c
    strip = lambda shade, h: {"uv": [shade, 0], "uv_size": [1, max(1, min(16, round(h)))]}
    return {
        "origin": [round(x, 3), round(y, 3), round(z, 3)], "size": [round(sx, 3), round(sy, 3), round(sz, 3)],
        "uv": {
            "up": strip(3, sz), "down": strip(0, sz),
            "north": strip(2, sy), "south": strip(1, sy),
            "east": strip(2, sy), "west": strip(1, sy),
        },
    }


def geo(ident, cubes):
    return {
        "format_version": "1.12.0",
        "minecraft:geometry": [{
            "description": {"identifier": ident, "texture_width": 16, "texture_height": 16,
                            "visible_bounds_width": 2, "visible_bounds_height": 2, "visible_bounds_offset": [0, 0.5, 0]},
            "bones": [{"name": "antler", "pivot": [0, 0, 0], "cubes": [cube(c) for c in cubes]}],
        }],
    }


def bounds(cubes):
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
            json.dumps(geo(f"geometry.lothlorien.deer_antler_{name}", cubes), indent=2) + "\n")
        lo, hi = bounds(cubes)
        print(name, "bounds", [round(v, 2) for v in lo], [round(v, 2) for v in hi])
    texture().save(RP / "textures/blocks/deer_antler.png")
    print("antler block art written")


if __name__ == "__main__":
    main()
