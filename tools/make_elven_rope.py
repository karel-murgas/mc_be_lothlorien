"""Generates the Elven rope (hithlain, Phase 17b): the wall-hung block model + texture and the item icon.

    python -B mods/lothlorien/tools/make_elven_rope.py

Output (overwritten every run): lothlorien_rp/models/blocks/elven_rope.geo.json,
lothlorien_rp/textures/blocks/elven_rope.png, lothlorien_rp/textures/items/elven_rope.png.

Model: a two-strand rope 2 units thick hanging flat against the wall (back at +z, like the antler wall model; the block
permutations turn it for the other three walls), with one knot in the middle of each block. The rope is dark grey with a cool shadow
and a slightly warm highlight; the twist shows as alternating light/dark strands.
Texture regions (16x16): strand front 0-1 x 0-15, strand side 2-3 x 0-15, knot front 4-7 x 0-3, knot side 8-11 x 0-3,
knot top 4-7 x 4-7, strand end 12-13 x 0-1, knot bottom 8-11 x 4-7.
"""
import json
from pathlib import Path
from PIL import Image

RP = Path(__file__).resolve().parents[1] / "lothlorien_rp"

HI, LI, MID, SHADE, DEEP = ("#a4a6ae", "#82848c", "#62646c", "#46484f", "#2d2f35")
OUTLINE = "#494d57"
DEW = "#e4f4fc"


def hexc(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4)) + (255,)


