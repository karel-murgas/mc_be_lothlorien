"""Generates the unicorn (Phase 15): behaviour entity, client entity, geometry, animation, render controller and texture.

    python -B mods/lothlorien/tools/make_unicorn.py

Output (overwritten every run): lothlorien_bp/entities/unicorn.json, lothlorien_rp/entity/unicorn.entity.json,
lothlorien_rp/models/entity/unicorn.geo.json, lothlorien_rp/animations/unicorn.animation.json,
lothlorien_rp/render_controllers/unicorn.render_controllers.json, lothlorien_rp/textures/entity/unicorn/unicorn.png.

Body = the vanilla horse (geometry.horse.v3, white horse texture, walk/look animations) with the saddle, bridle, bags and
mule ears left out and a three-step horn added on the head; the coat is tinted pearl, mane and tail lilac. Reads the
vanilla files from reference/vanilla/current (git-ignored; rebuild with tools/refresh_vanilla_ref.ps1).
Not seen in game yet. The state groups follow entities/white_deer.json (Disharmony wariness, driven by scripts/deer.js).
"""
import json
from pathlib import Path
from PIL import Image

MOD = Path(__file__).resolve().parents[1]
BP, RP = MOD / "lothlorien_bp", MOD / "lothlorien_rp"
VANILLA_RP = MOD.parents[1] / "reference" / "vanilla" / "current" / "resource_packs" / "vanilla"
ID = "lothlorien:unicorn"
ELANOR = "lothlorien:elanor"
ALL_STATES = [f"lothlorien:state_{n}" for n in ("calm", "l1", "l2", "l3", "friend", "tame", "alarmed")]


