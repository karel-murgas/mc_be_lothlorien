"""Generates the Elven lighting set (Phase 17): Elven lantern, Firefly jar and Elven chandelier.

    python -B mods/lothlorien/tools/make_elven_lamps.py

Output (overwritten every run): BP blocks/items/recipes for the three lamps,
RP models (`elven_lantern`, `firefly_jar`, `elven_chandelier`), textures `elven_lamp`
(wood, gold, antler), `elven_lantern_glow` and `elven_jar_inner` (flipbooks with MERS maps),
item icons, and the entries in
terrain_texture.json, item_texture.json, flipbook_textures.json and en_US.lang (merged, other entries kept).

Models use per-face UV windows that map 1 texel to 1 unit onto one of four material regions of `elven_lamp`
(vertical wood, horizontal wood, gold, antler), so a 6x1 foot shows planks at real scale. The engine shades faces
by direction, so the texture carries no baked face shading. The glass parts use their own flipbook tile
(material instance `glow`): amber glow with fireflies that blink on their own phases.
"""
import json
import random
from pathlib import Path
from PIL import Image
from make_mallorn_wood import BARK as MALLORN_BARK, recolour, to_gold

MOD = Path(__file__).resolve().parents[1]
BP, RP = MOD / "lothlorien_bp", MOD / "lothlorien_rp"
NS = "lothlorien"
FRAMES = 6
TICKS_PER_FRAME = 30


def hexc(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4)) + (255,)


# ---------------------------------------------------------------------------------------------- palettes
# Silver wood (Mallorn planks), gold trim (trapdoor hinges), antler ivory (deer_antler block), glow.
WOOD = [hexc(h) for h in ("#dde0df", "#c3c8cc", "#aab1b9", "#8f96a2", "#808795")]
GOLD = [hexc(h) for h in ("#fbe9a0", "#eccd76", "#c9a04a", "#8a6a2a")]
IVORY = [hexc(h) for h in ("#f6eed8", "#e4d2a6", "#c3a06c", "#9a714a")]
GLOW = [hexc(h) for h in ("#fde48a", "#f6cb5a", "#e8aa44", "#cc872c", "#a2661f")]  # centre .. edge
FLY = [None, hexc("#ecdc74"), hexc("#dcf06a"), hexc("#fcffd8")]  # off, dim, lime, hot
FLY_HALO = hexc("#cfe85c")
GLASS_HI = hexc("#e8f6ff")
GLASS_EDGE = hexc("#b7873a")

# ---------------------------------------------------------------------------------------------- lamp tile
# 16x16: vertical wood (0,0,8,10), horizontal wood (8,0,8,10), gold (0,10,16,3), antler (0,13,16,3).
REGIONS = {"wv": (0, 0, 8, 10), "wh": (8, 0, 8, 10), "gold": (0, 10, 16, 3), "antler": (0, 13, 16, 3)}


def lamp_tile():
    rnd = random.Random(17)
    img = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
    # vertical wood: columns of grain, each column its own tone, dark streaks, a lit left edge on every board
    for x in range(8):
        base = [1, 2, 1, 0, 2, 1, 3, 1][x]
        for y in range(10):
            t = base
            if rnd.random() < 0.18:
                t = min(4, t + 1)
            if rnd.random() < 0.08:
                t = max(0, t - 1)
            img.putpixel((x, y), WOOD[t])
    # horizontal wood: rows of grain
    for y in range(10):
        base = [1, 2, 0, 1, 3, 2, 1, 1, 2, 0][y]
        for x in range(8):
            t = base
            if rnd.random() < 0.18:
                t = min(4, t + 1)
            if rnd.random() < 0.08:
                t = max(0, t - 1)
            img.putpixel((8 + x, y), WOOD[t])
    # gold: three rows light .. dark, a few sparkles
    for x in range(16):
        for y in range(3):
            c = GOLD[y + (1 if rnd.random() < 0.15 else 0)] if y < 2 else GOLD[3 if rnd.random() < 0.7 else 2]
            img.putpixel((x, 10 + y), c)
        if rnd.random() < 0.25:
            img.putpixel((x, 10), GOLD[0])
    # antler: ivory, light on top, red-brown at the bottom row
    for x in range(16):
        for y in range(3):
            c = IVORY[y + (1 if rnd.random() < 0.2 else 0)] if y < 2 else IVORY[3 if rnd.random() < 0.6 else 2]
            img.putpixel((x, 13 + y), c)
    mers = Image.new("RGBA", (16, 16), (0, 0, 255, 0))  # wood, gold, antler: not emissive, rough
    for y in range(10, 13):  # gold: a little metal
        for x in range(16):
            mers.putpixel((x, y), (60, 0, 190, 0))
    return img, mers


# ---------------------------------------------------------------------------------------------- glow tiles
def glow_base(x, y, w, h, kmax=4):
    """Amber glow of a w x h face: hot in the middle, deeper at the edges, a touch lighter near the top."""
    cx, cy = (w - 1) / 2, (h - 1) / 2
    d = max(abs(x - cx) / max(cx, 0.5), abs(y - cy) / max(cy, 0.5) * 0.9)
    k = min(kmax, int(d * 3.2 + (0.4 if y > cy else 0)))
    return GLOW[k], k


def fly_level(frame, phase):
    """0..3: a triangle wave over the frames, offset by the fly's phase (0 = dark, 3 = brightest)."""
    k = (frame + phase) % FRAMES
    return min(k, FRAMES - k)


def paint_face(img, mers, frame, ox, oy, w, h, flies, glass=False, strip=False, kmax=4):
    """One face region at (ox, oy) in frame `frame`. flies: (x, y, phase) in region coordinates (sparks that blink)."""
    fo = frame * 16

    def put(x, y, c, em):
        img.putpixel((ox + x, fo + oy + y), c)
        mers.putpixel((ox + x, fo + oy + y), (0, em, 255, 0))

    for y in range(h):
        for x in range(w):
            c, k = glow_base(x, y, w, h, kmax)
            em = 205 - 26 * k
            if strip:  # 1-wide corner strip or a face whose middle is hidden: edge amber, light inner columns
                if w == 1 or x in (0, w - 1):
                    c, em = GLASS_EDGE, 140
            elif glass:
                if x == 0 and 0 < y < h - 1:
                    c, em = GLASS_HI, 235
                elif x == w - 1 or y == h - 1:
                    c, em = GLASS_EDGE, 140
            put(x, y, c, em)
    for fx, fy, phase in flies:
        lv = fly_level(frame, phase)
        if not FLY[lv]:
            continue
        put(fx, fy, FLY[lv], 255)
        if lv == 3:  # brightest frame: a faint halo on the four neighbours
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                if 0 <= fx + dx < w and 0 <= fy + dy < h:
                    put(fx + dx, fy + dy, FLY_HALO, 255)


