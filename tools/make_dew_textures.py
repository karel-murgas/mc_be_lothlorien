"""Generates the dewy ground cover textures (Phase 14b): the leaf litter and blossom textures with droplet glints.

    python -B mods/lothlorien/tools/make_dew_textures.py

Needs textures/blocks/mallorn_leaf_carpet.png and mallorn_blossom.png (tools/make_mallorn_leaves.py,
tools/make_mallorn_blossoms.py). Output (overwritten every run): <name>_dew.png, <name>_dew_mers.tga (a copy of the
dry MERS map) and <name>_dew.texture_set.json next to them. Glints sit on a fixed spaced pattern of the opaque pixels.
"""
import json
import shutil
from pathlib import Path
from PIL import Image

BLOCKS = Path(__file__).resolve().parents[1] / "lothlorien_rp/textures/blocks"
GLINT = (226, 246, 255, 255)
GLINT_EDGE = (160, 208, 232, 255)
# (name, glint positions on the 16x16 sheet); each must land on an opaque pixel of the dry texture
SPOTS = {
    "mallorn_leaf_carpet": [(2, 1), (6, 3), (11, 2), (14, 5), (3, 6), (9, 7), (1, 10), (5, 13), (10, 11), (13, 14), (14, 9), (7, 15)],
    "mallorn_blossom": [(3, 2), (11, 1), (5, 7), (13, 4), (2, 10), (9, 12), (12, 11), (6, 14)],
}


def main():
    for name, spots in SPOTS.items():
        img = Image.open(BLOCKS / f"{name}.png").convert("RGBA")
        placed = 0
        for x, y in spots:
            if img.getpixel((x, y))[3] == 0:
                continue  # no cover pixel here (blossoms are cut out)
            img.putpixel((x, y), GLINT)
            placed += 1
            if y + 1 < 16 and img.getpixel((x, y + 1))[3]:
                img.putpixel((x, y + 1), GLINT_EDGE)
        img.save(BLOCKS / f"{name}_dew.png")
        shutil.copyfile(BLOCKS / f"{name}_mers.tga", BLOCKS / f"{name}_dew_mers.tga")
        (BLOCKS / f"{name}_dew.texture_set.json").write_text(json.dumps(
            {"format_version": "1.21.30", "minecraft:texture_set": {
                "color": f"{name}_dew", "metalness_emissive_roughness_subsurface": f"{name}_dew_mers"}}) + "\n")
        print(name, "glints", placed)


if __name__ == "__main__":
    main()
