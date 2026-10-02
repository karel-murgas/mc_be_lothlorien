"""Western Corn (the lembas grain): 8 growth stages + seeds and grain icons.

Lore (Tolkien Gateway "Lembas"): "corn" in Tolkien's English is wheat-like grain; Yavanna made the lembas grain in Aman
and Orome gave it to the Elves. Tolkien does not describe the plant, so the look is ours and must NOT be vanilla wheat:
tall straw stalks that bend under heavy gold ears with long silver awns, over cool blue-green blades (wheat: yellow-green,
upright spikes). Owner picked this concept (A, "nodding ears") from three on 2026-10-01. Palettes are the Mallorn ones
(tools/make_mallorn_leaves.py GOLD / SILVER); no tint is applied by the block.

The crop block is `minecraft:geometry.cross` (two crossed planes): every stage is a full 16x16 tile, cutout (alpha 0/255),
ground on the bottom row. Stage 7 (ripe) must be unmistakable: the only stage with gold and nodding ears.

  python -B tools/make_western_corn.py [OUT_DIR]     (default lothlorien_rp/textures; writes blocks/ and items/)
"""
import math
import os
import sys
from PIL import Image

N = 16
PAL = {
    # cool silvery greens (wheat's are yellow-green)
    "n": (34, 96, 72), "m": (58, 136, 92), "l": (104, 178, 120), "k": (168, 212, 170),
    # pale unripe green-gold
    "h": (150, 190, 80), "H": (190, 214, 100),
    # gold (Mallorn GOLD ramp)
    "A": (104, 64, 18), "a": (156, 100, 22), "b": (206, 150, 30), "c": (240, 192, 52), "d": (255, 228, 118),
    # silver awns (Mallorn SILVER ramp)
    "S": (96, 128, 126), "T": (132, 164, 158), "U": (166, 194, 186), "V": (204, 224, 216), "W": (240, 248, 244),
    # straw
    "s": (170, 150, 70), "t": (200, 182, 96), "r": (150, 90, 50),
}


def blank():
    return Image.new("RGBA", (N, N), (0, 0, 0, 0))


def px(i, x, y, c):
    x, y = int(x), int(y)
    if 0 <= x < N and 0 <= y < N:
        i.putpixel((x, y), PAL[c] + (255,))


def blit(i, rows, x, y):
    for dy, row in enumerate(rows):
        for dx, c in enumerate(row):
            if c in PAL:
                px(i, x + dx, y + dy, c)


def blade(i, bx, tx, ty, bend, ramp=("n", "m", "m", "l", "k"), wide=False):
    """arched blade from the ground at column bx to tip (tx, ty); two pixels wide on its lower third, tip leans out"""
    steps = 64
    for s in range(steps + 1):
        t = s / steps
        x = bx + (tx - bx) * t + bend * 4 * t * (1 - t) + bend * t * t * 0.0
        y = 15 - (15 - ty) * t
        x = min(15.0, max(0.0, x))  # an arch that would leave the tile bends along its edge instead of being cut
        c = ramp[min(len(ramp) - 1, int(t * len(ramp)))]
        px(i, x, y, c)
        if wide and t < 0.34:
            px(i, x + (1 if bend >= 0 else -1) * -1, y, ramp[0] if t < 0.2 else ramp[1])


def stalk(i, x, top, ch="m", hi="l"):
    for y in range(top, 16):
        px(i, x, y, ch if y >= top + 1 else hi)


# blades per stage: (base col, tip col, tip row, bend)
BLADES = {
    0: [(3, 2, 12, -0.8), (8, 8.5, 11, 0.4), (12, 13, 12, 0.8)],
    1: [(2, 0.5, 10, -1.0), (6, 6, 9, -0.2), (9, 10.5, 9, 0.7), (13, 14.5, 10, 0.8)],
    2: [(1, 0, 8, -1.2), (4, 3.5, 7, -0.5), (7, 8, 6, 0.3), (10, 11.5, 7, 0.8), (13, 15, 8, 1.1)],
    3: [(1, 0, 8, -1.4), (4, 3, 6, -0.6), (6, 7, 5, 0.3), (9, 10.5, 6, 0.7), (11, 12.5, 7, 0.9), (14, 15, 8, 0.8)],
    4: [(1, 0, 6, -1.6), (3, 2, 4, -0.7), (6, 7, 5, 0.2), (8, 10, 4, 0.9), (11, 12.5, 5, 0.9), (14, 15.5, 7, 0.9)],
}
# the stalks that carry the ears (col, top row of the ripe plant): same positions in stages 5-7
STALKS = [(3, 1), (7, 3), (14, 5)]