def glow_tile(layout, kmax=4):
    """layout: list of (ox, oy, w, h, flies, glass, strip) regions painted in every frame."""
    img = Image.new("RGBA", (16, 16 * FRAMES), (0, 0, 0, 255))
    mers = Image.new("RGBA", (16, 16 * FRAMES), (0, 0, 255, 0))
    for f in range(FRAMES):
        for ox, oy, w, h, flies, glass, strip in layout:
            paint_face(img, mers, f, ox, oy, w, h, flies, glass, strip, kmax)
    return img, mers


# Lantern glow: four 4x8 sides at row 0, 4x4 up/down at row 8, 2x3 sides of the small cores at row 12.. see FACES.
LANTERN_FACES = {
    "north": (0, 0, 4, 8, [(0, 2, 0), (1, 5, 3)]),
    "east": (4, 0, 4, 8, [(1, 1, 2), (0, 6, 5)]),
    "south": (8, 0, 4, 8, [(2, 3, 4), (0, 6, 1)]),
    "west": (12, 0, 4, 8, [(0, 1, 5), (2, 5, 2)]),
    "up": (0, 8, 4, 4, [(1, 1, 3)]),
    "down": (4, 8, 4, 4, [(2, 2, 0)]),
    "s_north": (8, 8, 2, 3, [(0, 1, 1)]),
    "s_east": (10, 8, 2, 3, [(0, 2, 4)]),
    "s_south": (12, 8, 2, 3, [(0, 1, 3)]),
    "s_west": (14, 8, 2, 3, [(0, 0, 0)]),
    "s_up": (8, 11, 2, 2, []),
    "s_down": (10, 11, 2, 2, []),
}


# ---------------------------------------------------------------------------------------------- geometry
def window(kind, w, h, face, salt):
    """UV (x, y) of a w x h window inside the material region `kind`; salt picks varied offsets."""
    rx, ry, rw, rh = REGIONS[kind]
    w, h = max(1, w), max(1, h)
    assert w <= rw and h <= rh, (kind, w, h)
    if kind in ("gold", "antler"):  # rows run light .. dark: tops light, undersides dark
        row = {"up": 0, "down": rh - h}.get(face, min(1, rh - h) if rh - h > 0 else 0)
        col = (salt * 5) % (rw - w + 1)
        return rx + col, ry + row
    return rx + (salt * 3) % (rw - w + 1), ry + (salt * 7) % (rh - h + 1)


def lamp_cube(origin, size, kind, salt):
    """A cube textured from a lamp-tile material. size in units; faces map 1:1."""
    sx, sy, sz = size
    uv = {}
    for face, (w, h) in {"north": (sx, sy), "south": (sx, sy), "east": (sz, sy), "west": (sz, sy),
                         "up": (sx, sz), "down": (sx, sz)}.items():
        k = kind
        if kind == "wood":
            k = "wv" if face not in ("up", "down") and h > w else "wh"
        w, h = int(round(w)), int(round(h))
        x, y = window(k, w, h, face, salt + len(face))
        uv[face] = {"uv": [x, y], "uv_size": [w, h]}
    return {"origin": list(origin), "size": list(size), "uv": uv}


def glow_cube(origin, size, faces, small=False, crop=0):
    """A glass/glow cube: every face samples its own region of the glow tile (material instance `glow`).
    `crop` shifts side windows down by that many rows (a shorter core reusing a taller painting)."""
    sx, sy, sz = size
    pre = "s_" if small else ""
    sides = {"north": pre + "north", "south": pre + "south", "east": pre + "east", "west": pre + "west"}
    uv = {}
    for face in ("north", "south", "east", "west"):
        ox, oy, w, h, _ = faces[sides[face]]
        fw = int(sz if face in ("east", "west") else sx)
        uv[face] = {"uv": [ox, oy + crop], "uv_size": [fw, int(sy)], "material_instance": "glow"}
    for face in ("up", "down"):
        ox, oy, w, h, _ = faces[pre + face]
        uv[face] = {"uv": [ox, oy], "uv_size": [int(sx), int(sz)], "material_instance": "glow"}
    return {"origin": list(origin), "size": list(size), "uv": uv}


# ---------------------------------------------------------------------------------------------- the Elven lantern
# An accepted 16-high Mallorn lantern: a small foot, open glowing chamber framed by silver arches, a broad stepped
# canopy and a short gold spire (the spire also hangs it from a ceiling). The heartwood version shares the geometry.
# Its own tile `elven_lantern_wood` (material instance `wood`):
#   (0,0) 12x6 pale carving wood (the vines), (12,0) 4x8 vertical grain (posts), (0,6) 12x4 roof,
#   (0,10) 16x6 horizontal grain (bowl, cap).
LW_REGIONS = {"carve": (0, 0, 12, 6), "wv": (12, 0, 4, 8), "roof": (0, 6, 12, 4), "wh": (0, 10, 16, 6)}
ARCH_PATTERN_WIDTH = 6


def lantern_wood_tile():
    rnd = random.Random(23)
    img = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
    mers = Image.new("RGBA", (16, 16), (0, 0, 255, 0))

    def grain(base, lo=0, hi=4):
        t = base
        r = rnd.random()
        if r < 0.10:
            t += 1
        elif r < 0.15:
            t -= 1
        return WOOD[max(lo, min(hi, t))]

    for x in range(4):  # posts: vertical grain
        for y in range(8):
            img.putpixel((12 + x, y), grain([1, 0, 1, 2][x]))
    for y in range(4):  # roof: the same silver wood range as the bowl and cap
        for x in range(12):
            img.putpixel((x, 6 + y), grain([1, 0, 1, 2][y], 0, 3))
    for y in range(6):  # bowl and cap: horizontal grain
        for x in range(16):
            img.putpixel((x, 10 + y), grain([1, 0, 1, 2, 1, 1][y]))
    for y in range(6):  # carving wood: the palest end of the ramp, a little grain
        for x in range(12):
            img.putpixel((x, y), grain([0, 1, 0, 1, 1, 0][y], 0, 2))
    return img, mers


