"""Mallorn acorn, Mallorn sapling, Great Mallorn nut and Great Mallorn sprout (replaces make_great_nut.py).

Lore (Tolkien Gateway "Sam's garden box", "Mallorn"): Galadriel's seed was "a small nut with a silver shell"; the tree has
smooth silver-grey bark, leaves green above and silver beneath (golden in autumn), and bursts into golden flowers in spring.
Our tree follows that, so:

  acorn          the common one (leaves drop it): a honey-gold nut in a silver scaled cap.
  great nut      the gift of the white deer: the lore nut, a plump SILVER-shelled one under a gold cap, with a gold leaf.
                 (colours inverted against the acorn so the two never look alike in a hotbar)
  sapling        a young Mallorn: slim silver trunk, long pointed leaves green above and silver beneath, one spring blossom.
  great sprout   a thicker silver stem with big GOLD leaves (the Great Mallorn is golden); no shell, it did not read at 16 px.

Icons are shaded by rule (light from the top-left, hue-shifted ramps, derived outline); the two plants are hand-placed leaf
and branch lists on the Mallorn palettes (GREEN, GOLD, SILVER of make_mallorn_leaves.py, BARK of make_mallorn_wood.py).
Plants are 16x16 cutouts (alpha 0/255) standing on the bottom row, with transparent texels carrying neighbour colours.

  python -B tools/make_mallorn_seeds.py [OUT_DIR]     (default lothlorien_rp/textures; writes blocks/ and items/)
"""
import math
import os
import sys
from PIL import Image

N = 16
PAL = {
    # Mallorn leaf greens (cutouts must hold against the vivid grass: darker body, light tips)
    "N": (22, 76, 38), "G": (36, 108, 44), "g": (56, 146, 46), "h": (88, 180, 54), "H": (136, 208, 80),
    # gold
    "A": (104, 64, 18), "a": (156, 100, 22), "b": (206, 150, 30), "c": (240, 192, 52), "d": (255, 228, 118),
    # minty leaf silver
    "S": (96, 128, 126), "T": (132, 164, 158), "U": (166, 194, 186), "V": (204, 224, 216), "W": (240, 248, 244),
    # bark silver (make_mallorn_wood.py BARK)
    "1": (112, 119, 134), "2": (143, 150, 162), "3": (170, 177, 185), "4": (195, 200, 204), "5": (221, 224, 223),
    # spring blossom yellow
    "y": (255, 236, 79), "Y": (254, 214, 57),
}

# ramps for the shaded icons, dark -> light
HONEY = [(120, 78, 34), (166, 112, 48), (206, 154, 74), (232, 190, 106), (250, 226, 160)]
CAPSILVER = [(74, 82, 96), (112, 120, 134), (150, 158, 170), (190, 198, 206), (228, 234, 238)]
SHELL = [(86, 98, 120), (126, 140, 162), (170, 184, 204), (212, 224, 236), (248, 252, 255)]
GOLDRAMP = [(122, 74, 22), (168, 110, 30), (212, 156, 44), (238, 196, 78), (252, 232, 150)]
LEAFGOLD = [(150, 96, 20), (206, 150, 34), (240, 196, 64), (252, 226, 120)]
STEM = [(92, 78, 60), (128, 116, 98)]
OUTLINE = (58, 44, 36)


def blank():
    return Image.new("RGBA", (N, N), (0, 0, 0, 0))


def px(i, x, y, c):
    x, y = int(x), int(y)
    if 0 <= x < N and 0 <= y < N:
        i.putpixel((x, y), (PAL[c] if isinstance(c, str) else c) + (255,))


def shade(ramp, t):
    return ramp[max(0, min(len(ramp) - 1, round(t * (len(ramp) - 1))))]


def leaf(img, bx, by, tx, ty, w, bend=0.0, ch=("h", "g", "T"), tip=None, under=(0.15, -0.35)):
    """pointed leaf from base to tip (half-width w, sideways bow bend); lit side top-left, the far side the underside"""
    L = math.hypot(tx - bx, ty - by) or 1
    ux, uy = (tx - bx) / L, (ty - by) / L
    nx, ny = -uy, ux
    lit_side = -1 if (nx + ny) > 0 else 1
    px(img, bx, by, ch[1])
    for py in range(N):
        for qx in range(N):
            dx, dy = qx + 0.5 - bx, py + 0.5 - by
            t = (dx * ux + dy * uy) / L
            if t < 0 or t > 1:
                continue
            v = dx * nx + dy * ny - bend * 4 * t * (1 - t)
            hw = w * (1 - t) ** 0.6 * (min(1, t * 5) ** 0.5) + 0.3
            if abs(v) <= hw:
                s_ = v / hw * lit_side
                c = ch[0] if s_ > under[0] else (ch[2] if s_ < under[1] else ch[1])
                if tip and t > 0.88:
                    c = tip
                px(img, qx, py, c)


