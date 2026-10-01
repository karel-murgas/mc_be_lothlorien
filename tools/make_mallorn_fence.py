"""Mallorn fence geometry (owner's design, 2026-10-01): the vanilla fence with both rails bent into an inverted V
(low at the post, peak at the block edge, so two neighbours draw a ^ between their posts) and a small diamond cap.

Writes lothlorien_rp/models/blocks/mallorn_fence.geo.json (bones post, north_rails, south_rails, west_rails,
east_rails: the block's bone_visibility and the heartwood clone rely on these names) and
mallorn_fence_carried.geo.json (the inventory icon: two posts with a ^ between; its item_display_transforms are kept).
Every face uses the block's default material ("*" = mallorn_fence_post texture: 4 sides x 4 columns); the rails and
cap read a leaf-free strip of it. Both sets share this geometry.

World coordinates below: block centred on x/z in [-8, 8], north = -z, east = +x. Geometry x is mirrored
(geo_x = -world_x), handled in cube(). Rotations are multiples of 22.5 degrees (per-cube x rotation for the slopes,
the four sides by turning the north rails). Checked in Blockbench during design.

  python -B tools/make_mallorn_fence.py
"""
import json
import math
import os

HERE = os.path.dirname(os.path.abspath(__file__))
MODELS = os.path.join(HERE, "..", "lothlorien_rp", "models", "blocks")
T22 = math.tan(math.radians(22.5))
RAIL_Y = (7.5, 13.0)  # bottom of each rail at the post; both rise 6 * tan(22.5) = 2.49 to the block edge


# Rails and cap wear the post's own colours (owner: the planks looked white): a 2-wide strip of the post's west side
# without leaf or knot (columns 5-6, rows 1-7.5), its vertical grain turned to run along the rail.
RAIL_UV = [5, 1]


def faces_for(size, kind):
    sx, sy, sz = size
    if kind == "post":  # 4 sides read consecutive 4-wide columns of the post texture
        order = {"north": 0, "west": 1, "south": 2, "east": 3}
        fs = {f: {"uv": [4 * i, 0], "uv_size": [4, sy]} for f, i in order.items()}
        fs["up"] = {"uv": [4, 1], "uv_size": [4, 4]}
        fs["down"] = {"uv": [4, 4], "uv_size": [4, 4]}
        return fs
    if kind == "rail":  # a rail along z: tops take the strip as it is (grain along z), sides turned 90 degrees
        strip = {"uv": RAIL_UV, "uv_size": [sx, sz]}
        return {
            "east": {**strip, "uv_rotation": 90}, "west": {**strip, "uv_rotation": 90},
            "up": dict(strip), "down": dict(strip),
            "north": {"uv": RAIL_UV, "uv_size": [sx, sy]}, "south": {"uv": RAIL_UV, "uv_size": [sx, sy]},
        }
    # cap
    return {f: {"uv": [5, 1], "uv_size": [2, 1 if f not in ("up", "down") else 2]}
            for f in ("north", "south", "east", "west", "up", "down")}


def cube(x, y, z, sx, sy, sz, kind, rot=None, pivot=None):
    """x, y, z = world min corner; rot = world rotation (x, y, z) about pivot (world)."""
    c = {"origin": [-(x + sx), y, z], "size": [sx, sy, sz], "uv": faces_for((sx, sy, sz), kind)}
    if rot:
        c["rotation"] = [rot[0], -rot[1], -rot[2]]  # mirrored x: y and z rotations flip sign
        c["pivot"] = [-pivot[0], pivot[1], pivot[2]]
    return c


def seg(z0, y0, z1, y1, w=2):
    """A w x w rail from (z0, y0) to (z1, y1) in the plane x = 0; slope a multiple of 22.5 degrees."""
    dz, dy = z1 - z0, y1 - y0
    L = math.hypot(dz, dy)
    ang = math.degrees(math.atan2(dy, abs(dz)))
    assert abs(ang / 22.5 - round(ang / 22.5)) < 1e-6, ang
    cz, cy = (z0 + z1) / 2, (y0 + y1) / 2
    rot = -ang * (1 if dz < 0 else -1)  # sign checked on Blockbench side views (arches rose, not dipped)
    return cube(-w / 2, cy - w / 2, cz - L / 2, w, w, L, "rail", rot=(rot, 0, 0) if ang else None, pivot=(0, cy, cz))