def oct_layer(width, chamfer, y, h, salt, kind="wh"):
    """One octagonal slab of lantern wood: centre box plus `chamfer` rows of 1-unit steps front and back."""
    half = width / 2
    cubes = [wood_cube((-half, y, -(half - chamfer)), (width, h, width - 2 * chamfer), salt, kind=kind)]
    for i in range(chamfer):
        hw = half - chamfer + i
        for z in (-half + i, half - i - 1):
            cubes.append(wood_cube((-hw, y, z), (2 * hw, h, 1), salt + 3 * i + (z > 0), kind=kind))
    return cubes


def wood_cube(origin, size, salt, faces=None, kind="wh"):
    """A cube on the lantern wood tile. kind "wh": tall narrow sides use vertical grain, the rest horizontal;
    "roof" / "carve": every face from that region."""
    sx, sy, sz = size
    dims = {"north": (sx, sy), "south": (sx, sy), "east": (sz, sy), "west": (sz, sy), "up": (sx, sz), "down": (sx, sz)}
    uv = {}
    for face, (w, h) in dims.items():
        if faces is not None and face not in faces:
            continue
        w, h = int(round(w)), int(round(h))
        k = kind if kind in ("roof", "carve") else ("wv" if face not in ("up", "down") and h > w else "wh")
        rx, ry, rw, rh = LW_REGIONS[k]
        assert w <= rw and h <= rh, (k, w, h)
        s = salt + len(face)
        uv[face] = {"uv": [rx + (s * 3) % (rw - w + 1), ry + (s * 5) % (rh - h + 1)], "uv_size": [w, h],
                    "material_instance": "wood"}
    return {"origin": list(origin), "size": list(size), "uv": uv}


def arch_cubes(side, y0, pattern, d):
    """One side's shallow silver arch, with adjacent painted cells merged into real wood cubes."""
    cubes = []
    for r, row in enumerate(pattern):
        y = y0 + ARCH_PATTERN_WIDTH - 1 - r
        i = 0
        while i < ARCH_PATTERN_WIDTH:
            if row[i] == ".":
                i += 1
                continue
            j = i
            while j < ARCH_PATTERN_WIDTH and row[j] == row[i]:
                j += 1
            n = j - i  # cells i..j-1, counted from the viewer's left
            if side == "north":  # seen from -z: left is +x
                o, sz = (3 - j, y, -d), (n, 1, 1)
            elif side == "south":  # seen from +z: left is -x
                o, sz = (-3 + i, y, d - 1), (n, 1, 1)
            elif side == "east":  # seen from +x: left is +z
                o, sz = (d - 1, y, 3 - j), (1, 1, n)
            else:  # west, seen from -x: left is -z
                o, sz = (-d, y, -3 + i), (1, 1, n)
            cubes.append(wood_cube(o, sz, r * 7 + i, kind="carve"))
            i = j
    return cubes


def arch_lantern_cubes():
    """A narrow light chamber below a broad, leaf-like silver canopy.

    The four windows are mostly open amber. A shallow pointed arch grows out of the corner posts at the top of
    each window; no diagonal crosses the light. The canopy overhang and small stepped foot give a different
    silhouette while keeping the Mallorn wood and firefly palette.
    """
    c = oct_layer(6, 1, 0, 1, 18)
    c += oct_layer(8, 1, 1, 1, 19)
    y0, height, inset = 2, 7, 0.125
    core_uv = {}
    for face in ("north", "east", "south", "west"):
        ox, oy, _, _, _ = LANTERN_FACES[face]
        core_uv[face] = {"uv": [ox, oy], "uv_size": [4, height], "material_instance": "glow"}
    c.append({"origin": [-2 + inset, y0, -2 + inset],
              "size": [4 - 2 * inset, height, 4 - 2 * inset], "uv": core_uv})
    for i, (px, pz) in enumerate(((-3, -3), (2, -3), (-3, 2), (2, 2))):
        c.append(wood_cube((px, y0, pz), (1, height, 1), 31 + i))
    arch = [".1111.", ".1..1.", "......", "......", "......", "......"]
    for side in ("north", "south", "east", "west"):
        c += arch_cubes(side, 3, arch, d=3)
    c += oct_layer(10, 2, 9, 1, 20)  # bright, overhanging eave
    c += oct_layer(8, 2, 10, 1, 21, "roof")
    c += oct_layer(6, 1, 11, 1, 22, "roof")
    c += oct_layer(4, 1, 12, 1, 23, "roof")
    c.append(wood_cube((-1, 13, -1), (2, 1, 2), 24, kind="roof"))
    c.append(lamp_cube((-0.5, 14, -0.5), (1, 2, 1), "gold", 25))
    return c


def geo(identifier, bones):
    return {"format_version": "1.26.50", "minecraft:geometry": [{
        "description": {"identifier": f"geometry.{NS}.{identifier}", "texture_width": 16, "texture_height": 16},
        "bones": [{"name": n, "pivot": [0, 0, 0], "cubes": cubes} for n, cubes in bones]}]}


