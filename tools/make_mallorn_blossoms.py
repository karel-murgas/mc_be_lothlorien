"""Mallorn blossom litter (fallen blossoms), the flat segmented ground cover next to the golden leaf litter.

Lore (Tolkien Gateway "Mallorn"; LotR II 6 and the Sam's-tree passage): when spring brings the new green, the boughs
are "laden with yellow flowers" and the old golden leaves fall; the Shire turned golden from Sam's mallorn bloom.
So the blossoms are small YELLOW flowers (vanilla dandelion yellows), clearly lighter and yellower than the amber
leaf litter (vanilla gold ingot ramp), with a deep-gold centre.

Same construction as the leaf litter (tools/make_mallorn_leaves.py): 16x16 texture, segment 1 = top-left quarter,
2 top-right, 3 bottom-right, 4 bottom-left; hand-drawn sprites; flat geometry (tools/make_leaf_litter_geo.py).

  python -B tools/make_mallorn_blossoms.py [OUT_DIR]      (default lothlorien_rp/textures; writes blocks/ and items/)
"""
import os
import sys
from PIL import Image

N = 16
# vanilla dandelion yellows + the gold block's centre tone; digits: 0 centre, 1 outline, 2 shade, 3 petal, 4 light
BLOSSOM = [(211, 150, 50), (241, 157, 37), (254, 214, 57), (255, 236, 79), (255, 253, 160)]
SPRITES = {
    "A": ["..3..", ".343.", "34043", ".323.", "..2.."],  # five-point star flower
    "B": [".343.", "33433", "34043", "32233", ".322."],  # round flower
    "C": [".34.", "3433", "3233", ".22."],  # loose petal
    "D": [".3.", "343", ".2."],  # small petal
}
# (sprite, x, y, flip x, flip y, pixel scale) in painting order, positions inside the 8x8 quarter
BLOSSOMS = {
    (0, 0): [("B", 0, 0, 0, 0, 1), ("C", 4, 3, 1, 0, 1), ("D", 0, 5, 0, 1, 1)],
    (8, 0): [("A", 3, 0, 0, 0, 1), ("D", 0, 4, 1, 0, 1), ("C", 4, 4, 0, 1, 1)],
    (8, 8): [("D", 0, 0, 0, 0, 1), ("B", 3, 1, 1, 0, 1), ("C", 0, 3, 0, 1, 1)],
    (0, 8): [("C", 0, 0, 1, 0, 1), ("A", 3, 3, 0, 0, 1), ("D", 1, 5, 1, 1, 1)],
}
ICON = [("B", 0, 0, 0, 0, 2), ("A", 6, 6, 0, 0, 2), ("C", 1, 11, 0, 1, 1), ("D", 12, 1, 0, 0, 1)]


def paint(img, ox, oy, sprite, x, y, fx, fy, k):
    rows = [list(r) for r in SPRITES[sprite]]
    if fx:
        rows = [r[::-1] for r in rows]
    if fy:
        rows = rows[::-1]
    for dy, row in enumerate(rows):
        for dx, ch in enumerate(row):
            if ch.isdigit():
                for ky in range(k):
                    for kx in range(k):
                        img.putpixel((ox + x + dx * k + kx, oy + y + dy * k + ky), BLOSSOM[int(ch)] + (255,))


def render():
    img = Image.new("RGBA", (N, N), (0, 0, 0, 0))
    for (ox, oy), parts in BLOSSOMS.items():
        for part in parts:
            paint(img, ox, oy, *part)
    return img


def render_icon():
    img = Image.new("RGBA", (N, N), (0, 0, 0, 0))
    for part in ICON:
        paint(img, 0, 0, *part)
    return img


def main():
    here = os.path.dirname(os.path.abspath(__file__))
    out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(here, "..", "lothlorien_rp", "textures")
    os.makedirs(os.path.join(out, "blocks"), exist_ok=True)
    os.makedirs(os.path.join(out, "items"), exist_ok=True)
    tex = render()
    tex.save(os.path.join(out, "blocks", "mallorn_blossom.png"))
    render_icon().save(os.path.join(out, "items", "mallorn_blossom.png"))
    print("blossom pixels", sum(1 for x in range(N) for y in range(N) if tex.getpixel((x, y))[3]), "of", N * N)


if __name__ == "__main__":
    main()
