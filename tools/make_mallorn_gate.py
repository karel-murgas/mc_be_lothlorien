"""Mallorn fence gate geometry, matching the carved fence (2026-10-01): the vanilla gate (two 2x2 end posts, two rails,
a centre piece) with the fence's ideas: rails bent at 22.5 deg, the fence post texture (grain, knots, painted leaves),
no caps. Owner's pick (2026-10-01, over two capped variants with a centre upright, in git history): the fence line
runs through: the rails are the fence's own (low at a centre post, peak at the block edge, so they meet the
neighbouring fence rails), the centre piece is a 4-wide post with the painted leaf.

Writes lothlorien_rp/models/blocks/mallorn_fence_gate_closed.geo.json (bones posts, rails; keeps its
item_display_transforms: the icon pose [30,135,0] is confirmed in game) and mallorn_fence_gate_open.geo.json
(bones posts, leaves). Both sets share them; every face uses the block's "*" material = mallorn_fence_post texture.

Geometry coordinates throughout (x mirrored against the world, see make_mallorn_fence.py): the closed gate lies
along x at z -1..1, end posts at x +-7. Opening turns each half a quarter about its post so it points to -z (north
in the unrotated block), where the old open model and the open selection box (z -8..0) are.

  python -B tools/make_mallorn_gate.py
"""
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import make_mallorn_fence as fence  # noqa: E402

MODELS = fence.MODELS
T22 = fence.T22
POST_H = (5, 16)  # vanilla gate posts: y 5..16
STRIP = [5, 1]    # leaf-free strip of the post texture (rails, tops), as the fence rails use


def box(origin, size, uv, rot=None, pivot=None):
    c = {"origin": list(origin), "size": list(size), "uv": uv}
    if rot:
        c["rotation"], c["pivot"] = list(rot), list(pivot)
    return c


def end_post(x):
    """2x2 post at geo x (centre), y 5..16. Its long faces read columns 12-13 of the post texture (rows 0-10 hold no
    leaf or knot there)."""
    h = POST_H[1] - POST_H[0]
    side = {"uv": [12, 0], "uv_size": [2, h]}
    uv = {"north": dict(side), "south": dict(side), "east": dict(side), "west": dict(side),
          "up": {"uv": STRIP, "uv_size": [2, 2]}, "down": {"uv": STRIP, "uv_size": [2, 2]}}
    return [box([x - 1, POST_H[0], -1], [2, h, 2], uv)]


def half_rails(pairs):
    """Rails of the +x half from (u0, y0) to (u1, y1), u = distance from the gate's centre. Built along z by
    fence.seg (z = -u) and turned onto +x; the -x half is the same turned the other way."""
    return [fence.turn(fence.seg(-u0, y0, -u1, y1), 1) for u0, y0, u1, y1 in pairs]


def mirror_half(cubes):
    """The -x half: the +x half turned 180 degrees about the gate's centre."""
    return [fence.turn(c, 2) for c in cubes]


def centre_post():
    """A 4-wide, 2-deep post in the middle wearing the fence post's leaf sides (north: side 0 with its leaf at
    rows 3-7; south: side 2, leaf rows 5-9 and a knot), split into the two halves' 2-wide parts so each opens with
    its half of the picture. Seen from the north, geo +x is on the left, so the +x part takes the left columns."""
    h = POST_H[1] - POST_H[0]
    parts = []
    for x0, n_u, s_u in ((0, 0, 10), (-2, 2, 8)):
        uv = {"north": {"uv": [n_u, 0], "uv_size": [2, h]}, "south": {"uv": [s_u, 0], "uv_size": [2, h]},
              "east": {"uv": [12, 0], "uv_size": [2, h]}, "west": {"uv": [12, 0], "uv_size": [2, h]},
              "up": {"uv": STRIP, "uv_size": [2, 2]}, "down": {"uv": STRIP, "uv_size": [2, 2]}}
        parts.append([box([x0, POST_H[0], -1], [2, h, 2], uv)])
    return parts


def build():
    """-> (posts, plus_half, minus_half): cubes in geo space for the closed gate. The fence's rails: low at the centre
    post's face (u 2), peak at the block edge (u 8)."""
    plus = half_rails([(2, y + 1, 8, y + 1 + 6 * T22) for y in fence.RAIL_Y])
    cp_p, cp_m = centre_post()
    return end_post(7) + end_post(-7), plus + cp_p, mirror_half(plus) + cp_m


def about(c, k, px, pz):
    """Turn a geo cube k quarter turns about the vertical axis through (px, pz)."""
    c = json.loads(json.dumps(c))
    c["origin"][0] -= px
    c["origin"][2] -= pz
    if "pivot" in c:
        c["pivot"][0] -= px
        c["pivot"][2] -= pz
    c = fence.turn(c, k)
    c["origin"][0] += px
    c["origin"][2] += pz
    if "pivot" in c:
        c["pivot"][0] += px
        c["pivot"][2] += pz
    return c


def opened(plus, minus):
    """Each half turned about its post to point to -z: +x half about (7, 0) once, -x half about (-7, 0) three times."""
    return [about(c, 1, 7, 0) for c in plus] + [about(c, 3, -7, 0) for c in minus]


def geometries(transforms=None):
    posts, plus, minus = build()
    closed = fence.geometry("geometry.lothlorien.mallorn_fence_gate_closed",
                            [{"name": "posts", "pivot": [0, 0, 0], "cubes": posts},
                             {"name": "rails", "pivot": [0, 0, 0], "cubes": plus + minus}], transforms)
    leaves = opened(plus, minus)
    for c in leaves:  # sanity: the open leaves stay north of the posts' line, inside the block
        z0, z1 = c["origin"][2], c["origin"][2] + c["size"][2]
        assert -8.5 <= z0 and z1 <= 1.5 and (z0 + z1) / 2 < 0.5, c
    opn = fence.geometry("geometry.lothlorien.mallorn_fence_gate_open",
                         [{"name": "posts", "pivot": [0, 0, 0], "cubes": posts},
                          {"name": "leaves", "pivot": [0, 0, 0], "cubes": leaves}])
    return closed, opn


def main():
    closed_path = os.path.join(MODELS, "mallorn_fence_gate_closed.geo.json")
    with open(closed_path, encoding="utf8") as f:
        transforms = json.load(f)["minecraft:geometry"][0].get("item_display_transforms")
    assert transforms and transforms["gui"]["rotation"] == [30, 135, 0], "icon pose lost"
    closed, opn = geometries(transforms)
    for path, data in [(closed_path, closed), (os.path.join(MODELS, "mallorn_fence_gate_open.geo.json"), opn)]:
        with open(path, "w", encoding="utf8", newline="\n") as f:
            f.write(json.dumps(data, indent=2) + "\n")
    print("wrote mallorn_fence_gate_closed/open.geo.json")


if __name__ == "__main__":
    main()
