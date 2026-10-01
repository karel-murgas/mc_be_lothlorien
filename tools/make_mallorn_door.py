"""Mallorn door: textures (top + bottom 16x16), the 2D item icon, and the four door geometries.

  python -B tools/make_mallorn_door.py [--out DIR] [--no-geo]

The tree door (owner's design, final 2026-10-01): half a mallorn per door. The trunk stands at the free edge, so a
double door shows one whole tree: a loose arc of gold leaves over a fan of silver branches, cut out against the sky,
and below a painted mid rail the trunk with its roots spreading over vertical boards. Design rounds (other crowns,
a carved arch variant, a lattice variant, a depth model) are in git history (lothlorien commit ade8e24).

Geometry, like vanilla: one flat 16x16x3 cube per half. Texture column 0 is the HINGE side, 15 the free edge
(verified in game: the plain door's north face `uv [0,0] size [16,16]`, the hinge-right `_mirror` door's
`uv [16,0] size [-16,16]`). Both 3-texel edge faces stretch the frame line (column 1) over their depth, the top face
the top frame line (row 1), the bottom face the bottom frame line (row 14 of the bottom texture): those stay opaque
(checked); everything else may be cut through (render method alpha_test_single_sided). The faces where the two halves
touch are left out: through the cut-out crown they showed as a 3-texel ledge.

Frame: painted and flat (no shading step between frame and field: that read as a recess), dark outline + frame line on
the hinge, top and bottom edges, none on the free edge (the trunk halves meet). Hinges and handle painted.

Shading: every texel has a kind and a height; light from the top-left lights upper/left edges, shades lower/right
edges and casts a one-texel shadow onto lower surfaces; small details have fixed tones. Silver art only, in the
PLANK/BARK/GOLD palette of make_mallorn_wood.py, so the heartwood twin is an exact recolour. The trapdoor generator
reuses Canvas and shade() from here.
"""
import argparse
import json
import math
import os
import random
import sys

from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from make_mallorn_wood import BARK, GOLD, recolour  # noqa: E402

W, H = 16, 32
HOLE = None

# kind -> (height, base tone); tones index SILVER, gold kinds the GOLD ramp
KINDS = {
    "O": (2, 1),   # outline (fixed tone): the door reads against the wall
    "F": (2, 2),   # frame line, vertical grain
    "R": (2, 2),   # frame line / rail, horizontal grain
    "V": (2, 3),   # boards, vertical grain, level with the frame (flat like vanilla)
    "S": (2, 1),   # board seam
    "T": (3, 4),   # carved relief (branch, root)
    "B": (2, 4),   # bark (tones per column)
    "G": (3, 2),   # gold leaf
    "g": (3, 1),   # gold leaf, shaded half
    "Y": (3, 3),   # gold leaf highlight
    "d": (3, 0),   # gold leaf, deep
    "K": (3, 0),   # handle
    "H": (3, 0),   # hinge
}
FIXED = {"O": 1, "S": 1, "Y": ("g", 3), "G": ("g", 2), "g": ("g", 1), "d": ("g", 0), "K": 0, "H": 0}
GOLD_KINDS = "YGgd"
SILVER = [BARK[0], BARK[1], BARK[2], BARK[3], BARK[4], BARK[5]]


class Canvas:
    def __init__(self):
        self.k = [[HOLE] * W for _ in range(H)]
        self.tone = {}   # (x, y) -> fixed silver tone 0-5 or ("g", 0-3)

    def set(self, x, y, kind):
        if 0 <= x < W and 0 <= y < H:
            self.k[y][x] = kind

    def rect(self, kind, x0, y0, x1, y1):
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                self.set(x, y, kind)

    def grid(self, x0, y0, rows):
        """Hand-drawn texels, one string per row from (x0, y0); '.' keeps the texel, ' ' cuts a hole."""
        for r, row in enumerate(rows):
            for i, ch in enumerate(row):
                if ch == " ":
                    self.set(x0 + i, y0 + r, HOLE)
                elif ch != ".":
                    self.set(x0 + i, y0 + r, ch)


# ---------------------------------------------------------------- the tree door
# leaf: Y highlight, G lit half, g shaded half, d deep
LEAF = [".Y.",
        "YGg",
        "Ggd",
        ".d."]
DOME = (16.0, 5.0, 14.5, 9.0)   # the crown's extent: centre x, centre y, radius x, radius y (texels)
GARLAND = [(11.5, 6.5, 160, 22), (7.0, 4.5, 205, 40)]   # leaf arcs: radius x, radius y, first angle, step (degrees)
BRANCHES = [[(12, 12), (9, 10), (5, 9), (3, 8)], [(12, 11), (8, 7), (5, 4)], [(12, 10), (10, 5), (9, 2)],
            [(13, 9), (13, 2)], [(8, 7), (7, 4)], [(9, 10), (7, 12)]]   # polylines from the trunk top
