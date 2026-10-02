"""Generates the swan and ground squirrel art: geometry and textures (swan: one white plumage; squirrel: three coats).

    python -B mods/lothlorien/tools/make_swan_squirrel.py [--preview DIR]

Output (overwritten every run): lothlorien_rp/models/entity/{swan,squirrel}.geo.json,
lothlorien_rp/textures/entity/swan/swan.png, lothlorien_rp/textures/entity/squirrel/squirrel_{brown,russet,dark}.png.
Same method as make_songbird.py (shelf-packed box UV, every face painted by rule, colour ramps dark -> light, light
from the top and front). Rotation-free models (the swan's curved neck is stepped boxes), so no bone sign to get wrong.
Owner brief 2026-10-02: no gold or silver on the animals; the swan is plain white, the squirrel brown. Not seen in game yet.
"""
import json
import sys
from pathlib import Path
from PIL import Image

RP = Path(__file__).resolve().parents[1] / "lothlorien_rp"
CLEAR = (0, 0, 0, 0)


def hexc(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4)) + (255,)


def ramp(hexes):
    return [hexc(c) for c in hexes]


def pick(r, k):
    return r[max(0, min(len(r) - 1, k))]


def box_extent(size):
    w, h, d = size
    return int(2 * (w + d)), int(h + d)


def pack(cubes, tw, th):
    items = sorted(cubes, key=lambda c: -box_extent(c[3])[1])
    x = y = shelf = 0
    out = {}
    for name, _b, _o, size, _r in items:
        bw, bh = box_extent(size)
        if x + bw > tw:
            x, y, shelf = 0, y + shelf, 0
        out[name] = (x, y)
        x += bw
        shelf = max(shelf, bh)
    if y + shelf > th:
        raise SystemExit(f"texture overflow: {y + shelf} > {th}")
    return out


def geometry(ident, bones_def, cubes, tw, th, bounds):
    uvs = pack(cubes, tw, th)
    bones = []
    for bname, (parent, pivot) in bones_def.items():
        b = {"name": bname, "pivot": pivot}
        if parent:
            b["parent"] = parent
        bones.append(b)
    for name, bone, origin, size, _r in cubes:
        entry = next(b for b in bones if b["name"] == bone)
        entry.setdefault("cubes", []).append({"origin": origin, "size": size, "uv": list(uvs[name])})
    geo = {"format_version": "1.12.0", "minecraft:geometry": [{
        "description": {"identifier": ident, "texture_width": tw, "texture_height": th,
                        "visible_bounds_width": bounds[0], "visible_bounds_height": bounds[1],
                        "visible_bounds_offset": [0, bounds[1] / 2 - 0.25, 0]},
        "bones": bones}]}
    return geo, uvs


def faces(u, v, size):
    w, h, d = (int(s) for s in size)
    return {
        "top": (u + d, v, w, d), "bottom": (u + d + w, v, w, d),
        "east": (u, v + d, d, h), "north": (u + d, v + d, w, h),
        "west": (u + d + w, v + d, d, h), "south": (u + 2 * d + w, v + d, w, h),
    }


class Painter:
    def __init__(self, tw, th):
        self.img = Image.new("RGBA", (tw, th), CLEAR)

    def fill(self, rect, fn):
        x0, y0, w, h = rect
        for j in range(h):
            for i in range(w):
                self.img.putpixel((x0 + i, y0 + j), fn(i, j, w, h))

    def side(self, f, fn):
        """Both side faces from a profile fn(fi, j, w, h); fi counts from the FRONT (east has the front on the right)."""
        self.fill(f["west"], lambda i, j, w, h: fn(i, j, w, h))
        self.fill(f["east"], lambda i, j, w, h: fn(w - 1 - i, j, w, h))

    def solid(self, f, r, k):
        for face in f.values():
            self.fill(face, lambda i, j, w, h: pick(r, k))


def check_painted(pt, cubes, uvs):
    """Every face texel must be painted (a gap shows as a see-through hole)."""
    for cname, _b, _o, size, _r in cubes:
        for face, (x, y, w, h) in faces(*uvs[cname], size).items():
            for j in range(h):
                for i in range(w):
                    if pt.img.getpixel((x + i, y + j))[3] == 0:
                        raise SystemExit(f"{cname}.{face}: unpainted texel")


