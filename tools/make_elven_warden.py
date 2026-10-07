"""Generates the Elven Warden RP art: geometry, texture, animations, animation controllers, render controller, client entity.

    python -B mods/lothlorien/tools/make_elven_warden.py [--sheet]

Output (overwritten every run): lothlorien_rp/models/entity/elven_warden.geo.json,
lothlorien_rp/textures/entity/elven_warden/elven_warden.png, lothlorien_rp/animations/elven_warden.animation.json,
lothlorien_rp/animation_controllers/elven_warden.animation_controllers.json,
lothlorien_rp/render_controllers/elven_warden.render_controllers.json, lothlorien_rp/entity/elven_warden.entity.json.
--sheet also writes the review sheet to temp/elven_warden/ (software preview from the bedrock-mobs skill, not the game renderer).

Design: docs/mobs/elven_warden.md part B. Vanilla skeleton bone names (body, waist, head, hat, rightArm, rightItem, leftArm,
leftItem, rightLeg, leftLeg) so vanilla humanoid animations drive it; hat = the hood, with a window cut out of its front face
(alpha test) that shows the face. The bow is the vanilla bow item drawn at rightItem (BP equipment). Quiver, cloak and back hair
are model parts. Every texture face is painted by rule (colour ramps with hue shift, hand-placed details, no random noise).
Not seen in game yet; left/right face mapping of box UVs follows make_deer.py and is symmetric wherever it matters.
"""
import json
import sys
from pathlib import Path
from PIL import Image

MOD = Path(__file__).resolve().parents[1]
RP = MOD / "lothlorien_rp"
WS = MOD.parents[1]
TEX = 64
ID = "lothlorien:elven_warden"
GEO_ID = "geometry.lothlorien.elven_warden"


def hexc(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4)) + (255,)


def R(names):
    return [hexc(c) for c in names.split()]


# Ramps dark -> light; shadows lean blue/violet, lights lean yellow-green.
CLOAK = R("#27352c #35483a #46604a #5d7857 #7a9370")      # Lorien cloak, grey-green
TUNIC = R("#363f2c #4a5a3b #627652 #7d9269 #9fb085")      # tunic, warmer and lighter than the cloak
LEGG = R("#2f3b36 #404f46 #566659 #6f8070")               # leggings, greyer
LEATHER = R("#2a1c16 #43301f #5f4429 #7f5c37")
SKIN = R("#a98672 #c9a58f #e2c6ae #f1ddc9")
HAIR = R("#7b6538 #a58c4f #cfb878 #ead9a2")               # fair, pale gold
SILVER = R("#5f6c75 #8d9aa3 #bdc8ce #eef3f5")
FEATHER = R("#8f989d #c3cacd #eef1f2")
FEATHER_G = R("#3f5e3b #5c8250 #86a974")
EYE = hexc("#4a6f86")
BROW = hexc("#8a7340")
MOUTH = hexc("#a56d64")
CLEAR = (0, 0, 0, 0)


def ramp(r, k):
    return r[max(0, min(len(r) - 1, k))]


# ---------------------------------------------------------------- model
# bone: (parent, pivot, rotation, extra); cube: (name, bone, origin, size, role)
BONES = {
    "waist": (None, [0, 12, 0], None, {}),
    "body": ("waist", [0, 24, 0], None, {}),
    "head": ("body", [0, 24, 0], None, {}),
    "hat": ("head", [0, 24, 0], None, {}),
    "rightArm": ("body", [-5.5, 22, 0], None, {}),
    "rightItem": ("rightArm", [-6, 15, 1], None, {"neverRender": True}),
    "leftArm": ("body", [5.5, 22, 0], None, {}),
    "leftItem": ("leftArm", [6, 15, 1], None, {"neverRender": True}),
    "rightLeg": ("body", [-2, 12, 0], None, {}),
    "leftLeg": ("body", [2, 12, 0], None, {}),
    "cloak": ("body", [0, 25, 2], None, {}),
    "quiver": ("cloak", [3.5, 15, 5.5], [0, 0, -9], {}),
}

