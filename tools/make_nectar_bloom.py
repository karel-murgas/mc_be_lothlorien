"""Generates the Phase 14b nectar bloom: block + item JSON, loot table and the stage textures.

    python -B mods/lothlorien/tools/make_nectar_bloom.py

Output (overwritten every run): lothlorien_bp/blocks/nectar_bloom.json, items/nectar_bloom.json,
loot_tables/blocks/nectar_bloom.json, lothlorien_rp/textures/blocks/nectar_bloom_0..3.png and
textures/items/nectar_bloom.png. The atlas and lang lines are written once by hand (see the notes).

The bloom hangs under a full block face (vanilla spore blossom analogue): three golden flowers on stems from the
top of a crossed-plane model. State `lothlorien:nectar` 0-3 = dry, budding, open, full; at 3 a golden drop hangs below.
"""
import json
from pathlib import Path
from PIL import Image

MOD = Path(__file__).resolve().parents[1]
BP, RP = MOD / "lothlorien_bp", MOD / "lothlorien_rp"
NS = "lothlorien"
STAGES = 4

CLEAR = (0, 0, 0, 0)
STEM = {"d": (92, 78, 34, 255), "l": (128, 112, 50, 255)}
# vanilla dandelion yellows + the blossom's deep-gold centre (tools/make_mallorn_blossoms.py)
BLOSSOM = [(211, 150, 50, 255), (241, 157, 37, 255), (254, 214, 57, 255), (255, 236, 79, 255), (255, 253, 160, 255)]
DRY = [(88, 70, 40, 255), (110, 88, 48, 255), (140, 112, 60, 255), (160, 132, 72, 255), (176, 148, 86, 255)]
BUD = [(150, 130, 40, 255), (176, 158, 52, 255), (214, 190, 60, 255), (236, 214, 76, 255), (250, 238, 140, 255)]
DROP = {"a": (232, 168, 40, 255), "h": (255, 240, 170, 255), "s": (190, 124, 24, 255)}
SPRITES = {
    "A": ["..3..", ".343.", "34043", ".323.", "..2.."],
    "B": [".343.", "33433", "34043", "32233", ".322."],
    "C": [".34.", "3433", "3233", ".22."],
    "D": [".3.", "343", ".2."],
}
# (stem x, flower sprite, sprite x offset, sprite y offset); the middle flower hangs lower
FLOWERS = [(3, "B", 1, 3), (8, "A", 6, 5), (13, "C", 11, 3)]
BUDS = [(3, "D", 2, 3), (8, "D", 7, 5), (13, "D", 12, 3)]
DROP_PIXELS = {(8, 11): "s", (8, 12): "a", (7, 13): "a", (8, 13): "h", (9, 13): "a", (7, 14): "a", (8, 14): "a", (9, 14): "s", (8, 15): "s"}


def paint(img, sprite, ox, oy, palette):
    for dy, row in enumerate(SPRITES[sprite]):
        for dx, ch in enumerate(row):
            if ch.isdigit():
                img.putpixel((ox + dx, oy + dy), palette[int(ch)])


def texture(stage):
    img = Image.new("RGBA", (16, 16), CLEAR)
    flowers = [(x, s, ox, oy) for x, s, ox, oy in (FLOWERS if stage >= 2 else BUDS)]
    palette = {0: DRY, 1: BUD}.get(stage, BLOSSOM)
    for x, sprite, ox, oy in flowers:
        for y in range(0, oy):
            img.putpixel((x, y), STEM["d" if y % 2 == 0 else "l"])
        paint(img, sprite, ox, oy, palette)
    if stage == 3:
        for xy, c in DROP_PIXELS.items():
            img.putpixel(xy, DROP[c])
    return img


def dump(path, obj):
    if "minecraft:block" in obj:
        from configure_support import configure
        configure(obj)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(obj, indent=2) + "\n", newline="\n")


HANG_ON = [f"{NS}:{n}" for n in ("mallorn_leaves", "mallorn_golden_leaves", "mallorn_log", "mallorn_wood",
                                 "mallorn_stripped_log", "mallorn_stripped_wood", "mallorn_planks",
                                 "mallorn_heartwood_planks")]


def material(stage):
    return {"*": {"texture": f"{NS}:nectar_bloom_{stage}", "render_method": "alpha_test", "ambient_occlusion": 0.0}}


def block():
    return {"format_version": "1.26.50", "minecraft:block": {
        "description": {"identifier": f"{NS}:nectar_bloom", "menu_category": {"category": "none"},
                        "states": {f"{NS}:nectar": list(range(STAGES))}},
        "components": {
            "minecraft:collision_box": False,
            "minecraft:light_dampening": 0,
            "minecraft:selection_box": {"origin": [-5, 2, -5], "size": [10, 14, 10]},
            "minecraft:destructible_by_mining": {"seconds_to_destroy": 0.1},
            "minecraft:destructible_by_explosion": {"explosion_resistance": 0},
            "minecraft:flammable": {"catch_chance_modifier": 60, "destroy_chance_modifier": 100},
            "minecraft:sound": {"sound": "grass"},
            "minecraft:map_color": "#e8a828",
            "minecraft:geometry": {"identifier": f"geometry.{NS}.plant_cross"},
            "minecraft:material_instances": material(0),
            "minecraft:loot": "loot_tables/blocks/nectar_bloom.json",
            "minecraft:placement_filter": {"conditions": [{"allowed_faces": ["down"], "block_filter": HANG_ON}]},
            f"{NS}:nectar_bloom": {}},
        "permutations": [{"condition": f"query.block_state('{NS}:nectar') == {s}",
                          "components": {"minecraft:material_instances": material(s)}} for s in range(1, STAGES)]}}


def item():
    return {"format_version": "1.26.50", "minecraft:item": {
        "description": {"identifier": f"{NS}:nectar_bloom", "menu_category": {"category": "nature", "group": "minecraft:itemGroup.name.flower"}},
        "components": {"minecraft:block_placer": {"block": f"{NS}:nectar_bloom", "replace_block_item": True},
                       "minecraft:icon": f"{NS}:nectar_bloom"}}}


def loot():
    """Shears take the bloom as an item; broken by hand it drops nothing (vanilla vines)."""
    return {"pools": [{"rolls": 1, "entries": [{"type": "item", "name": f"{NS}:nectar_bloom"}],
                       "conditions": [{"condition": "match_tool", "item": "minecraft:shears"}]}]}


def main():
    for s in range(STAGES):
        (RP / "textures/blocks").mkdir(parents=True, exist_ok=True)
        texture(s).save(RP / f"textures/blocks/nectar_bloom_{s}.png")
    (RP / "textures/items").mkdir(parents=True, exist_ok=True)
    texture(3).save(RP / "textures/items/nectar_bloom.png")
    dump(BP / "blocks/nectar_bloom.json", block())
    dump(BP / "items/nectar_bloom.json", item())
    dump(BP / "loot_tables/blocks/nectar_bloom.json", loot())
    print("nectar bloom written")


if __name__ == "__main__":
    main()
    from configure_support import main as configure_production_support
    configure_production_support()
