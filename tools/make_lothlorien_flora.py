"""Lothlorien flora: Elanor, Niphredil, Athelas, golden fern (block texture = item icon, the same picture).

Lore (Tolkien Gateway / LotR II 6): Elanor = "small golden flowers shaped like stars", a pimpernel with sun-gold and
star-silver flowers on one plant; Niphredil = pale white (palest green) snowdrop kin on slender stalks; Athelas = a humble
sweet-smelling herb with long leaves (Tolkien describes no flower; the pale flower stalks are our invention); the golden
fern is ours. All colours are the Mallorn palettes of tools/make_mallorn_leaves.py (GREEN, GOLD, SILVER), never tinted.
Plants are 16x16, cutout (alpha 0/255), hand-drawn sprites + a parametric leaf drawer; no dark outlines.
Owner picked (2026-10-01): Elanor A, Niphredil A, Athelas B, golden fern A.

  python -B tools/make_lothlorien_flora.py [OUT_DIR]      (default lothlorien_rp/textures; writes blocks/ and items/)
"""
import math
import os
import sys
from PIL import Image

N = 16
PAL = {
    # greens (mallorn leaf GREEN ramp, no dark outlines)
    "G": (36, 108, 44), "g": (56, 146, 46), "h": (88, 180, 54), "H": (136, 208, 80),
    # gold (mallorn GOLD ramp)
    "A": (104, 64, 18), "a": (156, 100, 22), "b": (206, 150, 30), "c": (240, 192, 52), "d": (255, 228, 118),
    # silver (mallorn SILVER ramp, minty)
    "S": (96, 128, 126), "T": (132, 164, 158), "U": (166, 194, 186), "V": (204, 224, 216), "W": (240, 248, 244),
    # pale green for niphredil / athelas
    "p": (170, 214, 150), "q": (120, 184, 120),
}


def blank():
    return Image.new("RGBA", (N, N), (0, 0, 0, 0))


def blit(img, rows, x, y, flip=False):
    for dy, row in enumerate(rows):
        row = row[::-1] if flip else row
        for dx, ch in enumerate(row):
            if ch in PAL and 0 <= x + dx < N and 0 <= y + dy < N:
                img.putpixel((x + dx, y + dy), PAL[ch] + (255,))


def px(img, x, y, ch):
    if 0 <= x < N and 0 <= y < N:
        img.putpixel((x, y), PAL[ch] + (255,))


def vline(img, x, y0, y1, ch="g"):
    for y in range(y0, y1 + 1):
        px(img, x, y, ch)



# ---------------------------------------------------------------- ELANOR
STAR7 = ["...c...",
         "..dcc..",
         "cddbbcc",
         ".cbabc.",
         "..cbb..",
         ".cc.bc.",
         ".c...b."]
LEAF_L = ["hH..", ".hhg", "..gG"]


def elanor():
    """one bold sun-gold star with an amber eye, on a stem with two leaves"""
    i = blank()
    blit(i, STAR7, 4, 1)
    vline(i, 7, 6, 15)  # starts under the star body (row 5); from row 8 it left a gap
    px(i, 6, 9, "H"); px(i, 6, 10, "h")
    blit(i, LEAF_L, 3, 11)
    blit(i, LEAF_L, 9, 12, flip=True)
    px(i, 6, 15, "g"); px(i, 8, 15, "g")
    return i


# ---------------------------------------------------------------- NIPHREDIL
# Niphredil (owner round 4): every plant is TWO planes crossing on the centre line of the block, so anything drawn off-centre
# shows twice (two stems crossing, a double head). Niphredil is therefore symmetric about the centre: a two-texel stem on
# columns 7-8, the nodding bell seen from the side hanging in FRONT of the stem top (the stem shows only below it),
# and leaves in mirrored pairs.
BELL = ["..WWVV..",
        ".WWWVVU.",
        "WWWVVVUT",
        "WWVVVVUT",
        "WV.pp.UT",
        ".W.pp.T."]


