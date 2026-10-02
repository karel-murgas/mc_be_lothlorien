"""Generates the firefly art: geometry, the entity texture and the bottle icons.

    python -B mods/lothlorien/tools/make_firefly.py

Output (overwritten every run): lothlorien_rp/models/entity/firefly.geo.json,
lothlorien_rp/textures/entity/firefly.png (+ firefly_mers.tga, firefly.texture_set.json),
lothlorien_rp/textures/items/bottle_of_fireflies.png
(vanilla empty bottle plus glowing fireflies; needs reference/vanilla, see tools/refresh_vanilla_ref.ps1).
Glow under Vibrant Visuals: a PBR texture set whose emissive channel (green of the MERS map) lights the whole
green abdomen, the way vanilla glow squid and allay do (verified in game 2026-10-02). ignore_lighting and alpha-mask
emissive materials did not glow.
"""
import json
from pathlib import Path
from PIL import Image

RP = Path(__file__).resolve().parents[1] / "lothlorien_rp"
W, H = 32, 16
GLOW_ALPHA = 255
CLEAR = (0, 0, 0, 0)
DARK = [(38, 30, 26, 255), (58, 46, 36, 255), (78, 62, 46, 255)]
GLOW = [(200, 232, 70, GLOW_ALPHA), (226, 246, 110, GLOW_ALPHA), (246, 255, 170, GLOW_ALPHA)]
WING = [(214, 226, 232, 255), (236, 244, 248, 255)]
EYE = (12, 10, 10, 255)

BONES = {
    "body": (None, [0, 2, 0]),
    "abdomen": ("body", [0, 2, 1.5]),
    "head": ("body", [0, 2, -1.5]),
    "wing_l": ("body", [1, 3, 0]),
    "wing_r": ("body", [-1, 3, 0]),
}
# name, bone, origin, size, role, uv
CUBES = [
    ("body", "body", [-1, 1, -1.5], [2, 2, 3], "dark", (0, 0)),
    ("abdomen", "abdomen", [-1, 1, 1.5], [2, 2, 3], "glow", (10, 0)),
    ("head", "head", [-1, 1, -3.5], [2, 2, 2], "head", (20, 0)),
    ("wing_l", "wing_l", [1, 3, -1], [2, 0, 3], "wing", (0, 8)),
    ("wing_r", "wing_r", [-3, 3, -1], [2, 0, 3], "wing", (10, 8)),
]


def faces(u, v, size):
    w, h, d = size
    return {"top": (u + d, v, w, d), "bottom": (u + d + w, v, w, d),
            "east": (u, v + d, d, h), "north": (u + d, v + d, w, h),
            "west": (u + d + w, v + d, d, h), "south": (u + 2 * d + w, v + d, w, h)}


def geometry():
    bones = []
    for name, (parent, pivot) in BONES.items():
        b = {"name": name, "pivot": pivot}
        if parent:
            b["parent"] = parent
        b["cubes"] = [{"origin": o, "size": s, "uv": list(uv)} for n, bn, o, s, _r, uv in CUBES if bn == name]
        bones.append(b)
    return {"format_version": "1.12.0", "minecraft:geometry": [{
        "description": {"identifier": "geometry.lothlorien.firefly", "texture_width": W, "texture_height": H,
                        "visible_bounds_width": 1, "visible_bounds_height": 1, "visible_bounds_offset": [0, 0.3, 0]},
        "bones": bones}]}


def paint():
    img = Image.new("RGBA", (W, H), CLEAR)
    for name, _b, _o, size, role, uv in CUBES:
        for face, (x, y, w, h) in faces(*uv, size).items():
            for j in range(h):
                for i in range(w):
                    if role == "glow":
                        c = GLOW[2 if face in ("bottom", "south") else (1 if face != "top" else 0)]
                    elif role == "wing":
                        c = WING[(i + j) % 2]
                    elif role == "head":
                        c = EYE if face in ("north",) and j == 0 else DARK[1]
                    else:
                        c = DARK[2 if face == "top" else 0 if face == "bottom" else 1]
                    img.putpixel((x + i, y + j), c)
    return img


def mers():
    """Metalness/emissive/roughness/subsurface map in the entity texture's UV layout: the whole (green) abdomen emits."""
    img = Image.new("RGBA", (W, H), CLEAR)
    for name, _b, _o, size, role, uv in CUBES:
        for face, (x, y, w, h) in faces(*uv, size).items():
            emissive = 255 if role == "glow" else 0
            rough = {"glow": 230, "wing": 110}.get(role, 160)
            for j in range(h):
                for i in range(w):
                    img.putpixel((x + i, y + j), (0, emissive, rough, 0))
    return img


def texture_set(color, mers_name):
    return {"format_version": "1.21.30",
            "minecraft:texture_set": {"color": color, "metalness_emissive_roughness_subsurface": mers_name}}


VANILLA_BOTTLE = (Path(__file__).resolve().parents[3]
                  / "reference/vanilla/current/resource_packs/vanilla/textures/items/potion_bottle_empty.png")
CORE = (255, 255, 214)
GLOW_RGB = (200, 240, 60)
# (x, y, strength): two bright fireflies and a dimmer one; the rest of the glass stays empty
FLIES = ((9, 9, 1.0), (6, 12, 1.0), (10, 13, 0.6))
HALO_ALPHA = {1: 230, 2: 130}  # alpha of the glow by squared distance from a core: side neighbour, diagonal


def icon():
    """Vanilla empty bottle (cork, glass, rim) with a few bright firefly dots, each in a soft glow; empty glass between."""
    img = Image.open(VANILLA_BOTTLE).convert("RGBA")
    inside = set()
    for y in range(7, 14):
        xs = [x for x in range(16) if img.getpixel((x, y))[3]]
        inside |= {(x, y) for x in range(min(xs) + 1, max(xs)) if not img.getpixel((x, y))[3]}
    cores = {(x, y) for x, y, _s in FLIES}
    glow = {}
    for x, y, strength in FLIES:
        assert (x, y) in inside, (x, y)
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                xy = (x + dx, y + dy)
                if xy in inside and xy not in cores and dx * dx + dy * dy:
                    glow[xy] = max(glow.get(xy, 0), int(HALO_ALPHA[dx * dx + dy * dy] * strength))
    for xy, a in glow.items():
        img.putpixel(xy, GLOW_RGB + (a,))
    for x, y, strength in FLIES:
        img.putpixel((x, y), CORE + (255,) if strength >= 1 else (240, 250, 150, 255))
    return img


def main():
    (RP / "models/entity").mkdir(parents=True, exist_ok=True)
    (RP / "textures/entity").mkdir(parents=True, exist_ok=True)
    (RP / "textures/items").mkdir(parents=True, exist_ok=True)
    (RP / "models/entity/firefly.geo.json").write_text(json.dumps(geometry(), indent=2) + "\n")
    paint().save(RP / "textures/entity/firefly.png")
    mers().save(RP / "textures/entity/firefly_mers.tga")
    (RP / "textures/entity/firefly.texture_set.json").write_text(
        json.dumps(texture_set("firefly", "firefly_mers"), indent=2) + "\n")
    icon().save(RP / "textures/items/bottle_of_fireflies.png")
    print("firefly art written")


if __name__ == "__main__":
    main()