LOWER_BRANCHES = [     # x 2-15, rows 11-15 (below the crown); the trunk is columns 13-15
    "....TT........",   # 11
    "    TT    TBBB",   # 12
    "     TT   TBBB",   # 13
    "      TT  TBBB",   # 14
    "       TTTTBBB",   # 15
]
ROOTS = [              # x 2-15, rows 23-29: roots spread over the boards down to the bottom frame line
    "..........TBBB",   # 23
    ".........TTBBB",
    "........TT.BBB",
    ".......TT.TBBB",
    ".....TTT.TTBBB",
    "...TTT.TTTTBBB",
    ".TTT..TTTTTBBB",   # 29
]
BARK_TONES = {13: 3, 14: 4, 15: 5}   # round trunk: shaded at its outer edge, lit towards the meeting edge
BARK_MARKS = [(14, 13), (14, 19), (15, 22), (14, 27)]   # beech lenticels: dark groove, lit lip below


def frame(c):
    """Dark outline + frame line on the hinge, top and bottom edges (over everything, the trunk included), hinges."""
    c.rect("O", 0, 0, 15, 0)
    c.rect("O", 0, 31, 15, 31)
    c.rect("O", 0, 0, 0, 31)
    c.rect("F", 1, 1, 1, 30)
    c.rect("R", 2, 1, 15, 1)
    c.rect("R", 2, 30, 15, 30)
    for y in (4, 26):                   # hinges: two texels into the door, lit upper row
        c.rect("H", 0, y, 1, y + 1)
        c.tone[(1, y)] = 2


def handle(c, x, y):
    """A painted handle, 1x3: lit top, dark below."""
    c.rect("K", x, y, x, y + 2)
    c.tone[(x, y)] = 2


def tree_door():
    c = Canvas()
    c.rect("R", 2, 16, 12, 16)                   # mid rail
    c.rect("V", 2, 17, 12, 29)                   # boards, three of 3 texels
    for x in (5, 9):
        c.rect("S", x, 17, x, 29)
    c.rect("B", 13, 2, 15, 29)
    assert all(len(r) == 14 for r in LOWER_BRANCHES + ROOTS)
    c.grid(2, 11, LOWER_BRANCHES)
    cx, cy, rx, ry = DOME

    def inside(x, y):
        return ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1

    for y in range(2, 12):                       # open crown: sky behind; the trunk ends in the crown
        for x in range(2, 15):
            if inside(x, y) and not (13 <= x <= 15 and y >= 9):
                c.set(x, y, HOLE)
    for line in BRANCHES:
        for (x0, y0), (x1, y1) in zip(line, line[1:]):
            n = max(abs(x1 - x0), abs(y1 - y0))
            for i in range(n + 1):
                c.set(round(x0 + (x1 - x0) * i / n), round(y0 + (y1 - y0) * i / n), "T")
    for ax, ay, t0, dt in GARLAND:               # a loose garland of leaves along an arc
        for t in range(t0, 271, dt):
            lx = round(16 + ax * math.cos(math.radians(t)) - 1.5)
            ly = round(7.5 + ay * math.sin(math.radians(t)) - 2)
            for r, row in enumerate(LEAF):
                for i, ch in enumerate(row):
                    if ch != "." and 2 <= lx + i and inside(lx + i, ly + r):
                        c.set(lx + i, ly + r, ch)
    c.grid(2, 23, ROOTS)
    for y in range(H):
        for x, t in BARK_TONES.items():
            if c.k[y][x] == "B":
                c.tone[(x, y)] = t
    for x, y in BARK_MARKS:
        c.tone[(x, y)] = 1
        c.tone[(x, y + 1)] = 5
    frame(c)
    handle(c, 12, 18)
    return c


# ---------------------------------------------------------------- shading
def height(c, x, y):
    if not (0 <= x < W and 0 <= y < H):
        return 2
    k = c.k[y][x]
    return 0 if k is HOLE else KINDS[k][0]


def grain(seed, n, length):
    """Per-line streak offsets: runs of -1/+1 along a line of `length`, gaps between."""
    rng = random.Random(seed)
    lines = []
    for _ in range(n):
        off = [0] * length
        i = rng.randrange(3)
        while i < length:
            ln, d = rng.randint(2, 5), rng.choice((-1, -1, 1))
            for j in range(i, min(length, i + ln)):
                off[j] = d
            i += ln + rng.randint(2, 5)
        lines.append(off)
    return lines


def shade(c):
    vgrain = grain(11, W, H)       # per column, along y
    hgrain = grain(12, H, W)       # per row, along x
    out = [[None] * W for _ in range(H)]
    for y in range(H):
        for x in range(W):
            k = c.k[y][x]
            if k is HOLE:
                continue
            h, tone = KINDS[k]
            fixed = c.tone.get((x, y), FIXED.get(k))
            if fixed is not None:
                out[y][x] = GOLD[fixed[1]] if isinstance(fixed, tuple) else SILVER[fixed]
                continue
            if k in "FV":
                tone += vgrain[x][y]
            elif k == "R":
                tone += hgrain[y][x]
            up, left = height(c, x, y - 1), height(c, x - 1, y)
            down, right = height(c, x, y + 1), height(c, x + 1, y)
            lit = up < h or left < h
            dark = down < h or right < h
            if lit and not dark:
                tone += 1
            elif dark and not lit:
                tone -= 1
            if up > h or left > h or height(c, x - 1, y - 1) > h:   # cast shadow from a higher neighbour
                tone -= 1
            out[y][x] = GOLD[max(0, min(3, tone))] if k in GOLD_KINDS else SILVER[max(0, min(5, tone))]
    return out