def niphredil():
    """single tall snowdrop, centred: stem, nodding bell with three petal tips and a pale-green mark, mirrored leaves"""
    i = blank()
    for y in range(3, 16):        # the stem starts under the bell: nothing sticks out above the head (owner round 5)
        px(i, 7, y, "g")
        px(i, 8, y, "G")
    # mirrored leaves (the plant is crossed with itself, so the pair is what a player sees from every side)
    for (tx, ty, w, bend) in [(1.5, 8.5, 0.95, -0.7), (3.5, 11.0, 0.8, -0.4)]:
        leaf(i, 7.0, 15.5, tx, ty, w, bend, lit="H", mid="h", dark="g")
        leaf(i, 9.0, 15.5, 16 - tx, ty, w, -bend, lit="H", mid="h", dark="g")
    blit(i, BELL, 4, 3)
    return i


# ---------------------------------------------------------------- ATHELAS
def athelas():
    """long-leaf rosette (a humble weed), leaves only: owner round 4 dropped the flower stalks because the pale heads
    outweighed the leaves; five big lance leaves and two short ones with silver tips fan out from the root"""
    i = blank()
    for (tx, ty, w, bend) in [(0.5, 8.0, 1.5, -1.3), (3.5, 1.5, 1.8, -0.7), (8.0, 0.3, 1.9, 0.0), (12.5, 1.5, 1.8, 0.7),
                              (15.0, 8.0, 1.5, 1.3)]:
        leaf(i, 7.5, 15.5, tx, ty, w, bend, tip="U")
    for (tx, ty) in [(5.0, 11.5), (10.5, 11.5)]:
        leaf(i, 7.5, 15.5, tx, ty, 1.1, 0.0, tip="U")
    return i


# ---------------------------------------------------------------- shared leaf drawer
def leaf(img, bx, by, tx, ty, w, bend=0.0, lit="h", mid="g", dark="G", rib=None, tip=None):
    """pointed leaf from base to tip, max half-width w, bend = sideways bow in px; light from the top-left."""
    L = math.hypot(tx - bx, ty - by) or 1
    ux, uy = (tx - bx) / L, (ty - by) / L
    img.putpixel((min(N - 1, int(bx)), min(N - 1, int(by))), PAL[dark] + (255,))  # the base always exists
    nx, ny = -uy, ux
    for py in range(N):
        for px_ in range(N):
            dx, dy = px_ + 0.5 - bx, py + 0.5 - by
            t = (dx * ux + dy * uy) / L
            if t < 0 or t > 1:
                continue
            v = dx * nx + dy * ny - bend * 4 * t * (1 - t)
            hw = w * math.sin(math.pi * min(1, t * 1.05)) ** 0.8 + 0.25
            if abs(v) <= hw:
                side = v / hw
                # light is top-left: the side facing up-left is the lit one
                lit_side = -1 if (nx + ny) > 0 else 1
                s_ = side * lit_side
                ch = lit if s_ > 0.25 else (dark if s_ < -0.55 else mid)
                if rib and abs(v) < 0.45 and 0.15 < t < 0.8:
                    ch = rib
                if tip and t > 0.86:
                    ch = tip
                img.putpixel((px_, py), PAL[ch] + (255,))


# ---------------------------------------------------------------- GOLDEN FERN
def fern(tip_ramp, base_ramp, fronds, step=3):
    """fronds: (dx_end, top_row, bend). Arching midrib, short sparse pinnae, ramp by distance along the frond."""
    i = blank()
    for (ex, top, bend) in fronds:
        pts = []
        steps = 24
        for s in range(steps + 1):
            t = s / steps
            x = 7.5 + ex * t + bend * 4 * t * (1 - t)
            y = 15.5 - (15.5 - top) * (1 - (1 - t) ** 1.6)
            pts.append((x, y, t))
        for k, (x, y, t) in enumerate(pts):
            xi, yi = int(x), int(y)
            if 0 <= xi < N and 0 <= yi < N:
                i.putpixel((xi, yi), (tip_ramp[1] if t > 0.4 else base_ramp[1]) + (255,))
        for k in range(step + 2, len(pts) - 2, step):
            x, y, t = pts[k]
            x2, y2, _ = pts[k + 1]
            dx, dy = x2 - x, y2 - y
            ln = math.hypot(dx, dy) or 1
            nx, ny = -dy / ln, dx / ln
            L = 2.4 * (1 - t) + 1.2
            for side in (-1, 1):
                for r in (1, 2):
                    if r > L:
                        break
                    xx = int(x + side * nx * r + dx / ln * 0.9 * r)
                    yy = int(y + side * ny * r + dy / ln * 0.9 * r)
                    if 0 <= xx < N and 0 <= yy < N and i.getpixel((xx, yy))[3] == 0:
                        up = side * ny < 0  # pinna on the upper side = lit
                        ramp = tip_ramp if t > 0.4 else base_ramp
                        i.putpixel((xx, yy), (ramp[3] if up else ramp[2]) + (255,))
    return i


