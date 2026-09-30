"""Mallorn fence gate geometry, matching the carved fence (2026-10-01): the vanilla gate (two 2x2 end posts, two rails,
a centre piece) with the fence's ideas: rails bent at 22.5 deg, the fence post texture (grain, knots, painted leaves),
small diamond caps. Variants (the owner picks from temp/mallorn_wood/gate/gate_variants.png):

  A  both rails as an inverted V peaking at the middle (the gate reads as one fence span), short centre upright,
     diamond caps on the end posts;
  B  straight top rail + inverted-V lower rail, short centre upright, diamond caps on the end posts;
  C  the fence line runs through: the rails are the fence's own (low at a centre post, peak at the block edge, so they
     meet the neighbouring fence rails), the centre piece is a 4-wide post with the painted leaf, no caps.

Writes lothlorien_rp/models/blocks/mallorn_fence_gate_closed.geo.json (bones posts, rails; keeps its
item_display_transforms: the icon pose [30,135,0] is confirmed in game) and mallorn_fence_gate_open.geo.json
(bones posts, leaves). Both sets share them; every face uses the block's "*" material = mallorn_fence_post texture.

Geometry coordinates throughout (x mirrored against the world, see make_mallorn_fence.py): the closed gate lies
along x at z -1..1, end posts at x +-7. Opening turns each half a quarter about its post so it points to -z (north
in the unrotated block), where the old open model and the open selection box (z -8..0) are.

  python -B tools/make_mallorn_gate.py [A|B|C]      (default: VARIANT below)
"""
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import make_mallorn_fence as fence  # noqa: E402

VARIANT = "A"
MODELS = fence.MODELS
T22 = fence.T22
POST_H = (5, 16)  # vanilla gate posts: y 5..16
STRIP = [5, 1]    # leaf-free strip of the post texture (rails, uprights, tops), as the fence rails use


def box(origin, size, uv, rot=None, pivot=None):
    c = {"origin": list(origin), "size": list(size), "uv": uv}
    if rot:
        c["rotation"], c["pivot"] = list(rot), list(pivot)
    return c


def strip_faces(sx, sy, sz):
    """Every face a piece of the leaf-free strip, 1 texel = 1 unit."""
    return {"north": {"uv": STRIP, "uv_size": [sx, sy]}, "south": {"uv": STRIP, "uv_size": [sx, sy]},
            "east": {"uv": STRIP, "uv_size": [sz, sy]}, "west": {"uv": STRIP, "uv_size": [sz, sy]},
            "up": {"uv": STRIP, "uv_size": [sx, sz]}, "down": {"uv": STRIP, "uv_size": [sx, sz]}}


def end_post(x, caps):
    """2x2 post at geo x (centre), y 5..16. Its long faces read columns 12-13 of the post texture (rows 0-10 hold no
    leaf or knot there); with caps, the fence's small diamond cap sits on top."""
    h = POST_H[1] - POST_H[0]
    side = {"uv": [12, 0], "uv_size": [2, h]}
    uv = {"north": dict(side), "south": dict(side), "east": dict(side), "west": dict(side),
          "up": {"uv": STRIP, "uv_size": [2, 2]}, "down": {"uv": STRIP, "uv_size": [2, 2]}}
    cs = [box([x - 1, POST_H[0], -1], [2, h, 2], uv)]
    if caps:
        cap = fence.faces_for((2, 1, 2), "cap")
        cs.append(box([x - 1, 16, -1], [2, 1, 2], cap, rot=[0, 45, 0], pivot=[x, 16, 0]))
    return cs


def half_rails(pairs):
    """Rails of the +x half from (u0, y0) to (u1, y1), u = distance from the gate's centre. Built along z by
    fence.seg (z = -u) and turned onto +x; the -x half is the same turned the other way."""
    return [fence.turn(fence.seg(-u0, y0, -u1, y1), 1) for u0, y0, u1, y1 in pairs]


def mirror_half(cubes):
    """The -x half: the +x half turned 180 degrees about the gate's centre."""
    return [fence.turn(c, 2) for c in cubes]


def upright(y0, y1):
    """Short centre piece between the rails (vanilla's middle), 2 wide, split into the two halves' 1-wide parts."""
    return ([box([0, y0, -1], [1, y1 - y0, 2], strip_faces(1, y1 - y0, 2))],
            [box([-1, y0, -1], [1, y1 - y0, 2], strip_faces(1, y1 - y0, 2))])


def centre_post():
    """Variant C: a 4-wide, 2-deep post in the middle wearing the fence post's leaf sides (north: side 0 with its leaf at
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


def build(variant):
    """-> (posts, plus_half, minus_half): cubes in geo space for the closed gate."""
    if variant == "A":  # both rails ^ from the end posts (inner face u 6) to a peak at the centre
        plus = half_rails([(6, 7, 0, 7 + 6 * T22), (6, 12.5, 0, 12.5 + 6 * T22)])
        up_p, up_m = upright(10, 14)
        return end_post(7, True) + end_post(-7, True), plus + up_p, mirror_half(plus) + up_m
    if variant == "B":  # straight top rail, ^ lower rail
        plus = half_rails([(6, 7, 0, 7 + 6 * T22), (6, 14, 0, 14)])
        up_p, up_m = upright(10, 13)
        return end_post(7, True) + end_post(-7, True), plus + up_p, mirror_half(plus) + up_m
    if variant == "C":  # the fence's rails: low at the centre post's face (u 2), peak at the block edge (u 8)
        plus = half_rails([(2, y + 1, 8, y + 1 + 6 * T22) for y in fence.RAIL_Y])
        cp_p, cp_m = centre_post()
        return end_post(7, False) + end_post(-7, False), plus + cp_p, mirror_half(plus) + cp_m
    raise SystemExit(f"unknown variant {variant}")


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


def geometries(variant, transforms=None):
    posts, plus, minus = build(variant)
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
    variant = sys.argv[1] if len(sys.argv) > 1 else VARIANT
    closed_path = os.path.join(MODELS, "mallorn_fence_gate_closed.geo.json")
    with open(closed_path, encoding="utf8") as f:
        transforms = json.load(f)["minecraft:geometry"][0].get("item_display_transforms")
    assert transforms and transforms["gui"]["rotation"] == [30, 135, 0], "icon pose lost"
    closed, opn = geometries(variant, transforms)
    for path, data in [(closed_path, closed), (os.path.join(MODELS, "mallorn_fence_gate_open.geo.json"), opn)]:
        with open(path, "w", encoding="utf8", newline="\n") as f:
            f.write(json.dumps(data, indent=2) + "\n")
    print(f"wrote mallorn_fence_gate_closed/open.geo.json (variant {variant})")


if __name__ == "__main__":
    main()
