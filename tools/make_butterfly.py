"""Generates the butterfly art: geometry and one texture per wing colour.

    python -B mods/lothlorien/tools/make_butterfly.py

Output (overwritten every run): lothlorien_rp/models/entity/butterfly.geo.json,
lothlorien_rp/textures/entity/butterfly/butterfly_<colour>.png for every colour in COLOURS.
The colour index (position in COLOURS) is the `lothlorien:wing` property in the BP entity and the
texture array in the render controller; keep the three in step (tests/run.mjs does not cover it, verify does).
"""
import json
from pathlib import Path
from PIL import Image

RP = Path(__file__).resolve().parents[1] / "lothlorien_rp"
W, H = 32, 32
CLEAR = (0, 0, 0, 0)
BODY = [(24, 18, 20, 255), (42, 32, 32, 255), (62, 48, 44, 255)]
# name: (wing, edge, spot) - bright wing, dark rim of the same hue, pale spots
COLOURS = {
    "red": ((226, 38, 48), (96, 12, 26), (255, 196, 176)),
    "orange": ((255, 138, 28), (112, 50, 10), (255, 226, 150)),
    "yellow": ((255, 218, 40), (122, 84, 10), (255, 250, 190)),
    "lime": ((124, 220, 52), (36, 90, 20), (226, 255, 160)),
    "turquoise": ((36, 212, 196), (10, 84, 92), (190, 255, 245)),
    "blue": ((54, 112, 240), (18, 36, 120), (186, 220, 255)),
    "violet": ((156, 72, 226), (62, 20, 110), (236, 190, 255)),
    "pink": ((255, 108, 190), (120, 22, 84), (255, 206, 236)),
}
# 6x6 wing outline, rows front (0) to back (5), columns body side (0) to tip (5)
MASK = ["..###.",
        "######",
        "######",
        "#####.",
        "#####.",
        ".###.."]
SPOTS = {(3, 1), (4, 2), (3, 4)}  # (column, row)

BONES = {
    "body": (None, [0, 1.5, 0]),
    "head": ("body", [0, 1.5, -2]),
    "wing_l": ("body", [0.5, 1.5, 0]),
    "wing_r": ("body", [-0.5, 1.5, 0]),
}
# name, bone, origin, size, role, uv, mirror
CUBES = [
    ("body", "body", [-0.5, 1, -2], [1, 1, 4], "body", (0, 0), False),
    ("head", "head", [-1, 0.5, -4], [2, 2, 2], "body", (12, 0), False),
    ("wing_l", "wing_l", [0.5, 1.5, -3], [6, 0, 6], "wing", (0, 16), False),
    ("wing_r", "wing_r", [-6.5, 1.5, -3], [6, 0, 6], "wing", (0, 16), True),
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
        cubes = []
        for _n, bn, o, s, _r, uv, mirror in CUBES:
            if bn == name:
                cube = {"origin": o, "size": s, "uv": list(uv)}
                if mirror:
                    cube["mirror"] = True
                cubes.append(cube)
        b["cubes"] = cubes
        bones.append(b)
    return {"format_version": "1.12.0", "minecraft:geometry": [{
        "description": {"identifier": "geometry.lothlorien.butterfly", "texture_width": W, "texture_height": H,
                        "visible_bounds_width": 2, "visible_bounds_height": 1, "visible_bounds_offset": [0, 0.3, 0]},
        "bones": bones}]}


def wing_pixel(i, j, colour):
    """Colour of wing cell column i, row j (None outside the outline): dark rim, bright body, pale spots."""
    main, edge, spot = colour
    if MASK[j][i] != "#":
        return None
    rim = any(not (0 <= i + di < 6 and 0 <= j + dj < 6) or MASK[j + dj][i + di] != "#"
              for di, dj in ((1, 0), (-1, 0), (0, 1), (0, -1)))
    if rim:
        return edge + (255,)
    if (i, j) in SPOTS:
        return spot + (255,)
    shade = 0.88 if i == 0 else 1.0  # slightly darker next to the body
    return tuple(int(c * shade) for c in main) + (255,)


def paint(colour):
    img = Image.new("RGBA", (W, H), CLEAR)
    for _n, _b, _o, size, role, uv, _m in CUBES:
        for face, (x, y, w, h) in faces(*uv, size).items():
            for j in range(h):
                for i in range(w):
                    if role == "wing":
                        # the bottom face is read back to front, so flip it to keep the outline
                        c = wing_pixel(i, 5 - j if face == "bottom" else j, colour)
                        if c:
                            img.putpixel((x + i, y + j), c)
                    else:
                        img.putpixel((x + i, y + j), BODY[2 if face == "top" else 0 if face == "bottom" else 1])
    return img


def main():
    (RP / "models/entity").mkdir(parents=True, exist_ok=True)
    out = RP / "textures/entity/butterfly"
    out.mkdir(parents=True, exist_ok=True)
    (RP / "models/entity/butterfly.geo.json").write_text(json.dumps(geometry(), indent=2) + "\n")
    for name, colour in COLOURS.items():
        paint(colour).save(out / f"butterfly_{name}.png")
    print(f"butterfly art written: {len(COLOURS)} colours: {', '.join(COLOURS)}")


if __name__ == "__main__":
    main()