# ---------------------------------------------------------------------------------------------- the Firefly jar
# A squat octagonal glass jar (7 high): see-through glass (`glass`, blend), a moss bed inside and loose fireflies as
# single-texel cubes that blink and vanish (`inner`, alpha_test flipbook: a fly is transparent in its dark frames,
# so flies seem to wander), a wooden lid and a gold knob. Every material instance is blend (one render_method
# per block).
# Glass tile `elven_jar_glass`: (0,0) 4x4 wall, (4,0) 1x4 corner wall, (0,4) 4x1 rim (top of a wall),
# (0,5) 4x1 shoulder side, (0,6) 1x1 rim corner.
# Inner tile `elven_jar_inner` (flipbook): (0,0) 4x4 moss top, (0,4) 4x1 moss side, fly i at texel (i, 8).
GLASS_RIM = [hexc(h) for h in ("#d0eaf0", "#a8d0d9", "#8bc1cd", "#7baeb7")]  # vanilla glass edge colours
MOSS = [hexc(h) for h in ("#a9c45a", "#86a63e", "#64822f", "#4a6226")]
LEAF_GOLD = [hexc(h) for h in ("#f4d77a", "#d9a944")]
JAR_FLY = [None, hexc("#a8cc3a"), hexc("#c8f03c"), hexc("#f0fa96")]  # off, dim, lime, hot (Bottle of Fireflies)
JAR_FLIES = [  # (origin x, y, z, phase): one-unit cubes floating inside the jar (interior x, z -2..2, y 1..5)
    (-1.6, 1.5, -1.3, 0), (0.6, 2.6, -1.8, 2), (-0.5, 3.6, 0.5, 4), (0.9, 1.9, 0.3, 1),
    (-1.3, 2.8, 0.9, 3), (0.2, 3.9, -0.7, 5), (-0.2, 1.3, 0.9, 3), (0.8, 3.2, 0.8, 0),
]


def jar_glass_tile():
    img = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
    a = lambda c, alpha: c[:3] + (alpha,)
    for y in range(4):  # wall: faint pale tint, a lit streak down the left, a darker bottom edge
        for x in range(4):
            c = a(hexc("#e6f4f8"), 46)
            if x == 0 and y in (0, 1):
                c = a(hexc("#ffffff"), 190)
            elif x == 1 and y == 0:
                c = a(hexc("#ffffff"), 130)
            elif x == 3 and y == 3:
                c = a(GLASS_RIM[3], 150)
            elif y == 3:
                c = a(GLASS_RIM[2], 90)
            img.putpixel((x, y), c)
    for y in range(4):  # corner wall: a bright edge line, so the octagon reads
        img.putpixel((4, y), a(GLASS_RIM[1 if y < 2 else 2], 170))
    for x in range(4):  # rim and shoulder
        img.putpixel((x, 4), a(GLASS_RIM[0 if x < 2 else 1], 210))
        img.putpixel((x, 5), a(GLASS_RIM[1 if x < 2 else 2], 170))
    img.putpixel((0, 6), a(GLASS_RIM[0], 210))
    return img, Image.new("RGBA", (16, 16), (0, 0, 255, 0))


def jar_inner_tile():
    rnd = random.Random(5)
    img = Image.new("RGBA", (16, 16 * FRAMES), (0, 0, 0, 0))
    mers = Image.new("RGBA", (16, 16 * FRAMES), (0, 0, 255, 0))
    moss_top = [[0, 1, 1, 2], [1, 0, 2, 1], [1, 2, 1, 2], [2, 1, 2, 3]]
    for f in range(FRAMES):
        o = f * 16
        for y in range(4):
            for x in range(4):
                img.putpixel((x, o + y), MOSS[moss_top[y][x]])
        img.putpixel((2, o + 1), LEAF_GOLD[0])  # a fallen mallorn leaf
        img.putpixel((1, o + 2), LEAF_GOLD[1])
        for x in range(4):
            img.putpixel((x, o + 4), MOSS[[1, 2, 2, 3][x]])
        for i, (_, _, _, phase) in enumerate(JAR_FLIES):
            lv = fly_level(f, phase)
            if lv == 0:
                continue  # dark frame: the fly is gone
            img.putpixel((i, o + 8), JAR_FLY[lv])
            mers.putpixel((i, o + 8), (0, 255, 255, 0))
    rnd.random()
    return img, mers


def glass_face(key):
    x, y, w, h = {"wall": (0, 0, 4, 4), "corner": (4, 0, 1, 4), "rim": (0, 4, 4, 1), "shoulder": (0, 5, 4, 1),
                  "dot": (0, 6, 1, 1)}[key]
    return {"uv": [x, y], "uv_size": [w, h], "material_instance": "glass"}


def jar_cubes():
    c = []
    # glass walls: four 4x4x1 slabs round the middle (inner faces not drawn: the jar is see-through)
    for o, s, out in (((-2, 0, -3), (4, 4, 1), "north"), ((-2, 0, 2), (4, 4, 1), "south"),
                      ((2, 0, -2), (1, 4, 4), "east"), ((-3, 0, -2), (1, 4, 4), "west")):
        uv = {out: glass_face("wall"), "up": glass_face("rim")}
        ends = ("east", "west") if out in ("north", "south") else ("north", "south")
        for e in ends:
            uv[e] = glass_face("corner")
        c.append({"origin": list(o), "size": list(s), "uv": uv})
    c.append({"origin": [-2, 4, -2], "size": [4, 1, 4], "uv": {f: glass_face("shoulder")
                                                                for f in ("north", "south", "east", "west")}})
    c.append({"origin": [-2, 0, -2], "size": [4, 1, 4], "uv": {  # moss bed
        "up": {"uv": [0, 0], "uv_size": [4, 4], "material_instance": "inner"},
        **{f: {"uv": [0, 4], "uv_size": [4, 1], "material_instance": "inner"} for f in ("north", "south", "east", "west")}}})
    for i, (x, y, z, _) in enumerate(JAR_FLIES):
        c.append({"origin": [x, y, z], "size": [1, 1, 1], "uv": {
            f: {"uv": [i, 8], "uv_size": [1, 1], "material_instance": "inner"}
            for f in ("north", "south", "east", "west", "up", "down")}})
    c.append(lamp_cube((-2.5, 5, -2.5), (5, 1, 5), "wood", 4))  # lid
    c.append(lamp_cube((-0.5, 6, -0.5), (1, 1, 1), "gold", 5))  # knob
    return c


def rot90(cube, times):
    """Turn a cube about the vertical axis through the block centre (x, z -> -z, x), faces moved to match."""
    order = ["north", "east", "south", "west"]
    out = json.loads(json.dumps(cube))
    for _ in range(times):
        (x, y, z), (sx, sy, sz) = out["origin"], out["size"]
        out["origin"] = [-(z + sz), y, x]
        out["size"] = [sz, sy, sx]
        uv = out["uv"]
        out["uv"] = {**{order[(order.index(f) + 1) % 4]: uv[f] for f in order}, "up": uv["up"], "down": uv["down"]}
    return out


