"""Mallorn boat family: 4 boats (silver / heartwood x boat / boat with chest), every file they need.

  python -B tools/make_mallorn_boat_family.py

Runs the two model generators (default rotated-plank model, "Prettier boats" stepped model), then writes:
- art: heartwood textures and icons as a RECOLOUR of the silver art (owner's rule for the heartwood set, via
  make_mallorn_wood.recolour: silver -> golden wood, gold accents -> silver); chest-boat icons (boat icon + a chest);
  the chest geometry for both models.
- BP: entities (copies of the vanilla boat / chest boat with runtime_identifier), items, recipes, loot tables.
- RP: client entities, the chest render controller; upserts item_texture.json and en_US.lang.

The chest is the vanilla one (owner, 2026-10-01: "classical minecraft chest texture"): a second geometry rendered
by a second render controller with the vanilla chest-boat texture `textures/entity/boat/chest_boat_oak`, whose
chest (12x8x12 base, 12x4x12 lid, 2x4x1 lock) sits at uv (0,76) / (0,59). Nothing of Mojang's is copied into the
pack; the game resolves the path from the vanilla resource pack.
"""
import copy
import json
import os
import re
import sys

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import make_mallorn_boat as stepped  # noqa: E402
import make_mallorn_boat_planks as planks  # noqa: E402
from make_mallorn_wood import recolour  # noqa: E402

MOD = os.path.dirname(HERE)
BP, RP = os.path.join(MOD, "lothlorien_bp"), os.path.join(MOD, "lothlorien_rp")
VANILLA = os.path.join(MOD, "..", "..", "reference", "vanilla", "current", "behavior_packs", "vanilla_1.26.30",
                       "entities")
CHEST_TEXTURE = "textures/entity/boat/chest_boat_oak"

WOODS = [  # (id prefix, planks item, display name)
    ("mallorn", "lothlorien:mallorn_planks", "Mallorn"),
    ("mallorn_heartwood", "lothlorien:mallorn_heartwood_planks", "Mallorn Heartwood"),
]
CHEST_X = (-8, 4)          # chest footprint along the boat (behind the rider)
CHEST_SEAT_X = 0.45        # the chest boat's single seat, moved forward clear of the chest (vanilla 0.2)
FLOOR_Y = {"default": 2, "pretty": 3}

# vanilla chest colours for the icon (sampled from the chest-boat texture's chest)
CH_DARK, CH_LIGHT, CH_MID, CH_SHADE = (51, 46, 37), (171, 121, 45), (143, 105, 29), (127, 95, 34)
LOCK, LOCK_DARK = (196, 196, 196), (120, 120, 120)


def write_json(path, data):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8", newline="\n") as f:
        json.dump(data, f, indent=2)
        f.write("\n")


# ---------------------------------------------------------------- art
def chest_geometry():
    """One geometry per model: bone `hull` (so the turn animation turns it) with the chest, lock facing the stern."""
    geos = []
    x0, x1 = CHEST_X
    cx = (x0 + x1) / 2
    for model, ident in (("default", "geometry.lothlorien.mallorn_boat_chest"),
                         ("pretty", "geometry.lothlorien.mallorn_boat_chest_pretty")):
        y = FLOOR_Y[model]
        rot, piv = [0, -90, 0], [cx, y, 0]  # lock towards the stern (checked in a render)
        cubes = [
            {"origin": [x0, y, -6], "size": [12, 8, 12], "uv": [0, 76], "rotation": rot, "pivot": piv},
            {"origin": [x0, y + 8, -6], "size": [12, 4, 12], "uv": [0, 59], "rotation": rot, "pivot": piv},
            {"origin": [cx - 1, y + 6, -7], "size": [2, 4, 1], "uv": [0, 59], "rotation": rot, "pivot": piv},
        ]
        geos.append({
            "description": {"identifier": ident, "texture_width": 128, "texture_height": 128,
                            "visible_bounds_width": 4, "visible_bounds_height": 2, "visible_bounds_offset": [0, 0.5, 0]},
            "bones": [{"name": "hull", "pivot": [0, 0, 0], "cubes": cubes}],
        })
    return {"format_version": "1.12.0", "minecraft:geometry": geos}


