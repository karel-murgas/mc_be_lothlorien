"""Generates the Mallorn bee (Phase 14b) from the vanilla bee: behaviour, client entity, controllers, textures.

    python -B mods/lothlorien/tools/make_mallorn_bee.py

The entity is the newest vanilla bee.json with our identifier and our flowers (Elanor, Niphredil, Athelas,
Mallorn blossom) in every flower list; the open eyeblossom / wither rose feeding is dropped. Textures are the
vanilla bee textures recoloured: yellow -> pale gold, brown stripes -> silver; wings and eyes unchanged.
Needs reference/vanilla (see tools/refresh_vanilla_ref.ps1).

SPIKE (plan Phase 14b): two variants differ in the nectar property (see CONTROL_FLOWERS), to learn which one the vanilla hive
reads for honey: `mallorn_bee` declares vanilla's `minecraft:has_nectar`, `mallorn_bee_b` our own
`lothlorien:has_nectar`. Delete the losing variant from VARIANTS after the in-game test.
"""
import colorsys
import copy
import json
import re
import shutil
from pathlib import Path
from PIL import Image

MOD = Path(__file__).resolve().parents[1]
BP, RP = MOD / "lothlorien_bp", MOD / "lothlorien_rp"
VANILLA = MOD.parents[1] / "reference" / "vanilla" / "current"

FLOWERS = ["lothlorien:elanor", "lothlorien:niphredil", "lothlorien:athelas", "lothlorien:mallorn_blossom"]


# SPIKE (2026-10-02, 1.26.52): custom flower blocks in move_to_block.target_blocks are never targeted (bare ids,
# exact-state descriptors, with or without vanilla's is_waterlogged filter); vanilla poppy/dandelion are. Round 4 gives
# both variants the vanilla control flowers so the honey test can run: B (lothlorien:has_nectar) brought nectar to a
# nest and made no honey; does A (minecraft:has_nectar)?
CONTROL_FLOWERS = ["minecraft:poppy", "minecraft:dandelion"]


# identifier suffix -> nectar property
VARIANTS = {"mallorn_bee": "minecraft:has_nectar", "mallorn_bee_b": "lothlorien:has_nectar"}
NAMES = {"mallorn_bee": "Mallorn Bee", "mallorn_bee_b": "Mallorn Bee (test B)"}
TEXTURES = ["bee", "bee_nectar", "bee_angry", "bee_angry_nectar",
            "bee_baby", "bee_nectar_baby", "bee_angry_baby", "bee_angry_nectar_baby"]
TEX_DIR = "textures/entity/mallorn_bee"
EGG = ("#ecdc9a", "#b9bfca")


def newest(kind, rel):
    hits = sorted(VANILLA.glob(f"{kind}/vanilla_*/{rel}"),
                  key=lambda p: [int(x) for x in re.findall(r"\d+", p.parts[-1 - len(Path(rel).parts)])])
    if not hits:
        raise SystemExit(f"vanilla file not found: {rel}")
    return hits[-1]


def behaviour(ident, prop):
    src = json.loads(newest("behavior_packs", "entities/bee.json").read_text(encoding="utf-8"))
    ent = src["minecraft:entity"]
    ent["description"]["identifier"] = ident
    ent["description"]["properties"] = {prop: ent["description"]["properties"]["minecraft:has_nectar"]}
    groups, comps, events = ent["component_groups"], ent["components"], ent["events"]

    groups["bee_baby"]["minecraft:ageable"]["feed_items"] = FLOWERS
    groups["bee_adult"]["minecraft:breedable"]["breed_items"] = FLOWERS
    groups["bee_adult"]["minecraft:breedable"]["breeds_with"] = {ident: {}}
    groups["look_for_food"]["minecraft:behavior.move_to_block"]["target_blocks"] = FLOWERS + CONTROL_FLOWERS
    comps["minecraft:behavior.tempt"]["items"] = FLOWERS
    comps["minecraft:offspring"]["offspring_pairs"] = {ident: ident}
    comps["minecraft:type_family"]["family"].append("lothlorien_bee")
    groups["countdown_to_perish"]["minecraft:type_family"]["family"].append("lothlorien_bee")

    # eyeblossom / wither rose feeding belongs to vanilla flowers
    del comps["minecraft:interact"]
    for g in ("add_poison_effect", "add_wither_effect"):
        del groups[g]
    for e in ("fed_open_eyeblossom", "on_poison_effect_added", "fed_wither_rose", "on_wither_effect_added"):
        del events[e]

    for ev in events.values():  # vanilla removes a group "collect_nectar" that it never defines
        for step in ev.get("sequence", [ev]):
            groups_out = step.get("remove", {}).get("component_groups")
            if groups_out and "collect_nectar" in groups_out:
                groups_out.remove("collect_nectar")

    text = json.dumps(src, indent=2)
    return text.replace("minecraft:has_nectar", prop) + "\n"