# ----------------------------------------------------------------------------------------------- swan
SW, SH = 64, 64
# white plumage: cool violet shadows, warm highlights, dark -> light
WHITE = ramp(("#aab0c4", "#c8cddc", "#e2e6f0", "#f4f6fa", "#ffffff"))
WING = ramp(("#9aa1b8", "#b8bfd2", "#d4d9e6", "#eceff6", "#fbfcfe"))
BEAK = ramp(("#a8421a", "#d8642a", "#f08c3c", "#f8b25a"))
BLACK = ramp(("#14111a", "#2a2530", "#3c3644"))
LEG = ramp(("#1a161e", "#2c2632", "#40384a"))
EYE = hexc("#0b090c")

SWAN_BONES = {
    "body": (None, [0, 3, 0]),
    "neck": ("body", [0, 9, -5]),
    "neck_up": ("neck", [0, 13, -5.5]),
    "head": ("neck_up", [0, 17, -7]),
    "tail": ("body", [0, 5, 6]),
    "wing_l": ("body", [4, 8, -3]),
    "wing_r": ("body", [-4, 8, -3]),
    "leg_l": ("body", [2, 3, 0]),
    "leg_r": ("body", [-2, 3, 0]),
}
# (name, bone, origin, size, role); whole-number sizes (box UV)
SWAN_CUBES = [
    ("body", "body", [-4, 3, -6], [8, 6, 12], "body"),
    ("neck", "neck", [-1, 8, -6], [2, 5, 2], "neck"),
    ("neck_up", "neck_up", [-1, 13, -6.5], [2, 4, 2], "neck"),
    ("head", "head", [-1.5, 16.5, -9], [3, 3, 4], "head"),
    ("beak", "head", [-1, 16, -12], [2, 2, 3], "beak"),
    ("tail", "tail", [-2, 6, 5], [4, 2, 4], "tail"),
    ("wing_l", "wing_l", [4, 4, -4], [1, 5, 9], "wing"),
    ("wing_r", "wing_r", [-5, 4, -4], [1, 5, 9], "wing"),
    ("leg_l", "leg_l", [1, 0, -1], [2, 3, 2], "leg"),
    ("leg_r", "leg_r", [-3, 0, -1], [2, 3, 2], "leg"),
]


