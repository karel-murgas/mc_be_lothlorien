"""Mallorn door: textures (top + bottom 16x16, 2D item icon) in design variants, and the shared door geometry.

  python -B tools/make_mallorn_door.py [VARIANT] [--heartwood VARIANT] [--out DIR] [--no-geo]

  A   half a mallorn tree: the trunk stands at the free edge, so a double door shows one whole tree; solid gold crown
  A2  A with a silver crown
  A3  A with a lace crown: separate gold leaves, sky between them, the branches showing through
  A4  A with a wreath crown: gold leaves only along the dome's rim, the open middle shows a fan of silver branches
  B   carved: pointed-arch window with a leaf spray (one gold leaf), lower panel with one big carved leaf

--heartwood picks another variant for the heartwood door (to compare two designs in game; the geometry is shared).
Round 1 also had C (patterns: lattice window, diagonal boards); dropped in round 3, kept in docs/art/door/.

Geometry (round 3, owner 2026-10-01: "match the vanilla door"): one flat 16x16x3 cube per half, like vanilla. The
frame is colour only and flat (no shading step between frame and field: round 3's cast shadow read as a 3-texel
recess): outline + frame line; variant A has none on the free edge (the trunk halves meet). The faces where the
two halves touch are left out of the geometry: through a cut-out crown they showed as a 3-texel ledge. Texture column 0 is the
HINGE side, 15 the free edge: verified in game (round 1, owner 2026-10-01) with the plain door's north face
`uv [0,0] size [16,16]` and the hinge-right door's `uv [16,0] size [-16,16]`. Both 3-texel edge faces stretch the frame
line (column 1) over their depth, the top face the top frame line (row 1), the bottom face the bottom frame line
(row 14 of the bottom texture): those stay opaque (checked); everything else may be cut through. Cutouts elsewhere (render method alpha_test_single_sided).

Shading: every texel has a kind and a height; light from the top-left lights upper/left edges, shades lower/right
edges and casts a one-texel shadow onto lower surfaces; small carved details have fixed tones. Silver art only, in
the PLANK/BARK/GOLD palette of make_mallorn_wood.py, so the heartwood twin is an exact recolour.
"""
import argparse
import json
import math
import os
import random
import sys

from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from make_mallorn_wood import BARK, GOLD, PLANK, recolour  # noqa: E402

W, H = 16, 32
VARIANT = "A4"   # the owner's pick (2026-10-01)
HOLE = None

# kind -> (height, base tone); tones index SILVER, gold kinds the GOLD ramp
KINDS = {
    "O": (2, 1),   # door outline (fixed tone): the door reads against the wall
    "F": (2, 2),   # frame line, vertical grain
    "R": (2, 2),   # frame line / rail, horizontal grain
    "P": (1, 3),   # panel, sparse vertical grain
    "V": (2, 3),   # boards, vertical grain (variant A lower half), level with the frame: flat like vanilla
    "S": (2, 1),   # board seam
    "T": (3, 4),   # carved relief (moulding, branch, root, sprig)
    "B": (2, 4),   # bark: the trunk of variant A (tones per column)
    "L": (3, 4),   # silver leaf (edge rule)
    "l": (3, 3),   # silver leaf, shaded texel
    "G": (3, 2),   # gold leaf
    "g": (3, 1),   # gold leaf, shaded half
    "Y": (3, 3),   # gold leaf highlight
    "d": (3, 0),   # gold leaf, deep
    "m": (3, 2),   # leaf midrib
    "K": (3, 0),   # handle
    "H": (3, 0),   # hinge
}
FIXED = {"O": 1, "S": 1, "l": 3, "m": 2, "Y": ("g", 3), "G": ("g", 2), "g": ("g", 1), "d": ("g", 0), "K": 0, "H": 0}
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