EAR_BUD = ["l", "H"]                                      # stage 5: the ear swelling inside the sheath
EAR_UNRIPE = ["H.", "hH", "hh", "hl", "ll"]               # stage 6: upright, pale green-gold, short awns added below
EAR_RIPE_LEFT = [          # stalk on the right edge (col 2), ear and awns hang left
    "tt.",
]


def ear_ripe(i, side, x, top):
    """ripe ear: the stalk top bends over, the ear hangs beside it, silver awns on the outer side"""
    if side < 0:
        rows = [".Vdcs", "..cbs", ".Wdcs", "..cbs", ".Vdcs", "..cbs", ".Wdcs", "..bas"]
        px(i, x - 1, top, "t")
        px(i, x, top, "t")
        blit(i, rows, x - 3, top + 1)
    else:
        rows = ["sdcV.", "scb..", "sdcW.", "scb..", "sdcV.", "scb..", "sdcW.", "sba.."]
        px(i, x, top, "t")
        px(i, x + 1, top, "t")
        blit(i, rows, x, top + 1)


def stage(k):
    i = blank()
    if k <= 4:
        for (bx, tx, ty, bend) in BLADES[k]:
            blade(i, bx, tx, ty, bend)
        return i
    # stages 5-7: the blade clump of stage 4 stays (never smaller than the stage before; ripe leaves droop two rows),
    # and the stalks rise above it
    drop = 2 if k == 7 else 0
    ramp = {5: ("n", "m", "l", "k", "k"), 6: ("n", "m", "l", "H", "H"), 7: ("n", "m", "l", "t", "t")}[k]
    for (bx, tx, ty, bend) in BLADES[4]:
        blade(i, bx, tx, ty + drop, bend, ramp)
    for n, (sx, top) in enumerate(STALKS):
        if k == 5:
            t = (3, 4, 6)[n]
            stalk(i, sx, t, "m", "l")
            for dy, c in enumerate(EAR_BUD):
                px(i, sx, t - 1 + dy, c)
        elif k == 6:
            t = (5, 6, 9)[n]
            stalk(i, sx, t, "m", "h")
            blit(i, EAR_UNRIPE, sx, t - 4)
            px(i, sx - 1, t - 2, "k")
            px(i, sx + 2, t - 3, "k")
        else:
            stalk(i, sx, top + 1, "s", "t")
            ear_ripe(i, 1 if n == 1 else -1, sx, top)
    if k == 7:
        for y in (14, 15):
            for (sx, _) in STALKS:
                px(i, sx, y, "a")
    return i


# ------------------------------------------------------------------------------ item icons
GRAIN_SHAPE = ["dc", "cb", "ba"]   # one slender gold grain, light top-left
SEED_AT = [(4, 8), (7, 5), (9, 9), (5, 11), (11, 6), (8, 12), (2, 12)]


def seeds_icon():
    """a small heap of slender gold grains, each with a silver husk tip (2D icon, light top-left)"""
    i = blank()
    for (x, y) in SEED_AT:
        blit(i, GRAIN_SHAPE, x, y)
        px(i, x + 1, y - 1, "V")
    return i


