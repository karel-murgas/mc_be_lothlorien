"""Carved Mallorn fence concepts (design stage, temp only).

Each concept = post_mid, post_end (carved end/corner post), and one side's rails (north, -z), which the
game-ready version copies to the four sides with bone y-rotation. Here we compose a small scene
(end - straight - corner - straight - end) into ONE geometry so Blockbench can render the joins.

World coords: block centred on x,z in [-8, 8], y in [0, 16], north = -z. Geometry x is mirrored
(geo_x = -world_x), handled in cube().  All rotations are multiples of 22.5 degrees.
"""
import json
import math
import os
import sys

sys.path.insert(0, r"C:\mcmods\mods\lothlorien\tools")
import make_mallorn_wood as m  # noqa: E402
from PIL import Image  # noqa: E402

OUT = os.path.dirname(os.path.abspath(__file__))
TW = 32  # texture width/height; 1 texel = 1 unit

# texture regions: (u, v, w, h)
REG = {"post": (0, 0, 12, 16), "rail": (12, 16, 16, 4), "rail2": (12, 20, 16, 4), "cap": (24, 0, 8, 8),
       "leaf": (0, 16, 4, 4), "ring": (24, 8, 8, 4), "tip": (24, 8, 8, 4)}


def faces(size, reg, plane=None):
    u0, v0, rw, rh = REG[reg]
    sx, sy, sz = size

    def f(w, h):
        return {"uv": [u0, v0], "uv_size": [max(min(w, rw), 0.01) if w else 0, min(h, rh) if h else 0]}
    fs = {"north": f(sx, sy), "south": f(sx, sy), "east": f(sz, sy), "west": f(sz, sy), "up": f(sx, sz),
          "down": f(sx, sz)}
    if plane == "z":  # a flat panel facing north/south: only those faces, full region
        fs = {"north": {"uv": [u0, v0], "uv_size": [sx, sy]}, "south": {"uv": [u0 + sx, v0], "uv_size": [-sx, sy]}}
    if plane == "x":  # a flat panel facing east/west (a rail running north-south)
        fs = {"east": {"uv": [u0, v0], "uv_size": [sz, sy]}, "west": {"uv": [u0 + sz, v0], "uv_size": [-sz, sy]}}
    return fs


def cube(x, y, z, sx, sy, sz, reg, rot=None, pivot=None, plane=None):
    """x,y,z = world min corner."""
    c = {"origin": [-(x + sx), y, z], "size": [sx, sy, sz], "uv": faces((sx, sy, sz), reg, plane)}
    if rot:
        px, py, pz = pivot
        c["rotation"] = [rot[0], -rot[1], -rot[2]]  # mirror x: y and z rotations flip sign
        c["pivot"] = [-px, py, pz]
    return c


# ---------------- shared carved post ----------------
def post_shaft():
    """3x3x16 shaft; its four sides read consecutive 3-wide strips of the post region, so the spiral groove
    painted there runs on around the corners (a twisted look without crooked boxes)."""
    c = cube(-1.5, 0, -1.5, 3, 16, 3, "post")
    u0, v0 = REG["post"][:2]
    for i, f in enumerate(["north", "west", "south", "east"]):
        c["uv"][f] = {"uv": [u0 + 3 * i, v0], "uv_size": [3, 16]}
    c["uv"]["up"] = {"uv": [24, 0], "uv_size": [3, 3]}
    c["uv"]["down"] = {"uv": [24, 0], "uv_size": [3, 3]}
    return c


def post(end):
    cs = [post_shaft(), cube(-2, 0, -2, 4, 1, 4, "ring"), cube(-2, 13, -2, 4, 1, 4, "ring")]
    if end:  # bud spire: diamond capital, slim bud, gold tip
        cs += [cube(-1.5, 14, -1.5, 3, 2, 3, "cap", rot=(0, 45, 0), pivot=(0, 14, 0)),
               cube(-1, 16, -1, 2, 3, 2, "cap", rot=(0, 45, 0), pivot=(0, 16, 0)),
               cube(-0.5, 19, -0.5, 1, 2, 1, "tip", rot=(0, 45, 0), pivot=(0, 19, 0))]
    else:
        cs += [cube(-1.5, 14, -1.5, 3, 1, 3, "cap", rot=(0, 45, 0), pivot=(0, 14, 0))]
    return cs


