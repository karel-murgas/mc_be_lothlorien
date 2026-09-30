"""Mallorn wood textures: logs (bark, cut end, stripped), silver planks, and the heartwood (golden) plank set.

The heartwood set is a RECOLOUR of the silver set through SILVER_TO_GOLD (owner's rule, 2026-09-30): draw
silver art once, the golden twin follows. Colours outside the map (e.g. the placeholder door art) are mapped by
brightness onto the golden anchors, so any silver texture can be translated.

Lore: "its pillars are of silver, for the bark of the trees is smooth and grey" (LotR II 6); beech-like
trees, "mallorn" = gold-tree. So: smooth silver-grey bark like beech (no deep fissures) with long sheen ridges,
beech-style lenticels (short horizontal marks) and two gold glints, pale golden heartwood, and a thin gold sap ring between bark and wood.

Deterministic: every feature is data below. Re-running overwrites the output files.

  python -B tools/make_mallorn_wood.py [OUT_DIR]

OUT_DIR defaults to lothlorien_rp/textures/blocks (installs); pass a temp folder to try changes.
"""
import argparse
import math
import os
from PIL import Image

N = 16

# ---- colour ramps (dark -> light, hue shifts cool/blue in shadow, neutral-warm in light) ----
BARK = [  # silver-grey, slightly cool in shadow
    (78, 84, 101),    # 0 deep slate: inside of marks
    (112, 119, 134),  # 1 shadow
    (143, 150, 162),  # 2 shade
    (170, 177, 185),  # 3 base silver
    (195, 200, 204),  # 4 light
    (221, 224, 223),  # 5 highlight
]
GOLD = [
    (150, 112, 52),   # 0 deep
    (201, 160, 74),   # 1 mid
    (236, 205, 118),  # 2 light
    (250, 234, 168),  # 3 glint
]
WOOD = [
    (139, 116, 82),   # 0 ring line
    (176, 152, 108),  # 1 shade
    (205, 184, 138),  # 2 base
    (225, 208, 164),  # 3 light
    (240, 229, 194),  # 4 highlight
]

def blank(v):
    return [[v for _ in range(N)] for _ in range(N)]


def put(g, x, y, v):
    g[y % N][x % N] = v


def wave_field(waves, sway, x, y):
    sx = x + sum(a * math.sin(2 * math.pi * fy * y / N + ph) for fy, a, ph in sway)
    return sum(a * math.cos(2 * math.pi * (fx * sx + fy * y) / N + ph) for fx, fy, a, ph in waves)


def quantise(v, levels):
    for t, tone in levels:
        if v < t:
            return tone
    return levels[-1][1]


# ---- bark side ----
# Smooth beech-like bark: a tone field (below) quantised to a few calm tones, the upper-left edge of
# light bands one step brighter, fine wrinkles, lenticels and two pale-gold glints.
# The owner picked this over a hand-placed ridge version and a curving-strand version (2026-09-30).
BARK_WAVES = [  # (x freq, y freq, amplitude, phase)
    (2, 0, 0.80, 0.3), (3, 1, 0.75, 1.9), (5, 1, 0.45, 4.1), (1, 1, 0.35, 2.6), (7, 1, 0.25, 0.7),
]
SWAY = [(1, 0.9, 0.4)]  # (y freq, amplitude in texels, phase)
BARK_LEVELS = [(-1.05, 2), (0.05, 3), (0.95, 4), (99, 5)]  # threshold -> bark tone
WRINKLES = [(5, 3, 4), (12, 10, 5), (1, 13, 3), (9, 0, 3)]  # (x, y_start, length): tone 2 hairlines
LENTICELS = [(2, 5, 3), (10, 3, 2), (13, 12, 3), (6, 7, 2)]  # (x, y, length): groove tone 1, lit lip below
GLINTS = [(4, 1), (14, 8)]  # single pale-gold texels