def chandelier_cubes():
    c = []
    c.append(lamp_cube((-2, 15, -2), (4, 1, 4), "wood", 1))  # ceiling plate
    c.append(lamp_cube((-0.5, 11, -0.5), (1, 2, 1), "gold", 2))  # chain
    c.append(lamp_cube((-0.5, 13, -0.5), (1, 2, 1), "gold", 3))
    c.append(lamp_cube((-2, 9, -2), (4, 2, 4), "wood", 3))  # hub
    # central lantern hung under the hub (shorter core: crop one row off the 8-high painting)
    c.append(lamp_cube((-2, 8, -2), (4, 1, 4), "wood", 4))
    c.append(glow_cube((-2, 2, -2), (4, 6, 4), LANTERN_FACES, crop=1))
    c.append(lamp_cube((-2, 1, -2), (4, 1, 4), "wood", 5))
    c.append(lamp_cube((-1, 0, -1), (2, 1, 2), "gold", 6))
    arm = [lamp_cube((2, 9, -1), (3, 2, 2), "antler", 1),  # beam out of the hub
           lamp_cube((5, 10, -1), (2, 2, 2), "antler", 2),  # rising step
           lamp_cube((6, 12, -0.5), (1, 3, 1), "antler", 3),  # tall tine
           lamp_cube((3, 8, -1), (2, 1, 2), "gold", 5),  # cap of the small lantern
           glow_cube((3, 5, -1), (2, 3, 2), LANTERN_FACES, small=True),
           lamp_cube((3, 4, -1), (2, 1, 2), "gold", 6)]
    for t in range(4):
        c.extend(rot90(cube, t) for cube in arm)
    return c


# ---------------------------------------------------------------------------------------------- icons
ICON_WOOD = [hexc(h) for h in ("#dde0df", "#aab1b9", "#808795")]
ICON_GOLD = [hexc(h) for h in ("#fbe9a0", "#c9a04a", "#8a6a2a")]
ICON_IVORY = [hexc(h) for h in ("#f6eed8", "#d9c28f", "#a98a58")]


def icon_lantern(heartwood=False):
    """Compact 16px inventory sprite, drawn at item scale instead of shrinking the model's ten-unit canopy.

    Vanilla lanterns use a tight silhouette, a few large warm light pixels and directional metal shading. Keep the
    broad silver eave and gold finial of this model, but spend more pixels on the light than on outlines or detail.
    """
    light, mid, shade, dark = (hexc(h) for h in ("#e4e8e4", "#b9c1c5", "#76818c", "#39414d"))
    if heartwood:
        light, mid, shade, dark = (to_gold(c[:3]) + (255,) for c in (light, mid, shade, dark))
    ember, amber, hot = (hexc(h) for h in ("#b66c33", "#eda748", "#ffdc83"))
    gold_light, gold_mid, gold_dark = GOLD[0], GOLD[2], GOLD[3]
    if heartwood:  # the golden wood set swaps its metal detail to Mallorn silver
        gold_light, gold_mid, gold_dark = (c + (255,) for c in (MALLORN_BARK[5], MALLORN_BARK[3], MALLORN_BARK[1]))
    px = {}

    def fill(x0, y0, x1, y1, colour):
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                px[(x, y)] = colour

    # Gold finial, pale stepped canopy, and a shadow under its overhang.
    fill(7, 1, 7, 2, gold_light)
    fill(8, 1, 8, 2, gold_mid)
    px[(8, 2)] = gold_dark
    fill(6, 3, 8, 3, mid)
    px[(9, 3)] = shade
    fill(5, 4, 7, 4, light)
    fill(8, 4, 9, 4, mid)
    px[(10, 4)] = shade
    fill(4, 5, 7, 5, light)
    fill(8, 5, 9, 5, mid)
    px[(10, 5)] = shade
    px[(11, 5)] = dark
    fill(4, 6, 5, 6, mid)
    fill(6, 6, 9, 6, shade)
    px[(10, 6)] = dark
    px[(11, 6)] = dark

    # Four-pixel amber window with silver posts and a small pointed arch.
    fill(6, 8, 9, 12, amber)
    fill(6, 8, 8, 8, hot)
    fill(7, 9, 8, 11, hot)
    fill(6, 12, 9, 12, ember)
    px[(7, 9)] = hexc("#fff1b1")
    px[(8, 11)] = FLY[2]
    fill(5, 7, 5, 12, mid)
    fill(10, 7, 10, 12, dark)
    fill(6, 7, 6, 8, light)
    fill(7, 7, 8, 7, mid)
    fill(9, 7, 9, 8, shade)
    px[(5, 7)] = light
    px[(10, 7)] = shade
    fill(5, 13, 7, 13, mid)
    fill(8, 13, 9, 13, shade)
    px[(10, 13)] = dark

    img = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
    for pos, colour in px.items():
        img.putpixel(pos, colour)
    return img


