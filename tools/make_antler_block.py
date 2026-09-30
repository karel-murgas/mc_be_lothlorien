"""Generates the placeable deer antler: two block geometries (floor shed, wall trophy) and the 16x16 texture.

    python -B mods/lothlorien/tools/make_antler_block.py

Output (overwritten every run): lothlorien_rp/models/blocks/deer_antler_{floor,wall}.geo.json and
lothlorien_rp/textures/blocks/deer_antler.png.

Geometry uses per-face UV strips of one small palette-like texture (left to right: bone shadow -> light,
wood shadow -> light), so no box-UV layout is needed. Antlers are built from axis-aligned cubes (stepped
slants) on purpose: the sign of block-geometry rotations under the mirrored-x rule is unverified, and a
pair that leans the wrong way would cross over the skull. Wall model: back at +z (north-facing state),
front toward -z, like the stairs (see bedrock-block-families/references/families.md).
"""
import json
from pathlib import Path
from PIL import Image

RP = Path(__file__).resolve().parents[1] / "lothlorien_rp"


def hexc(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4)) + (255,)


BONE = [hexc(c) for c in ("#6e5a3e", "#9a8459", "#c4ae80", "#e0cfa4")]   # columns 0-3
WOOD = [hexc(c) for c in ("#4a3422", "#6b4a30", "#8c6640", "#a8814f")]   # columns 4-7
COL = {"bone": 0, "wood": 4}


def texture():
    img = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
    for x in range(8):
        pal = BONE if x < 4 else WOOD
        for y in range(16):
            c = pal[x % 4]
            if y % 6 == 5:  # faint growth rings / grain lines
                c = pal[max(0, x % 4 - 1)]
            img.putpixel((x, y), c)
    for x in range(8, 16):  # spare columns: plain dark, never referenced
        for y in range(16):
            img.putpixel((x, y), BONE[0])
    return img


def cube(origin, size, mat):
    """Cube with per-face UV strips: top lightest, sides mid, bottom darkest."""
    base = COL[mat]
    strip = lambda shade, h: {"uv": [base + shade, 0], "uv_size": [1, max(1, min(16, round(h)))]}
    w, h, d = size
    return {
        "origin": origin, "size": size,
        "uv": {
            "up": strip(3, d), "down": strip(0, d),
            "north": strip(2, h), "south": strip(1, h),
            "east": strip(2, h), "west": strip(1, h),
        },
    }


def geo(ident, cubes):
    return {
        "format_version": "1.12.0",
        "minecraft:geometry": [{
            "description": {"identifier": ident, "texture_width": 16, "texture_height": 16,
                            "visible_bounds_width": 2, "visible_bounds_height": 2, "visible_bounds_offset": [0, 0.5, 0]},
            "bones": [{"name": "antler", "pivot": [0, 0, 0], "cubes": cubes}],
        }],
    }


def floor_cubes():
    c = []
    c.append(cube([-1.75, 0, 4.5], [3.5, 2.5, 2.5], "bone"))            # burr where it fell off the skull
    c.append(cube([-0.75, 0.25, -6.5], [1.5, 1.75, 11.5], "bone"))      # main beam
    c.append(cube([-0.6, 2.0, -5.5], [1.2, 2.5, 1.2], "bone"))          # tines pointing up
    c.append(cube([-0.6, 2.0, -2.0], [1.2, 3.5, 1.2], "bone"))
    c.append(cube([-0.6, 2.0, 1.5], [1.2, 2.5, 1.2], "bone"))
    c.append(cube([0.75, 0.6, -3.5], [2.5, 1.2, 1.2], "bone"))          # one side tine
    return c


def wall_cubes():
    c = []
    c.append(cube([-3.5, 3.5, 6.0], [7, 8, 2], "wood"))                 # plaque on the wall
    c.append(cube([-2.25, 5.0, 4.0], [4.5, 5, 2.25], "bone"))           # skull cap
    for s in (1, -1):
        for i in range(4):                                              # beam: stepped slant, outward
            cx = s * (1.0 + 0.9 * i)
            c.append(cube([cx - 0.6, 9.6 + 1.35 * i, 4.6], [1.2, 2.0, 1.2], "bone"))
        c.append(cube([s * 1.6 - 0.6, 9.8, 2.2], [1.2, 1.2, 2.6], "bone"))   # brow tine, forward
        c.append(cube([s * 2.8 - 0.6, 12.3, 2.6], [1.2, 1.2, 2.4], "bone"))  # upper tine, forward
    return c


def main():
    (RP / "models/blocks").mkdir(parents=True, exist_ok=True)
    for name, cubes in (("floor", floor_cubes()), ("wall", wall_cubes())):
        ident = f"geometry.lothlorien.deer_antler_{name}"
        (RP / f"models/blocks/deer_antler_{name}.geo.json").write_text(json.dumps(geo(ident, cubes), indent=2) + "\n")
    texture().save(RP / "textures/blocks/deer_antler.png")
    print("antler block art written")


if __name__ == "__main__":
    main()