CUBES = [
    ("head", "head", [-4, 24, -4], [8, 8, 8], "head"),
    ("hood", "hat", [-4.5, 24, -4.5], [9, 9, 9], "hood"),
    ("body", "body", [-4, 12, -2], [8, 12, 4], "body"),
    ("collar", "body", [-5.5, 21, -3.5], [11, 4, 7], "collar"),
    ("lock_r_up", "body", [-3.5, 21, -4.5], [1, 3, 1], "lock"),
    ("lock_l_up", "body", [2.5, 21, -4.5], [1, 3, 1], "lock"),
    ("lock_r_lo", "body", [-3.5, 17, -3], [1, 4, 1], "lock"),
    ("lock_l_lo", "body", [2.5, 17, -3], [1, 4, 1], "lock"),
    ("rightArm", "rightArm", [-7, 12, -1.5], [3, 12, 3], "arm"),
    ("leftArm", "leftArm", [4, 12, -1.5], [3, 12, 3], "arm"),
    ("rightLeg", "rightLeg", [-3.5, 0, -1.5], [3, 12, 3], "leg"),
    ("leftLeg", "leftLeg", [0.5, 0, -1.5], [3, 12, 3], "leg"),
    ("cloak_back", "cloak", [-5, 6, 2], [10, 19, 2], "cloak"),
    ("edge_r", "body", [-4.5, 7, -3], [1, 14, 1], "cloak_edge"),
    ("edge_l", "body", [3.5, 7, -3], [1, 14, 1], "cloak_edge"),
    ("quiver", "quiver", [2, 9, 4], [3, 11, 3], "quiver"),
    ("arrow_a", "quiver", [2, 20, 5], [1, 3, 1], "arrow_w"),
    ("arrow_b", "quiver", [3, 20, 5.5], [1, 4, 1], "arrow_g"),
    ("arrow_c", "quiver", [4, 20, 5], [1, 3, 1], "arrow_w"),
]


def box_extent(size):
    w, h, d = (int(s) for s in size)
    return 2 * (w + d), h + d


MIRRORED = {"leftArm": "rightArm", "leftLeg": "rightLeg"}  # share the right limb's UV (cube "mirror": true); designs are symmetric


def pack(cubes):
    """Shelf-pack boxes; tries a few orderings and keeps the first that fits the texture. Returns {name: (u, v)}."""
    for _n, _b, _o, size, _r in cubes:
        assert all(float(s) == int(s) for s in size), "box sizes must be whole numbers"
    import random
    items = [c for c in cubes if c[0] not in MIRRORED]
    rng = random.Random(7)  # fixed seed: the same layout every run
    best = None
    for attempt in range(20000):
        order = sorted(items, key=lambda c: (-box_extent(c[3])[1], c[0])) if attempt == 0 else rng.sample(items, len(items))
        x = y = shelf = 0
        out = {}
        for name, _b, _o, size, _r in order:
            bw, bh = box_extent(size)
            if x + bw > TEX:
                x, y, shelf = 0, y + shelf, 0
            out[name] = (x, y)
            x += bw
            shelf = max(shelf, bh)
        used = y + shelf
        if used <= TEX:
            for left, right in MIRRORED.items():
                out[left] = out[right]
            return out
        best = used if best is None else min(best, used)
    raise SystemExit(f"texture overflow: best ordering needs {best} > {TEX}")


def geometry(uvs):
    bones = []
    for name, (parent, pivot, rot, extra) in BONES.items():
        b = {"name": name, "pivot": pivot}
        if parent:
            b["parent"] = parent
        if rot:
            b["rotation"] = rot
        b.update(extra)
        bones.append(b)
    for name, bone, origin, size, _role in CUBES:
        entry = next(b for b in bones if b["name"] == bone)
        cube = {"origin": origin, "size": size, "uv": list(uvs[name])}
        if name in MIRRORED:
            cube["mirror"] = True
        entry.setdefault("cubes", []).append(cube)
    return {
        "format_version": "1.12.0",
        "minecraft:geometry": [{
            "description": {"identifier": GEO_ID, "texture_width": TEX, "texture_height": TEX,
                            "visible_bounds_width": 3, "visible_bounds_height": 3, "visible_bounds_offset": [0, 1.2, 0]},
            "bones": bones,
        }],
    }