def icon_chandelier():
    """A broad antler arc with one bright centre lantern and two smaller side lanterns."""
    px = {}
    put = px.__setitem__
    silver_hi, silver_mid, silver_dark = ICON_WOOD
    ivory_hi, ivory_mid, ivory_dark = ICON_IVORY[0], ICON_IVORY[1], ICON_IVORY[2]
    gold_hi, gold_mid, gold_dark = ICON_GOLD
    for y in range(1, 4):
        put((7, y), gold_hi if y == 1 else gold_mid)
        put((8, y), gold_dark)
    for x in range(6, 10):
        put((x, 4), silver_hi if x < 8 else silver_dark)
    # Silhouette first: two continuous rising antler arms, their tips and small tines.
    for x, y, c in ((6, 5, ivory_hi), (5, 5, ivory_mid), (4, 5, ivory_mid), (3, 4, ivory_mid),
                    (2, 3, ivory_dark), (2, 2, ivory_mid), (4, 3, ivory_hi), (5, 4, ivory_mid),
                    (9, 5, ivory_mid), (10, 5, ivory_dark), (11, 5, ivory_mid), (12, 4, ivory_dark),
                    (13, 3, ivory_dark), (13, 2, ivory_mid), (11, 3, ivory_hi), (10, 4, ivory_mid)):
        put((x, y), c)

    # Gold suspensions and two narrow side lights.
    for cx in (3, 12):
        put((cx, 6), gold_dark)
        put((cx - 1, 7), silver_hi)
        put((cx, 7), gold_mid)
        put((cx + 1, 7), silver_dark)
        for y in (8, 9):
            put((cx - 1, y), silver_mid)
            put((cx, y), GLOW[0] if y == 8 else GLOW[1])
            put((cx + 1, y), silver_dark)
        for x in range(cx - 1, cx + 2):
            put((x, 10), silver_mid if x < cx else silver_dark)

    # A bright central lamp is the focal point, with a stepped silver cap.
    for x in range(6, 10):
        put((x, 7), silver_hi if x < 8 else silver_mid)
        put((x, 12), silver_mid if x < 8 else silver_dark)
    for y in range(8, 12):
        put((6, y), silver_hi if y < 10 else silver_mid)
        put((7, y), GLOW[0] if y < 10 else GLOW[1])
        put((8, y), GLOW[0] if y < 10 else GLOW[1])
        put((9, y), silver_dark)
    put((7, 9), FLY[3])
    put((8, 13), gold_mid)
    img = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
    for pos, colour in px.items():
        img.putpixel(pos, colour)
    return img


# Bottle of Fireflies icon colours (tools/make_firefly.py), so the jar sits with it and with vanilla potions:
# glass is drawn only as its rim (light top-left, blue bottom-right), the inside stays transparent, flies are soft glows.
B_LIGHT, B_PALE, B_MID, B_DARK = hexc("#d4e5f7"), hexc("#b3cfec"), hexc("#8badd0"), hexc("#5d8fc2")
F_HOT, F_CORE = hexc("#ffffd6"), hexc("#f0fa96")
F_ARM, F_SOFT, F_FAINT = (200, 240, 60, 230), (200, 240, 60, 130), (200, 240, 60, 78)
LID = [hexc(h) for h in ("#dde0df", "#b6bcc4", "#8f96a2", "#5f6672")]


def icon_jar():
    """A small round-shouldered jar: glass at the rim, empty space around the flies, moss at its base."""
    px = {}
    put = px.__setitem__
    put((7, 2), GOLD[0])
    put((8, 2), GOLD[2])
    for x in range(5, 11):
        put((x, 3), LID[0] if x < 8 else LID[1])
    for x in range(4, 12):
        put((x, 4), LID[1] if x < 7 else LID[2] if x < 11 else LID[3])
    for x in range(5, 11):  # the shoulders pull in under the wide lid
        put((x, 5), B_LIGHT if x < 8 else B_MID)
    for y in range(6, 12):
        put((4, y), B_LIGHT if y < 9 else B_PALE)
        put((11, y), B_MID if y < 9 else B_DARK)
    put((5, 6), B_PALE)
    put((5, 7), B_LIGHT)  # short glass reflection, not a filled blue panel
    put((5, 8), B_PALE)
    for x, k in enumerate((1, 0, 1, 2, 1, 0), 5):
        put((x, 11), MOSS[k])
    for x, k in enumerate((2, 1, 2, 3, 2, 3), 5):
        put((x, 12), MOSS[k])
    for x in range(5, 11):
        put((x, 13), B_PALE if x < 8 else B_DARK)
    put((9, 11), LEAF_GOLD[0])
    put((10, 11), LEAF_GOLD[1])
    for (cx, cy), big in (((6, 8), True), ((9, 9), False)):
        put((cx, cy), F_HOT if big else F_CORE)
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            put((cx + dx, cy + dy), F_ARM if big else F_SOFT)
    put((9, 7), F_FAINT)
    img = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
    for q, c in px.items():
        img.putpixel(q, c)
    return img


# ---------------------------------------------------------------------------------------------- json helpers
def dump(path, obj):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(obj, indent=2) + "\n", newline="\n")


def merge_atlas(path, entries, key="texture_data"):
    d = json.loads(path.read_text())
    d[key].update(entries)
    dump(path, d)


def merge_lang(lines):
    path = RP / "texts/en_US.lang"
    text = path.read_text(encoding="utf-8")
    have = {ln.split("=", 1)[0] for ln in text.splitlines() if "=" in ln}
    add = [ln for ln in lines if ln.split("=", 1)[0] not in have]
    if add:
        path.write_text(text.rstrip("\n") + "\n" + "\n".join(add) + "\n", encoding="utf-8", newline="\n")


def box(origin, size):
    return {"origin": list(origin), "size": list(size)}


def save_set(tex, name, img, mers):
    img.save(tex / f"{name}.png")
    mers.save(tex / f"{name}_mers.tga")
    write_texture_set(name)


def write_texture_set(name):
    dump(RP / f"textures/blocks/{name}.texture_set.json", {"format_version": "1.21.30", "minecraft:texture_set": {
        "color": name, "metalness_emissive_roughness_subsurface": f"{name}_mers"}})


def lamp_block(ident, light, geometry, placement_faces, boxes, extra_perms=None, map_color="#e8c050",
               seconds=0.8, tile_glow=None, sound="wood"):
    mats = {"*": {"texture": f"{NS}:elven_lamp", "render_method": "opaque"}}
    if tile_glow:
        mats["glow"] = {"texture": f"{NS}:{tile_glow}", "render_method": "opaque", "ambient_occlusion": 0.0}
    comps = {
        "minecraft:destructible_by_mining": {"seconds_to_destroy": seconds},
        "minecraft:destructible_by_explosion": {"explosion_resistance": 1},
        "minecraft:sound": {"sound": sound},
        "minecraft:light_emission": light,
        "minecraft:light_dampening": 0,
        "minecraft:map_color": map_color,
        "minecraft:geometry": geometry,
        "minecraft:material_instances": mats,
        "minecraft:placement_filter": {"conditions": [{"allowed_faces": placement_faces}]},
        "lothlorien:lamp_support": {},
    }
    comps.update(boxes)
    block = {"description": {"identifier": f"{NS}:{ident}", "traits": {
        "minecraft:placement_position": {"enabled_states": ["minecraft:block_face"]}}},
        "components": comps}
    if extra_perms:
        block["permutations"] = extra_perms
    return {"format_version": "1.26.50", "minecraft:block": block}