def bark_side():
    g = [[quantise(wave_field(BARK_WAVES, SWAY, x, y), BARK_LEVELS) for x in range(N)] for y in range(N)]
    g2 = [row[:] for row in g]
    for y in range(N):
        for x in range(N):
            if 4 <= g[y][x] < 5 and g[y][(x - 1) % N] < g[y][x]:
                g2[y][x] = g[y][x] + 1
    g = g2
    for x, y0, ln in WRINKLES:
        for i in range(ln):
            put(g, x, y0 + i, min(2, g[(y0 + i) % N][x % N]))
    for x, y, ln in LENTICELS:
        for j in range(ln):
            put(g, x + j, y, 1)
            put(g, x + j, y + 1, 5)
        put(g, x - 1, y, 2)
        put(g, x + ln, y, 2)
    for x, y in GLINTS:
        put(g, x, y, "g3")
        put(g, x, y + 1, "g2")
    return g


# ---- cut end ----
def rings_level(x, y, cx=7.3, cy=7.7, p=3.2):
    dx, dy = abs(x - cx), abs(y - cy)
    return (dx ** p + dy ** p) ** (1 / p)


def cut_end(stripped):
    g = blank(2)
    for y in range(N):
        for x in range(N):
            r = rings_level(x, y)
            if r < 1.2:
                v = "g1"
            elif r < 2.0:
                v = 3
            elif r < 2.9:
                v = 1
            elif r < 4.0:
                v = 2
            elif r < 4.7:
                v = 3
            elif r < 5.4:
                v = 0
            else:
                v = 2
            g[y][x] = ("w", v) if isinstance(v, int) else v
    # light from the top-left: lighter texels on upper-left ring edges
    for y in range(1, N - 1):
        for x in range(1, N - 1):
            if g[y][x] == ("w", 2) and g[y - 1][x] == ("w", 0) and x < 8:
                g[y][x] = ("w", 3)
    # gold sap ring just inside the bark ("mallorn" = gold-tree); lighter on the top-left sides
    for i in range(1, N - 1):
        for x, y in [(i, 1), (i, N - 2), (1, i), (N - 2, i)]:
            lit = y == 1 or x == 1
            g[y][x] = ("g", 2 if lit and (x + y) % 4 else 1)
    # rim: bark (or stripped sapwood)
    rim_bark = [3, 4, 3, 2, 3, 3, 4, 5, 3, 2, 3, 4, 3, 3, 1, 3]
    for i in range(N):
        for k, (x, y) in enumerate([(i, 0), (N - 1, N - 1 - i), (N - 1 - i, N - 1), (0, i)]):
            t = rim_bark[(i + 5 * k) % N]
            if stripped:
                g[y][x] = ("w", min(4, max(1, t - 1)))
            else:
                g[y][x] = ("b", t)
    # a radial check (drying crack) from the heart towards the lower right
    for x, y in [(9, 9), (10, 10), (11, 11)]:
        g[y][x] = ("w", 0)
    g[12][12] = ("w", 1)
    return g


# ---- stripped side: long straight grain from a tone field ----
# Tone field: a sum of cosines with whole-number periods over the tile (tiles exactly), mostly vertical,
# with a slight sideways sway per row.
S_WAVES = [(2, 0, 0.9, 1.1), (3, 0, 0.5, 0.2), (5, 1, 0.45, 3.3), (7, 1, 0.3, 5.0), (1, 1, 0.3, 0.9)]
S_SWAY = [(1, 0.4, 2.0)]  # (y freq, amplitude in texels, phase)
S_LEVELS = [(-1.1, 1), (0.1, 2), (1.0, 3), (99, 4)]  # threshold -> wood tone
S_LINES = [(4, 2, 6), (11, 9, 5), (14, 0, 3)]  # (x, y_start, length): darker grain lines


def stripped_side():
    g = [[("w", quantise(wave_field(S_WAVES, S_SWAY, x, y), S_LEVELS)) for x in range(N)] for y in range(N)]
    for x, y0, ln in S_LINES:
        for i in range(ln):
            put(g, x, y0 + i, ("w", 1 if i in (0, ln - 1) else 0))
    return g


