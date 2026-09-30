"""Generates the deer art: geometry (adult + fawn), entity textures, item icons.

    python -B mods/lothlorien/tools/make_deer.py

Output (overwritten every run): lothlorien_rp/models/entity/deer.geo.json,
lothlorien_rp/textures/entity/deer/{deer,deer_baby}.png, lothlorien_rp/textures/items/{venison_raw,
venison_cooked,deer_antler}.png. Boxes are laid out by a shelf packer (Bedrock box UV); every face is
painted by hand-placed rules (colour ramps with hue shift, no noise), following
`.claude/skills/bedrock-modding/references/10-art-style.md`. Seen only in this script's preview
(`--preview`), not yet in game: treat the look as a placeholder until the graphics pass.
"""
import json
import os
import sys
from pathlib import Path
from PIL import Image

RP = Path(__file__).resolve().parents[1] / "lothlorien_rp"
TEX = 64  # texture size (square); all boxes at 1 px = 1 unit, no mixels


def hexc(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4)) + (255,)


# Colour ramps, dark -> light. Shadows shift towards red/violet, highlights towards yellow.
COAT = [hexc(c) for c in ("#3f2a26", "#5e3d2c", "#80573a", "#a27446", "#c79a5e")]
BELLY = [hexc(c) for c in ("#a8906f", "#c9b48f", "#e4d6b8", "#f4ecd8")]
SPOT = [hexc(c) for c in ("#d1b98a", "#ecddb6")]
DARK = [hexc(c) for c in ("#1f1513", "#33231f", "#4a342b")]
EAR_IN = [hexc(c) for c in ("#8a5a4c", "#b98870", "#d8b29a")]
BONE = [hexc(c) for c in ("#6e5a3e", "#9a8459", "#c4ae80", "#e0cfa4")]
EYE = hexc("#120b09")
EYE_GLINT = hexc("#e8dcc0")
CLEAR = (0, 0, 0, 0)

# ---------------------------------------------------------------- model definitions
# cube: (name, bone, origin, size, role). Bones: (name, parent, pivot, rotation).
LEGS = os.environ.get("DEER_LEGS", "slim")  # slim | sturdy | step: leg shape, see docs/mobs/deer.md


def leg_cubes(i, x, z, height, w_up, w_low=None):
    """One leg as a single cube (slim/sturdy) or an upper thigh plus thinner cannon (step)."""
    if LEGS == "step":
        up_h = height * 0.55
        return [(f"leg{i}_up", f"leg{i}", [x, height - up_h, z], [w_up, up_h, w_up], "leg_up"),
                (f"leg{i}_low", f"leg{i}", [x + 0.5, 0, z + 0.5], [w_up - 1, height - up_h, w_up - 1], "leg_low")]
    w = w_up if LEGS == "sturdy" else (w_low or w_up - 1)
    off = (w_up - w) / 2
    return [(f"leg{i}", f"leg{i}", [x + off, 0, z + off], [w, height, w], "leg")]


def antler_cubes(bone, s, y0, z0):
    """One antler, +x side for s=1 and mirrored for s=-1. y0/z0 = base on the head. Main beam, brow and bez tines
    forward, a back tine, a crown of two upright prongs."""
    def box(name, x, y, z, sx, sy, sz):
        ox = x if s == 1 else -x - sx
        return (f"{bone}_{name}", bone, [ox, y0 + y, z0 + z], [sx, sy, sz], "antler")
    return [
        box("beam", 1.0, 0, 0, 1.5, 9.5, 1.5),
        box("brow", 1.0, 1.5, -3.5, 1.3, 1.3, 3.6),
        box("bez", 1.0, 4.2, -3.0, 1.3, 1.3, 3.1),
        box("back", 1.0, 6.0, 1.2, 1.3, 1.3, 2.5),
        box("crown_a", 1.0, 8.0, -1.4, 1.3, 4.0, 1.3),
        box("crown_b", 2.3, 7.0, -0.1, 1.3, 4.5, 1.3),
        box("out_a", 2.0, 3.0, 0, 2.6, 1.3, 1.3),   # tines to the side, so the pair reads as branched from the front
        box("out_b", 2.0, 5.8, 0, 2.2, 1.3, 1.3),
    ]