def lamp_item(ident, stack=64):
    return {"format_version": "1.26.50", "minecraft:item": {
        "description": {"identifier": f"{NS}:{ident}", "menu_category": {
            "category": "items", "group": "minecraft:itemGroup.name.lanterns"}},
        "components": {"minecraft:icon": f"{NS}:{ident}", "minecraft:max_stack_size": stack,
                       "minecraft:block_placer": {"block": f"{NS}:{ident}", "replace_block_item": True}}}}


def recipe(ident, pattern, key, unlock, count=1):
    return {"format_version": "1.20.30", "minecraft:recipe_shaped": {
        "description": {"identifier": f"{NS}:{ident}"}, "tags": ["crafting_table"], "pattern": pattern,
        "key": {k: {"item": v} for k, v in key.items()}, "unlock": [{"item": unlock}],
        "result": {"item": f"{NS}:{ident}", "count": count}}}


def check_uv(name, geo_obj, tiles):
    """Every face lies inside its tile and samples only painted texels (a fly may be transparent in some frames)."""
    for bone in geo_obj["minecraft:geometry"][0]["bones"]:
        for cube in bone["cubes"]:
            for face, f in cube["uv"].items():
                tile = tiles[f.get("material_instance", "*")]
                (x, y), (w, h) = f["uv"], f["uv_size"]
                assert 0 <= x and x + w <= 16 and 0 <= y and y + h <= 16, (name, face, f)
                frames = [tile.crop((0, i * 16, 16, i * 16 + 16)) for i in range(tile.height // 16)]
                for yy in range(y, y + h):
                    for xx in range(x, x + w):
                        assert any(fr.getpixel((xx, yy))[3] > 0 for fr in frames), (name, face, f, xx, yy)


def preview(out):
    """Self-check every model, then render each block with its real materials (block_render.py)."""
    import subprocess
    import sys
    out.mkdir(parents=True, exist_ok=True)
    renderer = MOD.parents[1] / ".claude/skills/bedrock-art/scripts/block_render.py"
    for name in ("elven_lantern", "elven_lantern_heartwood", "firefly_jar", "elven_chandelier"):
        block = json.loads((BP / f"blocks/{name}.json").read_text())["minecraft:block"]["components"]
        tiles = {k: Image.open(RP / (json.loads((RP / "textures/terrain_texture.json").read_text())["texture_data"]
                                     [m["texture"]]["textures"] + ".png")).convert("RGBA")
                 for k, m in block["minecraft:material_instances"].items()}
        geo_name = "elven_lantern" if name == "elven_lantern_heartwood" else name
        check_uv(name, json.loads((RP / f"models/blocks/{geo_name}.geo.json").read_text()), tiles)
        for frame in (0, 3):
            subprocess.run([sys.executable, "-B", str(renderer), str(BP / f"blocks/{name}.json"),
                            str(out / f"{name}_f{frame}.png"), "--size", "256", "--frame", str(frame)], check=True)


def main():
    tex = RP / "textures/blocks"
    tex.mkdir(parents=True, exist_ok=True)

    # ---- textures
    lamp_img, lamp_mers = lamp_tile()
    lamp_img.save(tex / "elven_lamp.png")
    lamp_mers.save(tex / "elven_lamp_mers.tga")
    write_texture_set("elven_lamp")
    save_set(tex, "elven_lamp_heartwood", recolour(lamp_img), lamp_mers)
    flips = []
    img, mers = glow_tile([(ox, oy, w, h, flies, False, False) for ox, oy, w, h, flies in LANTERN_FACES.values()])
    save_set(tex, "elven_lantern_glow", img, mers)  # the chandelier's lanterns
    wood_img, wood_mers = lantern_wood_tile()
    save_set(tex, "elven_lantern_wood", wood_img, wood_mers)
    save_set(tex, "elven_lantern_wood_heartwood", recolour(wood_img), wood_mers)
    save_set(tex, "elven_jar_glass", *jar_glass_tile())
    save_set(tex, "elven_jar_inner", *jar_inner_tile())
    for name in ("elven_lantern_glow", "elven_jar_inner"):
        flips.append({"flipbook_texture": f"textures/blocks/{name}", "atlas_tile": f"{NS}:{name}",
                      "ticks_per_frame": TICKS_PER_FRAME, "frames": list(range(FRAMES)), "blend_frames": True})
    for old in ("elven_jar_glow", "elven_lantern_core"):  # retired textures
        for suffix in (".png", "_mers.tga", ".texture_set.json"):
            (tex / f"{old}{suffix}").unlink(missing_ok=True)
    fp = RP / "textures/flipbook_textures.json"
    entries = [e for e in json.loads(fp.read_text()) if e["atlas_tile"] not in
               {f["atlas_tile"] for f in flips} | {f"{NS}:elven_jar_glow", f"{NS}:elven_lantern_core"}]
    dump(fp, entries + flips)
    tt = RP / "textures/terrain_texture.json"
    d = json.loads(tt.read_text())
    d["texture_data"].pop(f"{NS}:elven_jar_glow", None)
    d["texture_data"].pop(f"{NS}:elven_lantern_core", None)
    d["texture_data"].update({f"{NS}:{n}": {"textures": f"textures/blocks/{n}"} for n in (
        "elven_lamp", "elven_lamp_heartwood", "elven_lantern_glow",
        "elven_lantern_wood", "elven_lantern_wood_heartwood", "elven_jar_glass", "elven_jar_inner")})
    dump(tt, d)

    # ---- models
    models = RP / "models/blocks"
    (models / "elven_lantern_hanging.geo.json").unlink(missing_ok=True)  # one shape now: the tip hangs it
    dump(models / "elven_lantern.geo.json", geo("elven_lantern", [("lantern", arch_lantern_cubes())]))
    (models / "elven_lantern_arch.geo.json").unlink(missing_ok=True)  # former comparison block is now the main lantern
    dump(models / "firefly_jar.geo.json", geo("firefly_jar", [("jar", jar_cubes())]))
    dump(models / "elven_chandelier.geo.json", geo("elven_chandelier", [("chandelier", chandelier_cubes())]))

    # ---- blocks
    G = f"geometry.{NS}."
    lantern = lamp_block("elven_lantern", 14, G + "elven_lantern", ["up", "down"], {
        "minecraft:collision_box": box((-5, 0, -5), (10, 16, 10)),
        "minecraft:selection_box": box((-5, 0, -5), (10, 16, 10))}, tile_glow="elven_lantern_glow")
    lantern["minecraft:block"]["components"]["minecraft:material_instances"]["wood"] = {
        "texture": f"{NS}:elven_lantern_wood", "render_method": "opaque"}
    dump(BP / "blocks/elven_lantern.json", lantern)
    heartwood = lamp_block("elven_lantern_heartwood", 14, G + "elven_lantern", ["up", "down"], {
        "minecraft:collision_box": box((-5, 0, -5), (10, 16, 10)),
        "minecraft:selection_box": box((-5, 0, -5), (10, 16, 10))},
        tile_glow="elven_lantern_glow", map_color="#bd9a58")
    heartwood["minecraft:block"]["components"]["minecraft:material_instances"].update({
        "*": {"texture": f"{NS}:elven_lamp_heartwood", "render_method": "opaque"},
        "wood": {"texture": f"{NS}:elven_lantern_wood_heartwood", "render_method": "opaque"}})
    dump(BP / "blocks/elven_lantern_heartwood.json", heartwood)
    (BP / "blocks/elven_lantern_arch.json").unlink(missing_ok=True)
    jar = lamp_block("firefly_jar", 11, G + "firefly_jar", ["up"], {
        "minecraft:collision_box": box((-3, 0, -3), (6, 7, 6)), "minecraft:selection_box": box((-3, 0, -3), (6, 7, 6))},
        map_color="#e0b048", tile_glow=None, sound="glass")
    # One render_method per block: the game rejects opaque mixed with transparent ("MaterialInstances can't mix and
    # match opaque and transparent materials"), so lid, knob, moss and flies are blend too (full alpha = solid; a fly's
    # dark frames are alpha 0, so it still vanishes).
    jar["minecraft:block"]["components"]["minecraft:material_instances"].update({
        "*": {"texture": f"{NS}:elven_lamp", "render_method": "blend"},
        "glass": {"texture": f"{NS}:elven_jar_glass", "render_method": "blend"},
        "inner": {"texture": f"{NS}:elven_jar_inner", "render_method": "blend", "ambient_occlusion": 0.0}})
    dump(BP / "blocks/firefly_jar.json", jar)
    dump(BP / "blocks/elven_chandelier.json", lamp_block(
        "elven_chandelier", 15, G + "elven_chandelier", ["down"],
        {"minecraft:collision_box": False, "minecraft:selection_box": box((-7, 0, -7), (14, 16, 14))},
        tile_glow="elven_lantern_glow", seconds=1.0))

    # ---- icons
    items = RP / "textures/items"
    for ident, draw in (("elven_lantern", icon_lantern),
                        ("elven_lantern_heartwood", lambda: icon_lantern(heartwood=True)), ("firefly_jar", icon_jar),
                        ("elven_chandelier", icon_chandelier)):
        draw().save(items / f"{ident}.png")
    (items / "elven_lantern_arch.png").unlink(missing_ok=True)
    atlas = RP / "textures/item_texture.json"
    atlas_data = json.loads(atlas.read_text())
    atlas_data["texture_data"].pop(f"{NS}:elven_lantern_arch", None)
    dump(atlas, atlas_data)
    merge_atlas(RP / "textures/item_texture.json", {
        f"{NS}:{i}": {"textures": f"textures/items/{i}"} for i in
        ("elven_lantern", "elven_lantern_heartwood", "firefly_jar", "elven_chandelier")})

    # ---- items and recipes
    for ident in ("elven_lantern", "elven_lantern_heartwood", "firefly_jar", "elven_chandelier"):
        dump(BP / f"items/{ident}.json", lamp_item(ident, 16 if ident == "elven_chandelier" else 64))
    (BP / "items/elven_lantern_arch.json").unlink(missing_ok=True)
    bottle = f"{NS}:bottle_of_fireflies"
    dump(BP / "recipes/elven_lantern.json", recipe(
        "elven_lantern", ["T", "B", "T"], {"T": f"{NS}:mallorn_trapdoor", "B": bottle}, bottle))
    dump(BP / "recipes/elven_lantern_heartwood.json", recipe(
        "elven_lantern_heartwood", ["T", "B", "T"],
        {"T": f"{NS}:mallorn_heartwood_trapdoor", "B": bottle}, bottle))
    dump(BP / "recipes/firefly_jar.json", recipe(
        "firefly_jar", ["N", "B"], {"N": f"{NS}:mallorn_button", "B": bottle}, bottle))
    dump(BP / "recipes/elven_chandelier.json", recipe(
        "elven_chandelier", ["ARA", "ALA"],
        {"A": f"{NS}:deer_antler", "R": f"{NS}:elven_rope", "L": f"{NS}:elven_lantern"}, f"{NS}:elven_lantern"))

    # ---- names
    merge_lang([f"tile.{NS}:{i}.name={n}\nitem.{NS}:{i}={n}" for i, n in (
        ("elven_lantern", "Elven Lantern"), ("elven_lantern_heartwood", "Heartwood Elven Lantern"),
        ("firefly_jar", "Firefly Jar"), ("elven_chandelier", "Elven Chandelier"))])
    lang = RP / "texts/en_US.lang"
    lang.write_text("\n".join(line for line in lang.read_text(encoding="utf-8").splitlines()
                              if not line.startswith((f"tile.{NS}:elven_lantern_arch.",
                                                      f"item.{NS}:elven_lantern_arch="))) + "\n",
                    encoding="utf-8", newline="\n")
    preview(MOD.parents[1] / "temp/lamps")
    print("elven lamps written")


if __name__ == "__main__":
    main()