# ---------------------------------------------------------------- painting
class Canvas:
    def __init__(self):
        self.img = Image.new("RGBA", (TEX, TEX), CLEAR)
        self.px = self.img.load()
        self.painted = set()

    def set(self, x, y, c):
        self.px[x, y] = c
        self.painted.add((x, y))


def faces(u, v, size):
    w, h, d = (int(s) for s in size)
    return {
        "top": (u + d, v, w, d), "bottom": (u + d + w, v, w, d),
        "east": (u, v + d, d, h), "north": (u + d, v + d, w, h),
        "west": (u + d + w, v + d, d, h), "south": (u + 2 * d + w, v + d, w, h),
    }


def fill(cv, rect, fn):
    x0, y0, w, h = rect
    for j in range(h):
        for i in range(w):
            c = fn(i, j, w, h)
            cv.set(x0 + i, y0 + j, CLEAR if c is None else c)


FACE_LIGHT = {"top": 1, "north": 0, "east": 0, "west": 0, "south": -1, "bottom": -2}
LEAF_SHAPES = [
    [(1, 0), (0, 1), (1, 1), (2, 1), (1, 2)],       # small diamond leaf
    [(0, 0), (1, 0), (1, 1), (2, 1)],               # diagonal blade
    [(0, 1), (1, 1), (1, 0), (2, 0)],
    [(0, 0), (1, 1), (1, 0)],
]