def turn(c, k):
    """Turn a geo-space cube k quarter turns about the vertical axis (the four fence sides)."""
    c = json.loads(json.dumps(c))
    (ox, oy, oz), (sx, sy, sz) = c["origin"], c["size"]
    cx, cz = ox + sx / 2, oz + sz / 2
    for _ in range(k % 4):
        cx, cz = -cz, cx
    if k % 2:
        sx, sz = sz, sx
        uv = c["uv"]
        # the long faces move with the cube; the top/bottom now run along x, so their strip turns too
        c["uv"] = {"north": uv["east"], "south": uv["west"], "east": uv["north"], "west": uv["south"],
                   "up": {**uv["up"], "uv_rotation": 90}, "down": {**uv["down"], "uv_rotation": 90}}
    c["origin"], c["size"] = [cx - sx / 2, oy, cz - sz / 2], [sx, sy, sz]
    if "pivot" in c:
        px, py, pz = c["pivot"]
        rx, ry, rz = c["rotation"]
        for _ in range(k % 4):
            px, pz = -pz, px
            rx, rz = -rz, rx
        c["pivot"], c["rotation"] = [px, py, pz], [rx, ry, rz]
    return c


def north_rails():
    return [seg(-2, y + 1, -8, y + 1 + 6 * T22) for y in RAIL_Y]


# quarter turns in geo space that carry the north rails to each side (geo x is world west, see the old east_rails at geo -x)
SIDES = {"north_rails": 0, "west_rails": 1, "south_rails": 2, "east_rails": 3}


def post_cubes():
    return [cube(-2, 0, -2, 4, 16, 4, "post"),
            cube(-1, 16, -1, 2, 1, 2, "cap", rot=(0, 45, 0), pivot=(0, 16, 0))]


def geometry(identifier, bones, transforms=None):
    g = {"description": {"identifier": identifier, "texture_width": 16, "texture_height": 16}, "bones": bones}
    if transforms:
        g["item_display_transforms"] = transforms
    return {"format_version": "1.26.50", "minecraft:geometry": [g]}  # >= 1.26.40 for the "shelf" transform


def main():
    bones = [{"name": "post", "pivot": [0, 0, 0], "cubes": post_cubes()}]
    for name, k in SIDES.items():
        bones.append({"name": name, "pivot": [0, 0, 0], "cubes": [turn(c, k) for c in north_rails()]})
    fence = geometry("geometry.lothlorien.mallorn_fence", bones)
    # sanity: each side's rails lie on its own side of the post (geo x is mirrored: world east = geo -x)
    expect = {"north_rails": (None, -1), "south_rails": (None, 1), "west_rails": (1, None), "east_rails": (-1, None)}
    for b in bones[1:]:
        ex, ez = expect[b["name"]]
        for c in b["cubes"]:
            mx, mz = c["origin"][0] + c["size"][0] / 2, c["origin"][2] + c["size"][2] / 2
            assert (ex is None or mx * ex > 2) and (ez is None or mz * ez > 2), (b["name"], mx, mz)

    carried_path = os.path.join(MODELS, "mallorn_fence_carried.geo.json")
    with open(carried_path, encoding="utf8") as f:
        transforms = json.load(f)["minecraft:geometry"][0].get("item_display_transforms")
    # icon: two posts at z -6 and +6 with a ^ between them (peak at z 0), like the vanilla fence icon
    icon_posts = []
    for z in (-8, 4):
        for c in post_cubes():
            c = json.loads(json.dumps(c))
            c["origin"][2] += z + 2
            if "pivot" in c:
                c["pivot"][2] += z + 2
            icon_posts.append(c)
    icon_rails = []
    for y in RAIL_Y:
        rise = 4 * T22
        icon_rails += [seg(-4, y + 1, 0, y + 1 + rise), seg(4, y + 1, 0, y + 1 + rise)]
    carried = geometry("geometry.lothlorien.mallorn_fence_carried",
                       [{"name": "posts", "pivot": [0, 0, 0], "cubes": icon_posts},
                        {"name": "rails", "pivot": [0, 0, 0], "cubes": icon_rails}], transforms)

    for path, data in [(os.path.join(MODELS, "mallorn_fence.geo.json"), fence), (carried_path, carried)]:
        with open(path, "w", encoding="utf8", newline="\n") as f:
            f.write(json.dumps(data, indent=2) + "\n")
    print("wrote mallorn_fence.geo.json and mallorn_fence_carried.geo.json")


if __name__ == "__main__":
    main()
