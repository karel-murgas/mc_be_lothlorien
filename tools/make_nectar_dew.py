"""Generates the Phase 14b bottle icons: Mallorn nectar, Dew bottle (partly filled) and Bottle of morning dew.

    python -B mods/lothlorien/tools/make_nectar_dew.py

Output (overwritten every run): lothlorien_rp/textures/items/{mallorn_nectar,dew_bottle,morning_dew}.png
(vanilla empty bottle with a coloured fill; needs reference/vanilla, see tools/refresh_vanilla_ref.ps1).
"""
from pathlib import Path
from PIL import Image

RP = Path(__file__).resolve().parents[1] / "lothlorien_rp"
VANILLA_BOTTLE = (Path(__file__).resolve().parents[3]
                  / "reference/vanilla/current/resource_packs/vanilla/textures/items/potion_bottle_empty.png")
GOLD = {"body": (232, 168, 40, 255), "top": (250, 214, 96, 255), "shade": (190, 124, 24, 255), "spark": (255, 244, 190, 255)}
DEW = {"body": (150, 206, 232, 255), "top": (214, 240, 252, 255), "shade": (96, 160, 200, 255), "spark": (255, 255, 255, 255)}


def icon(palette, first_row, sparks=()):
    """Vanilla bottle with the inside filled from first_row down: lighter surface row, darker right edge."""
    img = Image.open(VANILLA_BOTTLE).convert("RGBA")
    inside = {}
    for y in range(7, 14):
        xs = [x for x in range(16) if img.getpixel((x, y))[3]]
        if y >= 11 and xs[-1] - xs[-2] == 2:
            xs = xs[:-1]  # the outer shade pixel right of the wall is not glass interior
        inside[y] = [x for x in range(min(xs) + 1, max(xs)) if not img.getpixel((x, y))[3]]
    for y, xs in inside.items():
        if y < first_row:
            continue
        for x in xs:
            c = palette["top"] if y == first_row else palette["shade"] if x == xs[-1] else palette["body"]
            img.putpixel((x, y), c)
    for x, y in sparks:
        assert x in inside[y] and y >= first_row, (x, y)
        img.putpixel((x, y), palette["spark"])
    return img


def main():
    out = RP / "textures/items"
    out.mkdir(parents=True, exist_ok=True)
    icon(GOLD, 9, sparks=((7, 11),)).save(out / "mallorn_nectar.png")
    icon(DEW, 12).save(out / "dew_bottle.png")
    icon(DEW, 9, sparks=((7, 10), (8, 12))).save(out / "morning_dew.png")
    print("nectar and dew icons written")


if __name__ == "__main__":
    main()