def client(ident, name):
    tex = {"default": "bee", "angry": "bee_angry", "nectar": "bee_nectar", "angry_nectar": "bee_angry_nectar",
           "baby_default": "bee_baby", "baby_angry": "bee_angry_baby", "baby_nectar": "bee_nectar_baby",
           "baby_angry_nectar": "bee_angry_nectar_baby"}
    return {"format_version": "1.10.0", "minecraft:client_entity": {"description": {
        "identifier": ident,
        "materials": {"default": "bee"},
        "textures": {k: f"{TEX_DIR}/{v}" for k, v in tex.items()},
        "geometry": {"default": "geometry.bee", "baby": "geometry.bee.baby"},
        "animations": {
            "flying": "animation.bee.flying",
            "drip": f"controller.animation.lothlorien.{name}.drip",
            "controller_bee_sting": "controller.animation.bee.sting",
            "bee_sting": "animation.bee.sting",
            "bee_no_stinger": "animation.bee.no_stinger",
            "bee_fly_bobbing": "animation.bee.fly.bobbing",
            "bee_root_controller": f"controller.animation.lothlorien.{name}.root"},
        "particle_effects": {"nectar_dripping": "minecraft:nectar_drip_particle"},
        "scripts": {"scale": "query.is_baby ? 2.0 : 1.0",
                    "animate": ["bee_root_controller", {"bee_no_stinger": "query.mark_variant == 1"}]},
        "render_controllers": [f"controller.render.lothlorien.{name}"],
        "spawn_egg": {"base_color": EGG[0], "overlay_color": EGG[1]}}}}


def render_controllers():
    out = {}
    for name, prop in VARIANTS.items():
        pick = f"query.property('{prop}') + query.is_angry * 2"
        out[f"controller.render.lothlorien.{name}"] = {
            "arrays": {"textures": {
                "array.skins": ["texture.default", "texture.nectar", "texture.angry", "texture.angry_nectar"],
                "array.baby_skins": ["texture.baby_default", "texture.baby_nectar", "texture.baby_angry",
                                     "texture.baby_angry_nectar"]}},
            "geometry": "query.is_baby ? Geometry.baby : Geometry.default",
            "materials": [{"*": "Material.default"}],
            "textures": [f"query.is_baby ? array.baby_skins[{pick}] : array.skins[{pick}]"]}
    return {"format_version": "1.8.0", "render_controllers": out}


def animation_controllers():
    out = {}
    for name, prop in VARIANTS.items():
        q = f"query.property('{prop}')"
        out[f"controller.animation.lothlorien.{name}.drip"] = {"initial_state": "default", "states": {
            "default": {"transitions": [{"dripping": q}]},
            "dripping": {"particle_effects": [{"effect": "nectar_dripping"}], "transitions": [{"default": f"!{q}"}]}}}
        out[f"controller.animation.lothlorien.{name}.root"] = {"initial_state": "default", "states": {
            "default": {"animations": ["flying", "drip", "bee_fly_bobbing", "controller_bee_sting"]}}}
    return {"format_version": "1.10.0", "animation_controllers": out}


def recolour(px):
    r, g, b, a = px
    if a == 0:
        return px
    h, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
    if s < 0.25 or not (h < 0.17 or h > 0.95):  # wings, eyes, greys: unchanged
        return px
    if r > 2.5 * g and v > 0.6:  # angry red eyes: unchanged
        return px
    if v >= 0.55:  # yellow body -> pale gold
        h2, s2, v2 = 0.12, s * 0.7, min(1.0, 0.15 + v * 0.88)
    else:  # brown stripes, legs, face -> silver with a cool tint
        h2, s2, v2 = 0.62, 0.06, min(1.0, 0.28 + v * 1.1)
    r2, g2, b2 = colorsys.hsv_to_rgb(h2, s2, v2)
    return (round(r2 * 255), round(g2 * 255), round(b2 * 255), a)


def textures():
    out = RP / TEX_DIR
    out.mkdir(parents=True, exist_ok=True)
    for t in TEXTURES:
        src = newest("resource_packs", f"textures/entity/bee/{t}.png")
        im = Image.open(src).convert("RGBA")
        im.putdata([recolour(p) for p in im.get_flattened_data()])
        im.save(out / f"{t}.png")
        for extra in (f"{t}_mers.tga", f"{t}.texture_set.json"):  # vanilla PBR maps, same names
            if (src.parent / extra).exists():
                shutil.copyfile(src.parent / extra, out / extra)


SOUNDS = {"volume": 0.6, "pitch": 1.0, "events": {  # vanilla 1.14 sounds.json "bee"
    "hurt": {"sound": "mob.bee.hurt", "volume": 0.6, "pitch": [0.9, 1.1]},
    "death": {"sound": "mob.bee.death", "volume": 0.6, "pitch": [0.9, 1.1]},
    "attack": {"sound": "mob.bee.sting", "pitch": [0.8, 1.0]},
    "ambient.pollinate": {"sound": "mob.bee.pollinate", "volume": 0.85}}}


def sounds():
    path = RP / "sounds.json"
    data = json.loads(path.read_text(encoding="utf-8"))
    ents = data["entity_sounds"]["entities"]
    for name in [k for k in ents if k.startswith("lothlorien:mallorn_bee")]:
        del ents[name]
    for name in VARIANTS:
        ents[f"lothlorien:{name}"] = SOUNDS
    write(path, data)


def write(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(data if isinstance(data, str) else json.dumps(data, indent=2) + "\n", encoding="utf-8")


def main():
    for name, prop in VARIANTS.items():
        write(BP / "entities" / f"{name}.json", behaviour(f"lothlorien:{name}", prop))
        write(RP / "entity" / f"{name}.entity.json", client(f"lothlorien:{name}", name))
    write(RP / "render_controllers" / "mallorn_bee.render_controllers.json", render_controllers())
    write(RP / "animation_controllers" / "mallorn_bee.animation_controllers.json", animation_controllers())
    textures()
    sounds()
    print("mallorn bee written:", ", ".join(VARIANTS))


if __name__ == "__main__":
    main()
