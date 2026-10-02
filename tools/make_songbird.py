"""Generates the songbird art: geometry and the three plumage textures (blue, yellow, pink).

    python -B mods/lothlorien/tools/make_songbird.py [--preview DIR]

Output (overwritten every run): lothlorien_rp/models/entity/songbird.geo.json,
lothlorien_rp/textures/entity/songbird/{songbird_silver,songbird_gold}.png. Same method as make_deer.py (shelf-packed
box UV, every face painted by rule, colour ramps dark -> light, light from top and front). Not seen in game yet.
"""
import json
import sys
from pathlib import Path
from PIL import Image

RP = Path(__file__).resolve().parents[1] / "lothlorien_rp"
TEX = 32


def hexc(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4)) + (255,)


def ramp(hexes):
    return [hexc(c) for c in hexes]


# back / wing / belly / tail ramps, dark -> light (shadows shift to violet, highlights to yellow)
PLUMAGE = {
    "blue": {
        "back": ramp(("#3f78b0", "#5a9ad0", "#7ab8e6", "#a4d4f4")),
        "wing": ramp(("#2c4f86", "#3f78b0", "#5a9ad0", "#e4f2fc")),
        "belly": ramp(("#b8c8d8", "#d4e2ee", "#e8f2f8", "#f6fbfe")),
        "cap": ramp(("#2c4f86", "#3a68a0", "#5a9ad0")),
        "tail": ramp(("#2c4f86", "#3f78b0", "#5a9ad0", "#e4f2fc")),
    },
    "yellow": {
        "back": ramp(("#a88a1e", "#cfae2a", "#ecd048", "#f8e87a")),
        "wing": ramp(("#6a5a24", "#8e7a28", "#cfae2a", "#fff6c0")),
        "belly": ramp(("#e8d890", "#f4e8a8", "#fbf2c4", "#fffbe0")),
        "cap": ramp(("#6a5a24", "#8e7a28", "#cfae2a")),
        "tail": ramp(("#6a5a24", "#8e7a28", "#cfae2a", "#fff6c0")),
    },
    "pink": {
        "back": ramp(("#a8527a", "#c8729a", "#e494b8", "#f4b8d0")),
        "wing": ramp(("#74385c", "#a8527a", "#c8729a", "#fde4ee")),
        "belly": ramp(("#d8bcc8", "#ecd4dc", "#f6e6ec", "#fdf4f7")),
        "cap": ramp(("#74385c", "#94466c", "#c8729a")),
        "tail": ramp(("#74385c", "#a8527a", "#c8729a", "#fde4ee")),
    },
}
BEAK = ramp(("#7a4a1a", "#c8782a", "#e69a3c"))
LEG = ramp(("#6e4a3e", "#9a6e5a"))
EYE = hexc("#0e0b0c")
CLEAR = (0, 0, 0, 0)

# bones: name -> (parent, pivot, rotation)
BONES = {
    "body": (None, [0, 3, 0], None),
    "head": ("body", [0, 5, -2.5], None),
    "tail": ("body", [0, 4, 2.5], [15, 0, 0]),
    "wing_l": ("body", [1.5, 6, -0.5], None),
    "wing_r": ("body", [-1.5, 6, -0.5], None),
    "leg_l": ("body", [1, 3, 0], None),
    "leg_r": ("body", [-1, 3, 0], None),
}
# (name, bone, origin, size, role); whole-number sizes only (box UV, see bedrock-mobs client.md)
CUBES = [
    ("body", "body", [-1.5, 3, -2.5], [3, 3, 5], "body"),
    ("head", "head", [-1.5, 5, -4.5], [3, 3, 3], "head"),
    ("beak", "head", [-0.5, 5.5, -6.5], [1, 1, 2], "beak"),
    ("tail", "tail", [-1, 3, 2.5], [2, 1, 4], "tail"),
    ("wing_l", "wing_l", [1.5, 3, -2], [1, 3, 4], "wing"),
    ("wing_r", "wing_r", [-2.5, 3, -2], [1, 3, 4], "wing"),
    ("leg_l", "leg_l", [0.5, 1, -0.5], [1, 2, 1], "leg"),
    ("leg_r", "leg_r", [-1.5, 1, -0.5], [1, 2, 1], "leg"),
]


