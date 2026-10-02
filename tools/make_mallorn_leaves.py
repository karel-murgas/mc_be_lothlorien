"""Mallorn leaves (live trees): the "spring" look from Tolkien - green above, silver beneath - on BIG leaves.

Lore (LotR II 6, Tolkien Gateway "Mallorn"): beech-like trees whose leaves are "much larger and longer" than
beech leaves, pale green above, silver beneath. The golden look is the autumn/ground variant (step 2, not here).

Three textures share ONE leaf silhouette (so the cutout matches on every face):
  mallorn_leaves_side    bottom 25 % silver, 2 px blend (starts inside the silver zone), vivid green above
  mallorn_leaves_top     all vivid green
  mallorn_leaves_bottom  all silver
Golden twins (autumn / ground leaves, owner 2026-10-01): mallorn_golden_leaves (same layout, all gold, every
face) for the crafted golden block, and mallorn_leaf_carpet (the litter: loose gold leaves on an 8x8 quarter tile).
Colours are never biome-tinted. Deterministic; the leaf layout is data (LEAVES).

  python -B tools/make_mallorn_leaves.py [OUT_DIR]     (default lothlorien_rp/textures/blocks)
"""
import math
import os
import random
import shutil
import sys
from PIL import Image

N = 16
# shade index 0 (darkest) .. 4 (lightest) per colour; ramps shift hue (cool shadows, warm lights)
GREEN = [(22, 76, 38), (36, 108, 44), (56, 146, 46), (88, 180, 54), (136, 208, 80)]
# silver leaf = minty/teal-tinted so it never matches the neutral grey bark of the logs
SILVER = [(62, 92, 94), (96, 128, 126), (132, 164, 158), (166, 194, 186), (204, 224, 216)]

GOLD = [(104, 64, 18), (156, 100, 22), (206, 150, 30), (240, 192, 52), (255, 228, 118)]

# silver zone: rows 12..15 (25 %); blend = rows 11 and 12 (t = share of silver), rows 13-15 pure silver
SILVER_SHARE = {11: 1 / 3, 12: 2 / 3}
for _y in (13, 14, 15):
    SILVER_SHARE[_y] = 1.0

# Leaves overlap in three layers (depth 0 back .. 2 front), painted back to front, so the FRONT leaves set the
# visible size and the ones behind only peek out. (depth, centre x, centre y, angle deg, half length, half width);
# the tile wraps. Layout picked by a seed search: ~85 see-through pixels in small scattered gaps.
LEAVES = [
    (0, 5.8, 9.3, 44, 5.3, 2.4), (0, 13.2, 0.8, -15, 5.0, 2.5), (0, 15.0, 9.1, 28, 4.8, 2.3),
    (0, 4.6, 1.9, 69, 4.8, 2.3),
    (1, 10.2, 5.8, -48, 5.7, 2.7), (1, 9.4, 13.1, -47, 6.0, 2.7), (1, 0.0, 5.3, 19, 5.3, 2.5),
    (1, 1.9, 13.4, -70, 5.4, 2.8),
    (2, 2.8, 3.3, 48, 6.5, 2.9), (2, 8.1, 10.6, -32, 6.5, 2.8), (2, 2.0, 10.4, -29, 6.5, 2.8),
    (2, 8.2, 1.8, -66, 6.4, 2.8),
]
GAPS = 64  # see-through pixels wanted (vanilla leaves: 78-112; owner asked for fewer), carved as small scattered gaps


def leaf_pixels(cx, cy, ang, L, W, n=N, rim=0.9):
    """Yield (x, y, v, edge) for the pixels of one pointed leaf: v = side across the midrib in -1..1."""
    a = math.radians(ang)
    ca, sa = math.cos(a), math.sin(a)
    seen = {}
    r = int(L) + 2
    for py in range(int(cy) - r, int(cy) + r + 1):
        for px in range(int(cx) - r, int(cx) + r + 1):
            dx, dy = px + 0.5 - cx, py + 0.5 - cy
            u = dx * ca + dy * sa
            v = -dx * sa + dy * ca
            if abs(u) > L:
                continue
            w = W * (1 - abs(u / L) ** 1.7)
            if abs(v) <= w:
                seen[(px % n, py % n)] = (v, u, abs(v) > w - rim, abs(v) < 0.55)
    return seen


