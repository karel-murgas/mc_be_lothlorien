"""Generates the Harmony band icons: the font glyph page lothlorien_rp/font/glyph_E5.png.

    python -B mods/lothlorien/tools/make_harmony_icons.py [--preview DIR]

Output (overwritten every run): lothlorien_rp/font/glyph_E5.png (256x256 RGBA, 16x16 cells of 16x16 px, cell n = U+E500+n).
Cells 0-4 hold the band icons used by scripts/harmony.js BAND_ICONS (action bar prefix):
  U+E500 Friend  bright green mallorn leaf with a gold star   U+E501 Guest   paler green plain leaf
  U+E502 Uneasy  orange wilted, drooping leaf                  U+E503 Shunned red leaf broken in two
  U+E504 Hated   dark red arrow after the vanilla arrow item
Colour AND shape differ per band (colour-blind safe); every icon has a 1 px darker outline so it reads on light and dark
scenes. Same layout as vanilla font/glyph_E1.png. Rendering of this page in the action bar is not verified in game yet.
--preview DIR also writes an upscaled sheet of the icons on a dark and a light background (iteration scratch, not in the mod).
"""
import math
import sys
from pathlib import Path
from PIL import Image

RP = Path(__file__).resolve().parents[1] / "lothlorien_rp"
OUT = RP / "font" / "glyph_E5.png"
N = 12  # drawing box; the 1 px outline makes the icon 14x14, placed at offset (1, 1) of its 16x16 cell


def hexc(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4)) + (255,)


# ---------------------------------------------------------------- shape helpers (drawing box, y down)
def blank():
    return [[None] * N for _ in range(N)]


def leaf(ramp, curve, width, vein):
    """Leaf along a sampled centre curve; ramp = (light, mid, dark); lit from the top left."""
    img = blank()
    pts = [curve(i / 60) for i in range(61)]
    for y in range(N):
        for x in range(N):
            cx, cy = x + 0.5, y + 0.5
            best = None
            for i, (px, py) in enumerate(pts):
                d = math.hypot(cx - px, cy - py)
                if best is None or d < best[0]:
                    best = (d, i / 60, px, py)
            d, t, px, py = best
            if d > width(t):
                continue
            side = (cx - px) + (cy - py)  # negative = upper left of the centre line
            shade = 0 if side < -0.7 else (2 if side > 0.9 else 1)
            img[y][x] = ramp[shade]
            if vein(t) and d < 0.62:
                img[y][x] = ramp[0] if shade else ramp[1]
    return img


def paint(img, rows, palette):
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            if ch != "." and y < N and x < N:
                img[y][x] = palette[ch]
    return img


def outline(img, color):
    """Return a (N+2)x(N+2) grid with a 1 px 4-neighbour outline around the painted pixels."""
    out = [[None] * (N + 2) for _ in range(N + 2)]
    for y in range(N):
        for x in range(N):
            if img[y][x]:
                out[y + 1][x + 1] = img[y][x]
    for y in range(N + 2):
        for x in range(N + 2):
            if out[y][x] is not None:
                continue
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                nx, ny = x + dx, y + dy
                if 1 <= nx <= N and 1 <= ny <= N and img[ny - 1][nx - 1]:
                    out[y][x] = color
                    break
    return out


# ---------------------------------------------------------------- the five icons
GREEN_F = tuple(hexc(c) for c in ("#9cf060", "#3fc23a", "#1c7f30"))
GREEN_G = tuple(hexc(c) for c in ("#b4d890", "#7fae62", "#4f7d45"))
ORANGE = tuple(hexc(c) for c in ("#f5b146", "#da7820", "#9c4a14"))


def lerp(a, b, t):
    return (a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t)


def diagonal_leaf(ramp, vein_color):
    """Pointed leaf, stem at the lower left, tip at the upper right."""
    def curve(t):
        return lerp((0.5, 11.5), (11.3, 0.7), t)

    def width(t):
        if t < 0.14:
            return 0.5
        u = (t - 0.14) / 0.86
        return 3.0 * math.sin(math.pi * u) ** 0.75 + 0.2

    img = leaf(ramp, curve, width, lambda t: False)
    for y in range(N):
        for x in range(N):
            if img[y][x] and abs((x + 0.5) + (y + 0.5) - 12.0) < 0.9 and 0.12 < ((x + 0.5) / 11.8) < 0.9:
                img[y][x] = vein_color
    return img