def write(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")


# ---------------------------------------------------------------- behaviour entity
def player_avoid(dist, sneak_dist, walk, sprint, lure=False):
    def entry(sneaking, max_dist):
        tests = [
            {"test": "is_family", "subject": "other", "value": "player"},
            {"test": "is_sneaking", "subject": "other", "value": sneaking},
        ]
        if lure:  # a player holding the lure is not fled from
            tests.append({"test": "has_equipment", "subject": "other", "domain": "hand", "operator": "!=", "value": ELANOR})
        return {"filters": {"all_of": tests}, "max_dist": max_dist, "walk_speed_multiplier": walk, "sprint_speed_multiplier": sprint}

    return [entry(False, dist), entry(True, sneak_dist)]


DANGER = [
    {"filters": {"test": "is_family", "subject": "other", "value": "wolf"}, "max_dist": 12, "walk_speed_multiplier": 1.4, "sprint_speed_multiplier": 1.8},
    {"filters": {"test": "is_family", "subject": "other", "value": "monster"}, "max_dist": 8, "walk_speed_multiplier": 1.4, "sprint_speed_multiplier": 1.8},
]


def avoid_group(dist, sneak, walk, sprint, lure=False, extra=None):
    group = {"minecraft:behavior.avoid_mob_type": {"priority": 4, "entity_types": player_avoid(dist, sneak, walk, sprint, lure) + DANGER}}
    if lure:
        group["minecraft:behavior.tempt"] = {"priority": 3, "speed_multiplier": 1, "items": [ELANOR], "can_get_scared": False}
    if extra:
        group.update(extra)
    return group


# The offer is only open to a Friend of Lothlorien (scripts/unicorn.js checks it); the interact entry just gives the prompt.
OFFER = {
    "minecraft:interact": {
        "interactions": [
            {
                "on_interact": {
                    "filters": {
                        "all_of": [
                            {"test": "is_family", "subject": "other", "value": "player"},
                            {"test": "has_equipment", "domain": "hand", "subject": "other", "value": ELANOR},
                        ]
                    }
                },
                "use_item": False,
                "swing": True,
                "cooldown": 1,
                "interact_text": "action.interact.lothlorien.offer_elanor",
            }
        ]
    }
}


def state_events():
    def set_state(name):
        base = {"set_property": {"lothlorien:wariness": name, "lothlorien:alarmed": False}, "remove": {"component_groups": ALL_STATES}}
        return {
            "sequence": [
                base,
                {"filters": {"test": "bool_property", "domain": "lothlorien:tame", "value": False}, "add": {"component_groups": [f"lothlorien:state_{name}"]}},
                {"filters": {"test": "bool_property", "domain": "lothlorien:tame", "value": True}, "add": {"component_groups": ["lothlorien:state_tame"]}},
            ]
        }

    names = ["calm", "l1", "l2", "l3", "friend"]
    events = {f"lothlorien:set_{n}": set_state(n) for n in names}
    events["lothlorien:alarm"] = {
        "set_property": {"lothlorien:alarmed": True},
        "remove": {"component_groups": ALL_STATES},
        "add": {"component_groups": ["lothlorien:state_alarmed"]},
    }
    events["lothlorien:alarm_over"] = {
        "sequence": [
            {"filters": {"test": "enum_property", "domain": "lothlorien:wariness", "value": n}, "trigger": f"lothlorien:set_{n}"} for n in names
        ]
    }
    events["minecraft:entity_spawned"] = {"trigger": "lothlorien:set_calm"}
    # The bond: the script sets the owner and the property is visible a tick later, when it re-applies the state.
    events["lothlorien:become_tame"] = {"set_property": {"lothlorien:tame": True}, "add": {"component_groups": ["lothlorien:bonded"]}}
    return events


def behaviour_entity():
    groups = {
        "lothlorien:state_calm": avoid_group(13, 6, 1.4, 1.7, extra=OFFER),  # a stranger: keeps its distance, no lure
        "lothlorien:state_l1": avoid_group(13, 6, 1.4, 1.7),
        "lothlorien:state_l2": avoid_group(20, 10, 1.5, 1.9),
        "lothlorien:state_l3": avoid_group(30, 15, 1.6, 2.1),
        "lothlorien:state_friend": avoid_group(3, 2, 1.1, 1.3, lure=True, extra=OFFER),
        "lothlorien:state_tame": {},
        "lothlorien:state_alarmed": avoid_group(36, 18, 1.6, 2.1, extra={
            "minecraft:timer": {"time": 20, "looping": False, "time_down_event": {"event": "lothlorien:alarm_over", "target": "self"}}
        }),
        # Bonded to a player: rideable by its owner without a saddle (scripts/unicorn.js keeps everyone else off), the best
        # horse's jump, never despawns. No saddle slot, no armor slot, not leashable.
        "lothlorien:bonded": {
            "minecraft:is_tamed": {},
            "minecraft:persistent": {},
            "minecraft:rideable": {
                "seat_count": 1,
                "family_types": ["player"],
                "interact_text": "action.interact.mount",
                "seats": {"position": [0.0, 1.1, -0.2]},
            },
            "minecraft:behavior.player_ride_tamed": {},
            "minecraft:can_power_jump": {},
            "minecraft:input_ground_controlled": {},
            # a ridden horse steps up a full block (a custom mount only gets the default 0.5625 without this)
            "minecraft:variable_max_auto_step": {"base_value": 1.0625, "controlled_value": 1.0625, "jump_prevented_value": 0.5625},
        },
    }
    components = {
        "minecraft:type_family": {"family": ["lothlorien_unicorn", "mob"]},
        "minecraft:collision_box": {"width": 1.4, "height": 1.6},
        # the best horse: top health, top speed, top jump (vanilla ranges are 15-30, 0.1125-0.3375, 0.4-1.0)
        "minecraft:health": {"value": 30, "max": 30},
        "minecraft:movement": {"value": 0.3375},
        "minecraft:horse.jump_strength": {"value": 1.0},
        "minecraft:navigation.walk": {"can_path_over_water": True, "avoid_water": True, "avoid_damage_blocks": True, "using_door_annotation": True},
        "minecraft:movement.basic": {},
        "minecraft:jump.static": {},
        "minecraft:physics": {},
        "minecraft:pushable_by_entity": {},
        "minecraft:pushable_by_block": {},
        "minecraft:breathable": {"total_supply": 15, "suffocate_time": 0},
        "minecraft:hurt_on_condition": {"damage_conditions": [{"filters": {"test": "in_lava", "subject": "self"}, "cause": "lava", "damage_per_tick": 4}]},
        "minecraft:nameable": {},
        "minecraft:is_hidden_when_invisible": {},
        "minecraft:despawn": {"despawn_from_distance": {}},
        "minecraft:conditional_bandwidth_optimization": {},
        "minecraft:ambient_sound_interval": {"value": 12, "range": 20, "event_name": "ambient"},
        "minecraft:behavior.float": {"priority": 0},
        "minecraft:behavior.panic": {"priority": 1, "speed_multiplier": 1.8},
        "minecraft:behavior.random_stroll": {"priority": 6, "speed_multiplier": 0.7},
        "minecraft:behavior.look_at_player": {"priority": 7, "look_distance": 6, "probability": 0.02},
        "minecraft:behavior.random_look_around": {"priority": 8},
    }
    return {
        "format_version": "1.26.50",
        "minecraft:entity": {
            "description": {
                "identifier": ID,
                "spawn_category": "creature",
                "is_spawnable": True,
                "is_summonable": True,
                "properties": {
                    "lothlorien:wariness": {"type": "enum", "values": ["calm", "l1", "l2", "l3", "friend"], "default": "calm", "client_sync": False},
                    "lothlorien:alarmed": {"type": "bool", "default": False, "client_sync": False},
                    "lothlorien:tame": {"type": "bool", "default": False, "client_sync": False},
                    "lothlorien:trust": {"type": "int", "range": [0, 3], "default": 0, "client_sync": False},
                },
            },
            "component_groups": groups,
            "components": components,
            "events": state_events(),
        },
    }


# ---------------------------------------------------------------- client side
KEEP = {"Body", "Tail", "LegBL", "LegBR", "LegFL", "LegFR", "Neck", "Head", "Muzzle", "EarL", "EarR", "Mane"}
# three stepped boxes, each a little further forward (-z) and 3, 3, 2 high: a horn leaning over the muzzle. uv in a free
# patch of the horse texture (rows 2-5, left of the head faces).
HORN = [
    ("HornA", [-0.5, 33, -10.0], [1, 3, 1], [0, 2]),
    ("HornB", [-0.5, 36, -10.5], [1, 3, 1], [5, 2]),
    ("HornC", [-0.5, 39, -11.0], [1, 2, 1], [10, 2]),
]


def geometry():
    src = json.loads((VANILLA_RP / "models/entity/horse_v3.geo.json").read_text(encoding="utf-8"))["geometry.horse.v3"]
    bones = [b for b in src["bones"] if b["name"] in KEEP]
    head = next(b for b in bones if b["name"] == "Head")
    head_pivot = head["pivot"]
    for name, origin, size, uv in HORN:
        bones.append({"name": name, "parent": "Head", "pivot": head_pivot, "cubes": [{"origin": origin, "size": size, "uv": uv}]})
    geo = dict(src)
    geo["bones"] = bones
    return {"format_version": "1.10.0", "geometry.lothlorien.unicorn": {k: v for k, v in geo.items()}}


def animation():
    src = json.loads((VANILLA_RP / "animations/horse_v3.animation.json").read_text(encoding="utf-8"))["animations"]
    out = {}
    for key in ("walk", "look_at_player"):
        anim = json.loads(json.dumps(src[f"animation.horse.v3.{key}"]))
        anim["bones"] = {b: v for b, v in anim["bones"].items() if not b.startswith("bag")}
        # query.head_y_rotation takes a clamp in degrees only for the vanilla horse family; any other entity must pass 0 (unclamped, so the head can swing right round while ridden: clamp it ourselves)
        anim["bones"] = json.loads(json.dumps(anim["bones"]).replace("query.head_y_rotation(20)", "math.clamp(query.head_y_rotation(0), -20.0, 20.0)"))
        out[f"animation.lothlorien.unicorn.{key}"] = anim
    return {"format_version": "1.8.0", "animations": out}


def client_entity():
    return {
        "format_version": "1.10.0",
        "minecraft:client_entity": {
            "description": {
                "identifier": ID,
                "materials": {"default": "entity_alphatest"},
                "textures": {"default": "textures/entity/unicorn/unicorn"},
                "geometry": {"default": "geometry.lothlorien.unicorn"},
                "animations": {"walk": "animation.lothlorien.unicorn.walk", "look_at_player": "animation.lothlorien.unicorn.look_at_player"},
                "scripts": {
                    "pre_animation": [
                        "variable.head_x_rot = query.target_x_rotation + (query.modified_move_speed > 0.2 ? (math.cos(query.modified_distance_moved * 11.46) * 11.46 * query.modified_move_speed + query.modified_move_speed * 11.46) : 0.0);",
                        "variable.stand_anim = 0.0;",
                        "variable.inverse_max_stand_eat = 1.0;",
                        "variable.leg_stand_factor = math.cos((query.modified_distance_moved * 38.38) + 180.0);",
                        "variable.leg_x_rot_anim = variable.leg_stand_factor * 45.8 * query.modified_move_speed;",
                    ],
                    "animate": ["walk", "look_at_player"],
                },
                "render_controllers": ["controller.render.lothlorien.unicorn"],
                "spawn_egg": {"base_color": "#f3f1f7", "overlay_color": "#b9a6d6"},
            }
        },
    }


def render_controller():
    return {
        "format_version": "1.8.0",
        "render_controllers": {"controller.render.lothlorien.unicorn": {"geometry": "Geometry.default", "materials": [{"*": "Material.default"}], "textures": ["Texture.default"]}},
    }


# ---------------------------------------------------------------- texture
def lerp(a, b, t):
    return tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3))


