"""Mallorn boat: entity geometry, entity texture and item icon.

  python -B tools/make_mallorn_boat.py [--out DIR] [--debug]

An elven boat (owner's brief, 2026-10-01): long and slender, pointed at both ends, the ends rising above the middle,
a clear front, no sail. Silver mallorn planks with a gold gunwale and gold leaves at the bow, like the fences, door
and trapdoor (palette from make_mallorn_wood.py).

Shape: the hull is cut into 1-unit slices along X; a profile gives each slice its half-width, keel height and
gunwale height, and identical neighbours are merged. A slice is a keel strip, a two-high bottom and two thin walls
(stepped cross-section: keel W-3, bottom W-1, walls W), or one solid block where the ends are too narrow to be open
(covered bow and stern decks). The length runs along X because the vanilla boat seats sit at x 0.2 / -0.6; BOW
picks the bow end (flip it if the boat sails backwards). The client entity turns the `hull` bone by the actor yaw
(a runtime boat's model does not turn by itself), and the `lead` locator puts the leash knot on the bow.

Texture: box UV, packed automatically; every texel is painted by its WORLD position (the strakes follow the keel line
and their butt joints and the gold trim line up across cubes). --debug paints a coordinate test pattern instead.
"""
import argparse
import json
import math
import os
import sys

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from make_mallorn_wood import BARK, GOLD  # noqa: E402

MOD = os.path.dirname(HERE)
RP = os.path.join(MOD, "lothlorien_rp")

BOW = -1         # bow direction along X: the vanilla front seat sits at local +X, which renders at geometry -X
L = 20           # hull from -L to +L (units)
WMAX = 8         # half-width amidships
GUNWALE = 8      # gunwale height amidships
RISE = {1: 8, -1: 6}   # extra gunwale height at the bow / stern tip
ROCKER = 3       # keel rise at the tips
TEX_W = 128

CLEAR = (0, 0, 0, 0)
SEAM = (138, 145, 158)
PEG = (128, 135, 149)


# ---------------------------------------------------------------- shape
def profile(xc):
    """(half-width, keel y, gunwale y) at slice centre xc."""
    t = min(1.0, abs(xc) / L)
    end = BOW if xc * BOW > 0 else -BOW
    w = WMAX * max(0.0, 1 - t ** 1.8) ** 0.6
    return (max(1, round(w)), round(ROCKER * t ** 3), GUNWALE + round(RISE[1 if end == BOW else -1] * t ** 2.3))


def slices():
    """Merged runs: (x0, x1, w, yb, yt)."""
    runs = []
    for x in range(-L, L):
        p = profile(x + 0.5)
        if runs and runs[-1][2:] == p:
            runs[-1][1] = x + 1
        else:
            runs.append([x, x + 1, *p])
    return [tuple(r) for r in runs]


def hull_cubes():
    """(kind, origin, size) for the hull, then the bow and stern posts."""
    out = []
    for x0, x1, w, yb, yt in slices():
        lx = x1 - x0
        if w <= 3:
            out.append(("deck", [x0, yb, -w], [lx, yt - yb, 2 * w]))
            continue
        out.append(("keel", [x0, yb, -(w - 3)], [lx, 1, 2 * (w - 3)]))
        out.append(("bottom", [x0, yb + 1, -(w - 1)], [lx, 2, 2 * (w - 1)]))
        for z0 in (-w, w - 1):
            out.append(("wall", [x0, yb + 3, z0], [lx, yt - yb - 3, 1]))
    out += posts()
    return out


def posts():
    """Bow: a neck rising from the stem and curling back over the deck, gold-tipped. Stern: a short point."""
    bw, byb, byt = profile(BOW * (L - 0.5))
    sw, syb, syt = profile(-BOW * (L - 0.5))
    tip = L if BOW > 0 else -L - 1  # x0 of the unit just past the bow tip

    def at(dx, y0, h, kind="post"):  # dx along the bow direction from the tip
        x0 = tip + dx if BOW > 0 else tip - dx
        return (kind, [x0, y0, -1], [1, h, 2])

    bow = [at(0, byb + 1, byt - byb + 2), at(1, byt - 1, 5), at(2, byt + 2, 5), at(1, byt + 6, 2, "finial"),
           at(0, byt + 6, 2, "finial"), at(-1, byt + 5, 2, "finial")]
    st = -L - 1 if BOW > 0 else L
    stern = [("post", [st, syb + 1, -1], [1, syt - syb + 1, 2]), ("post", [st - BOW, syt - 1, -1], [1, 2, 2])]
    return bow + stern


# ---------------------------------------------------------------- UV packing (box UV)
def box_extent(size):
    w, h, d = size
    return 2 * (w + d), h + d


def pack(cubes):
    order = sorted(range(len(cubes)), key=lambda i: -box_extent(cubes[i][2])[1])
    x = y = shelf = 0
    uvs = [None] * len(cubes)
    for i in order:
        bw, bh = box_extent(cubes[i][2])
        assert bw <= TEX_W, cubes[i]
        if x + bw > TEX_W:
            x, y, shelf = 0, y + shelf, 0
        uvs[i] = (x, y)
        x += bw
        shelf = max(shelf, bh)
    height = y + shelf
    return uvs, 1 << (height - 1).bit_length()