# ---- silver planks: full-length boards (owner's design, 2026-09-30) ----
# Palette for plank-family art. Every entry is a distinct colour so SILVER_TO_GOLD is a clean colour map
# (the seam is a hair darker than the board shade for that reason).
PLANK = {
    "peg": (128, 135, 149),   # soft peg / short deeper gap in a seam
    "seam": (138, 145, 158),
    2: BARK[2], 3: BARK[3], 4: BARK[4], 5: BARK[5],
}
BOARDS = [(4, 4), (5, 3), (3, 4), (4, 4)]  # (height incl. seam, base tone); uneven widths break the stripes
STROKES = [  # long grain strokes: (board, row, x start, length, tone offset); wrap horizontally
    (0, 1, 2, 7, +1), (0, 2, 10, 5, -1), (1, 1, 6, 8, +1), (1, 2, 0, 4, -1), (1, 3, 9, 6, +1),
    (1, 2, 13, 5, -1), (2, 1, 4, 6, -1), (2, 1, 12, 3, +1), (3, 1, 8, 7, +1), (3, 2, 1, 5, -1),
]
PEGS = {(0, 5), (0, 6), (1, 12), (2, 1), (3, 9), (3, 10)}  # (board, x) in the seam row


def planks():
    g = blank(4)
    y0 = 0
    for b, (h, base) in enumerate(BOARDS):
        for x in range(N):
            g[y0][x] = base + 1  # top edge of a board catches the light
            for r in range(1, h - 1):
                g[y0 + r][x] = base
            g[y0 + h - 1][x] = "peg" if (b, x) in PEGS else "seam"
        for bb, r, xs, ln, off in STROKES:
            if bb == b and r < h - 1:
                for i in range(ln):
                    g[y0 + r][(xs + i) % N] = base + off
        y0 += h
    assert y0 == N
    return g


# ---- silver -> golden (heartwood) colour map ----
SILVER_TO_GOLD = {
    BARK[0]: (110, 88, 60),
    BARK[1]: (128, 106, 74),
    PLANK["peg"]: (126, 104, 72),
    PLANK["seam"]: WOOD[0],
    BARK[2]: WOOD[1],
    BARK[3]: WOOD[2],
    BARK[4]: WOOD[3],
    BARK[5]: WOOD[4],
    # gold accents swap the other way: gold on silver art becomes silver on the heartwood twin (owner, 2026-10-01)
    GOLD[0]: BARK[1],
    GOLD[1]: BARK[3],
    GOLD[2]: BARK[4],
    GOLD[3]: BARK[5],
}


# ---- fence post: 4 sides x 4 columns (north, west, south, east as the model maps them) ----
# Owner's design (2026-10-01): vanilla 4x4 post, wood grain streaks, a knot on two sides, and one painted leaf per side
# (like the falling-leaf particle), neighbouring sides at different heights. Gold on silver, silver on the heartwood twin.
POST_LEAVES = [(0, 3, False), (1, 9, True), (2, 5, False), (3, 10, True)]  # (side, top row, mirrored)
POST_LEAF = ["AA..",   # tip top-left, stalk bottom-right; A light, B mid, C deep gold, S stalk
             "ABB.",
             ".BBC",
             "..CC",
             "...S"]
POST_KNOTS = {0: (1, 13), 2: (2, 1)}  # side: (x, y) dark eye, lit texel above (below at the top edge)


def fence_post():
    import random
    rng = random.Random(7)  # fixed seed: the same grain every run
    g = [[4] * N for _ in range(N)]
    for f in range(4):
        for x in range(4):
            col = [[5, 4, 4, 3][x] - (1 if f == 3 else 0)] * N  # lit left, shaded right, east side a step darker
            y = rng.randrange(3)
            while y < N:  # grain streaks: 2-5 texels one step lighter or darker, gaps of 1-4
                ln, d = rng.randint(2, 5), rng.choice((-1, -1, 1))
                for i in range(y, min(N, y + ln)):
                    col[i] += d
                y += ln + rng.randint(1, 4)
            for y in range(N):
                g[y][4 * f + x] = 5 if y == 0 else min(5, max(2, col[y]))
    for f, (kx, ky) in POST_KNOTS.items():
        g[ky][4 * f + kx] = "seam"
        g[ky - 1 if ky else ky + 1][4 * f + kx] = 5
    for f, top, mirror in POST_LEAVES:
        for r, row in enumerate(POST_LEAF):
            for c, ch in enumerate(row[::-1] if mirror else row):
                if ch != ".":
                    g[top + r][4 * f + c] = {"A": ("g", 2), "B": ("g", 1), "C": ("g", 0), "S": "seam"}[ch]
    return g