BODY = {0: (0, 1), 1: (1, 2), 2: (2, 3)}  # (shaded side, lit side) per depth: back leaves darker
EDGE = {0: 0, 1: 0, 2: 1}  # outline shade: separates a leaf from the ones behind it


def build_shade():
    """Return {(x, y): shade 0..4} for opaque pixels (absent = transparent)."""
    shade = {}
    edges = {}  # leaf-edge pixels (not the midrib): where gaps may open
    for depth, cx, cy, ang, L, W in LEAVES:
        dark, lit = BODY[depth]
        for (x, y), (v, u, edge, rib) in leaf_pixels(cx, cy, ang, L, W).items():
            if rib:
                s = EDGE[depth] if abs(u) > L * 0.8 else min(lit + 1, 4)  # midrib a ray of light, dark at the tips
            elif edge:
                s = EDGE[depth]
            else:
                s = lit if v < 0 else dark  # light from the top-left side
            shade[(x, y)] = s
            edges[(x, y)] = edge and not rib
    carve(shade, edges)
    return shade


def carve(shade, edges):
    """Punch GAPS - (already empty) pixels into the foliage: small 1-3 px gaps on leaf edges, well apart."""
    rnd = random.Random(11)
    cand = sorted(xy for xy, e in edges.items() if e)
    rnd.shuffle(cand)
    need = GAPS - (N * N - len(shade))
    gaps = []

    def far(xy, d):
        return all(min(abs(xy[0] - g[0]), N - abs(xy[0] - g[0])) + min(abs(xy[1] - g[1]), N - abs(xy[1] - g[1])) >= d for g in gaps)

    for d in (4, 3, 2, 1):  # relax the spacing only if the quota is not met
        for xy in cand:
            if need <= 0:
                break
            if xy[1] >= 11 and rnd.random() < 0.75:
                continue  # keep the silver band mostly solid so it reads
            if xy in shade and far(xy, d):
                size = rnd.choice((1, 2, 2, 3))
                cluster = [xy]
                while len(cluster) < size:
                    nb = [((cluster[-1][0] + dx) % N, (cluster[-1][1] + dy) % N) for dx, dy in ((1, 0), (0, 1), (-1, 0), (0, -1))]
                    nb = [q for q in nb if q in shade and q not in cluster and not (q in edges and not edges[q])]
                    if not nb:
                        break
                    cluster.append(rnd.choice(nb))
                for q in cluster[:need]:
                    del shade[q]
                    need -= 1
                gaps.append(xy)


def render(shade, kind):
    img = Image.new("RGBA", (N, N), (0, 0, 0, 0))
    for (x, y), s in shade.items():
        if kind == "top":
            t = 0.0
        elif kind == "bottom":
            t = 1.0
        else:
            t = SILVER_SHARE.get(y, 0.0)
        g, sv = GREEN[s], SILVER[min(s + 1, 4)]  # silver one step lighter: it must read as silver
        img.putpixel((x, y), tuple(round(g[i] + (sv[i] - g[i]) * t) for i in range(3)) + (255,))
    return img


def render_gold(shade):
    img = Image.new("RGBA", (N, N), (0, 0, 0, 0))
    for (x, y), s in shade.items():
        img.putpixel((x, y), GOLD[s] + (255,))
    return img


# Litter (owner, 2026-10-01): FLAT leaves (the block is a zero-thickness plane, no sides), the same bright gold as the
# leaf block, bigger than vanilla's and free to overlap, ground showing between them. Every segment of the block
# shows ITS OWN quarter of the 16x16 texture (1 top-left, 2 top-right, 3 bottom-right, 4 bottom-left;
# geometry.lothlorien.leaf_litter_N). Hand-drawn leaves (digits = GOLD ramp index: 1 outline, 2 shade,
# 3 light, 4 vein), two per quarter so no quarter reads as a square.
# litter ramp: the vanilla gold ingot's own colours (owner, 2026-10-01: take the palette from the gold block / ingot);
# digits 1 outline, 2 shade, 3 light, 4 vein; 0 is the ingot's dark brown, unused
LITTER_GOLD = [(117, 40, 2), (178, 100, 17), (220, 150, 19), (233, 177, 21), (250, 214, 74)]
SPRITES = {
    "P": ["..333.", ".3343.", "33432.", "3322.."],  # pointed, diagonal
    "Q": ["..3333.", "2344432", ".22222."],  # long, horizontal
    "R": [".33.", "3432", "2432", ".22."],  # small, round
}
# (sprite, x, y, flip x, flip y) in painting order (later on top), positions inside the 8x8 quarter
LITTER = {
    (0, 0): [("P", 0, 0, 0, 0), ("R", 4, 4, 0, 0)],
    (8, 0): [("Q", 1, 0, 1, 0), ("R", 0, 4, 1, 0)],
    (8, 8): [("R", 0, 0, 0, 1), ("P", 2, 3, 0, 1)],
    (0, 8): [("Q", 0, 1, 0, 1), ("P", 2, 4, 1, 1)],
}
ICON = [("Q", 1, 1, 0, 0), ("R", 0, 8, 0, 1), ("P", 4, 6, 1, 0)]