def frame(c, free_edge=True):
    """Painted frame like a vanilla door: dark outline + one frame line, hinges on the hinge edge. free_edge=False
    (variant A): the top and bottom frame rows run across, but no frame on the free edge, so the two trunk halves of
    a double door meet without a line between them (owner, round 5)."""
    c.rect("O", 0, 0, 15, 0)
    c.rect("O", 0, 31, 15, 31)
    c.rect("O", 0, 0, 0, 31)
    c.rect("F", 1, 1, 1, 30)
    c.rect("R", 2, 1, 15, 1)
    c.rect("R", 2, 30, 15, 30)
    if free_edge:
        c.rect("O", 15, 0, 15, 31)
        c.rect("F", 14, 1, 14, 30)
    for y in (4, 26):                   # hinges: two texels into the door, lit upper row
        c.rect("H", 0, y, 1, y + 1)
        c.tone[(1, y)] = 2


def handle(c, x, y):
    """A painted handle, 1x3: lit top, dark below."""
    c.rect("K", x, y, x, y + 2)
    c.tone[(x, y)] = 2


# ---------------------------------------------------------------- variant A: half a tree
# leaf: Y highlight, G lit half, g shaded half, d deep (gold on A, silver tones on A2)
LEAF = [".Y.",
        "YGg",
        "Ggd",
        ".d."]