def friend():
    img = diagonal_leaf(GREEN_F, hexc("#d4ff9a"))
    paint(img, [
        ".y..........",
        "ywy.........",
        ".y..........",
    ], {"y": hexc("#ffd23a"), "w": hexc("#fff6b8")})
    return outline(img, hexc("#0f4a1e"))


def guest():
    return outline(diagonal_leaf(GREEN_G, hexc("#d8ebc0")), hexc("#2c4a2a"))


def uneasy():
    """A stem arching over, the wilted leaf hanging limp from its end, tip curled and dry."""
    stem = hexc("#8a5a24")
    pal = {"l": ORANGE[0], "m": ORANGE[1], "d": ORANGE[2], "v": hexc("#7a3c10"), "s": stem}
    img = blank()
    paint(img, [
        "...sss......",
        "..s...s.....",
        ".s.....s....",
        ".s.....lm...",
        ".s....lmmd..",
        "s.....lvmmd.",
        "......lvmmd.",
        ".......vmm..",
        ".......vmd..",
        "........vd..",
        "........dd..",
        ".........d..",
    ], pal)
    return outline(img, hexc("#5a2a0c"))


def shunned():
    """A red mallorn leaf broken in two across its widest part, the upper half pushed apart: harmony broken."""
    red = tuple(hexc(c) for c in ("#ff8272", "#e0342c", "#a01a1c"))
    leaf_px = diagonal_leaf(red, hexc("#ffb0a4"))
    img = blank()
    for y in range(N):
        for x in range(N):
            c = leaf_px[y][x]
            if not c:
                continue
            k = x - y - (1 if (x + y) % 4 < 2 else 0)  # across the leaf axis, with a zigzag break line
            if k in (0, 1):
                continue  # the gap
            if k > 1:
                nx, ny = x + 1, y - 1  # the upper half moves away along the axis
                if 0 <= nx < N and 0 <= ny < N:
                    img[ny][nx] = c
            else:
                img[y][x] = c
    return outline(img, hexc("#4a0a10"))


def hated():
    """A dark red arrow drawn after the vanilla arrow item (textures/items/arrow.png, one shaft step shorter): head at the
    upper right, two-tone shaft, fletching at the lower left. The wardens shoot on sight."""
    pal = {"L": hexc("#ffb4a4"), "M": hexc("#ff5a48"), "D": hexc("#b81e24"),  # head: light, mid, dark
           "s": hexc("#a8343a"), "S": hexc("#5a0e18"),  # shaft: lit upper-left side, shaded lower-right side
           "f": hexc("#e0485a"), "F": hexc("#8a1a2a")}  # fletching
    img = blank()
    paint(img, [
        ".........LLM",
        ".......LLLMD",
        ".......MLMD.",
        ".......DMDD.",
        "......sS.D..",
        ".....sS.....",
        "....sS......",
        "...sS.......",
        ".ffS........",
        "fFfS........",
        "FfF.........",
        ".F..........",
    ], pal)
    return outline(img, hexc("#24040a"))


ICONS = [friend, guest, uneasy, shunned, hated]


def build():
    page = Image.new("RGBA", (256, 256), (0, 0, 0, 0))
    for n, make in enumerate(ICONS):
        for y, row in enumerate(make()):
            for x, c in enumerate(row):
                if c:
                    page.putpixel(((n % 16) * 16 + 1 + x, (n // 16) * 16 + 1 + y), c)
    return page


def preview(page, folder):
    folder = Path(folder)
    folder.mkdir(parents=True, exist_ok=True)
    for name, scale in (("harmony_icons.png", 10), ("harmony_icons_3x.png", 3)):
        tile_px = 18 * scale
        sheet = Image.new("RGBA", (len(ICONS) * tile_px, 2 * tile_px), (0, 0, 0, 255))
        for row, bg in enumerate(((36, 36, 40, 255), (222, 222, 214, 255))):
            for n in range(len(ICONS)):
                cell = page.crop((n * 16, 0, n * 16 + 16, 16)).resize((16 * scale, 16 * scale), Image.NEAREST)
                tile = Image.new("RGBA", (tile_px, tile_px), bg)
                tile.alpha_composite(cell, (scale, scale))
                sheet.paste(tile, (n * tile_px, row * tile_px))
        sheet.save(folder / name)


def main(argv):
    page = build()
    OUT.parent.mkdir(parents=True, exist_ok=True)
    page.save(OUT, optimize=True)
    print(f"wrote {OUT.relative_to(RP.parent)} ({len(ICONS)} icons)")
    if "--preview" in argv:
        preview(page, argv[argv.index("--preview") + 1])


if __name__ == "__main__":
    main(sys.argv[1:])
