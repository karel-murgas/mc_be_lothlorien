"""Generates the Star canopy (Phase 14b): block + item JSON, recipe, the animated texture and its MERS strip.

    python -B mods/lothlorien/tools/make_star_canopy.py

Output (overwritten every run): lothlorien_bp/blocks/star_canopy.json, items/star_canopy.json,
recipes/star_canopy.json, lothlorien_rp/textures/blocks/star_canopy.png (+ star_canopy_mers.tga,
star_canopy.texture_set.json) and lothlorien_rp/textures/flipbook_textures.json (merged, other entries kept).
The texture is a vertical strip of FRAMES 16x16 frames, flipbooked with blended frames: silver stars on deep night
blue, each star on its own phase so they twinkle slowly. Under Vibrant Visuals the stars glow (emissive MERS channel).
"""
import json
import random
from pathlib import Path
from PIL import Image

MOD = Path(__file__).resolve().parents[1]
BP, RP = MOD / "lothlorien_bp", MOD / "lothlorien_rp"
NS = "lothlorien"
FRAMES = 6
TICKS_PER_FRAME = 40
NIGHT = [(10, 14, 38, 255), (14, 18, 48, 255), (18, 24, 60, 255), (22, 30, 72, 255)]
STAR = [(96, 110, 150, 255), (150, 164, 200, 255), (206, 216, 238, 255), (244, 247, 255, 255)]  # dim .. bright
# (x, y, phase, big): big stars get four dim arms at their brightest
STARS = [(2, 1, 0, 0), (7, 0, 2, 0), (12, 2, 4, 1), (4, 5, 3, 0), (9, 6, 1, 1), (14, 7, 5, 0), (1, 9, 4, 0),
         (6, 11, 0, 0), (11, 10, 3, 0), (3, 14, 2, 1), (8, 15, 5, 0), (13, 13, 1, 0), (15, 3, 2, 0)]


def level(frame, phase):
    """Brightness 0-3 of a star: a slow triangle wave over the frames, offset by the star's phase."""
    k = (frame + phase) % FRAMES
    return min(k, FRAMES - k)  # 0..3 for FRAMES = 6


def strip():
    rnd = random.Random(14)
    base = [[NIGHT[rnd.choice([0, 1, 1, 1, 2, 2, 3])] for _ in range(16)] for _ in range(16)]  # same night in every frame
    img = Image.new("RGBA", (16, 16 * FRAMES))
    mers = Image.new("RGBA", (16, 16 * FRAMES))
    for f in range(FRAMES):
        stars = {}
        for x, y, phase, big in STARS:
            lv = level(f, phase)
            stars[(x, y)] = (lv, 255)
            if big and lv == 3:
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    p = ((x + dx) % 16, (y + dy) % 16)
                    stars.setdefault(p, (0, 140))
        for y in range(16):
            for x in range(16):
                emissive = 0
                c = base[y][x]
                if (x, y) in stars:
                    lv, emissive = stars[(x, y)]
                    c = STAR[lv]
                    emissive = emissive if lv else 90
                img.putpixel((x, f * 16 + y), c)
                mers.putpixel((x, f * 16 + y), (0, emissive, 255, 0))
    return img, mers


def dump(path, obj):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(obj, indent=2) + "\n", newline="\n")


def main():
    img, mers = strip()
    (RP / "textures/blocks").mkdir(parents=True, exist_ok=True)
    img.save(RP / "textures/blocks/star_canopy.png")
    mers.save(RP / "textures/blocks/star_canopy_mers.tga")
    dump(RP / "textures/blocks/star_canopy.texture_set.json", {"format_version": "1.21.30", "minecraft:texture_set": {
        "color": "star_canopy", "metalness_emissive_roughness_subsurface": "star_canopy_mers"}})

    flip = RP / "textures/flipbook_textures.json"
    entries = json.loads(flip.read_text()) if flip.exists() else []
    entries = [e for e in entries if e.get("atlas_tile") != f"{NS}:star_canopy"]
    entries.append({"flipbook_texture": "textures/blocks/star_canopy", "atlas_tile": f"{NS}:star_canopy",
                    "ticks_per_frame": TICKS_PER_FRAME, "frames": list(range(FRAMES)), "blend_frames": True})
    dump(flip, entries)

    dump(BP / "blocks/star_canopy.json", {"format_version": "1.26.50", "minecraft:block": {
        "description": {"identifier": f"{NS}:star_canopy"},
        "components": {
            "minecraft:destructible_by_mining": {"seconds_to_destroy": 1.5},
            "minecraft:destructible_by_explosion": {"explosion_resistance": 6},
            "minecraft:sound": {"sound": "stone"},
            "minecraft:light_emission": 6,
            "minecraft:map_color": "#161e48",
            "minecraft:geometry": "minecraft:geometry.full_block",
            "minecraft:material_instances": {"*": {"texture": f"{NS}:star_canopy", "render_method": "opaque"}},
            "minecraft:redstone_conductivity": {"redstone_conductor": True}}}})
    dump(BP / "items/star_canopy.json", {"format_version": "1.26.50", "minecraft:item": {
        "description": {"identifier": f"{NS}:star_canopy", "menu_category": {"category": "construction"}},
        "components": {"minecraft:block_placer": {"block": f"{NS}:star_canopy", "aligned_placement": True,
                                                  "replace_block_item": True}}}})
    # leaves on top, dew in the middle, stone below (owner, 2026-10-02); the glass bottles are used up
    dump(BP / "recipes/star_canopy.json", {"format_version": "1.20.30", "minecraft:recipe_shaped": {
        "description": {"identifier": f"{NS}:star_canopy"}, "tags": ["crafting_table"],
        "pattern": ["LLL", "DDD", "TTT"],
        "key": {"L": {"item": f"{NS}:mallorn_leaves"}, "D": {"item": f"{NS}:morning_dew"},
                "T": {"item": "minecraft:deepslate_tiles"}},
        "unlock": [{"item": f"{NS}:morning_dew"}],
        "result": {"item": f"{NS}:star_canopy", "count": 9}}})
    print("star canopy written")


if __name__ == "__main__":
    main()