def paint_block():
    img = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
    put = lambda x, y, c: img.putpixel((x, y), hexc(c))
    # strand front: two twisted strands, the light one swaps sides every 2 rows
    for y in range(16):
        light_left = (y // 2) % 2 == 0
        put(0, y, HI if light_left else MID)
        put(1, y, MID if light_left else LI)
        if y % 2 == 1:  # the dark groove where the strands cross
            put(0 if light_left else 1, y, LI if light_left else SHADE)
    # strand side: in shadow
    for y in range(16):
        put(2, y, SHADE if (y // 2) % 2 == 0 else MID)
        put(3, y, DEEP if (y // 2) % 2 == 0 else SHADE)
    # knot front 4x4: lit top row, shaded bottom row, a cord line across the middle
    for x in range(4):
        put(4 + x, 0, HI if x < 3 else LI)
        put(4 + x, 1, LI if x % 2 == 0 else MID)
        put(4 + x, 2, MID if x % 2 == 0 else SHADE)
        put(4 + x, 3, SHADE if x < 3 else DEEP)
    # knot side 4x4 (depth 4): darker
    for x in range(4):
        put(8 + x, 0, LI if x == 0 else MID)
        put(8 + x, 1, MID if x % 2 == 0 else SHADE)
        put(8 + x, 2, SHADE if x % 2 == 0 else MID)
        put(8 + x, 3, SHADE if x < 3 else DEEP)
    # knot top 4x4: brightest, lit from the top-left
    for y in range(4):
        for x in range(4):
            put(4 + x, 4 + y, HI if x + y < 2 else LI if x + y < 5 else MID)
    # strand end 2x2 and knot bottom 4x4: unseen mostly, dark
    for y in range(2):
        for x in range(2):
            put(12 + x, y, SHADE)
    for y in range(4):
        for x in range(4):
            put(8 + x, 4 + y, DEEP if (x + y) % 2 == 0 else SHADE)
    return img


def face(uv, size):
    return {"uv": list(uv), "uv_size": list(size)}


def cube(origin, size, strand):
    ox, oy, oz = origin
    sx, sy, sz = size
    if strand:
        f = {"north": face((0, 0), (2, 16)), "south": face((0, 0), (2, 16)),
             "east": face((2, 0), (2, 16)), "west": face((2, 0), (2, 16)),
             "up": face((12, 0), (2, 2)), "down": face((12, 0), (2, 2))}
    else:
        f = {"north": face((4, 0), (4, 4)), "south": face((4, 0), (4, 4)),
             "east": face((8, 0), (4, 4)), "west": face((8, 0), (4, 4)),
             "up": face((4, 4), (4, 4)), "down": face((8, 4), (4, 4))}
    return {"origin": [ox, oy, oz], "size": [sx, sy, sz], "uv": f}


def geometry():
    # Block coordinates: x -8..8 (mirrored by the engine; the rope is symmetric), y 0..16, the wall at z = 8.
    cubes = [cube((-1, 0, 6), (2, 16, 2), True)]
    cubes.append(cube((-2, 6, 4), (4, 4, 4), False))  # one knot per block, mid-height
    return {
        "format_version": "1.21.0",
        "minecraft:geometry": [{
            "description": {"identifier": "geometry.lothlorien.elven_rope", "texture_width": 16, "texture_height": 16,
                            "visible_bounds_width": 2, "visible_bounds_height": 2, "visible_bounds_offset": [0, 0.5, 0]},
            "bones": [{"name": "rope", "pivot": [0, 0, 0], "cubes": cubes}],
        }],
    }


# Icon ramp: the block's greys widened to 7 values, cool in the shadows and a little warm in the highlight
ICON_RAMP = ["#4f5360", "#343647", "#4b4f5f", "#656a77", "#858a93", "#a9aeb0", "#d3d5cf"]
ICON_LIGHT = (-0.7071, -0.7071)  # towards the top-left


def rope_stroke(px, path, width=2.0, dark=0.0, lay=3.2):
    """Paints one outlined rope along `path` (points in pixel units) over what `px` holds ((x, y) -> ramp index or "o"
    for outline), so a stroke painted later lies on top with a dark edge. Tube shading: lit on the shoulder towards
    ICON_LIGHT; a diagonal groove every `lay` pixels shows the twist."""
    import math
    arc = [0.0]
    for a, b in zip(path, path[1:]):
        arc.append(arc[-1] + math.dist(a, b))
    fill, edge = {}, set()
    for y in range(16):
        for x in range(16):
            c = (x + 0.5, y + 0.5)
            i = min(range(len(path)), key=lambda k: (path[k][0] - c[0]) ** 2 + (path[k][1] - c[1]) ** 2)
            d = math.dist(c, path[i])
            if d <= width / 2:
                tx = path[min(i + 1, len(path) - 1)][0] - path[max(i - 1, 0)][0]
                ty = path[min(i + 1, len(path) - 1)][1] - path[max(i - 1, 0)][1]
                tl = math.hypot(tx, ty) or 1
                nx, ny = -ty / tl, tx / tl
                s = (c[0] - path[i][0]) * nx + (c[1] - path[i][1]) * ny  # offset across the rope
                v = 0.72 + 0.32 * (s / (width / 2)) * (nx * ICON_LIGHT[0] + ny * ICON_LIGHT[1]) - dark
                if (arc[i] + s * 1.2) % lay < 0.85:
                    v -= 0.2
                fill[(x, y)] = max(0, min(len(ICON_RAMP) - 1, int(v * len(ICON_RAMP))))
            elif d <= width / 2 + 0.6:
                edge.add((x, y))
    for pos in edge:
        px[pos] = "o"
    px.update(fill)


def paint_icon():
    """A short working length with an overhand knot, echoing the placed block's knot."""
    def bezier(pts, n=120):
        out = []
        for i in range(n + 1):
            q = list(pts)
            while len(q) > 1:
                q = [(a[0] + (b[0] - a[0]) * i / n, a[1] + (b[1] - a[1]) * i / n) for a, b in zip(q, q[1:])]
            out.append(q[0])
        return out

    px = {}
    rope_stroke(px, bezier([(5, 1), (5, 4), (4, 6), (6, 8)]), width=2.2)
    rope_stroke(px, bezier([(6, 8), (9, 11), (12, 8), (10, 6)]), width=2.2)
    rope_stroke(px, bezier([(10, 6), (7, 4), (4, 6), (7, 9)]), width=2.2)
    rope_stroke(px, bezier([(7, 9), (8, 11), (9, 13), (9, 15)]), width=2.2)
    px[(5, 2)] = "dew"
    img = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
    for pos, c in px.items():
        img.putpixel(pos, hexc(OUTLINE if c == "o" else DEW if c == "dew" else ICON_RAMP[c]))
    return img


def main():
    (RP / "models/blocks").mkdir(parents=True, exist_ok=True)
    (RP / "models/blocks/elven_rope.geo.json").write_text(json.dumps(geometry(), indent=2) + "\n")
    paint_block().save(RP / "textures/blocks/elven_rope.png")
    paint_icon().save(RP / "textures/items/elven_rope.png")
    print("elven rope: geometry, block texture, item icon written")


if __name__ == "__main__":
    main()