def to_images(px):
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    for y in range(H):
        for x in range(W):
            if px[y][x] is not None:
                im.putpixel((x, y), px[y][x] + (255,))
    return im.crop((0, 0, 16, 16)), im.crop((0, 16, 16, 32))


# ---------------------------------------------------------------- icon
# hand-drawn like the vanilla door icons (10x14 at x 3-12, y 2-15): a whole small tree in one narrow door.
# digits = silver tones 0-5, a-d = gold 0-3, '.' = transparent (sky holes and outside the door)
ICON = [
    "................",
    "................",
    "...1111111111...",
    "...1222222221...",
    "...12.dc.cd21...",
    "...0dc.44.cd0...",
    "...12c.45.c21...",
    "...12.3453.21...",
    "...1222222221...",
    "...1231453121...",
    "...1231453121...",
    "...1231453121...",
    "...0234454320...",
    "...1244454421...",
    "...1222222221...",
    "...1111111111...",
]


def icon():
    assert len(ICON) == 16 and all(len(r) == 16 for r in ICON)
    im = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
    for y, row in enumerate(ICON):
        for x, ch in enumerate(row):
            if ch.isdigit():
                im.putpixel((x, y), SILVER[int(ch)] + (255,))
            elif ch in "abcd":
                im.putpixel((x, y), GOLD["abcd".index(ch)] + (255,))
    return im


# ---------------------------------------------------------------- geometry
def geo_cube(part, mirror):
    """One 16x16x3 cube; the face where the halves touch is left out (a missing face is not drawn)."""
    north = {"uv": [16, 0], "uv_size": [-16, 16]} if mirror else {"uv": [0, 0], "uv_size": [16, 16]}
    south = {"uv": [0, 0], "uv_size": [16, 16]} if mirror else {"uv": [16, 0], "uv_size": [-16, 16]}
    sides = {"uv": [1, 0], "uv_size": [1, 16]}                       # the frame column, stretched over the depth
    cap = {"uv": [0, 1 if part == "top" else 14], "uv_size": [16, 1]}   # the frame row likewise
    uv = {"north": north, "south": south, "east": sides, "west": dict(sides), "up": cap, "down": dict(cap)}
    del uv["down" if part == "top" else "up"]
    return {"origin": [-8, 0, -8], "size": [16, 16, 3], "uv": uv}


def write_geometry(models_dir):
    for part in ("bottom", "top"):
        for mirror in (False, True):
            name = f"mallorn_door_{part}" + ("_mirror" if mirror else "")
            geo = {"format_version": "1.26.50", "minecraft:geometry": [{
                "description": {"identifier": f"geometry.lothlorien.{name}", "texture_width": 16, "texture_height": 16},
                "bones": [{"name": "door", "pivot": [0, 0, 0], "cubes": [geo_cube(part, mirror)]}],
            }]}
            with open(os.path.join(models_dir, name + ".geo.json"), "w", newline="\n") as f:
                json.dump(geo, f, indent=2)
                f.write("\n")


def check(top, bottom):
    """The texels the edge, top and bottom faces show (frame column 1, top row 1, bottom row 14) are opaque."""
    for part, im, row in (("top", top, 1), ("bottom", bottom, 14)):
        for i in range(16):
            for x, y in ((1, i), (i, row)):
                assert im.getpixel((x, y))[3] == 255, f"{part} texel ({x},{y}) is on an edge/top/bottom face"


def build():
    top, bottom = to_images(shade(tree_door()))
    check(top, bottom)
    return top, bottom, icon()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", help="textures folder (default: the pack's lothlorien_rp/textures)")
    ap.add_argument("--no-geo", action="store_true", help="do not write the geometry")
    a = ap.parse_args()
    here = os.path.dirname(os.path.abspath(__file__))
    rp = os.path.join(here, "..", "lothlorien_rp")
    out = a.out or os.path.join(rp, "textures")
    for sub in ("blocks", "items"):
        os.makedirs(os.path.join(out, sub), exist_ok=True)
    top, bottom, ic = build()
    for wood, f in [("mallorn", lambda im: im), ("mallorn_heartwood", recolour)]:
        f(top).save(os.path.join(out, "blocks", f"{wood}_door_top.png"))
        f(bottom).save(os.path.join(out, "blocks", f"{wood}_door_bottom.png"))
        f(ic).save(os.path.join(out, "items", f"{wood}_door.png"))
    print("wrote silver + heartwood door textures and icons")
    if not a.no_geo and not a.out:
        write_geometry(os.path.join(rp, "models", "blocks"))
        print("wrote the 4 door geometries")


if __name__ == "__main__":
    main()