def line(img, pts, ch):
    """connected 1px line through the given points"""
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        n = int(max(abs(x1 - x0), abs(y1 - y0)) * 2) + 1
        for k in range(n + 1):
            t = k / n
            px(img, x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, ch)


# ------------------------------------------------------------------------------ sapling
def sapling():
    i = blank()
    # leaves first (behind the wood): five long pointed leaves, green above, silver underside, on branch ends
    leaf(i, 4.5, 8.5, 0.0, 3.0, 1.35, -1.0)
    leaf(i, 11.5, 6.5, 15.5, 1.5, 1.35, 1.0)
    leaf(i, 7.5, 5.5, 3.0, 0.5, 1.2, -0.8)
    leaf(i, 8.5, 4.5, 8.5, 0.0, 1.1, 0.0)
    leaf(i, 6.5, 11.5, 0.5, 11.5, 1.2, -1.2)
    leaf(i, 8.5, 9.5, 15.0, 10.0, 1.2, 1.0)
    # silver trunk with the branches that carry them, lit on the left
    line(i, [(7, 15), (7, 12), (7, 9), (7, 6)], "3")
    line(i, [(7, 9), (5, 8), (4, 8)], "3")
    line(i, [(8, 8), (10, 7), (11, 6)], "3")
    line(i, [(7, 6), (8, 5), (8, 4)], "3")
    line(i, [(7, 12), (6, 11)], "3")
    line(i, [(8, 10), (8, 9)], "3")
    for y in range(6, 16):
        px(i, 7, y, "4" if y % 3 else "5")
    for (x, y) in [(8, 14), (8, 15), (6, 15), (9, 15)]:
        px(i, x, y, "2")
    px(i, 7, 15, "3")
    # one golden blossom (they open in spring) on a leaf axil
    for (x, y, c) in [(9, 6, "y"), (10, 6, "Y"), (9, 7, "Y")]:
        px(i, x, y, c)
    return i


# ------------------------------------------------------------------------------ great sprout
def sprout():
    i = blank()
    gold = ("c", "b", "a")
    leaf(i, 7.5, 9.5, 0.5, 3.0, 1.7, -1.1, gold, tip="d")
    leaf(i, 8.5, 7.5, 15.5, 1.0, 1.7, 1.1, gold, tip="d")
    leaf(i, 8.0, 6.0, 8.0, 0.0, 1.3, 0.0, gold, tip="d")
    leaf(i, 7.5, 12.0, 3.0, 10.5, 1.0, -0.6, gold, tip="d")
    leaf(i, 8.5, 11.5, 12.5, 9.5, 1.0, 0.6, gold, tip="d")
    # two-texel silver stem, lighter on the left
    for y in range(6, 15):
        px(i, 7, y, "5" if y % 3 == 0 else "4")
        px(i, 8, y, "3")
    roots(i)
    return i


def roots(i):
    """the stem meets the ground with a small flare. No shell: two rounds of shell pieces (halves, chips) read as grey
    lumps at 16 px and the owner dropped them (2026-10-02)."""
    px(i, 6, 15, "2"); px(i, 7, 15, "3"); px(i, 8, 15, "2"); px(i, 9, 15, "2")


# ------------------------------------------------------------------------------ icons
def rim_and_gloss(im, solid, ramp_edge, top_left_lighter=True):
    px_ = im.load()
    edge = [(x, y) for (x, y) in solid
            if any((x + dx, y + dy) not in solid for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))]
    for (x, y) in edge:
        lit = (x - 1, y) not in solid or (x, y - 1) not in solid
        px_[x, y] = ramp_edge(x, y, lit) + (255,)


