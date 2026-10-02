"""Heartwood plank set: a clone of the silver Mallorn plank family, crafted from stripped logs / stripped wood.

Owner's decision (2026-09-30): two plank sets. Logs and wood -> silver `mallorn_planks` family; stripped logs and
stripped wood -> golden `mallorn_heartwood_planks` family. The heartwood blocks are the silver blocks with the
identifiers, textures and map colour swapped; they share the silver geometries (shape only).
Textures come from `make_mallorn_wood.py` (a recolour of the silver art). Edit the silver files, then re-run:

  python -B tools/make_heartwood_set.py

Writes BP blocks/items/recipes/loot for the ten heartwood blocks and the heartwood atlas, icon and lang entries.
"""
import json
import os
import re

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
BP = os.path.join(HERE, "..", "lothlorien_bp")
RP = os.path.join(HERE, "..", "lothlorien_rp")

FAMILY = ["planks", "stairs", "slab", "double_slab", "fence", "fence_gate", "door", "trapdoor", "button",
          "pressure_plate"]
# identifiers and texture keys (namespace ':'); geometry ids use '.' and are not touched
ID_RE = re.compile(r"lothlorien:mallorn_(double_slab|fence_gate|fence_post|pressure_plate|door_bottom|door_top|planks|stairs|"
                   r"slab|fence|door|trapdoor|button)\b")
LOOT_RE = re.compile(r"loot_tables/blocks/mallorn_(\w+)\.json")
SILVER_RECIPES = ["button", "door", "fence", "fence_gate", "pressure_plate", "slab", "stairs", "trapdoor"]
NAMES = {  # English names
    "planks": "Mallorn Heartwood Planks", "stairs": "Mallorn Heartwood Stairs", "slab": "Mallorn Heartwood Slab",
    "double_slab": "Mallorn Heartwood Double Slab", "fence": "Mallorn Heartwood Fence",
    "fence_gate": "Mallorn Heartwood Fence Gate", "door": "Mallorn Heartwood Door",
    "trapdoor": "Mallorn Heartwood Trapdoor", "button": "Mallorn Heartwood Button",
    "pressure_plate": "Mallorn Heartwood Pressure Plate",
}
TEXTURES = ["planks", "door_bottom", "door_top", "trapdoor", "fence_post"]


def avg_hex(path):
    px = list(Image.open(path).convert("RGB").get_flattened_data())
    return "#%02x%02x%02x" % tuple(sum(p[i] for p in px) // len(px) for i in range(3))


def read(path):
    with open(path, encoding="utf8", newline="") as f:
        return f.read()


def write(path, text):
    with open(path, "w", encoding="utf8", newline="") as f:
        f.write(text)


def clone(text, silver_map, gold_map):
    text = ID_RE.sub(r"lothlorien:mallorn_heartwood_\1", text)
    text = LOOT_RE.sub(r"loot_tables/blocks/mallorn_heartwood_\1.json", text)
    return text.replace(f'"minecraft:map_color": "{silver_map}"', f'"minecraft:map_color": "{gold_map}"')


def main():
    silver_map = avg_hex(os.path.join(RP, "textures", "blocks", "mallorn_planks.png"))
    gold_map = avg_hex(os.path.join(RP, "textures", "blocks", "mallorn_heartwood_planks.png"))
    written = []

    for part in FAMILY:
        src = os.path.join(BP, "blocks", f"mallorn_{part}.json")
        text = read(src)
        assert f'"minecraft:map_color": "{silver_map}"' in text, f"{src}: map colour is not the silver planks average"
        dst = os.path.join(BP, "blocks", f"mallorn_heartwood_{part}.json")
        write(dst, clone(text, silver_map, gold_map))
        written.append(dst)
        item = os.path.join(BP, "items", f"mallorn_{part}.json")
        if os.path.exists(item):
            dst = os.path.join(BP, "items", f"mallorn_heartwood_{part}.json")
            write(dst, clone(read(item), silver_map, gold_map))
            written.append(dst)

    for part in SILVER_RECIPES:
        dst = os.path.join(BP, "recipes", f"mallorn_heartwood_{part}.json")
        write(dst, clone(read(os.path.join(BP, "recipes", f"mallorn_{part}.json")), silver_map, gold_map))
        written.append(dst)
    dst = os.path.join(BP, "loot_tables", "blocks", "mallorn_heartwood_double_slab.json")
    write(dst, clone(read(os.path.join(BP, "loot_tables", "blocks", "mallorn_double_slab.json")), silver_map, gold_map))
    written.append(dst)

    # atlases: add heartwood entries after their silver twins' data (json order is not significant)
    for atlas, keys, folder in [("terrain_texture.json", TEXTURES, "blocks"), ("item_texture.json", ["door"], "items")]:
        path = os.path.join(RP, "textures", atlas)
        text = read(path)
        nl = "\r\n" if "\r\n" in text else "\n"
        data = json.loads(text)
        for k in keys:
            data["texture_data"][f"lothlorien:mallorn_heartwood_{k}"] = {
                "textures": f"textures/{folder}/mallorn_heartwood_{k}"}
        write(path, json.dumps(data, indent=2).replace("\n", nl) + nl)
        written.append(path)

    # lang: drop old heartwood lines, insert fresh ones after the last silver plank-family line; keep line endings
    path = os.path.join(RP, "texts", "en_US.lang")
    text = read(path)
    nl = "\r\n" if "\r\n" in text else "\n"
    family_name = re.compile(r"^(?:tile|item)\.lothlorien:mallorn_heartwood_(?:%s)(?:\.name)?=" % "|".join(FAMILY))
    lines = [ln for ln in text.splitlines() if not family_name.match(ln)]
    silver = [i for i, ln in enumerate(lines) if re.match(r"(tile|item)\.lothlorien:mallorn_(%s)\b" % "|".join(FAMILY), ln)]
    at = silver[-1] + 1
    new = []
    for part in FAMILY:
        new += [f"tile.lothlorien:mallorn_heartwood_{part}.name={NAMES[part]}",
                f"item.lothlorien:mallorn_heartwood_{part}={NAMES[part]}"]
    lines[at:at] = new
    write(path, nl.join(lines) + nl)
    written.append(path)
    print(f"wrote {len(written)} files (map colour silver {silver_map} -> heartwood {gold_map})")


if __name__ == "__main__":
    main()
