"""Fence concept v3 (owner's notes on v2, 2026-10-01):
- both rails as inverted V (v2 version 1);
- leaves PAINTED on the post (no leaf boxes): one per side, neighbouring sides at different heights;
  gold on the silver fence, silver on the golden (heartwood) fence -> the colour map swaps gold and silver;
- small posts keep the small diamond cap; end/corner posts get a slim pointed spire with a gold tip.
Renders the silver and the heartwood fence."""
import json
import math
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import design_fence as v1  # noqa: E402
from design_fence import cube, seg, _turn  # noqa: E402
from PIL import Image  # noqa: E402

m = v1.m
v1.REG.clear()
v1.REG.update({"post": (0, 0, 16, 16), "rail": (16, 0, 16, 4), "cap": (16, 4, 8, 8), "spire": (24, 4, 4, 4),
               "tip": (28, 4, 4, 4)})
T22 = math.tan(math.radians(22.5))


def post_shaft():
    c = cube(-2, 0, -2, 4, 16, 4, "post")
    for i, f in enumerate(["north", "west", "south", "east"]):
        c["uv"][f] = {"uv": [4 * i, 0], "uv_size": [4, 16]}
    c["uv"]["up"] = c["uv"]["down"] = {"uv": [16, 4], "uv_size": [4, 4]}
    return c


def post(end):
    cs = [post_shaft()]
    if end:  # slim pointed spire: diamond base, tall slim middle, gold point
        cs += [cube(-1.5, 16, -1.5, 3, 2, 3, "cap", rot=(0, 45, 0), pivot=(0, 16, 0)),
               cube(-1, 18, -1, 2, 3, 2, "spire", rot=(0, 45, 0), pivot=(0, 18, 0)),
               cube(-0.5, 21, -0.5, 1, 2, 1, "tip", rot=(0, 45, 0), pivot=(0, 21, 0))]
    else:  # small diamond cap (owner likes it)
        cs += [cube(-1, 16, -1, 2, 1, 2, "cap", rot=(0, 45, 0), pivot=(0, 16, 0))]
    return cs


def rails():  # both rails bent: low at the post, peak at the block edge
    return [seg(-2, 7.5, -8, 7.5 + 6 * T22, "rail", w=2), seg(-2, 13, -8, 13 + 6 * T22, "rail", w=2)]


SCENE = [(0, 0, "s"), (0, 1, "ns"), (0, 2, "ne"), (1, 2, "we"), (2, 2, "w")]

# leaf per post side: (face index in the post strip: 0 north, 1 west, 2 south, 3 east), top row, x offset, mirrored
LEAVES = [(0, 3, 0, False), (1, 9, 0, True), (2, 5, 0, False), (3, 10, 0, True)]
LEAF = ["AA..",   # diagonal leaf like the falling-leaf particle: tip top-left, stalk bottom-right
        "ABB.",   # A light, B mid, C deep (gold on silver), S dark stalk
        ".BBC",
        "..CC",
        "...S"]


def scene_geo(name):
    bones = []
    for bx, bz, con in SCENE:
        ox, oz = -bx * 16, bz * 16
        cubes = post(False)  # owner: the small cap on every post
        for side in con:
            cubes += [_turn(c, -v1.SIDE_TURN[side]) for c in rails()]
        for c in cubes:
            c = json.loads(json.dumps(c))
            c["origin"] = [c["origin"][0] + ox, c["origin"][1], c["origin"][2] + oz]
            if "pivot" in c:
                c["pivot"] = [c["pivot"][0] + ox, c["pivot"][1], c["pivot"][2] + oz]
            bones.append(c)
    return {"format_version": "1.21.0", "minecraft:geometry": [{
        "description": {"identifier": f"geometry.design.{name.lower()}", "texture_width": 32, "texture_height": 32},
        "bones": [{"name": "scene", "pivot": [0, 0, 0], "cubes": bones}]}]}


def texture():
    P, G = m.PLANK, m.GOLD
    im = Image.new("RGBA", (32, 32), (0, 0, 0, 0))
    px = im.load()

    def put(x, y, c):
        px[x, y] = tuple(c) + (255,)
    import random
    rng = random.Random(7)  # fixed seed: the same grain every run
    for f in range(4):  # post sides: lit left column, shaded right, east side a step darker, plus wood grain
        for x in range(4):
            col = [[5, 4, 4, 3][x] - (1 if f == 3 else 0)] * 16
            y = rng.randrange(3)
            while y < 16:  # grain streaks: runs of 2-5 texels one step lighter or darker, gaps of 1-4
                ln, d = rng.randint(2, 5), rng.choice((-1, -1, 1))
                for i in range(y, min(16, y + ln)):
                    col[i] += d
                y += ln + rng.randint(1, 4)
            for y in range(16):
                put(4 * f + x, y, P[5 if y == 0 else min(5, max(2, col[y]))])
        # a small knot on two of the sides: dark eye with a lit rim above
        if f in (0, 2):
            kx, ky = (1, 13) if f == 0 else (2, 1)
            put(4 * f + kx, ky, P["seam"]); put(4 * f + kx, ky - 1 if ky else ky + 1, P[5])
    for f, top, dx, mirror in LEAVES:  # painted leaves
        for r, row in enumerate(LEAF):
            for c, ch in enumerate(row[::-1] if mirror else row):
                if ch != ".":
                    col = {"A": G[2], "B": G[1], "C": G[0], "S": P["seam"]}[ch]
                    put(4 * f + dx + c, top + r, col)
    for y in range(4):  # rails
        for x in range(16):
            t = [5, 4, 3, 2][y]
            if y in (1, 2) and (x * 5 + y * 7) % 11 < 3:
                t += 1 if y == 2 else -1
            put(16 + x, y, P[t])
    for y in range(8):  # caps
        for x in range(8):
            put(16 + x, 4 + y, P[5] if x + y < 4 else P[4] if x + y < 8 else P[3])
    for y in range(4):  # spire middle: lit left, shaded right
        for x in range(4):
            put(24 + x, 4 + y, P[[5, 4, 3, 3][x]])
    for y in range(4):  # gold point
        for x in range(4):
            put(28 + x, 4 + y, G[2] if x + y < 2 else G[1] if x + y < 5 else G[0])
    return im


# heartwood twin: the silver->gold map plus gold->silver for the accents
SWAP = dict(m.SILVER_TO_GOLD)
SWAP.update({m.GOLD[0]: m.BARK[1], m.GOLD[1]: m.BARK[3], m.GOLD[2]: m.BARK[4], m.GOLD[3]: m.BARK[5]})


def recolour(im):
    out = im.copy()
    px = out.load()
    for y in range(im.height):
        for x in range(im.width):
            r, g, b, a = px[x, y]
            if a:
                px[x, y] = SWAP.get((r, g, b), m.to_gold((r, g, b))) + (a,)
    return out


def main():
    tex = texture()
    tex.save(os.path.join(HERE, "fence_v3d_silver.png"))
    recolour(tex).save(os.path.join(HERE, "fence_v3d_heartwood.png"))
    with open(os.path.join(HERE, "V3.geo.json"), "w") as f:
        json.dump(scene_geo("v3"), f, indent=1)
    print("ok")


if __name__ == "__main__":
    main()