def _lum(c):
    return 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]


# brightness fallback: silver anchors only (the gold->silver swap entries would pull greys towards silver)
_ANCHORS = sorted((_lum(s), g) for s, g in SILVER_TO_GOLD.items() if s not in GOLD)


def to_gold(c):
    """Map one silver colour: exact entry if listed, else by brightness between the golden anchors."""
    if c in SILVER_TO_GOLD:
        return SILVER_TO_GOLD[c]
    L = _lum(c)
    if L <= _ANCHORS[0][0]:
        return _ANCHORS[0][1]
    for (l0, g0), (l1, g1) in zip(_ANCHORS, _ANCHORS[1:]):
        if L <= l1:
            t = (L - l0) / (l1 - l0) if l1 > l0 else 0
            return tuple(round(a + (b - a) * t) for a, b in zip(g0, g1))
    return _ANCHORS[-1][1]


def recolour(im):
    im = im.convert("RGBA")
    out = Image.new("RGBA", im.size)
    for y in range(im.height):
        for x in range(im.width):
            r, g, b, a = im.getpixel((x, y))
            out.putpixel((x, y), to_gold((r, g, b)) + (a,))
    return out


def to_image(g, default_ramp):
    im = Image.new("RGBA", (N, N))
    for y in range(N):
        for x in range(N):
            v = g[y][x]
            if v in ("peg", "seam"):
                c = PLANK[v]
            elif isinstance(v, str):  # "g1"
                c = GOLD[int(v[1])]
            elif isinstance(v, tuple):
                ramp = {"b": BARK, "w": WOOD, "g": GOLD}[v[0]]
                c = ramp[v[1]]
            else:
                c = default_ramp[v]
            im.putpixel((x, y), c + (255,))
    return im


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("out", nargs="?", help="textures folder (default: the pack's lothlorien_rp/textures)")
    a = ap.parse_args()
    here = os.path.dirname(os.path.abspath(__file__))
    pack = os.path.join(here, "..", "lothlorien_rp", "textures")
    out = a.out or pack
    for sub in ("blocks", "items"):
        os.makedirs(os.path.join(out, sub), exist_ok=True)
    silver_planks = to_image(planks(), PLANK)
    files = {
        "blocks/mallorn_log_side.png": to_image(bark_side(), BARK),
        "blocks/mallorn_log_top.png": to_image(cut_end(False), WOOD),
        "blocks/mallorn_stripped_log_side.png": to_image(stripped_side(), WOOD),
        "blocks/mallorn_stripped_log_top.png": to_image(cut_end(True), WOOD),
        "blocks/mallorn_planks.png": silver_planks,
        "blocks/mallorn_heartwood_planks.png": recolour(silver_planks),
    }
    silver_post = to_image(fence_post(), PLANK)
    files["blocks/mallorn_fence_post.png"] = silver_post
    files["blocks/mallorn_heartwood_fence_post.png"] = recolour(silver_post)
    for name, im in files.items():
        assert im.size == (N, N) and all(p[3] == 255 for p in im.get_flattened_data()), name
    # golden twins of silver art that is not generated here (door, trapdoor: placeholders for now)
    for src, dst in [
        ("blocks/mallorn_door_bottom.png", "blocks/mallorn_heartwood_door_bottom.png"),
        ("blocks/mallorn_door_top.png", "blocks/mallorn_heartwood_door_top.png"),
        ("blocks/mallorn_trapdoor.png", "blocks/mallorn_heartwood_trapdoor.png"),
        ("items/mallorn_door.png", "items/mallorn_heartwood_door.png"),
    ]:
        files[dst] = recolour(Image.open(os.path.join(pack, src)))
    for name, im in files.items():
        im.save(os.path.join(out, name))
    print("wrote", len(files), "textures to", os.path.normpath(out))


if __name__ == "__main__":
    main()