def chest_icon(boat_icon):
    """The boat icon with a chest standing in it (lid top, dark frame, lock), like the vanilla chest-boat icons."""
    img = boat_icon.copy()
    x0, y0 = 4, 2  # top-left of the chest (6 wide, 6 high)
    rows = ["dddddd",
            "dlllld",
            "dmmmmd",
            "ddkqdd",
            "dsmmsd",
            "dddddd"]
    pal = {"d": CH_DARK, "l": CH_LIGHT, "m": CH_MID, "s": CH_SHADE, "k": LOCK, "q": LOCK_DARK}
    for j, row in enumerate(rows):
        for i, ch in enumerate(row):
            img.putpixel((x0 + i, y0 + j), (*pal[ch], 255))
    return img


def build_art():
    geo_d, tex_d, _ = planks.build()
    geo_p, tex_p, _ = stepped.build()
    write_json(os.path.join(RP, "models", "entity", "mallorn_boat.geo.json"), geo_d)
    write_json(os.path.join(RP, "models", "entity", "mallorn_boat_pretty.geo.json"), geo_p)
    write_json(os.path.join(RP, "models", "entity", "mallorn_boat_chest.geo.json"), chest_geometry())
    icon = stepped.icon()
    for prefix, _, _ in WOODS:
        gold = prefix != "mallorn"
        f = recolour if gold else (lambda im: im)
        tex = os.path.join(RP, "textures", "entity")
        f(tex_d).save(os.path.join(tex, f"{prefix}_boat.png"))
        f(tex_p).save(os.path.join(tex, f"{prefix}_boat_pretty.png"))
        boat_icon = f(icon)
        items = os.path.join(RP, "textures", "items")
        boat_icon.save(os.path.join(items, f"{prefix}_boat.png"))
        chest_icon(boat_icon).save(os.path.join(items, f"{prefix}_chest_boat.png"))


# ---------------------------------------------------------------- behaviour pack
def entity(kind, ident):
    src = json.load(open(os.path.join(VANILLA, f"{kind}.json"), encoding="utf-8"))
    e = copy.deepcopy(src["minecraft:entity"])
    e["description"] = {"identifier": ident, "runtime_identifier": f"minecraft:{kind}",
                        "is_summonable": True, "is_spawnable": False}
    e["components"]["minecraft:loot"] = {"table": f"loot_tables/entities/{ident.split(':')[1]}.json"}
    groups = e["component_groups"]
    groups.pop("minecraft:can_ride_bamboo", None)
    e["events"]["minecraft:add_can_ride"] = {"add": {"component_groups": ["minecraft:can_ride_default"]}}
    sink = e["events"]["minecraft:sink"]["remove"]["component_groups"]
    if "minecraft:can_ride_bamboo" in sink:
        sink.remove("minecraft:can_ride_bamboo")
    if kind == "chest_boat":  # one seat, moved forward clear of the chest
        for rideable in (e["components"]["minecraft:rideable"], groups["minecraft:can_ride_default"]["minecraft:rideable"]):
            rideable["seats"][0]["position"][0] = CHEST_SEAT_X
    return {"format_version": "1.26.50", "minecraft:entity": e}


def item(ident):
    return {"format_version": "1.26.50", "minecraft:item": {
        "description": {"identifier": ident,
                        "menu_category": {"category": "items", "group": "minecraft:itemGroup.name.boat"}},
        "components": {"minecraft:icon": ident, "minecraft:max_stack_size": 1, "minecraft:liquid_clipped": True,
                       "minecraft:entity_placer": {"entity": ident}}}}


def recipe(ident, planks_item, boat_ident):
    if boat_ident is None:
        return {"format_version": "1.20.30", "minecraft:recipe_shaped": {
            "description": {"identifier": ident}, "tags": ["crafting_table"], "group": "boat",
            "pattern": ["# #", "###"], "key": {"#": {"item": planks_item}},
            "unlock": [{"item": planks_item}], "result": {"item": ident}}}
    # chest on top of the boat (vanilla is shapeless; this workspace allows shaped recipes only)
    return {"format_version": "1.20.30", "minecraft:recipe_shaped": {
        "description": {"identifier": ident}, "tags": ["crafting_table"], "group": "boat",
        "pattern": ["C", "B"], "key": {"C": {"item": "minecraft:chest"}, "B": {"item": boat_ident}},
        "unlock": [{"item": boat_ident}], "result": {"item": ident}}}