def mottle(seed, w, h, dark_div=16, light_div=34):
    """Leaf-shadow pattern: deterministic clusters (LCG, fixed seed) of dark leaf shapes with a few lighter flecks."""
    state = seed * 2654435761 % (2 ** 32)

    def nxt(n):
        nonlocal state
        state = (state * 1103515245 + 12345) % (2 ** 31)
        return (state >> 8) % n

    out = {}
    for kind, count in ((-1, max(1, w * h // dark_div)), (1, w * h // light_div)):
        for _ in range(count):
            shape = LEAF_SHAPES[nxt(len(LEAF_SHAPES))] if kind < 0 else LEAF_SHAPES[3]
            ox, oy = nxt(max(1, w - 2)), nxt(max(1, h - 2))
            for dx, dy in shape:
                x, y = ox + dx, oy + dy
                if x < w and y < h:
                    out[(x, y)] = kind
    return out


def cloth(r, face, i, j, dabs, base=2, top_rows=0):
    k = base + FACE_LIGHT[face]
    if top_rows and j < top_rows:
        k += 1
    return ramp(r, k + dabs.get((i, j), 0))


def seed_for(name, face):
    return sum(ord(c) * (n + 3) for n, c in enumerate(name + face)) % 9973


def paint_head(cv, f):
    def north(i, j, w, h):
        if j == 0:
            return ramp(HAIR, 2)
        if j == 1:
            return ramp(SKIN, 0) if i in (3, 4) else ramp(HAIR, 2)  # fringe parted at the middle
        if i in (0, 7):
            return ramp(HAIR, 2 if j < 5 else 1)  # long strands framing the face
        if j == 2:
            return ramp(SKIN, 0)  # shadow under the hood brow
        if j == 3:
            return BROW if i in (1, 2, 5, 6) else ramp(SKIN, 1)
        if j == 4:
            return EYE if i in (2, 5) else ramp(SKIN, 2)
        if j == 5:
            return ramp(SKIN, 1) if i in (3, 4) else ramp(SKIN, 2)  # nose
        if j == 6:
            return MOUTH if i in (3, 4) else ramp(SKIN, 2)
        return ramp(SKIN, 1 if 2 <= i <= 5 else 2)  # chin, a touch darker
    fill(cv, f["north"], north)

    def side(i, j, w, h):  # i counts from the face edge
        if j <= 1:
            return ramp(HAIR, 2)
        if i >= 5:
            return ramp(HAIR, 2 if j % 4 else 1)
        if j >= 6:
            return ramp(SKIN, 1)
        if j == 3 and 2 <= i <= 3:
            return ramp(SKIN, 1)  # ear
        return ramp(SKIN, 2)
    fill(cv, f["east"], side)
    fill(cv, f["west"], lambda i, j, w, h: side(w - 1 - i, j, w, h))
    fill(cv, f["top"], lambda i, j, w, h: ramp(HAIR, 3 if i in (3, 4) else 2))
    fill(cv, f["bottom"], lambda i, j, w, h: ramp(SKIN, 0))
    fill(cv, f["south"], lambda i, j, w, h: ramp(HAIR, 3 if i % 3 == 0 else 2) if j < 7 else ramp(HAIR, 1))


def paint_hood(cv, f):
    dabs = {k: mottle(seed_for("hood", k), f[k][2], f[k][3]) for k in f}

    def north(i, j, w, h):
        if 2 <= i <= 6 and j >= 2:
            return None  # window onto the face (alpha test)
        if (i in (1, 7) and j >= 2) or (j == 1 and 1 <= i <= 7):
            return ramp(CLOAK, 1)  # inner rim of the hood, in shadow
        return cloth(CLOAK, "north", i, j, dabs["north"], base=3 if j < 2 else 2)
    fill(cv, f["north"], north)
    for k in ("east", "west"):
        fill(cv, f[k], lambda i, j, w, h, k=k: ramp(CLOAK, 1) if j == h - 1
             else cloth(CLOAK, k, i, j, dabs[k], base=2, top_rows=2))
    fill(cv, f["top"], lambda i, j, w, h: cloth(CLOAK, "top", i, j, dabs["top"], base=2))
    fill(cv, f["bottom"], lambda i, j, w, h: ramp(CLOAK, 0))
    fill(cv, f["south"], lambda i, j, w, h: ramp(CLOAK, 1) if i == w // 2 and j > 1
         else cloth(CLOAK, "south", i, j, dabs["south"], base=2, top_rows=2))


def paint_hood_tip(cv, f):
    for k, rect in f.items():
        d = mottle(seed_for("tip", k), rect[2], rect[3], 8, 99)
        fill(cv, rect, lambda i, j, w, h, k=k, d=d: cloth(CLOAK, k, i, j, d, base=2 if j < h - 1 else 1))


def paint_edge(cv, f):
    for k, rect in f.items():
        fill(cv, rect, lambda i, j, w, h, k=k: ramp(CLOAK, 0) if j == h - 1 else
             ramp(CLOAK, 1 if k in ("top", "bottom", "south") or j % 4 == 3 else 2))


def paint_collar(cv, f):
    dabs = {k: mottle(seed_for("collar", k), f[k][2], f[k][3]) for k in f}
    leaf = {(1, 0): 3, (2, 0): 2, (0, 1): 3, (1, 1): 2, (2, 1): 1, (0, 2): 2, (1, 2): 1}  # silver leaf, 3x3, lit top-left

    def north(i, j, w, h):
        if 4 <= i <= 6 and 1 <= j <= 3 and (i - 4, j - 1) in leaf:
            return ramp(SILVER, leaf[(i - 4, j - 1)])
        if j == h - 1:
            return ramp(CLOAK, 1)
        return cloth(CLOAK, "north", i, j, dabs["north"], base=3 if j < 2 else 2)
    fill(cv, f["north"], north)
    for k in ("east", "west", "south"):
        fill(cv, f[k], lambda i, j, w, h, k=k: ramp(CLOAK, 1) if j == h - 1
             else cloth(CLOAK, k, i, j, dabs[k], base=2))
    fill(cv, f["top"], lambda i, j, w, h: cloth(CLOAK, "top", i, j, dabs["top"], base=2))
    fill(cv, f["bottom"], lambda i, j, w, h: ramp(CLOAK, 0))


def paint_body(cv, f):
    def north(i, j, w, h):
        if j in (9, 10):  # belt with a silver buckle
            if i in (3, 4):
                return ramp(SILVER, 3 if j == 9 else 1)
            return ramp(LEATHER, 2 if j == 9 else 1)
        if j == h - 1:
            return ramp(TUNIC, 1)  # hem
        k = 2 + (1 if j < 5 else 0) - (1 if i in (3, 4) and j > 10 else 0)
        if i in (0, w - 1):
            k -= 1
        return ramp(TUNIC, k)
    fill(cv, f["north"], north)
    for k in ("east", "west"):
        fill(cv, f[k], lambda i, j, w, h: ramp(LEATHER, 1) if j in (9, 10) else ramp(TUNIC, 1 if j < h - 1 else 0))
    fill(cv, f["south"], lambda i, j, w, h: ramp(LEATHER, 1) if j in (9, 10) else ramp(TUNIC, 1))
    fill(cv, f["top"], lambda i, j, w, h: ramp(TUNIC, 2))
    fill(cv, f["bottom"], lambda i, j, w, h: ramp(TUNIC, 0))


def paint_lock(cv, f):
    def side(i, j, w, h):
        return ramp(HAIR, 3 if j < h - 1 else 1) if (j + i) % 3 == 0 else ramp(HAIR, 2 if j < h - 1 else 1)
    for k, rect in f.items():
        if k == "top":
            fill(cv, rect, lambda i, j, w, h: ramp(HAIR, 3))
        elif k == "bottom":
            fill(cv, rect, lambda i, j, w, h: ramp(HAIR, 1))
        else:
            fill(cv, rect, side)


def paint_arm(cv, f):
    def side(back, j):
        if j >= 10:
            return ramp(SKIN, 0 if back else (2 if j == 10 else 1))  # hand
        if j in (8, 9):
            return ramp(LEATHER, 1 if back else (3 if j == 8 else 2))  # bracer
        return ramp(TUNIC, 1 if back else (2 if j < 5 else 1))
    for k in ("north", "south", "east", "west"):
        fill(cv, f[k], lambda i, j, w, h, k=k: side(k == "south", j))
    fill(cv, f["top"], lambda i, j, w, h: ramp(TUNIC, 2))
    fill(cv, f["bottom"], lambda i, j, w, h: ramp(SKIN, 1))


def paint_leg(cv, f):
    def side(k, i, j, h):
        shade = -1 if k == "south" else 0
        if j >= 8:  # boot
            if j == 8:
                return ramp(LEATHER, 3)  # folded cuff
            if j == h - 1:
                return ramp(LEATHER, 0)
            return ramp(LEATHER, 2 + shade) if j == 9 else ramp(LEATHER, 1)
        base = 2 if j < 3 else 1
        if k == "north" and i == 1 and j < 6:
            base += 1
        return ramp(LEGG, base + shade)
    for k in ("north", "south", "east", "west"):
        fill(cv, f[k], lambda i, j, w, h, k=k: side(k, i, j, h))
    fill(cv, f["top"], lambda i, j, w, h: ramp(LEGG, 2))
    fill(cv, f["bottom"], lambda i, j, w, h: ramp(LEATHER, 0))


def paint_cloak(cv, f):
    dabs = {k: mottle(seed_for("cloak", k), f[k][2], f[k][3], 11, 26) for k in f}

    def panel(k, i, j, w, h):
        if j == h - 1:
            return None if (i % 3 == 1 and k in ("north", "south")) else ramp(CLOAK, 0)  # ragged leaf-cut hem
        if j == h - 2:
            return ramp(CLOAK, 1)
        if k == "south" and i == w // 2:
            return ramp(CLOAK, 1)  # centre seam
        return ramp(CLOAK, (3 if j < 4 else 2) + FACE_LIGHT[k] + dabs[k].get((i, j), 0))
    for k in ("north", "south", "east", "west"):
        fill(cv, f[k], lambda i, j, w, h, k=k: panel(k, i, j, w, h))
    fill(cv, f["top"], lambda i, j, w, h: ramp(CLOAK, 3))
    fill(cv, f["bottom"], lambda i, j, w, h: ramp(CLOAK, 0))


def paint_hair_back(cv, f):
    def panel(k, i, j, w, h):
        if j == h - 1:
            return None if i % 2 == 0 else ramp(HAIR, 1)  # tapering tips
        if k == "south":
            return ramp(HAIR, 2 if (i * 2 + j // 4) % 4 == 0 else 1)
        return ramp(HAIR, 1)
    for k in ("north", "south", "east", "west"):
        fill(cv, f[k], lambda i, j, w, h, k=k: panel(k, i, j, w, h))
    fill(cv, f["top"], lambda i, j, w, h: ramp(HAIR, 2))
    fill(cv, f["bottom"], lambda i, j, w, h: ramp(HAIR, 0))


def paint_quiver(cv, f):
    def panel(k, i, j, w, h):
        if j == 0:
            return ramp(LEATHER, 0)  # rim
        if j in (2, 3):  # green cloth band
            return ramp(CLOAK, 3 if j == 2 else 2)
        if j == h - 1:
            return ramp(LEATHER, 0)  # base cap
        if k == "south" and i == 1 and j == 6:
            return ramp(SILVER, 3)  # silver leaf stud
        if k == "south" and i == 1 and j == 7:
            return ramp(SILVER, 1)
        stitch = i == 0 and k in ("east", "west") and j % 2 == 0
        return ramp(LEATHER, (2 if j < 6 else 1) + (1 if k == "south" and i == 0 else 0) - (1 if stitch else 0))
    for k in ("north", "south", "east", "west"):
        fill(cv, f[k], lambda i, j, w, h, k=k: panel(k, i, j, w, h))
    fill(cv, f["top"], lambda i, j, w, h: ramp(FEATHER, 1) if (i, j) == (1, 1) else ramp(LEATHER, 0))
    fill(cv, f["bottom"], lambda i, j, w, h: ramp(LEATHER, 0))


def paint_arrow(cv, f, colours):
    def panel(i, j, w, h):
        return ramp(colours, 2 if j == 0 else 1 if j < h - 1 else 0)
    for k in ("north", "south", "east", "west"):
        fill(cv, f[k], panel)
    fill(cv, f["top"], lambda i, j, w, h: ramp(colours, 2))
    fill(cv, f["bottom"], lambda i, j, w, h: ramp(colours, 0))


PAINTERS = {
    "head": paint_head, "hood": paint_hood, "cloak_edge": paint_edge, "body": paint_body, "collar": paint_collar,
    "lock": paint_lock, "arm": paint_arm, "leg": paint_leg, "cloak": paint_cloak,
    "quiver": paint_quiver,
    "arrow_w": lambda cv, f: paint_arrow(cv, f, FEATHER), "arrow_g": lambda cv, f: paint_arrow(cv, f, FEATHER_G),
}


def paint_texture(uvs):
    cv = Canvas()
    for name, _bone, _o, size, role in CUBES:
        if name in MIRRORED:
            continue
        PAINTERS[role](cv, faces(*uvs[name], size))
    # self-check: every face texel of every box is painted (transparent ones on purpose)
    for name, _b, _o, size, _r in CUBES:
        for (x, y, w, h) in faces(*uvs[name], size).values():
            for j in range(h):
                for i in range(w):
                    assert (x + i, y + j) in cv.painted, f"unpainted texel in {name}"
    return cv.img


# ---------------------------------------------------------------- animations, controllers, render controller, client entity
def write(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")


def animations():
    p = "animation.lothlorien.elven_warden"
    return {
        "format_version": "1.8.0",
        "animations": {
            # cloak (with quiver and back hair) lifts backwards and swings with the stride
            f"{p}.walk_cloak": {
                "loop": True,
                "bones": {"cloak": {"rotation": [
                    "math.min(query.modified_move_speed, 1.0) * 4.0 + math.cos(query.modified_distance_moved * 38.17) * 1.5 * query.modified_move_speed",
                    0.0,
                    "math.sin(query.modified_distance_moved * 38.17) * 0.8 * query.modified_move_speed"]}},
            },
            # standing: a slow breathing sway of the cloak
            f"{p}.idle_sway": {
                "loop": True,
                "bones": {"cloak": {"rotation": ["math.sin(query.life_time * 90.0) * 0.5", 0.0, 0.0]}},
            },
        },
    }


def controllers():
    c = "controller.animation.lothlorien.elven_warden"
    return {
        "format_version": "1.10.0",
        "animation_controllers": {
            # raised bow pose only while the warden has a target (same switch as the vanilla skeleton)
            f"{c}.bow": {
                "initial_state": "default",
                "states": {
                    "default": {"transitions": [{"aiming": "query.has_target"}]},
                    "aiming": {"animations": ["bow_and_arrow"], "transitions": [{"default": "!query.has_target"}]},
                },
            },
        },
    }


def render_controller():
    return {
        "format_version": "1.8.0",
        "render_controllers": {
            "controller.render.lothlorien.elven_warden": {
                "geometry": "Geometry.default", "materials": [{"*": "Material.default"}], "textures": ["Texture.default"],
            }
        },
    }


def client_entity():
    return {
        "format_version": "1.10.0",
        "minecraft:client_entity": {"description": {
            "identifier": ID,
            "materials": {"default": "entity_alphatest"},
            "textures": {"default": "textures/entity/elven_warden/elven_warden"},
            "geometry": {"default": GEO_ID},
            "animations": {
                "look_at_target": "animation.humanoid.look_at_target.default",
                "move": "animation.humanoid.move",
                "holding": "animation.humanoid.holding",
                "bow_and_arrow": "animation.humanoid.bow_and_arrow",
                "bow": "controller.animation.lothlorien.elven_warden.bow",
                "walk_cloak": "animation.lothlorien.elven_warden.walk_cloak",
                "idle_sway": "animation.lothlorien.elven_warden.idle_sway",
            },
            "scripts": {
                "pre_animation": ["variable.tcos0 = (Math.cos(query.modified_distance_moved * 38.17) * query.modified_move_speed / variable.gliding_speed_value) * 57.3;"],
                "animate": ["look_at_target", "move", "holding", "bow", "walk_cloak", "idle_sway"],
            },
            "render_controllers": ["controller.render.lothlorien.elven_warden"],
            "enable_attachables": True,
            "spawn_egg": {"base_color": "#6f7f66", "overlay_color": "#c9d1d6"},
        }},
    }


def review_sheet(geo_path, tex_path, out_dir):
    sys.path.insert(0, str(WS / ".claude" / "skills" / "bedrock-mobs" / "scripts"))
    import preview_entity as pe
    geo = json.load(open(geo_path, encoding="utf8"))["minecraft:geometry"][0]
    tex = Image.open(tex_path).convert("RGBA")
    bg = (150, 190, 220, 255)
    views = [("front", 180), ("side", 90), ("back", 0), ("3/4", 145)]
    sheet = Image.new("RGBA", (420 * 4, 420 + 540), bg)
    for n, (_t, yaw) in enumerate(views):
        sheet.alpha_composite(pe.render(geo, tex, yaw, pitch=8, scale=11), (420 * n, 0))
    plate = Image.new("RGBA", (TEX * 8, TEX * 8), (60, 60, 60, 255))
    plate.alpha_composite(tex.resize((TEX * 8, TEX * 8), Image.NEAREST))
    sheet.alpha_composite(plate, (20, 430))
    one = Image.new("RGBA", (TEX * 2, TEX * 2), bg)
    one.alpha_composite(tex.resize((TEX * 2, TEX * 2), Image.NEAREST))
    sheet.alpha_composite(one, (560, 430))
    out_dir.mkdir(parents=True, exist_ok=True)
    sheet.convert("RGB").save(out_dir / "review_sheet.png")


def main():
    uvs = pack(CUBES)
    write(RP / "models/entity/elven_warden.geo.json", geometry(uvs))
    tex_path = RP / "textures/entity/elven_warden/elven_warden.png"
    tex_path.parent.mkdir(parents=True, exist_ok=True)
    paint_texture(uvs).save(tex_path)
    write(RP / "animations/elven_warden.animation.json", animations())
    write(RP / "animation_controllers/elven_warden.animation_controllers.json", controllers())
    write(RP / "render_controllers/elven_warden.render_controllers.json", render_controller())
    write(RP / "entity/elven_warden.entity.json", client_entity())
    print("written; texture rows used:", max(v for _u, v in uvs.values()))
    if "--sheet" in sys.argv:
        review_sheet(RP / "models/entity/elven_warden.geo.json", tex_path, WS / "temp" / "elven_warden")


if __name__ == "__main__":
    main()