def texture():
    im = Image.open(VANILLA_RP / "textures/entity/horse2/horse_white.png").convert("RGBA")
    px = im.load()
    w, h = im.size
    # the white horse is already grey-white; give it a slightly cool pearl cast, keep the dark pixels (eyes, nostrils, hooves)
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a and (r + g + b) / 3 >= 90:
                px[x, y] = (min(255, round(r * 0.97)), min(255, round(g * 0.98)), min(255, round(b * 1.04)), a)

    def lilac(x0, y0, x1, y1):  # mane and tail: pale lilac, darker towards the tips, light and shade of the vanilla texture kept
        for y in range(y0, y1):
            for x in range(x0, x1):
                r, g, b, a = px[x, y]
                if not a:
                    continue
                lum = (r + g + b) / 3 / 255
                base = lerp((236, 222, 248), (160, 134, 200), (y - y0) / max(1, y1 - y0 - 1))
                k = 0.55 + 0.45 * lum
                px[x, y] = (round(base[0] * k), round(base[1] * k), round(base[2] * k), a)

    lilac(42, 36, 56, 54)  # tail (3 x 14 x 4 box)
    lilac(56, 36, 64, 54)  # mane (2 x 16 x 2 box)

    # horn: ivory, a spiral of lighter and darker bands rising to a pale tip; each box's patch is 4 wide (2 high for the tip)
    ivory = [(250, 247, 235), (238, 232, 212), (222, 213, 190)]
    for (_, _, size, uv) in HORN:
        ux, uy = uv
        sw, sh, sd = size
        ext_w, ext_h = 2 * (sw + sd), sh + sd
        for y in range(ext_h):
            for x in range(ext_w):
                shade = (x + y) % 3  # diagonal bands = the spiral
                px[ux + x, uy + y] = ivory[shade] + (255,)
    # clear what the geometry does not use (the vanilla sheet also holds saddle, bridle, bags and mule ears)
    used = [(0, 32, 64, 64), (0, 35, 22, 54), (0, 13, 26, 25), (0, 25, 18, 35), (19, 16, 25, 20), (48, 21, 64, 36), (42, 36, 64, 54)]
    for (_, _, size, uv) in HORN:
        used.append((uv[0], uv[1], uv[0] + 2 * (size[0] + size[2]), uv[1] + size[1] + size[2]))
    for y in range(h):
        for x in range(w):
            if not any(x0 <= x < x1 and y0 <= y < y1 for x0, y0, x1, y1 in used):
                px[x, y] = (0, 0, 0, 0)
    path = RP / "textures/entity/unicorn/unicorn.png"
    path.parent.mkdir(parents=True, exist_ok=True)
    im.save(path)


def main():
    write(BP / "entities/unicorn.json", behaviour_entity())
    write(RP / "entity/unicorn.entity.json", client_entity())
    write(RP / "models/entity/unicorn.geo.json", geometry())
    write(RP / "animations/unicorn.animation.json", animation())
    write(RP / "render_controllers/unicorn.render_controllers.json", render_controller())
    texture()
    print("unicorn written")


if __name__ == "__main__":
    main()