def acorn():
    """honey-gold nut, silver scaled cap, a short brown stem with one tiny gold leaf; slim and pointed (an acorn, not the great nut)"""
    im = blank()
    p = im.load()
    solid = set()
    # nut: half-width per row, rows 7..14, tapering to a point
    HW = {7: 4.5, 8: 4.5, 9: 4.3, 10: 3.9, 11: 3.3, 12: 2.5, 13: 1.6, 14: 0.8}
    body = set()
    for y, hw in HW.items():
        for x in range(N):
            if abs(x + 0.5 - 8.0) <= hw:
                body.add((x, y))
    for (x, y) in body:
        dx = (x + 0.5 - 8.0) / 4.5
        t = 0.62 - 0.5 * dx * 0.9 - (y - 7) * 0.035
        if (x, y) in {(5, 9), (5, 10), (6, 8)}:
            t += 0.3                      # a vertical sheen
        p[x, y] = shade(HONEY, t) + (255,)
        solid.add((x, y))
    # cap: a dome of silver scales with a lip one texel wider than the nut
    cap_rows = {3: (5, 11), 4: (3, 13), 5: (2, 14), 6: (2, 14)}
    cap = set()
    for y, (x0, x1) in cap_rows.items():
        for x in range(x0, x1):
            left = (x - x0) / max(1, x1 - x0 - 1)
            scale = (x + 2 * (y % 2)) % 4 == 3
            t = 0.95 - left * 0.55 - (y - 3) * 0.06 - (0.28 if scale else 0)
            if y == 6:
                t -= 0.3                  # the lip sits in its own shadow
            p[x, y] = shade(CAPSILVER, t) + (255,)
            solid.add((x, y)); cap.add((x, y))
    # stem and a tiny leaf
    for (x, y, c) in [(8, 2, STEM[0]), (7, 2, STEM[0]), (8, 1, STEM[1])]:
        p[x, y] = c + (255,)
        solid.add((x, y))
    for (x, y, k) in [(9, 1, 0.7), (10, 0, 1.0), (10, 1, 0.5), (9, 0, 1.0), (11, 0, 0.3)]:
        p[x, y] = shade(LEAFGOLD, k) + (255,)
        solid.add((x, y))
    # derived outline: nut edge darkest honey, cap edge darkest silver, lit edges keep their colour
    for (x, y) in list(solid):
        if all((x + dx, y + dy) in solid for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
            continue
        if (x, y) in cap:
            lit = (x - 1, y) not in solid or (x, y - 1) not in solid
            p[x, y] = (CAPSILVER[3] if lit else CAPSILVER[0]) + (255,)
        elif (x, y) in body:
            lit = (x - 1, y) not in solid
            p[x, y] = (HONEY[2] if lit else HONEY[0]) + (255,)
    return im


def great_nut():
    """the lore nut: a plump silver-shelled egg (cool blue-white ramp, polish glints) with a small gold scaled cap and a gold leaf"""
    im = blank()
    p = im.load()
    solid, body, cap = set(), set(), set()
    HW = {6: 4.6, 7: 5.4, 8: 5.7, 9: 5.7, 10: 5.4, 11: 4.8, 12: 4.0, 13: 3.0, 14: 1.9, 15: 0.9}
    for y, hw in HW.items():
        for x in range(16):
            if abs(x + 0.5 - 8.0) <= hw:
                body.add((x, y))
    lx, ly = -0.62, -0.58
    for (x, y) in body:
        v = (y - 6) / 9.0
        dx = (x + 0.5 - 8.0) / 5.7
        t = 0.62 + 0.55 * (dx * lx + (v - 0.4) * 1.3 * ly) - 0.25 * max(0.0, v - 0.7)
        p[x, y] = shade(SHELL, t) + (255,)
        solid.add((x, y))
    cap_rows = {3: (6, 10), 4: (4, 12), 5: (3, 13), 6: (3, 13)}
    for y, (x0, x1) in cap_rows.items():
        for x in range(x0, x1):
            left = (x - x0) / max(1, x1 - x0 - 1)
            scale = (x + 2 * (y % 2)) % 4 == 3
            t = 0.98 - left * 0.55 - (y - 3) * 0.08 - (0.3 if scale else 0) - (0.3 if y == 6 else 0)
            p[x, y] = shade(GOLDRAMP, t) + (255,)
            solid.add((x, y)); cap.add((x, y))
    for (x, y, c) in [(7, 2, STEM[0]), (8, 2, STEM[0]), (8, 1, STEM[1])]:
        p[x, y] = c + (255,)
        solid.add((x, y))
    for (x, y), t in {(9, 1): 0.66, (10, 0): 1.0, (10, 1): 0.66, (11, 0): 0.66, (11, 1): 0.33, (12, 0): 0.0, (9, 0): 1.0}.items():
        p[x, y] = shade(LEAFGOLD, t) + (255,)
        solid.add((x, y))
    for (x, y) in list(solid):
        if all((x + dx, y + dy) in solid for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
            continue
        if (x, y) in cap:
            lit = (x - 1, y) not in solid and y < 6
            p[x, y] = (GOLDRAMP[3] if lit else GOLDRAMP[0]) + (255,)
        elif (x, y) in body:
            lit = (x - 1, y) not in solid and y < 10
            p[x, y] = (SHELL[2] if lit else SHELL[0]) + (255,)
    for (x, y) in [(4, 9), (4, 10), (5, 8)]:
        p[x, y] = SHELL[4] + (255,)
    p[4, 5] = GOLDRAMP[4] + (255,)
    return im


# ------------------------------------------------------------------------------ checks and output
def check_rooted(img, name):
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
    """transparent texels carry neighbour colour, not black (no dark mip edges)"""
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
    for name, img in (("mallorn_sapling", sapling()), ("great_mallorn_sprout", sprout())):
        check_rooted(img, name)
        pad_colour(img).save(os.path.join(out, "blocks", name + ".png"))
    for name, img in (("mallorn_acorn", acorn()), ("great_mallorn_nut", great_nut())):
        pad_colour(img).save(os.path.join(out, "items", name + ".png"))
    print("written sapling, sprout, acorn, great nut")


if __name__ == "__main__":
    main()
