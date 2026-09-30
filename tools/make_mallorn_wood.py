"""Mallorn wood textures: bark (log side), cut end (log top), stripped side and stripped top.

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


def to_image(g, default_ramp):
    im = Image.new("RGBA", (N, N))
    for y in range(N):
        for x in range(N):
            v = g[y][x]
            if isinstance(v, str):  # "g1"
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
    ap.add_argument("out", nargs="?", help="output folder (default: the pack's textures/blocks)")
    a = ap.parse_args()
    out = a.out or os.path.join(os.path.dirname(__file__), "..", "lothlorien_rp", "textures", "blocks")
    os.makedirs(out, exist_ok=True)
    files = {
        "mallorn_log_side.png": to_image(bark_side(), BARK),
        "mallorn_log_top.png": to_image(cut_end(False), WOOD),
        "mallorn_stripped_log_side.png": to_image(stripped_side(), WOOD),
        "mallorn_stripped_log_top.png": to_image(cut_end(True), WOOD),
    }
    for name, im in files.items():
        assert im.size == (N, N) and all(p[3] == 255 for p in im.get_flattened_data()), name
        im.save(os.path.join(out, name))
    print("wrote", len(files), "textures to", os.path.normpath(out))


if __name__ == "__main__":
    main()