def face_texels(origin, size, uv):
    """Yield (face, tex_x, tex_y, world_x, world_y, world_z) for every texel of a box-UV cube.

    Each face is laid out as seen from outside, u to the viewer's right, v down (box-UV convention; checked by
    rendering --debug in Blockbench)."""
    (x0, y0, z0), (w, h, d), (u, v) = origin, size, uv
    x1, y1, z1 = x0 + w, y0 + h, z0 + d
    rects = {
        "up": (u + d, v, w, d), "down": (u + d + w, v, w, d),
        "east": (u, v + d, d, h), "north": (u + d, v + d, w, h),
        "west": (u + d + w, v + d, d, h), "south": (u + 2 * d + w, v + d, w, h),
    }
    for face, (fx, fy, fw, fh) in rects.items():
        for j in range(fh):
            for i in range(fw):
                if face == "up":
                    p = (x0 + i + .5, y1, z1 - j - .5)
                elif face == "down":
                    p = (x0 + i + .5, y0, z0 + j + .5)
                else:
                    y = y1 - j - .5
                    p = {"north": (x1 - i - .5, y, z0), "south": (x0 + i + .5, y, z1),
                         "east": (x1, y, z1 - i - .5), "west": (x0, y, z0 + i + .5)}[face]
                yield face, fx + i, fy + j, p


# ---------------------------------------------------------------- painting
def tone(r, k):
    return r[max(0, min(len(r) - 1, k))]


def hsh(*a):
    h = 2166136261
    for v in a:
        h = ((h ^ (int(math.floor(v)) & 0xFFFF)) * 16777619) & 0xFFFFFFFF
    return h


# gold leaves on the outer bow planks: (distance from the bow tip, height above the keel, mirrored)
LEAF = ["AA..", "ABB.", ".BBC", "..CC", "...S"]
LEAVES = [(9, 2, False), (14, 3, True), (19, 2, False)]


def leaf_at(x, y):
    """Gold leaf colour at an outer bow-side texel, or None."""
    d = (L - x * BOW)
    _, yb, _ = profile(x)
    for dist, hy, mirror in LEAVES:
        c = int(math.floor(d - dist + 2))
        r = int(math.floor(yb + hy + 4 - y))
        if 0 <= c < 4 and 0 <= r < 5:
            row = LEAF[r]
            # the leaf tip points to the bow on both sides
            ch = row[c if mirror else 3 - c]
            if ch != ".":
                return {"A": GOLD[2], "B": GOLD[1], "C": GOLD[0], "S": SEAM}[ch]
    return None


def plank(x, y, inner):
    """Strakes 3 high following the keel line; light top row, seam bottom row, staggered butt joints."""
    _, yb, yt = profile(x)
    rel = y - yb
    row = int(math.floor(rel)) % 3
    board = int(math.floor(rel)) // 3
    joint = (math.floor(x + board * 7) % 13) == 0
    base = 2 if inner else 3
    if row == 0 or joint:
        return PEG if joint and row == 0 else SEAM
    grain = (hsh(math.floor(x / 3), board) % 5) - 2
    k = base + (1 if row == 2 else 0) + (1 if grain == 2 else -1 if grain == -2 else 0)
    return tone(BARK, k)


def deck(x, z):
    """Lengthwise deck boards 3 wide, with the gold rim at the edge."""
    w, _, _ = profile(x)
    if abs(z) > w - 1:
        return GOLD[2]
    col = int(math.floor(z + 0.5 * w)) % 3
    if col == 0:
        return SEAM
    return tone(BARK, 4 if col == 1 else 3)


def paint(kind, face, p):
    x, y, z = p
    if kind == "finial":
        return {"up": GOLD[3], "down": GOLD[0]}.get(face, GOLD[2] if y % 2 > 1 else GOLD[1])
    if kind == "post":
        _, yb, yt = profile(max(-L + 0.5, min(L - 0.5, x)))
        if face == "up":
            return GOLD[2]
        if face == "down":
            return BARK[1]
        return GOLD[1] if y > yt - 1 else tone(BARK, 4 if face in ("north", "west") else 3)
    outward = (face == "south" and z > 0) or (face == "north" and z <= 0) or face in ("east", "west")
    if face == "down":
        return tone(BARK, 1 if (math.floor(z) % 3) else 0)
    if face == "up":
        if kind == "wall":
            return GOLD[2] if (math.floor(x) % 4) else GOLD[3]
        if kind == "deck":
            return deck(x, z)
        if kind == "bottom":  # the floor inside: lengthwise boards
            return SEAM if math.floor(z) % 3 == 0 else tone(BARK, 2 + (math.floor(z) % 3 == 1))
        return BARK[2]
    _, yb, yt = profile(x)
    if kind in ("wall", "deck") and y > yt - 1:
        return GOLD[1] if outward else GOLD[0]
    if kind in ("wall", "deck", "bottom") and outward and face in ("north", "south"):
        lf = leaf_at(x, y)
        if lf:
            return lf
    return plank(x, y, not outward)