def box_extent(size):
    w, h, d = size
    return int(2 * (w + d)), int(h + d)


def pack(cubes):
    items = sorted(cubes, key=lambda c: -box_extent(c[3])[1])
    x = y = shelf = 0
    out = {}
    for name, _b, _o, size, _r in items:
        bw, bh = box_extent(size)
        if x + bw > TEX:
            x, y, shelf = 0, y + shelf, 0
        out[name] = (x, y)
        x += bw
        shelf = max(shelf, bh)
    if y + shelf > TEX:
        raise SystemExit(f"texture overflow: {y + shelf} > {TEX}")
    return out


def geometry():
    uvs = pack(CUBES)
    bones = []
    for bname, (parent, pivot, rot) in BONES.items():
        b = {"name": bname, "pivot": pivot}
        if parent:
            b["parent"] = parent
        if rot:
            b["rotation"] = rot
        bones.append(b)
    for name, bone, origin, size, _r in CUBES:
        entry = next(b for b in bones if b["name"] == bone)
        entry.setdefault("cubes", []).append({"origin": origin, "size": size, "uv": list(uvs[name])})
    geo = {"format_version": "1.12.0", "minecraft:geometry": [{
        "description": {"identifier": "geometry.lothlorien.songbird", "texture_width": TEX, "texture_height": TEX,
                        "visible_bounds_width": 2, "visible_bounds_height": 1.5, "visible_bounds_offset": [0, 0.5, 0]},
        "bones": bones}]}
    return geo, uvs


def faces(u, v, size):
    w, h, d = (int(s) for s in size)
    return {
        "top": (u + d, v, w, d), "bottom": (u + d + w, v, w, d),
        "east": (u, v + d, d, h), "north": (u + d, v + d, w, h),
        "west": (u + d + w, v + d, d, h), "south": (u + 2 * d + w, v + d, w, h),
    }


def pick(r, k):
    return r[max(0, min(len(r) - 1, k))]