def cubes_adult():
    c = []
    bones = {
        "body": (None, [0, 13, 0], None),
        "neck": ("body", [0, 19, -7], [30, 0, 0]),
        "head": ("neck", [0, 27, -7], [-22, 0, 0]),
        "ear_l": ("head", [2, 29, -8.5], [0, 0, 30]),
        "ear_r": ("head", [-2, 29, -8.5], [0, 0, -30]),
        "antler_l": ("head", [1.5, 30, -9.5], [-20, 0, 15]),
        "antler_r": ("head", [-1.5, 30, -9.5], [-20, 0, -15]),
        "tail": ("body", [0, 21, 8], [15, 0, 0]),
        "leg0": ("body", [-2, 13, 6], None),
        "leg1": ("body", [2, 13, 6], None),
        "leg2": ("body", [-2, 13, -5], None),
        "leg3": ("body", [2, 13, -5], None),
    }
    c.append(("body", "body", [-3.5, 13, -7], [7, 9, 15], "body"))
    c.append(("neck", "neck", [-2, 19, -9], [4, 8, 4], "neck"))
    c.append(("skull", "head", [-2.5, 25, -12], [5, 5, 6], "skull"))
    c.append(("muzzle", "head", [-1.5, 25, -15], [3, 3, 3], "muzzle"))
    c.append(("ear_l", "ear_l", [2, 29, -9], [3, 4, 1], "ear"))
    c.append(("ear_r", "ear_r", [-5, 29, -9], [3, 4, 1], "ear"))
    c.append(("tail", "tail", [-1.5, 16.5, 7.5], [3, 5, 2], "tail"))
    for i, (x, z) in enumerate(((-3.5, 4.5), (0.5, 4.5), (-3.5, -6.5), (0.5, -6.5))):
        c.extend(leg_cubes(i, x, z, 13, 3))
    c.extend(antler_cubes("antler_l", 1, 30, -9.5))
    c.extend(antler_cubes("antler_r", -1, 30, -9.5))
    return bones, c


def cubes_baby():
    bones = {
        "body": (None, [0, 6, 0], None),
        "neck": ("body", [0, 9, -4], [25, 0, 0]),
        "head": ("neck", [0, 12, -4], [-18, 0, 0]),
        "ear_l": ("head", [1.5, 14, -6], [0, 0, 30]),
        "ear_r": ("head", [-1.5, 14, -6], [0, 0, -30]),
        "tail": ("body", [0, 10, 5], [15, 0, 0]),
        "leg0": ("body", [-1.5, 6, 3.5], None),
        "leg1": ("body", [1.5, 6, 3.5], None),
        "leg2": ("body", [-1.5, 6, -3], None),
        "leg3": ("body", [1.5, 6, -3], None),
    }
    c = []
    c.append(("body", "body", [-2.5, 6, -5], [5, 5, 10], "body"))
    c.append(("neck", "neck", [-1.5, 9, -5.5], [3, 3, 3], "neck"))
    c.append(("skull", "head", [-2, 11, -9.5], [4, 4, 5], "skull"))
    c.append(("muzzle", "head", [-1, 11, -11.5], [2, 2, 2], "muzzle"))
    c.append(("ear_l", "ear_l", [1.5, 14, -6.5], [2, 3, 1], "ear"))
    c.append(("ear_r", "ear_r", [-3.5, 14, -6.5], [2, 3, 1], "ear"))
    c.append(("tail", "tail", [-1, 7.5, 5], [2, 3, 1], "tail"))
    for i, (x, z) in enumerate(((-2.5, 2.5), (0.5, 2.5), (-2.5, -4), (0.5, -4))):
        c.extend(leg_cubes(i, x, z, 6, 2, 1.5))
    return bones, c


