"""Falling Mallorn leaves (particle `lothlorien:falling_leaf`): a 40x8 sheet of five 8x8 sprites, one picked at random per particle.

Lore (Tolkien Gateway "Mallorn", LotR II 6): the golden leaves fall when the spring green comes, and the boughs are laden with
yellow flowers: so four gold leaves (different length, width and curl, so a drift of them never looks copied) and one pale
yellow blossom. Same gold ramp as the leaf litter and the Mallorn blossoms (make_mallorn_leaves.py / make_mallorn_blossoms.py).
Sprites are drawn lit from the top-left; the particle spins them, so the base angle does not matter. They are about 2 px across in
game (0.12 block), so each reads by its silhouette and one highlight; no dark outline (it would turn to mush at that size).

  python -B tools/make_falling_leaf.py [OUT_DIR]      (default lothlorien_rp/textures/particle)
"""
import os
import sys
from PIL import Image

W = 8
GOLD = {"A": (104, 64, 18), "a": (156, 100, 22), "b": (206, 150, 30), "c": (240, 192, 52), "d": (255, 228, 118),
        "y": (255, 236, 79), "Y": (254, 214, 57), "o": (211, 150, 50)}


LEAVES = [   # hand-drawn 8x8, lit from the top-left: d lightest .. a darkest (rib, shade), A the stalk
    ["dc......",
     "cdcb....",
     ".cdcbb..",
     "..cbcab.",
     "...cbab.",
     "....bab.",
     ".....aA.",
     "......A."],      # slim leaf, tip up-left
    ["....ddc.",
     "..ddccbb",
     ".dccbcbb",
     ".dcbbbab",
     "..cbbab.",
     "..bbab..",
     ".Aab....",
     "A......."],      # broad leaf, tip up-right
    ["...dc...",
     "..dcb...",
     "..dcbb..",
     "..cbbab.",
     "..cbab..",
     "...bab..",
     "....a...",
     "....A..."],      # upright, a little curled
    ["........",
     "........",
     "..dc....",
     ".dccbb..",
     "dccbaabA",
     ".cbbab..",
     "..bb....",
     "........"],      # small spear leaf lying sideways
]
FLOWER = ["...yy...", "..yyYy..", ".yyoYyy.", "yyYooYyy", ".yyYYyy.", "..yyYy..", "...yY...", "........"]


def sprite(rows):
    img = Image.new("RGBA", (W, W), (0, 0, 0, 0))
    for y, row in enumerate(rows):
        assert len(row) == W, row
        for x, c in enumerate(row):
            if c in GOLD:
                img.putpixel((x, y), GOLD[c] + (255,))
    return img


def sheet():
    frames = [sprite(r) for r in LEAVES] + [sprite(FLOWER)]
    img = Image.new("RGBA", (W * len(frames), W), (0, 0, 0, 0))
    for k, f in enumerate(frames):
        img.alpha_composite(f, (k * W, 0))
    return img


def pad_colour(img):
    """hidden texels carry a neighbour colour, not black (no dark fringe when the particle is filtered)"""
    out = img.copy()
    w, h = img.size
    for _ in range(2):
        src = out.copy()
        for y in range(h):
            for x in range(w):
                if src.getpixel((x, y))[3]:
                    continue
                near = [src.getpixel((x + dx, y + dy)) for dx in (-1, 0, 1) for dy in (-1, 0, 1)
                        if 0 <= x + dx < w and 0 <= y + dy < h and (dx or dy)
                        and (src.getpixel((x + dx, y + dy))[3] or src.getpixel((x + dx, y + dy))[:3] != (0, 0, 0))]
                if near:
                    out.putpixel((x, y), tuple(sum(c[j] for c in near) // len(near) for j in range(3)) + (0,))
    return out


def main():
    here = os.path.dirname(os.path.abspath(__file__))
    out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(here, "..", "lothlorien_rp", "textures", "particle")
    os.makedirs(out, exist_ok=True)
    img = sheet()
    assert all(p[3] in (0, 255) for p in img.getdata())
    pad_colour(img).save(os.path.join(out, "mallorn_leaf.png"))
    print("written", img.size, "opaque", sum(1 for p in img.getdata() if p[3]))


if __name__ == "__main__":
    main()