GOLD_R = [PAL["a"], PAL["b"], PAL["c"], PAL["d"], PAL["d"]]
GREEN_R = [PAL["G"], PAL["g"], PAL["g"], PAL["h"], PAL["H"]]
FR = [(-6.0, 4, -1.4), (0.5, 1, -0.3), (6.5, 5, 1.3)]


def fern_a():
    """green at the root, gold fronds"""
    return fern([PAL["a"], PAL["b"], PAL["b"], PAL["c"], PAL["d"]], GREEN_R, FR)



GOLD_R = [PAL["a"], PAL["b"], PAL["b"], PAL["c"], PAL["d"]]
GREEN_R = [PAL["G"], PAL["g"], PAL["g"], PAL["h"], PAL["H"]]
FRONDS = [(-6.0, 4, -1.4), (0.5, 1, -0.3), (6.5, 5, 1.3)]


def golden_fern():
    """green at the root, gold fronds"""
    return fern(GOLD_R, GREEN_R, FRONDS)


def pad_colour(img):
    """transparent pixels carry the colour of their opaque neighbours (not black): mips and filtering then blend the
    plant into itself instead of drawing dark edges or single dark pixels"""
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
                    out.putpixel((x, y), tuple(sum(c[k] for c in near) // len(near) for k in range(3)) + (0,))
    return out


def check_rooted(img, name):
    """every piece of the plant must touch the ground row or be joined (8-neighbour) to one that does: no floating leaves"""
    pts = {(x, y) for x in range(N) for y in range(N) if img.getpixel((x, y))[3]}
    seen, rooted = set(), True
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
        if not any(y == N - 1 for _, y in comp):
            print("FLOATING piece in", name, "near", comp[0])
            rooted = False
    assert rooted, name + " has a piece that does not reach the ground"


def drop_isolated(img):
    """a lone opaque pixel shimmers as a cutout (mip levels); remove any with no opaque 8-neighbour"""
    out = img.copy()
    for y in range(N):
        for x in range(N):
            if img.getpixel((x, y))[3] and not any(
                    0 <= x + dx < N and 0 <= y + dy < N and (dx or dy) and img.getpixel((x + dx, y + dy))[3]
                    for dx in (-1, 0, 1) for dy in (-1, 0, 1)):
                out.putpixel((x, y), (0, 0, 0, 0))
    return out


PLANTS = {"elanor": elanor, "niphredil": niphredil, "athelas": athelas, "golden_fern": golden_fern}


def main():
    here = os.path.dirname(os.path.abspath(__file__))
    out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(here, "..", "lothlorien_rp", "textures")
    os.makedirs(os.path.join(out, "blocks"), exist_ok=True)
    os.makedirs(os.path.join(out, "items"), exist_ok=True)
    for name, fn in PLANTS.items():
        img = pad_colour(drop_isolated(fn()))
        # self-check: cutout only
        assert all(p[3] in (0, 255) for p in img.getdata()), name
        check_rooted(img, name)
        img.save(os.path.join(out, "blocks", name + ".png"))
        img.save(os.path.join(out, "items", name + ".png"))
        print(name, "opaque px", sum(1 for p in img.getdata() if p[3]), "of", N * N)


if __name__ == "__main__":
    main()