class Painter:
    def __init__(self, pal):
        self.pal = pal
        self.img = Image.new("RGBA", (TEX, TEX), CLEAR)

    def fill(self, rect, fn):
        x0, y0, w, h = rect
        for j in range(h):
            for i in range(w):
                self.img.putpixel((x0 + i, y0 + j), fn(i, j, w, h))

    def side(self, f, fn):
        """Paint both side faces from a profile fn(fi, j, w, h); fi counts from the FRONT (east has it on the right)."""
        self.fill(f["west"], lambda i, j, w, h: fn(i, j, w, h))
        self.fill(f["east"], lambda i, j, w, h: fn(w - 1 - i, j, w, h))

    def body(self, f):
        p = self.pal
        self.fill(f["top"], lambda i, j, w, h: pick(p["back"], 2 if (i + j) % 4 else 3))
        self.fill(f["bottom"], lambda i, j, w, h: pick(p["belly"], 1))
        # back colour fades into belly colour from the top down; breast (front) a touch lighter
        self.side(f, lambda fi, j, w, h: pick(p["back"], 2 - (j > 0)) if j == 0 else (
            pick(p["belly"], 2 if fi < 2 else 1) if j >= 2 else pick(p["back"], 1)))
        self.fill(f["north"], lambda i, j, w, h: pick(p["belly"], 2 + (j == 0)) if j > 0 else pick(p["back"], 2))
        self.fill(f["south"], lambda i, j, w, h: pick(p["back"], 1 if j else 2))

    def head(self, f):
        p = self.pal

        def side(fi, j, w, h):
            if j == 1 and fi == 0:
                return EYE
            if j == 0 and fi == 0:
                return pick(p["cap"], 2)
            if j == 2:
                return pick(p["belly"], 2)  # pale throat and cheek
            return pick(p["cap"], 1 if j == 0 else 2)
        self.side(f, side)
        self.fill(f["top"], lambda i, j, w, h: pick(p["cap"], 1 + (j == 0)))
        self.fill(f["bottom"], lambda i, j, w, h: pick(p["belly"], 1))
        self.fill(f["north"], lambda i, j, w, h: pick(p["belly"], 2) if j == 2 else pick(p["cap"], 2))
        self.fill(f["south"], lambda i, j, w, h: pick(p["cap"], 1))

    def beak(self, f):
        for k, t in (("top", 2), ("north", 1), ("east", 1), ("west", 1), ("south", 0), ("bottom", 0)):
            self.fill(f[k], lambda i, j, w, h, t=t: pick(BEAK, t))

    def tail(self, f):
        p = self.pal
        self.fill(f["top"], lambda i, j, w, h: pick(p["tail"], 2 if j < h - 1 else 3))  # light tip
        self.fill(f["bottom"], lambda i, j, w, h: pick(p["tail"], 1 if j < h - 1 else 3))
        self.side(f, lambda fi, j, w, h: pick(p["tail"], 2 if fi < w - 1 else 3))
        self.fill(f["north"], lambda i, j, w, h: pick(p["tail"], 1))
        self.fill(f["south"], lambda i, j, w, h: pick(p["tail"], 3))

    def wing(self, f):
        p = self.pal
        # outer face = wing coverts darker at the shoulder, a light feather bar near the tip (bottom rows)
        def outer(fi, j, w, h):
            return pick(p["wing"], 3 if j == h - 1 else (1 + (fi % 2)) if j >= 1 else 2)
        self.fill(f["east"], lambda i, j, w, h: pick(p["wing"], 3 if j == h - 1 else 1 + (i % 2)))
        self.fill(f["west"], lambda i, j, w, h: pick(p["wing"], 3 if j == h - 1 else 1 + (i % 2)))
        self.fill(f["top"], lambda i, j, w, h: pick(p["back"], 2))
        self.fill(f["bottom"], lambda i, j, w, h: pick(p["wing"], 1))
        self.fill(f["north"], lambda i, j, w, h: pick(p["wing"], 2))
        self.fill(f["south"], lambda i, j, w, h: pick(p["wing"], 2))

    def leg(self, f):
        for k in f:
            self.fill(f[k], lambda i, j, w, h: pick(LEG, 1 if j == 0 else 0))


def build(name):
    geo, uvs = geometry()
    pt = Painter(PLUMAGE[name])
    for cname, _b, _o, size, role in CUBES:
        getattr(pt, role)(faces(*uvs[cname], size))
    # every face texel must be painted (a gap shows as a see-through hole)
    for cname, _b, _o, size, _r in CUBES:
        for face, (x, y, w, h) in faces(*uvs[cname], size).items():
            for j in range(h):
                for i in range(w):
                    if pt.img.getpixel((x + i, y + j))[3] == 0:
                        raise SystemExit(f"{cname}.{face}: unpainted texel")
    return geo, pt.img


def main():
    (RP / "models/entity").mkdir(parents=True, exist_ok=True)
    (RP / "textures/entity/songbird").mkdir(parents=True, exist_ok=True)
    imgs = {}
    for name in PLUMAGE:
        geo, img = build(name)
        img.save(RP / f"textures/entity/songbird/songbird_{name}.png")
        imgs[name] = img
    (RP / "models/entity/songbird.geo.json").write_text(json.dumps(geo, indent=2) + "\n")
    if "--preview" in sys.argv:
        out = Path(sys.argv[sys.argv.index("--preview") + 1])
        out.mkdir(parents=True, exist_ok=True)
        for name, img in imgs.items():
            img.resize((img.width * 12, img.height * 12), Image.NEAREST).save(out / f"songbird_{name}.png")
    print("songbird art written")


if __name__ == "__main__":
    main()