SIGN = -1  # rotation sign about x for a segment rising towards -z (checked on the side view)


def seg(z0, y0, z1, y1, reg, w=1):
    """A w x w rail piece in the y-z plane from (z0, y0) to (z1, y1), centred on x = 0, as one rotated cube.
    The slope must be a multiple of 22.5 degrees."""
    dz, dy = z1 - z0, y1 - y0
    L = math.hypot(dz, dy)
    ang = math.degrees(math.atan2(dy, abs(dz)))
    assert abs(ang / 22.5 - round(ang / 22.5)) < 1e-6, ang
    cz, cy = (z0 + z1) / 2, (y0 + y1) / 2
    rot = SIGN * ang * (1 if dz < 0 else -1)
    return cube(-w / 2, cy - w / 2, cz - L / 2, w, w, L, reg, rot=(rot, 0, 0) if ang else None, pivot=(0, cy, cz))


T45, T22 = 1.0, math.tan(math.radians(22.5))
# pointed-arch half: springs at the post (z -1.5, y 5), 45 deg for 3, then 22.5 deg to the block edge (the apex)
ARCH = [(-1.5, 5.0, -4.5, 5.0 + 3 * T45), (-4.5, 8.0, -8.0, 8.0 + 3.5 * T22)]


# ---------------- concept A: pointed arches under a top rail ----------------
def a_rails():
    return [cube(-1, 12, -8, 2, 2, 6.5, "rail"),                  # top rail
            *[seg(*s_, "rail2") for s_ in ARCH],                   # arch half
            cube(-1, 2, -8, 2, 1, 6.5, "rail")]                    # low rail


# ---------------- concept B: woven lattice between two rails ----------------
def b_rails():
    # two crossing diagonals per half span: each rises/falls 22.5 deg across the 6.5 units
    rise = 6.5 * T22
    return [cube(-1, 12, -8, 2, 2, 6.5, "rail"),
            seg(-1.5, 6.5 - rise / 2 - 1, -8, 6.5 + rise / 2 - 1, "rail2"),
            seg(-1.5, 6.5 + rise / 2 + 1, -8, 6.5 - rise / 2 + 1, "rail2"),
            cube(-1, 3, -8, 2, 2, 6.5, "rail")]


# ---------------- concept C: arches with a gold leaf hanging at each apex ----------------
def c_rails():
    apex = ARCH[1][3]
    # a gold leaf-drop hanging under each arch point (straddles the block edge; both halves draw it)
    return a_rails() + [cube(-0.5, apex - 3, -9, 1, 3, 2, "tip"), cube(-0.5, apex - 4, -8.5, 1, 1, 1, "tip")]