def loot(ident):
    return {"pools": [{"rolls": 1, "entries": [{"type": "item", "name": ident, "weight": 1}]}]}


# ---------------------------------------------------------------- resource pack
def client_entity(ident, prefix, chest):
    d = {
        "identifier": ident,
        "materials": {"default": "entity"},
        "textures": {"default": f"textures/entity/{prefix}_boat", "pretty": f"textures/entity/{prefix}_boat_pretty"},
        "geometry": {"default": "geometry.lothlorien.mallorn_boat", "pretty": "geometry.lothlorien.mallorn_boat_pretty"},
        "scripts": {
            "pre_animation": [
                "variable.row = math.lerp(variable.row ?? 0, (query.has_rider && query.ground_speed > 0.3) ? 1 : 0, "
                "math.min(1, query.delta_time * 4));",
                "variable.paddle = (variable.paddle ?? 0) + query.delta_time * variable.row * 330;",
            ],
            "animate": ["turn", "row"],
        },
        "animations": {"turn": "animation.lothlorien.mallorn_boat.turn", "row": "animation.lothlorien.mallorn_boat.row"},
        "render_controllers": ["controller.render.lothlorien.mallorn_boat"],
    }
    if chest:
        d["textures"]["chest"] = CHEST_TEXTURE
        d["geometry"]["chest"] = "geometry.lothlorien.mallorn_boat_chest"
        d["geometry"]["chest_pretty"] = "geometry.lothlorien.mallorn_boat_chest_pretty"
        d["render_controllers"].append("controller.render.lothlorien.mallorn_boat_chest")
    return {"format_version": "1.10.0", "minecraft:client_entity": {"description": d}}


CHEST_CONTROLLER = {"format_version": "1.8.0", "render_controllers": {
    "controller.render.lothlorien.mallorn_boat_chest": {
        "geometry": "query.is_pack_setting_enabled('lothlorien:pretty_boats') ? Geometry.chest_pretty : Geometry.chest",
        "materials": [{"*": "Material.default"}],
        "textures": ["Texture.chest"]}}}


def upsert_item_textures(entries):
    path = os.path.join(RP, "textures", "item_texture.json")
    data = json.load(open(path, encoding="utf-8"))
    for key, tex in entries.items():
        data["texture_data"][key] = {"textures": tex}
    write_json(path, data)


def upsert_lang(lines):
    path = os.path.join(RP, "texts", "en_US.lang")
    text = open(path, encoding="utf-8").read()
    for key, value in lines.items():
        line = f"{key}={value}"
        pat = re.compile(rf"^{re.escape(key)}=.*$", re.M)
        text = pat.sub(line, text) if pat.search(text) else text.rstrip("\n") + "\n" + line + "\n"
    with open(path, "w", encoding="utf-8", newline="\n") as f:
        f.write(text)


def main():
    build_art()
    textures, lang = {}, {}
    for prefix, planks_item, name in WOODS:
        boat = f"lothlorien:{prefix}_boat"
        for kind, ident, label in (("boat", boat, f"{name} Boat"),
                                   ("chest_boat", f"lothlorien:{prefix}_chest_boat", f"{name} Boat with Chest")):
            short = ident.split(":")[1]
            write_json(os.path.join(BP, "entities", f"{short}.json"), entity(kind, ident))
            write_json(os.path.join(BP, "items", f"{short}.json"), item(ident))
            write_json(os.path.join(BP, "recipes", f"{short}.json"),
                       recipe(ident, planks_item, boat if kind == "chest_boat" else None))
            write_json(os.path.join(BP, "loot_tables", "entities", f"{short}.json"), loot(ident))
            write_json(os.path.join(RP, "entity", f"{short}.entity.json"), client_entity(ident, prefix, kind == "chest_boat"))
            textures[ident] = f"textures/items/{short}"
            lang[f"item.{ident}"] = label
            lang[f"entity.{ident}.name"] = label
    write_json(os.path.join(RP, "render_controllers", "mallorn_boat_chest.render_controllers.json"), CHEST_CONTROLLER)
    upsert_item_textures(textures)
    upsert_lang(lang)
    print("boat family written:", ", ".join(textures))


if __name__ == "__main__":
    main()