def swan_paint(pt, name, f):
    if name == "body":
        pt.fill(f["top"], lambda i, j, w, h: pick(WHITE, 3 if j % 4 == 0 else 4))
        pt.fill(f["bottom"], lambda i, j, w, h: pick(WHITE, 0))
        # sides: bright on top, shade towards the water line; a lighter breast at the front
        pt.side(f, lambda fi, j, w, h: pick(WHITE, 4 - (j * 3) // h + (1 if fi < 2 and j > 1 else 0)))
        pt.fill(f["north"], lambda i, j, w, h: pick(WHITE, 4 - j // 2))
        pt.fill(f["south"], lambda i, j, w, h: pick(WHITE, 2 + (j < 2)))
    elif name.startswith("neck"):
        pt.fill(f["top"], lambda i, j, w, h: pick(WHITE, 4))
        pt.fill(f["bottom"], lambda i, j, w, h: pick(WHITE, 1))
        pt.side(f, lambda fi, j, w, h: pick(WHITE, 3 if fi == 0 else 2))
        pt.fill(f["north"], lambda i, j, w, h: pick(WHITE, 4))
        pt.fill(f["south"], lambda i, j, w, h: pick(WHITE, 2))
    elif name == "head":
        def side(fi, j, w, h):
            if j == 1 and fi == 0:
                return EYE  # eye at the front edge, inside the black lore
            if j == 1 and fi == 1:
                return pick(BLACK, 1)
            if fi == 0 and j in (0, 2):
                return pick(BLACK, 0 if j == 0 else 1)
            return pick(WHITE, 4 if j == 0 else 3)
        pt.side(f, side)
        pt.fill(f["top"], lambda i, j, w, h: pick(WHITE, 4))
        pt.fill(f["bottom"], lambda i, j, w, h: pick(WHITE, 2))
        pt.fill(f["north"], lambda i, j, w, h: pick(BLACK, 1) if j == 1 else pick(WHITE, 3))  # black lore band
        pt.fill(f["south"], lambda i, j, w, h: pick(WHITE, 3))
    elif name == "beak":
        pt.fill(f["top"], lambda i, j, w, h: pick(BEAK, 2 if j > 0 else 0))  # dark knob at the base
        pt.fill(f["bottom"], lambda i, j, w, h: pick(BEAK, 1))
        pt.side(f, lambda fi, j, w, h: pick(BEAK, (1 + (j == 0)) if fi > 0 else 0))
        pt.fill(f["north"], lambda i, j, w, h: pick(BEAK, 3 if j == 0 else 2))
        pt.fill(f["south"], lambda i, j, w, h: pick(BEAK, 0))
    elif name == "tail":
        pt.fill(f["top"], lambda i, j, w, h: pick(WING, 4 if j == h - 1 else 3))
        pt.fill(f["bottom"], lambda i, j, w, h: pick(WING, 1))
        pt.side(f, lambda fi, j, w, h: pick(WING, 2 + (fi == w - 1)))
        pt.fill(f["north"], lambda i, j, w, h: pick(WING, 2))
        pt.fill(f["south"], lambda i, j, w, h: pick(WING, 4))
    elif name.startswith("wing"):
        # folded wing: rows of feathers, a little darker towards the bottom edge, bright tips at the rear
        outer = "west" if name == "wing_l" else "east"
        inner = "east" if name == "wing_l" else "west"
        pt.fill(f[outer], lambda i, j, w, h: pick(WING, 3 + (j % 2) - (j >= h - 2) + (i >= w - 2 and name == "wing_l")))
        pt.fill(f[inner], lambda i, j, w, h: pick(WING, 1 + (j % 2)))
        pt.fill(f["top"], lambda i, j, w, h: pick(WING, 4))
        pt.fill(f["bottom"], lambda i, j, w, h: pick(WING, 0))
        pt.fill(f["north"], lambda i, j, w, h: pick(WING, 2))
        pt.fill(f["south"], lambda i, j, w, h: pick(WING, 3))
    elif name.startswith("leg"):
        for k, face in f.items():
            pt.fill(face, lambda i, j, w, h, k=k: pick(LEG, 2 if j == h - 1 else (0 if k == "bottom" else 1)))


def build_swan():
    geo, uvs = geometry("geometry.lothlorien.swan", SWAN_BONES, SWAN_CUBES, SW, SH, (2.5, 2.0))
    pt = Painter(SW, SH)
    for cname, _b, _o, size, _r in SWAN_CUBES:
        swan_paint(pt, cname, faces(*uvs[cname], size))
    check_painted(pt, SWAN_CUBES, uvs)
    return geo, pt.img


# ------------------------------------------------------------------------------------------- squirrel
QW, QH = 32, 32
COATS = {
    # back / dark flank stripe / pale flank stripe / belly / tail, dark -> light (shadows lean violet, highlights warm)
    "brown": {
        "back": ramp(("#432a1c", "#5e3c26", "#7c5232", "#9a6c42")),
        "belly": ramp(("#b89870", "#d2b98e", "#e6d3ac")),
        "stripe": ramp(("#d8c294", "#ecdcb4")),
        "tail": ramp(("#432a1c", "#5e3c26", "#7c5232", "#b88c58")),
    },
    "russet": {
        "back": ramp(("#522818", "#7a3c20", "#a0522c", "#c06e3a")),
        "belly": ramp(("#c4a074", "#dcc096", "#eed8b2")),
        "stripe": ramp(("#e0c294", "#f2dcb0")),
        "tail": ramp(("#522818", "#7a3c20", "#a0522c", "#d8924e")),
    },
    "dark": {
        "back": ramp(("#2a1e1c", "#3e2c26", "#563e30", "#705040")),
        "belly": ramp(("#a8906c", "#c0aa84", "#d6c49c")),
        "stripe": ramp(("#c0aa84", "#d6c49c")),
        "tail": ramp(("#2a1e1c", "#3e2c26", "#563e30", "#907058")),
    },
}
NOSE = hexc("#1c1214")
EAR_IN = hexc("#b87c74")
EYE_Q = hexc("#0a0708")

SQUIRREL_BONES = {
    "body": (None, [0, 2, 0]),
    "head": ("body", [0, 4, -3.5]),
    "tail": ("body", [0, 4, 3.5]),
    "leg_fl": ("body", [1.5, 2, -2.5]),
    "leg_fr": ("body", [-1.5, 2, -2.5]),
    "leg_bl": ("body", [1.5, 2, 2.5]),
    "leg_br": ("body", [-1.5, 2, 2.5]),
}
SQUIRREL_CUBES = [
    ("body", "body", [-2, 2, -3.5], [4, 4, 7], "body"),
    ("head", "head", [-1.5, 3.5, -6.5], [3, 3, 3], "head"),
    ("nose", "head", [-0.5, 3.5, -7.5], [1, 1, 1], "nose"),
    ("ear_l", "head", [0.5, 6.5, -5.5], [1, 1, 1], "ear"),
    ("ear_r", "head", [-1.5, 6.5, -5.5], [1, 1, 1], "ear"),
    ("tail_a", "tail", [-1, 4, 3.5], [2, 2, 3], "tail"),
    ("tail_b", "tail", [-1.5, 4, 6.5], [3, 5, 2], "tail"),
    ("leg_fl", "leg_fl", [1, 0, -3], [1, 2, 1], "leg"),
    ("leg_fr", "leg_fr", [-2, 0, -3], [1, 2, 1], "leg"),
    ("leg_bl", "leg_bl", [1, 0, 2], [1, 2, 1], "leg"),
    ("leg_br", "leg_br", [-2, 0, 2], [1, 2, 1], "leg"),
]


def squirrel_paint(pt, pal, name, f):
    b, belly, stripe, tail = pal["back"], pal["belly"], pal["stripe"], pal["tail"]
    if name == "body":
        # top: darker flanks, a lighter saddle down the middle
        pt.fill(f["top"], lambda i, j, w, h: pick(b, 3 if i in (1, 2) else 2))
        pt.fill(f["bottom"], lambda i, j, w, h: pick(belly, 0))
        # side: back colour, pale stripe, dark stripe, cream belly: the ground squirrel's stripes
        def side(fi, j, w, h):
            return [pick(b, 2), pick(stripe, 1), pick(b, 0), pick(belly, 2 if fi < 3 else 1)][j]
        pt.side(f, side)
        pt.fill(f["north"], lambda i, j, w, h: pick(b, 2) if j < 2 else pick(belly, 2))
        pt.fill(f["south"], lambda i, j, w, h: pick(b, 1))
    elif name == "head":
        def side(fi, j, w, h):
            if j == 1 and fi == 0:
                return EYE_Q
            if j == 2:
                return pick(belly, 2)  # pale cheek and chin
            return pick(b, 3 if j == 0 else 2)
        pt.side(f, side)
        pt.fill(f["top"], lambda i, j, w, h: pick(b, 3 if j else 2))
        pt.fill(f["bottom"], lambda i, j, w, h: pick(belly, 1))
        pt.fill(f["north"], lambda i, j, w, h: pick(belly, 2) if j == 2 else (pick(b, 2) if j == 0 else pick(b, 3)))
        pt.fill(f["south"], lambda i, j, w, h: pick(b, 1))
    elif name == "nose":
        pt.solid(f, [NOSE], 0)
    elif name.startswith("ear"):
        pt.solid(f, b, 1)
        pt.fill(f["north"], lambda i, j, w, h: EAR_IN)
    elif name.startswith("tail"):
        # banded fur, lighter tip
        for k, face in f.items():
            pt.fill(face, lambda i, j, w, h, k=k: pick(tail, 3 if (name == "tail_b" and k == "top") else (1 + (j % 2) + (1 if name == "tail_b" and j < 2 else 0))))
    elif name.startswith("leg"):
        for k, face in f.items():
            pt.fill(face, lambda i, j, w, h, k=k: pick(b, 2 if j == h - 1 else (0 if k == "bottom" else 1)))


def build_squirrel(coat):
    geo, uvs = geometry("geometry.lothlorien.squirrel", SQUIRREL_BONES, SQUIRREL_CUBES, QW, QH, (1.0, 1.0))
    pt = Painter(QW, QH)
    for cname, _b, _o, size, _r in SQUIRREL_CUBES:
        squirrel_paint(pt, COATS[coat], cname, faces(*uvs[cname], size))
    check_painted(pt, SQUIRREL_CUBES, uvs)
    return geo, pt.img


def main():
    (RP / "models/entity").mkdir(parents=True, exist_ok=True)
    (RP / "textures/entity/swan").mkdir(parents=True, exist_ok=True)
    (RP / "textures/entity/squirrel").mkdir(parents=True, exist_ok=True)
    imgs = {}
    geo, img = build_swan()
    img.save(RP / "textures/entity/swan/swan.png")
    (RP / "models/entity/swan.geo.json").write_text(json.dumps(geo, indent=2) + "\n")
    imgs["swan"] = img
    for coat in COATS:
        geo, img = build_squirrel(coat)
        img.save(RP / f"textures/entity/squirrel/squirrel_{coat}.png")
        imgs[f"squirrel_{coat}"] = img
    (RP / "models/entity/squirrel.geo.json").write_text(json.dumps(geo, indent=2) + "\n")
    if "--preview" in sys.argv:
        out = Path(sys.argv[sys.argv.index("--preview") + 1])
        out.mkdir(parents=True, exist_ok=True)
        for name, img in imgs.items():
            img.resize((img.width * 10, img.height * 10), Image.NEAREST).save(out / f"{name}.png")
    print("swan and squirrel art written")


if __name__ == "__main__":
    main()
