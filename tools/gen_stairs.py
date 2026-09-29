"""Regenerate Mallorn stairs: 10 geometries + the block's 40 permutations.

Boxes are written in WORLD terms for a north-facing stair (+x east, -z north, y up).
collision_box takes them as-is; block geometry draws x mirrored, so geometry cubes get x negated.
"""
import json, pathlib

MOD = pathlib.Path(__file__).resolve().parent.parent
GEO = MOD / "lothlorien_rp/models/blocks"
BLOCK = MOD / "lothlorien_bp/blocks/mallorn_stairs.json"

# Quadrants of the step layer, seen from above, for facing north.
NORTH_HALF = [(-8, -8, 16, 8)]            # x, z, sx, sz
NW, NE, SW, SE = (-8, -8, 8, 8), (0, -8, 8, 8), (-8, 0, 8, 8), (0, 0, 8, 8)
# Java rules: left = counter-clockwise of facing (west for north), right = clockwise (east).
SHAPES = {
    "none": NORTH_HALF,                   # geometry name "straight"
    "outer_left": [NW],
    "outer_right": [NE],
    "inner_left": NORTH_HALF + [SW],
    "inner_right": NORTH_HALF + [SE],
}
GEO_NAME = {"none": "straight"}
ROTATION = {"north": 0, "west": 90, "south": 180, "east": 270}


def boxes(shape, half):
    slab_y, step_y = (0, 8) if half == "bottom" else (8, 0)
    out = [((-8, slab_y, -8), (16, 8, 16))]
    out += [((x, step_y, z), (sx, 8, sz)) for x, z, sx, sz in SHAPES[shape]]
    return out


def face_uvs(origin, size):
    """UVs taken from the cube's world position so the plank texture lines up across faces."""
    x, y, z = origin
    sx, sy, sz = size
    side_v = 16 - (y + sy)
    return {
        "north": {"uv": [8 - (x + sx), side_v], "uv_size": [sx, sy]},
        "south": {"uv": [x + 8, side_v], "uv_size": [sx, sy]},
        "east": {"uv": [8 - (z + sz), side_v], "uv_size": [sz, sy]},
        "west": {"uv": [z + 8, side_v], "uv_size": [sz, sy]},
        "up": {"uv": [x + 8, z + 8], "uv_size": [sx, sz]},
        "down": {"uv": [x + 8, 8 - (z + sz)], "uv_size": [sx, sz]},
    }


def geo_id(shape, half):
    return f"geometry.lothlorien.mallorn_stairs_{GEO_NAME.get(shape, shape)}_{half}"


for shape in SHAPES:
    for half in ("bottom", "top"):
        cubes = []
        for (x, y, z), (sx, sy, sz) in boxes(shape, half):
            gx = -(x + sx)  # mirror x for block geometry
            cubes.append({"origin": [gx, y, z], "size": [sx, sy, sz], "uv": face_uvs((x, y, z), (sx, sy, sz))})
        geo = {
            "format_version": "1.26.50",
            "minecraft:geometry": [{
                "description": {"identifier": geo_id(shape, half), "texture_width": 16, "texture_height": 16},
                "bones": [{"name": "body", "pivot": [0, 0, 0], "cubes": cubes}],
            }],
        }
        name = geo_id(shape, half).removeprefix("geometry.lothlorien.")
        (GEO / f"{name}.geo.json").write_text(json.dumps(geo, indent=2) + "\n", encoding="utf-8", newline="\n")

block = json.loads(BLOCK.read_text(encoding="utf-8"))
desc = block["minecraft:block"]["description"]
desc.pop("states", None)
desc["traits"]["minecraft:placement_direction"] = {
    "enabled_states": ["minecraft:corner_and_cardinal_direction"]
}
perms = []
for shape in SHAPES:
    for half in ("bottom", "top"):
        for facing, rot in ROTATION.items():
            comps = {
                "minecraft:geometry": geo_id(shape, half),
                "minecraft:collision_box": [{"origin": list(o), "size": list(s)} for o, s in boxes(shape, half)],
            }
            if rot:
                comps["minecraft:transformation"] = {"rotation": [0, rot, 0]}
            perms.append({
                "condition": f"q.block_state('minecraft:vertical_half') == '{half}' && "
                             f"q.block_state('minecraft:cardinal_direction') == '{facing}' && "
                             f"q.block_state('minecraft:corner') == '{shape}'",
                "components": comps,
            })
block["minecraft:block"]["permutations"] = perms
BLOCK.write_text(json.dumps(block, indent=2) + "\n", encoding="utf-8", newline="\n")
print(len(perms), "permutations")