def debug_paint(kind, face, p):
    x, y, z = p
    r = int(128 + 120 * x / (L + 3))
    g = int(40 + 200 * y / 20)
    b = int(128 + 120 * z / 10)
    return (max(0, min(255, r)), max(0, min(255, g)), max(0, min(255, b)), 255)


# ---------------------------------------------------------------- outputs
def build(debug=False):
    cubes = hull_cubes()
    uvs, tex_h = pack(cubes)
    img = Image.new("RGBA", (TEX_W, tex_h), CLEAR)
    px = img.load()
    painter = debug_paint if debug else paint
    for (kind, o, s), uv in zip(cubes, uvs):
        for face, tx, ty, p in face_texels(o, s, uv):
            c = painter(kind, face, p)
            px[tx, ty] = c if len(c) == 4 else (*c, 255)
    for (kind, o, s), uv in zip(cubes, uvs):  # self-check: every face texel painted
        for face, tx, ty, p in face_texels(o, s, uv):
            assert px[tx, ty][3] == 255, (kind, face, tx, ty)
    xs = [o[0] for _, o, _ in cubes] + [o[0] + s[0] for _, o, s in cubes]
    ys = [o[1] + s[1] for _, o, s in cubes]
    lead_x = BOW * (L - 2)
    geo = {
        "format_version": "1.12.0",
        "minecraft:geometry": [{
            "description": {
                "identifier": "geometry.lothlorien.mallorn_boat",
                "texture_width": TEX_W,
                "texture_height": tex_h,
                "visible_bounds_width": math.ceil((max(xs) - min(xs)) / 16) + 1,
                "visible_bounds_height": math.ceil(max(ys) / 16) + 1,
                "visible_bounds_offset": [0, 0.5, 0],
            },
            "bones": [{
                "name": "hull",
                "pivot": [0, 0, 0],
                "locators": {"lead": [lead_x, profile(lead_x)[2], 0]},
                "cubes": [{"origin": o, "size": s, "uv": list(uv)} for (_, o, s), uv in zip(cubes, uvs)],
            }],
        }],
    }
    return geo, img, len(cubes)


def icon():
    """Side view from slightly above: far gold rim, dark inside, near gold rim, silver strakes; bow (right) rises into
    the gold-tipped neck, the stern (left) into a short point. Dark outline below and at the ends."""
    px = {}
    for x in range(1, 15):
        t = abs(x - 7.5) / 7.0
        near = 8 - round(4 * t ** 2.2) - (1 if x >= 13 else 0)
        far = near - 2
        bot = 13 - round(3 * t ** 2.5)
        if t < 0.8:
            px[(x, far)] = GOLD[1]
            for y in range(far + 1, near):
                px[(x, y)] = BARK[1] if y == far + 1 else BARK[2]
        px[(x, near)] = GOLD[2] if x % 4 else GOLD[3]
        for y in range(near + 1, bot + 1):
            r = y - near
            px[(x, y)] = BARK[1] if y == bot else SEAM if r % 3 == 0 else BARK[4] if r % 3 == 1 else BARK[3]
    for x, y, c in [(14, 3, BARK[4]), (14, 2, BARK[3]), (15, 1, BARK[3]), (14, 0, GOLD[2]), (15, 0, GOLD[1]),
                    (13, 0, GOLD[2]), (13, 1, GOLD[0]), (0, 4, GOLD[1]), (1, 4, GOLD[2])]:
        px[(x, y)] = c
    img = Image.new("RGBA", (16, 16), CLEAR)
    outline = (78, 84, 101, 255)
    for (x, y), c in px.items():
        img.putpixel((x, y), (*c, 255))
    for (x, y) in list(px):
        for nx, ny in ((x, y + 1), (x + 1, y), (x - 1, y)):
            if (nx, ny) not in px and 0 <= nx < 16 and 0 <= ny < 16 and ny > 6:
                img.putpixel((nx, ny), outline)
    return img


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", help="write into this folder instead of the resource pack")
    ap.add_argument("--debug", action="store_true", help="coordinate test texture")
    a = ap.parse_args()
    geo, tex, n = build(a.debug)
    if a.out:
        os.makedirs(a.out, exist_ok=True)
        paths = [os.path.join(a.out, f) for f in ("mallorn_boat.geo.json", "mallorn_boat.png", "mallorn_boat_icon.png")]
    else:
        paths = [os.path.join(RP, "models", "entity", "mallorn_boat.geo.json"),
                 os.path.join(RP, "textures", "entity", "mallorn_boat.png"),
                 os.path.join(RP, "textures", "items", "mallorn_boat.png")]
    with open(paths[0], "w", encoding="utf-8", newline="\n") as f:
        json.dump(geo, f, indent=1)
        f.write("\n")
    tex.save(paths[1])
    icon().save(paths[2])
    print(f"{n} cubes, texture {tex.size[0]}x{tex.size[1]} ->", os.path.dirname(paths[0]))


if __name__ == "__main__":
    main()