def grain_icon():
    """a bound sheaf, diagonal like the vanilla wheat item: three straw stalks fan up-right from a leaf-green band,
    each ending in a short gold ear with silver awns"""
    i = blank()
    base = (3.0, 13.0)
    for (tx, ty) in [(6.5, 2.5), (10.5, 4.5), (12.5, 8.5)]:
        steps = 40
        pts = []
        for n in range(steps + 1):
            t = n / steps
            pts.append((base[0] + (tx - base[0]) * t, base[1] + (ty - base[1]) * t))
        for (x, y) in pts[:-12]:
            px(i, x, y, "s" if (int(x) + int(y)) % 2 else "t")
        ear = pts[-14:]
        for n, (x, y) in enumerate(ear):
            px(i, x, y, "c")
            px(i, x + 1, y, "b" if n % 3 else "d")
            px(i, x, y + 1, "d" if n % 3 == 0 else "c")
            if n % 4 == 1:
                px(i, x + 2, y - 1, "V")
        px(i, ear[-1][0] + 1, ear[-1][1] - 1, "W")
    # band: a leaf-green strip with two tails
    blit(i, ["mlm", "lmm", "mmn"], 3, 11)
    px(i, 2, 14, "m"); px(i, 4, 14, "l"); px(i, 5, 15, "m")
    for (x, y) in [(2, 14), (3, 15), (4, 15)]:
        px(i, x, y, "s")
    return i


def icon(rows):
    i = blank()
    for y, row in enumerate(rows):
        assert len(row) == N, (y, row)
        for x, c in enumerate(row):
            if c in PAL:
                px(i, x, y, c)
    return i


def check_rooted(img, name):
    """every piece of a crop texture must reach the ground row or be joined to one that does (no floating bits)"""
    pts = {(x, y) for x in range(N) for y in range(N) if img.getpixel((x, y))[3]}
    seen = set()
    for p in sorted(pts, key=lambda t: -t[1]):
        if p in seen:
            continue
        stack, comp = [p], []
        seen.add(p)
        while stack:
            q = stack.pop()
            comp.append(q)
            for dx in (-1, 0, 1):
                for dy in (-1, 0, 1):
                    r = (q[0] + dx, q[1] + dy)
                    if r in pts and r not in seen:
                        seen.add(r)
                        stack.append(r)
        assert any(y == N - 1 for _, y in comp), f"{name}: floating piece near {comp[0]}"


def pad_colour(img):
    """transparent pixels carry their opaque neighbours' colour (not black): mips then do not draw dark edges"""
    out = img.copy()
    for _ in range(3):
        src = out.copy()
        for y in range(N):
            for x in range(N):
                if src.getpixel((x, y))[3]:
                    continue
                near = [src.getpixel((x + dx, y + dy)) for dx in (-1, 0, 1) for dy in (-1, 0, 1)
                        if 0 <= x + dx < N and 0 <= y + dy < N and (dx or dy)
                        and (src.getpixel((x + dx, y + dy))[3] or src.getpixel((x + dx, y + dy))[:3] != (0, 0, 0))]
                if near:
                    out.putpixel((x, y), tuple(sum(c[j] for c in near) // len(near) for j in range(3)) + (0,))
    return out


def main():
    here = os.path.dirname(os.path.abspath(__file__))
    out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(here, "..", "lothlorien_rp", "textures")
    os.makedirs(os.path.join(out, "blocks"), exist_ok=True)
    os.makedirs(os.path.join(out, "items"), exist_ok=True)
    tops = []
    for k in range(8):
        img = stage(k)
        check_rooted(img, f"stage {k}")
        tops.append(min(y for y in range(N) for x in range(N) if img.getpixel((x, y))[3]))
        pad_colour(img).save(os.path.join(out, "blocks", f"western_corn_stage_{k}.png"))
    # a crop never gets smaller while growing: the highest pixel only rises (ripe stage: ears may hang one row lower)
    assert all(tops[k + 1] <= tops[k] for k in range(6)) and tops[7] <= tops[6] + 1, f"plant shrinks: top rows {tops}"
    print("top row per stage", tops)
    pad_colour(seeds_icon()).save(os.path.join(out, "items", "western_corn_seeds.png"))
    pad_colour(grain_icon()).save(os.path.join(out, "items", "western_corn_grain.png"))
    print("written 8 stages + seeds + grain")


if __name__ == "__main__":
    main()