def _turn(c, ry):
    """Turn a (geo-space) cube around the block's vertical axis by ry degrees (multiples of 90) - via a bone later;
    here for the finial leaves we rotate origin and pivot and add to the y rotation."""
    if ry % 360 == 0:
        return c
    c = json.loads(json.dumps(c))
    k = (ry // 90) % 4
    (ox, oy, oz), (sx, sy, sz) = c["origin"], c["size"]
    cx, cz = ox + sx / 2, oz + sz / 2
    for _ in range(k):
        cx, cz = -cz, cx
    if k % 2:
        sx, sz = sz, sx
        c["uv"] = {**c["uv"]}
    c["origin"], c["size"] = [cx - sx / 2, oy, cz - sz / 2], [sx, sy, sz]
    if "pivot" in c:
        px, py, pz = c["pivot"]
        for _ in range(k):
            px, pz = -pz, px
        c["pivot"] = [px, py, pz]
        rx, ryy, rz = c["rotation"]
        for _ in range(k):  # the tilt axis turns with the cube
            rx, rz = -rz, rx
        c["rotation"] = [rx, ryy, rz]
    return c


CONCEPTS = {"A_arches": (post, a_rails), "B_lattice": (post, b_rails), "C_arches_leaf": (post, c_rails)}
# scene: (block x, block z, connections) - an end, a straight run, a corner, a straight run, an end
SCENE = [(0, 0, "s"), (0, 1, "ns"), (0, 2, "ne"), (1, 2, "we"), (2, 2, "w")]
SIDE_TURN = {"n": 0, "e": 90, "s": 180, "w": 270}  # world: east = +x


def scene_geo(name, post_fn, rails_fn):
    bones = []
    for bx, bz, con in SCENE:
        straight = con in ("ns", "we")
        ox, oz = -bx * 16, bz * 16  # geo x is mirrored
        cubes = [dict(c) for c in post_fn(not straight)]
        for side in con:
            cubes += [_turn(c, -SIDE_TURN[side]) for c in rails_fn()]  # geo space is mirrored: turn the other way
        for c in cubes:
            c = json.loads(json.dumps(c))
            c["origin"] = [c["origin"][0] + ox, c["origin"][1], c["origin"][2] + oz]
            if "pivot" in c:
                c["pivot"] = [c["pivot"][0] + ox, c["pivot"][1], c["pivot"][2] + oz]
            bones.append(c)
    return {"format_version": "1.21.0", "minecraft:geometry": [{
        "description": {"identifier": f"geometry.design.{name.lower()}", "texture_width": TW, "texture_height": TW},
        "bones": [{"name": "scene", "pivot": [0, 0, 0], "cubes": bones}]}]}


def texture():
    P, G = m.PLANK, m.GOLD
    im = Image.new("RGBA", (TW, TW), (0, 0, 0, 0))
    px = im.load()

    def put(x, y, c):
        px[x, y] = tuple(c) + (255,)
    # post: 12 columns = the shaft's four 3-wide sides in turn; a spiral groove climbs one texel per row and
    # wraps around (period 12), a lit lip above it; each side lit left, shaded right, like the planks
    side_tone = [5, 4, 3]
    for y in range(16):
        for x in range(12):
            t = side_tone[x % 3] - (1 if x // 3 in (1, 3) else 0)  # west/east sides a step darker
            d = (x + y) % 12
            if d in (0, 1):
                t = max(2, t - 1)              # soft spiral groove, two texels tall
            px[x, y] = tuple(P[max(2, t)] if t >= 2 else P["seam"]) + (255,)
    # rails: lit top row, grain, shaded bottom row
    for v0 in (0, 4):
        for y in range(4):
            for x in range(16):
                t = [5, 4, 3, 2][y]
                if y in (1, 2) and (x * 5 + y * 7 + v0) % 11 < 3:
                    t += 1 if y == 2 else -1
                put(12 + x, 16 + v0 + y, P[t])
    # capital: light top-left, darker lower-right
    for y in range(8):
        for x in range(8):
            put(24 + x, y, P[5] if x + y < 5 else P[4] if x + y < 9 else P[3])
    for y in range(4):  # gold collar rows
        for x in range(8):
            put(24 + x, 8 + y, [G[2], G[1], G[1], G[0]][y])
    for y in range(4):  # gold tip
        for x in range(4):
            put(24 + x, 12 + y, G[2] if x + y < 2 else G[1] if x + y < 5 else G[0])
    for y in range(4):  # leaf: silver with a gold midrib
        for x in range(4):
            put(x, 16 + y, G[1] if x == 1 else (P[5] if x == 0 else P[4]))
    return im


def main():
    tex = texture()
    tex.save(os.path.join(OUT, "fence_design.png"))
    for name, (pf, rf) in CONCEPTS.items():
        with open(os.path.join(OUT, f"{name}.geo.json"), "w") as f:
            json.dump(scene_geo(name, pf, rf), f, indent=1)
    print("wrote", list(CONCEPTS))


if __name__ == "__main__":
    main()
