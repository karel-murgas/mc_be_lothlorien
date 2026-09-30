"""Great Mallorn nut icon and sprout texture (white deer gift). Deterministic: run `python -B tools/make_great_nut.py`.

Icon: a round golden nut under a silver scaled cap with a short stem and one golden leaf, shaded by rule
(light from the top-left, hue-shifted ramps). Sprout: the Mallorn sapling's silhouette recoloured to a silver stem
and golden leaves, with a few pale blossom glints, so it reads as a relative of the sapling but not the same plant.
"""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
RP = ROOT / "lothlorien_rp" / "textures"

# ramps: dark -> light, hue shifts towards orange in the shadows and pale yellow in the lights
GOLD = [(122, 74, 22), (168, 110, 30), (212, 156, 44), (238, 196, 78), (252, 232, 150)]
SILVER = [(78, 82, 96), (118, 124, 138), (160, 166, 176), (202, 206, 212), (236, 238, 240)]
LEAF = [(150, 96, 20), (206, 150, 34), (240, 196, 64), (252, 226, 120)]
STEM = [(92, 78, 60), (128, 116, 98)]
OUTLINE = (70, 44, 16)


def shade(ramp, t):
    """t in [0, 1] -> ramp colour (0 dark)."""
    return ramp[max(0, min(len(ramp) - 1, round(t * (len(ramp) - 1))))] + (255,)


def icon():
    im = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
    px = im.load()
    # body: an egg, widest a little above the middle, ending in a blunt tip at the bottom (acorn-like but plump)
    cx, top, bottom = 7.5, 5.0, 15.0
    body = set()
    for y in range(16):
        v = (y + 0.5 - top) / (bottom - top)  # 0 top .. 1 bottom
        if not 0 <= v <= 1:
            continue
        half = 5.6 * (1 - (max(0.0, v - 0.35) / 0.65) ** 2.2) ** 0.5 if v > 0.35 else 5.6
        for x in range(16):
            if abs(x + 0.5 - cx - 0.5) <= half:
                body.add((x, y))
    lx, ly = -0.62, -0.58  # light from the top-left
    for (x, y) in body:
        v = (y + 0.5 - top) / (bottom - top)
        dx = (x + 0.5 - cx - 0.5) / 5.6
        t = 0.62 + 0.55 * (dx * lx + (v - 0.45) * 1.4 * ly) - 0.25 * max(0.0, v - 0.7)
        px[x, y] = shade(GOLD, t)
    # cap: a cup of silver scales over the top of the body with a lip one texel wider on both sides
    cap_rows = {3: (5, 10), 4: (3, 12), 5: (2, 13), 6: (1, 14), 7: (2, 13)}
    for y, (x0, x1) in cap_rows.items():
        for x in range(x0, x1):
            left = (x - x0) / max(1, x1 - x0 - 1)
            scale_shadow = (x + 2 * (y % 2)) % 4 == 3
            t = 0.98 - left * 0.55 - (y - 3) * 0.07 - (0.3 if scale_shadow else 0) - (0.35 if y == 7 else 0)
            px[x, y] = shade(SILVER, t)
    # stem out of the cap, a leaf on its right
    px[7, 2] = STEM[0] + (255,)
    px[8, 2] = STEM[0] + (255,)
    px[8, 1] = STEM[1] + (255,)
    for (x, y), t in {(9, 1): 0.66, (10, 0): 1.0, (10, 1): 0.66, (11, 0): 0.66, (11, 1): 0.33, (12, 0): 0.0, (9, 0): 1.0}.items():
        px[x, y] = shade(LEAF, t)
    # rim: silhouette texels touching transparency get the darkest value of their ramp (outline like vanilla items),
    # the top-left rim of the cap stays lighter
    solid = {(x, y) for y in range(16) for x in range(16) if px[x, y][3]}
    rim = [(x, y) for (x, y) in solid if any((x + dx, y + dy) not in solid for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))]
    for (x, y) in rim:
        if (x, y) in body and y > 7:
            lit = (x - 1, y) not in solid and y < 10
            px[x, y] = (GOLD[1] if lit else OUTLINE) + (255,)
        elif 3 <= y <= 7 and (x, y + 1) not in solid:
            px[x, y] = SILVER[0] + (255,)
    # specular glints on the body and the cap
    for (x, y) in [(4, 9), (4, 10), (5, 9)]:
        px[x, y] = GOLD[4] + (255,)
    px[4, 5] = SILVER[4] + (255,)
    return im


def sprout():
    base = Image.open(RP / "blocks" / "mallorn_sapling.png").convert("RGBA")
    im = Image.new("RGBA", base.size, (0, 0, 0, 0))
    src, px = base.load(), im.load()
    w, h = base.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = src[x, y]
            if not a:
                continue
            lum = (0.3 * r + 0.59 * g + 0.11 * b) / 255
            is_stem = (r - b) < 40  # the sapling's trunk is a dark neutral brown, its leaves orange
            # lighter towards the top of the plant and towards the left
            lift = (1 - y / h) * 0.18 + (1 - x / w) * 0.08
            if is_stem:
                px[x, y] = shade(SILVER[:4], lum * 2.2 + lift)
            else:
                px[x, y] = shade(LEAF, (lum - 0.3) * 2.6 + lift)
    # blossom glints: pale gold on a few leaf tips (fixed cells, not random)
    for (x, y) in [(7, 2), (12, 4), (3, 6), (11, 9)]:
        if px[x, y][3]:
            px[x, y] = GOLD[4] + (255,)
    return im


if __name__ == "__main__":
    icon().save(RP / "items" / "great_mallorn_nut.png")
    sprout().save(RP / "blocks" / "great_mallorn_sprout.png")
    print("wrote items/great_mallorn_nut.png, blocks/great_mallorn_sprout.png")