# ---------------------------------------------------------------- UV packing
def box_extent(size):
    w, h, d = size
    return int(-(-2 * (w + d) // 1)), int(-(-(h + d) // 1))  # ceil


def pack(cubes):
    """Shelf-pack boxes; returns {name: (u, v)}."""
    items = sorted(cubes, key=lambda c: -box_extent(c[3])[1])
    x = y = shelf = 0
    out = {}
    for name, _bone, _o, size, _role in items:
        bw, bh = box_extent(size)
        if x + bw > TEX:
            x, y, shelf = 0, y + shelf, 0
        out[name] = (x, y)
        x += bw
        shelf = max(shelf, bh)
    if y + shelf > TEX:
        raise SystemExit(f"texture overflow: {y + shelf} > {TEX}")
    return out


def geometry(ident, bones, cubes, uvs):
    bone_list = []
    for bname, (parent, pivot, rot) in bones.items():
        b = {"name": bname, "pivot": pivot}
        if parent:
            b["parent"] = parent
        if rot:
            b["rotation"] = rot
        bone_list.append(b)
    for name, bone, origin, size, _role in cubes:
        entry = next(b for b in bone_list if b["name"] == bone)
        entry.setdefault("cubes", []).append({"origin": origin, "size": size, "uv": list(uvs[name])})
    return {
        "format_version": "1.12.0",
        "minecraft:geometry": [{
            "description": {
                "identifier": ident, "texture_width": TEX, "texture_height": TEX,
                "visible_bounds_width": 3, "visible_bounds_height": 3.5, "visible_bounds_offset": [0, 1.25, 0],
            },
            "bones": bone_list,
        }],
    }


# ---------------------------------------------------------------- painting
class Canvas:
    def __init__(self):
        self.img = Image.new("RGBA", (TEX, TEX), CLEAR)
        self.px = self.img.load()

    def set(self, x, y, c):
        if 0 <= x < TEX and 0 <= y < TEX:
            self.px[x, y] = c


def faces(u, v, size):
    """Face rectangles (x, y, w, h) of a Bedrock box-UV cube. East (+x) faces right, north (-z) is the front."""
    w, h, d = (int(s) if s == int(s) else s for s in size)
    wi, hi, di = int(round(w)), int(round(h)), int(round(d))
    return {
        "top": (u + di, v, wi, di),
        "bottom": (u + di + wi, v, wi, di),
        "east": (u, v + di, di, hi),
        "north": (u + di, v + di, wi, hi),
        "west": (u + di + wi, v + di, di, hi),
        "south": (u + 2 * di + wi, v + di, wi, hi),
    }


def fill(cv, rect, fn):
    x0, y0, w, h = rect
    for j in range(h):
        for i in range(w):
            c = fn(i, j, w, h)
            if c is not None:
                cv.set(x0 + i, y0 + j, c)


def ramp(r, k):
    return r[max(0, min(len(r) - 1, k))]


def spot_hash(i, j, seed):
    """Deterministic hand-tuned scatter: a fixed lattice with per-row offsets (not random noise)."""
    return ((i * 7 + j * 11 + seed) % 13) == 0


class Paint:
    def __init__(self, baby):
        self.baby = baby

    # --- helpers that produce a colour for a side profile pixel; i counts from the FRONT end
    SPOTS_ADULT = {(1, 4), (2, 1), (3, 3), (4, 5), (5, 2), (6, 4), (7, 1), (8, 3), (9, 5), (10, 2), (11, 4)}
    SPOTS_BABY = {(1, 1), (2, 2), (3, 0), (4, 1), (5, 2), (6, 0), (7, 1), (8, 2), (3, 2)}

    def coat_body_side(self, i, j, w, h):
        # i counts from the front end, j from the back line down to the belly
        belly_rows = 1 if self.baby else 2
        if j >= h - belly_rows:  # pale belly, darker on the bottom row
            return ramp(BELLY, 2 if j == h - belly_rows else 1)
        if i >= w - (2 if self.baby else 3) and j >= 1:  # rump patch
            return ramp(BELLY, 3 if j < h - belly_rows - 1 else 2)
        if not self.baby and i == w - 4 and 1 <= j <= h - belly_rows - 2:  # dark edge in front of the patch
            return ramp(COAT, 1)
        last = h - belly_rows - 1  # lowest coat row: shadow
        base = 4 if j == 0 else 1 if j == last else 2 if j == last - 1 else 3
        if self.baby:
            base = 3 if j == 0 else 2
        if i <= 1 and 0 < j < last:  # shoulder a touch darker
            base -= 1
        if (i, j) in (self.SPOTS_BABY if self.baby else self.SPOTS_ADULT):
            return ramp(SPOT, 1 if j <= 2 else 0)
        return ramp(COAT, base)

    def body(self, cv, name_faces):
        f = name_faces
        fill(cv, f["west"], lambda i, j, w, h: self.coat_body_side(i, j, w, h))
        fill(cv, f["east"], lambda i, j, w, h: self.coat_body_side(w - 1 - i, j, w, h))  # front on the right
        # top: dark spine stripe down the middle, spots beside it
        def top(i, j, w, h):
            mid = w // 2
            if i == mid:
                return ramp(COAT, 0 if not self.baby else 1)
            if abs(i - mid) == 1 and j % 3 != 0:
                return ramp(COAT, 2)
            if (i, j) in ((1, 2), (5, 4), (1, 8), (5, 10), (2, 6), (4, 13)) and not self.baby:
                return ramp(SPOT, 0)
            if (i, j) in ((1, 1), (4, 4), (1, 6)) and self.baby:
                return ramp(SPOT, 1)
            return ramp(COAT, 4 if j % 2 == 0 and abs(i - mid) == 2 else 3)
        fill(cv, f["top"], top)
        fill(cv, f["bottom"], lambda i, j, w, h: ramp(BELLY, 0 if j % 2 else 1))
        # chest (front face): light throat-chest at the bottom
        fill(cv, f["north"], lambda i, j, w, h: ramp(BELLY, 2) if j >= h - 3 and 1 <= i <= w - 2 else ramp(COAT, 3 if j < 2 else 2))
        # rump (back face): white patch with a dark border, tail sits in the middle of it
        def rump(i, j, w, h):
            if j == 0:
                return ramp(COAT, 1)
            if i == 0 or i == w - 1:
                return ramp(COAT, 1)
            if j == h - 1:
                return ramp(COAT, 0)
            return ramp(BELLY, 3 if 1 < j < h - 2 else 2)
        fill(cv, f["south"], rump)

    def neck(self, cv, f):
        def side(i, j, w, h, flip):
            ii = w - 1 - i if flip else i
            if ii == 0 and j > 1:
                return ramp(BELLY, 1)  # throat (front edge)
            return ramp(COAT, 3 if j < 2 else 2)
        fill(cv, f["west"], lambda i, j, w, h: side(i, j, w, h, False))
        fill(cv, f["east"], lambda i, j, w, h: side(i, j, w, h, True))
        fill(cv, f["north"], lambda i, j, w, h: ramp(BELLY, 2 if j > 2 else 1) if 0 < i < w - 1 else ramp(COAT, 3))
        fill(cv, f["south"], lambda i, j, w, h: ramp(COAT, 1 if i in (1, 2) else 2))  # mane
        fill(cv, f["top"], lambda i, j, w, h: ramp(COAT, 3))
        fill(cv, f["bottom"], lambda i, j, w, h: ramp(COAT, 1))

    def skull(self, cv, f):
        def side(i, j, w, h, flip):
            ii = w - 1 - i if flip else i  # 0 = snout end
            if j == 1 and ii == 2:
                return EYE
            if j == 0 and ii == 2:
                return ramp(BELLY, 1)  # brow above the eye
            if j >= h - 2:
                return ramp(BELLY, 1 if j == h - 2 else 0)  # pale cheek and jaw
            return ramp(COAT, 3 if j < 2 else 2)
        fill(cv, f["west"], lambda i, j, w, h: side(i, j, w, h, False))
        fill(cv, f["east"], lambda i, j, w, h: side(i, j, w, h, True))
        fill(cv, f["top"], lambda i, j, w, h: ramp(COAT, 1) if i == w // 2 else ramp(COAT, 3))
        fill(cv, f["north"], lambda i, j, w, h: ramp(COAT, 3 if j < 3 else 2))
        fill(cv, f["south"], lambda i, j, w, h: ramp(COAT, 2))
        fill(cv, f["bottom"], lambda i, j, w, h: ramp(BELLY, 1))
        # eye glint
        # (kept to the dark pixel only: a single light pixel at this size reads as noise)

    def muzzle(self, cv, f):
        fill(cv, f["west"], lambda i, j, w, h: ramp(COAT, 3) if j < h - 1 else ramp(BELLY, 1))
        fill(cv, f["east"], lambda i, j, w, h: ramp(COAT, 3) if j < h - 1 else ramp(BELLY, 1))
        fill(cv, f["top"], lambda i, j, w, h: ramp(COAT, 3) if j < h - 1 else ramp(DARK, 2))  # top image: front edge is the bottom row
        fill(cv, f["north"], lambda i, j, w, h: ramp(DARK, 0) if j < h - 1 and 0 < i < w - 1 and j >= 0 else ramp(BELLY, 1))
        fill(cv, f["south"], lambda i, j, w, h: ramp(COAT, 2))
        fill(cv, f["bottom"], lambda i, j, w, h: ramp(BELLY, 1))

    def ear(self, cv, f):
        rim = lambda i, j, w, h: i in (0, w - 1) or j == 0
        fill(cv, f["north"], lambda i, j, w, h: ramp(COAT, 1) if rim(i, j, w, h) else ramp(EAR_IN, 2 if j > h // 2 else 1))
        fill(cv, f["south"], lambda i, j, w, h: ramp(COAT, 2 if j else 1))
        for k in ("east", "west", "top", "bottom"):
            fill(cv, f[k], lambda i, j, w, h: ramp(COAT, 1))

    def tail(self, cv, f):
        fill(cv, f["south"], lambda i, j, w, h: ramp(COAT, 0) if j < 2 or i == w // 2 else ramp(BELLY, 2))
        fill(cv, f["north"], lambda i, j, w, h: ramp(BELLY, 3))
        for k in ("east", "west"):
            fill(cv, f[k], lambda i, j, w, h: ramp(COAT, 1) if j < 2 else ramp(BELLY, 2))
        fill(cv, f["top"], lambda i, j, w, h: ramp(COAT, 1))
        fill(cv, f["bottom"], lambda i, j, w, h: ramp(BELLY, 3))

    def leg(self, cv, f):
        def side(i, j, w, h):
            if j >= h - 1:
                return ramp(DARK, 1)  # hoof
            if j == h - 2:
                return ramp(DARK, 2)
            cut = int(h * 0.45)  # coat down to here, then the pale lower leg
            if j < cut:
                return ramp(COAT, (3 if j < 1 else 2) + (1 if self.baby else 0))
            if j == cut and i % 2 == 0:
                return ramp(COAT, 1)  # a broken edge rather than a ruler line
            return ramp(BELLY, 1 if j < h - 4 else 0)
        for k in ("east", "west", "north", "south"):
            fill(cv, f[k], side)
        fill(cv, f["top"], lambda i, j, w, h: ramp(COAT, 2))
        fill(cv, f["bottom"], lambda i, j, w, h: ramp(DARK, 0))

    def leg_up(self, cv, f):
        side = lambda i, j, w, h: ramp(COAT, (3 if j < 1 else 2 if j < h - 2 else 1) + (1 if self.baby else 0))
        for k in ("east", "west", "north", "south"):
            fill(cv, f[k], side if k in ("east", "west") else lambda i, j, w, h: ramp(COAT, 2 if j < h - 2 else 1))
        fill(cv, f["top"], lambda i, j, w, h: ramp(COAT, 2))
        fill(cv, f["bottom"], lambda i, j, w, h: ramp(COAT, 1))

    def leg_low(self, cv, f):
        def side(i, j, w, h):
            if j >= h - 1:
                return ramp(DARK, 1)  # hoof
            if j == h - 2:
                return ramp(DARK, 2)
            return ramp(BELLY, 1 if j < 2 else 0)
        for k in ("east", "west", "north", "south"):
            fill(cv, f[k], side)
        fill(cv, f["top"], lambda i, j, w, h: ramp(COAT, 1))
        fill(cv, f["bottom"], lambda i, j, w, h: ramp(DARK, 0))

    def antler(self, cv, f):
        for k, tone in (("north", 3), ("east", 2), ("west", 2), ("south", 1), ("top", 3), ("bottom", 0)):
            fill(cv, f[k], lambda i, j, w, h, t=tone: ramp(BONE, t - (1 if j % 3 == 2 else 0)))


def paint_model(baby, cubes, uvs):
    cv = Canvas()
    p = Paint(baby)
    for name, _bone, _o, size, role in cubes:
        u, v = uvs[name]
        getattr(p, role)(cv, faces(u, v, size))
    return cv.img


# ---------------------------------------------------------------- item icons (16x16, light from top-left)
def icon(rows, pal):
    img = Image.new("RGBA", (16, 16), CLEAR)
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            if ch != ".":
                img.putpixel((x, y), pal[ch])
    return img


CHOP = [
    "................",
    ".........oooo...",
    "......ooohhhcoo.",
    "....oohhhhcccbbo",
    "...ohhhcccccbbbo",
    "..ohhhccffccbbao",
    "..ohhcccffcbbbao",
    "..occcccccbbbaao",
    "...obbbbbbbbaado",
    "....oobbbbaaddo.",
    "..owwoooaaddo...",
    ".owwwo..oooo....",
    ".owwwo..........",
    "..owwo..........",
    "...oo...........",
    "................",
]


def chop(pal, grill):
    rows = [list(r) for r in CHOP]
    for (x, y) in grill:
        if rows[y][x] not in ".ow":
            rows[y][x] = "g"
    return icon(["".join(r) for r in rows], pal)


def venison_raw():
    pal = {"o": hexc("#4a1f26"), "h": hexc("#e0888a"), "c": hexc("#cc6268"), "b": hexc("#ad4853"),
           "a": hexc("#8c3644"), "d": hexc("#732c3a"), "f": hexc("#f2d8c8"), "w": hexc("#f0e6cc")}
    return chop(pal, [])


def venison_cooked():
    pal = {"o": hexc("#2e1a12"), "h": hexc("#cf9a60"), "c": hexc("#b47a45"), "b": hexc("#8f5730"),
           "a": hexc("#6b3b22"), "d": hexc("#4d2917"), "f": hexc("#e6cfa8"), "w": hexc("#f0e6cc"),
           "g": hexc("#3a2014")}
    return chop(pal, [(4, 4), (5, 5), (6, 6), (7, 4), (8, 5), (9, 6), (10, 7), (9, 4), (10, 5), (11, 6)])


def deer_antler():
    pal = {"o": hexc("#4b3d29"), "a": hexc("#8a7650"), "b": hexc("#b49f72"), "h": hexc("#dccb9c"), "d": hexc("#6e5a3e")}
    rows = [
        "................",
        "..o.........o...",
        ".oho.......ohoo.",
        ".obo...o...oboo.",
        ".obo..ohoo.obo..",
        "..obo.obo.obo...",
        "..obo.obo.obo...",
        "...obooboobo....",
        "....obbobbo.....",
        "....obbbbbo.....",
        ".....obbbo......",
        ".....oabao......",
        ".....oaado......",
        "......oddo......",
        ".......oo.......",
        "................",
    ]
    return icon(rows, pal)


# ---------------------------------------------------------------- main
def build(ident, baby, out_geo, out_tex):
    bones, cubes = (cubes_baby() if baby else cubes_adult())
    uvs = pack(cubes)
    geo = geometry(ident, bones, cubes, uvs)
    return geo, paint_model(baby, cubes, uvs)


def preview(img, path, scale=8):
    img.resize((img.width * scale, img.height * scale), Image.NEAREST).save(path)


def main():
    (RP / "models/entity").mkdir(parents=True, exist_ok=True)
    (RP / "textures/entity/deer").mkdir(parents=True, exist_ok=True)
    adult_geo, adult_tex = build("geometry.lothlorien.deer", False, None, None)
    baby_geo, baby_tex = build("geometry.lothlorien.deer_baby", True, None, None)
    # one geo file may hold several geometries
    merged = {"format_version": "1.12.0",
              "minecraft:geometry": adult_geo["minecraft:geometry"] + baby_geo["minecraft:geometry"]}
    (RP / "models/entity/deer.geo.json").write_text(json.dumps(merged, indent=2) + "\n")
    adult_tex.save(RP / "textures/entity/deer/deer.png")
    baby_tex.save(RP / "textures/entity/deer/deer_baby.png")
    venison_raw().save(RP / "textures/items/venison_raw.png")
    venison_cooked().save(RP / "textures/items/venison_cooked.png")
    deer_antler().save(RP / "textures/items/deer_antler.png")
    if "--preview" in sys.argv:
        out = Path(sys.argv[sys.argv.index("--preview") + 1])
        out.mkdir(parents=True, exist_ok=True)
        preview(adult_tex, out / "deer.png")
        preview(baby_tex, out / "deer_baby.png")
        for n in ("venison_raw", "venison_cooked", "deer_antler"):
            preview(Image.open(RP / f"textures/items/{n}.png"), out / f"{n}.png", 16)
    print("deer art written")


if __name__ == "__main__":
    main()