def paint(img, ox, oy, sprite, x, y, fx, fy, k=1):
    rows = [list(r) for r in SPRITES[sprite]]
    if fx:
        rows = [r[::-1] for r in rows]
    if fy:
        rows = rows[::-1]
    for dy, row in enumerate(rows):
        for dx, ch in enumerate(row):
            if ch.isdigit():
                for ky in range(k):  # k = pixel scale (the icon draws the leaves twice as big)
                    for kx in range(k):
                        img.putpixel((ox + x + dx * k + kx, oy + y + dy * k + ky), LITTER_GOLD[int(ch)] + (255,))


def litter_tile():
    """the 16x16 litter tile: ONE whole falling-leaf sprite per 8x8 quarter (owner, 2026-10-02: the particle leaves look much more
    like leaves than the old two or three 3-4 px fragments per quarter). Sprites come from make_falling_leaf.py so the drifting leaf and
    the one on the ground are the same drawing; quarter 1 = top-left, 2 = top-right, 3 = bottom-right (mirrored), 4 = bottom-left."""
    import make_falling_leaf as fl
    img = Image.new("RGBA", (N, N), (0, 0, 0, 0))
    img.alpha_composite(fl.sprite(fl.LEAVES[0]), (0, 0))
    img.alpha_composite(fl.sprite(fl.LEAVES[1]), (8, 0))
    img.alpha_composite(fl.sprite(fl.LEAVES[2]).transpose(Image.FLIP_LEFT_RIGHT), (8, 8))
    img.alpha_composite(fl.sprite(fl.LEAVES[3]), (0, 8))
    return fl.pad_colour(img)


def render_litter():
    img = litter_tile()
    return img, sum(1 for x in range(N) for y in range(N) if img.getpixel((x, y))[3])


def render_litter_icon():
    """the inventory icon is the same four leaves"""
    return litter_tile()


def shade_hidden(img):
    """Colour under the see-through texels (alpha stays 0, nothing changes up close). Vanilla leaves keep a dark green there;
    ours were pure black, which the far render (`alpha_test_to_opaque`) shows as black holes and mip filtering averages
    into the edges, a candidate for the flicker the owner saw while moving (2026-10-02). Each hidden texel gets the
    average of its opaque neighbours (the tile wraps) darkened to 55 %, so the holes read as shaded gaps in the leaf's own colours."""
    out = img.copy()
    for y in range(N):
        for x in range(N):
            if img.getpixel((x, y))[3]:
                continue
            near = [img.getpixel(((x + dx) % N, (y + dy) % N)) for dx in (-2, -1, 0, 1, 2) for dy in (-2, -1, 0, 1, 2)]
            near = [c for c in near if c[3]]
            if near:
                out.putpixel((x, y), tuple(int(sum(c[k] for c in near) / len(near) * 0.55) for k in range(3)) + (0,))
    return out


def main():
    here = os.path.dirname(os.path.abspath(__file__))
    out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(here, "..", "lothlorien_rp", "textures", "blocks")
    os.makedirs(out, exist_ok=True)
    shade = build_shade()
    for kind in ("side", "top", "bottom"):
        shade_hidden(render(shade, kind)).save(os.path.join(out, f"mallorn_leaves_{kind}.png"))
    shade_hidden(render_gold(shade)).save(os.path.join(out, "mallorn_golden_leaves.png"))
    litter, n = render_litter()
    litter.save(os.path.join(out, "mallorn_leaf_carpet.png"))
    items = os.path.join(out, "..", "items")
    if os.path.isdir(items):
        render_litter_icon().save(os.path.join(items, "mallorn_leaf_carpet.png"))
    print("opaque", len(shade), "of", N * N, "; litter", n, "of 256")


if __name__ == "__main__":
    main()