# the crown: a dome centred on the free edge (shared with the other door), from the top frame line
DOME = (16.0, 5.0, 14.5, 9.0)   # centre x, centre y, radius x, radius y (texels)
JITTER = [(0, 0), (1, 1), (0, -1), (-1, 0), (1, 0), (0, 1), (-1, 1), (0, 0), (1, -1)]  # breaks the scale pattern
BRANCHES_A = [         # x 2-15, rows 11-15 (below the crown); the trunk is columns 13-15
    "....TT........",   # 11
    "    TT    TBBB",    # 12 two branches rise into the crown
    "     TT   TBBB",    # 13
    "      TT  TBBB",    # 14
    "       TTTTBBB",    # 15
]
ROOTS_A = [            # x 2-15, rows 23-29: roots spread over the boards down to the bottom frame line
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
# skeleton of the cut-through crowns (A3, A4): polylines from the trunk top, x/y texels
CROWN_BRANCHES = {
    "lace": [[(12, 12), (8, 8), (5, 6)], [(12, 10), (10, 6), (8, 3)], [(13, 9), (13, 2)]],
    "filigree": [[(12, 12), (9, 10), (5, 9), (3, 8)], [(12, 11), (8, 7), (5, 4)], [(12, 10), (10, 5), (9, 2)],
                 [(13, 9), (13, 2)], [(8, 7), (7, 4)], [(9, 10), (7, 12)]],
}


def variant_a(crown="solid"):
    """Half a tree. The trunk stands at the free edge, so a double door shows one whole tree: a domed crown from the
    top frame line, two branches, and the trunk with its roots spreading over a lower half of vertical boards (seams,
    grain) under a painted mid rail. crown: solid | silver | lace | filigree."""
    c = Canvas()
    c.rect("R", 2, 16, 12, 16)                   # mid rail
    c.rect("V", 2, 17, 12, 29)                   # boards, three of 3 texels
    for x in (5, 9):
        c.rect("S", x, 17, x, 29)
    c.rect("B", 13, 2, 15, 29)
    c.grid(2, 11, BRANCHES_A)
    cx, cy, rx, ry = DOME

    def inside(x, y):
        return ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1

    def stamp_leaf(x, y):
        for r, line in enumerate(LEAF):
            for i, ch in enumerate(line):
                if ch != "." and 2 <= x + i and inside(x + i, y + r):
                    c.set(x + i, y + r, ch)

    if crown in ("solid", "silver"):
        for y in range(H):                       # solid crown: the shaded leaf tone under the leaves
            for x in range(2, W):
                if inside(x, y):
                    c.set(x, y, "g")
    else:
        for y in range(2, 12):                   # open crown: sky behind; the trunk ends in the crown
            for x in range(2, 15):
                if inside(x, y) and not (13 <= x <= 15 and y >= 9):
                    c.set(x, y, HOLE)
        for line in CROWN_BRANCHES[crown]:
            for (x0, y0), (x1, y1) in zip(line, line[1:]):
                n = max(abs(x1 - x0), abs(y1 - y0))
                for i in range(n + 1):
                    c.set(round(x0 + (x1 - x0) * i / n), round(y0 + (y1 - y0) * i / n), "T")
    if crown == "filigree":                      # a loose garland of leaves along an arc
        for ax, ay, t0, dt in [(11.5, 6.5, 160, 22), (7.0, 4.5, 205, 40)]:   # outer row, a few inner leaves
            for t in range(t0, 271, dt):
                x = 16 + ax * math.cos(math.radians(t)) - 1.5
                y = 7.5 + ay * math.sin(math.radians(t)) - 2
                stamp_leaf(round(x), round(y))
    else:
        step_x = 4 if crown == "lace" else 3
        for row, y0 in enumerate(range(-2, 15, 3)):  # staggered leaves, nudged by a fixed pattern, inside the dome
            for col, x0 in enumerate(range(1 + (row % 2) * 2 - 3, 17, step_x)):
                jx, jy = JITTER[(3 * row + col) % len(JITTER)]
                if inside(x0 + jx + 1, y0 + jy + 2):
                    stamp_leaf(x0 + jx, y0 + jy)
    assert all(len(r) == 14 for r in BRANCHES_A + ROOTS_A)
    c.grid(2, 23, ROOTS_A)
    if crown == "silver":
        for y in range(H):
            for x in range(W):
                if c.k[y][x] and c.k[y][x] in "YGgd":
                    c.tone[(x, y)] = {"Y": 5, "G": 4, "g": 3, "d": 2}[c.k[y][x]]
    for y in range(H):
        for x, t in BARK_TONES.items():
            if c.k[y][x] == "B":
                c.tone[(x, y)] = t
    for x, y in BARK_MARKS:
        c.tone[(x, y)] = 1
        c.tone[(x, y + 1)] = 5
    frame(c, free_edge=False)                    # top and bottom frame rows go over everything, the trunk included
    handle(c, 12, 18)
    return c, {}


# ---------------------------------------------------------------- variant B: carved
# x 2-13 (inside the frame), rows 2-29. P panel, T moulding, R rail, ' ' open, L/l silver leaf, G/g gold, m midrib.
CARVED_B = [
    "PPPPPPPPPPPP",   # 2
    "PPPPPTTPPPPP",   # 3  arch apex (moulding)
    "PPPPT  TPPPP",
    "PPPT GG TPPP",   # 5  gold leaf, lit half G, shaded half g
    "PPT GGgg TPP",
    "PPT GGgg TPP",
    "PPT  Gg  TPP",
    "PPTL TT lTPP",   # 9  silver side leaves
    "PPT LTTl TPP",
    "PPT  TT  TPP",
    "PPT  TT  TPP",
    "PPTTTTTTTTPP",   # 13 sill
    "PPPPPPPPPPPP",
    "RRRRRRRRRRRR",   # 15 mid rail (painted)
    "RRRRRRRRRRRR",
    "PPPPPPPPPPPP",
    "PPTTTTTTTTPP",   # 18 lower moulding
    "PPTPPPPPPTPP",
    "PPTPPLlPPTPP",   # 20 the big leaf (lit half / shaded half meet at the midrib)
    "PPTPLLllPTPP",
    "PPTPLLllPTPP",
    "PPTPLLllPTPP",
    "PPTPPLlPPTPP",
    "PPTPPmmPPTPP",   # 25 stalk
    "PPTPPPPPPTPP",
    "PPTTTTTTTTPP",
    "PPPPPPPPPPPP",
    "PPPPPPPPPPPP",   # 29
]


def variant_b():
    """Carved: a pointed-arch window holding a leaf spray (one gold leaf), a moulded lower panel with one big
    carved mallorn leaf. Complete on its own; a double door shows two."""
    c = Canvas()
    frame(c)
    assert len(CARVED_B) == 28 and all(len(r) == 12 for r in CARVED_B), [len(r) for r in CARVED_B]
    c.grid(2, 2, CARVED_B)
    handle(c, 12, 17)
    return c, {}


VARIANTS = {"A": variant_a, "A2": lambda: variant_a("silver"), "A3": lambda: variant_a("lace"),
            "A4": lambda: variant_a("filigree"), "B": variant_b}


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


def shade(c, extra):
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
            if k == "F":
                tone += vgrain[x][y]
            elif k == "R":
                tone += hgrain[y][x]
            elif k == "P" and vgrain[x][y] < 0 and x % 4 == 1 and y % 3:   # a few short dark streaks
                tone -= 1
            elif k == "V":
                tone += vgrain[x][y]
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
            if k in GOLD_KINDS:
                out[y][x] = GOLD[max(0, min(3, tone))]
            else:
                out[y][x] = SILVER[max(0, min(5, tone))]
    return out


def to_images(px):
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    for y in range(H):
        for x in range(W):
            if px[y][x] is not None:
                im.putpixel((x, y), px[y][x] + (255,))
    return im.crop((0, 0, 16, 16)), im.crop((0, 16, 16, 32)), im


# ---------------------------------------------------------------- geometry
# one cube per half, like vanilla: (col0, col1, row0, row1, z0, z1, side strip column, top/bottom strip row)
CUBES = {"top": [(0, 16, 0, 16, -8, -5, 1, 1)], "bottom": [(0, 16, 0, 16, -8, -5, 1, 14)]}


def geo_cube(cube, mirror):
    c0, c1, r0, r1, z0, z1, side, strip = cube
    w, h, d = c1 - c0, r1 - r0, z1 - z0
    x0 = 8 - c1 if mirror else c0 - 8
    # verified in game (round 1): the plain door's north face un-negated puts column 0 at the hinge
    north = {"uv": [c1, r0], "uv_size": [-w, h]} if mirror else {"uv": [c0, r0], "uv_size": [w, h]}
    south = {"uv": [c0, r0], "uv_size": [w, h]} if mirror else {"uv": [c1, r0], "uv_size": [-w, h]}
    sides = {"uv": [side, r0], "uv_size": [1, h]}    # one frame column stretched over the door's depth
    cap = {"uv": [c0, strip], "uv_size": [w, 1]}     # one frame row likewise
    return {"origin": [x0, 16 - r1, z0], "size": [w, h, d],
            "uv": {"north": north, "south": south, "east": sides, "west": dict(sides), "up": cap, "down": dict(cap)}}


# faces where the two halves touch: hidden from outside, but seen through a cut-out crown as a 3-texel ledge
# (owner's screenshot, round 4). A face missing from the per-face uv map is not drawn.
INNER_FACE = {"bottom": "up", "top": "down"}


def without(cube, face):
    del cube["uv"][face]
    return cube


def write_geometry(models_dir):
    for part in ("bottom", "top"):
        for mirror in (False, True):
            ident = f"geometry.lothlorien.mallorn_door_{part}" + ("_mirror" if mirror else "")
            geo = {"format_version": "1.26.50", "minecraft:geometry": [{
                "description": {"identifier": ident, "texture_width": 16, "texture_height": 16},
                "bones": [{"name": "door", "pivot": [0, 0, 0], "cubes": [without(geo_cube(c, mirror), INNER_FACE[part])
                                                                            for c in CUBES[part]]}],
            }]}
            name = f"mallorn_door_{part}" + ("_mirror" if mirror else "") + ".geo.json"
            with open(os.path.join(models_dir, name), "w", newline="\n") as f:
                json.dump(geo, f, indent=2)
                f.write("\n")


def check(top, bottom):
    """The texels the edge, top and bottom faces show (frame line column 1, top row 1, bottom row 14) are opaque."""
    for part, im, row in (("top", top, 1), ("bottom", bottom, 14)):
        for i in range(16):
            for x, y in ((1, i), (i, row)):
                assert im.getpixel((x, y))[3] == 255, f"{part} texel ({x},{y}) is on an edge/top/bottom face"


# ---------------------------------------------------------------- icon
def shrink(im):
    """Half size, 2x2 -> 1: open if at least half the cell is open; else gold if any, else the cell's median tone."""
    out = Image.new("RGBA", (im.width // 2, im.height // 2), (0, 0, 0, 0))
    for y in range(out.height):
        for x in range(out.width):
            cell = [im.getpixel((2 * x + dx, 2 * y + dy)) for dy in (0, 1) for dx in (0, 1)]
            solid = [p for p in cell if p[3]]
            if len(solid) < 3 and not any(p[:3] in GOLD for p in solid):
                continue
            gold = [p for p in solid if p[:3] in GOLD]
            out.putpixel((x, y), gold[0] if gold else sorted(solid, key=lambda p: sum(p[:3]))[len(solid) // 2])
    return out


# hand-drawn 2D icon of the picked design (A4): a whole small tree in one narrow door, like vanilla door icons.
# digits = silver tones 0-5, a-d = gold 0-3, '.' = transparent (sky holes and outside the door)
ICON_A4 = [   # vanilla door icons fill x 3-12, y 2-15 (10x14)
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


def drawn_icon(rows):
    icon = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
    assert len(rows) == 16 and all(len(r) == 16 for r in rows)
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            if ch.isdigit():
                icon.putpixel((x, y), SILVER[int(ch)] + (255,))
            elif ch in "abcd":
                icon.putpixel((x, y), GOLD["abcd".index(ch)] + (255,))
    return icon


def item_icon(full, pair):
    """Placeholder for the variants not picked: the door at half size (8x16), or the double door (16x16) for A*."""
    icon = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
    if pair:
        both = Image.new("RGBA", (32, 32))
        both.paste(full, (0, 0))
        both.paste(full.transpose(Image.FLIP_LEFT_RIGHT), (16, 0))
        icon.alpha_composite(shrink(both), (0, 0))
    else:
        icon.alpha_composite(shrink(full), (4, 0))
    return icon


def build(variant):
    c, extra = VARIANTS[variant]()
    top, bottom, full = to_images(shade(c, extra))
    check(top, bottom)
    icon = drawn_icon(ICON_A4) if variant == "A4" else item_icon(full, pair=variant.startswith("A"))
    return top, bottom, icon, full


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("variant", nargs="?", default=VARIANT, choices=VARIANTS)
    ap.add_argument("--heartwood", choices=VARIANTS, help="variant for the heartwood door (default: the same)")
    ap.add_argument("--out", help="textures folder (default: the pack's lothlorien_rp/textures)")
    ap.add_argument("--no-geo", action="store_true", help="do not write the geometry")
    a = ap.parse_args()
    here = os.path.dirname(os.path.abspath(__file__))
    rp = os.path.join(here, "..", "lothlorien_rp")
    out = a.out or os.path.join(rp, "textures")
    for sub in ("blocks", "items"):
        os.makedirs(os.path.join(out, sub), exist_ok=True)
    for wood, variant, f in [("mallorn", a.variant, lambda im: im),
                             ("mallorn_heartwood", a.heartwood or a.variant, recolour)]:
        top, bottom, icon, _ = build(variant)
        f(top).save(os.path.join(out, "blocks", f"{wood}_door_top.png"))
        f(bottom).save(os.path.join(out, "blocks", f"{wood}_door_bottom.png"))
        f(icon).save(os.path.join(out, "items", f"{wood}_door.png"))
        print(f"{wood}: variant {variant}")
    if not a.no_geo and not a.out:
        write_geometry(os.path.join(rp, "models", "blocks"))
        print("wrote the 4 door geometries")


if __name__ == "__main__":
    main()
