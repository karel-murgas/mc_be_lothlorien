"""Oblique 3D preview of the Mallorn door (frame cubes, recessed panel, knob) set in a planks wall.

Run from the workspace root:
  python -B mods/lothlorien/docs/art/door/render_door_3d.py OUT.png [VARIANT ...]

Rows per variant: single door, double door (silver), double door (heartwood), double door at 3x (distance).
Painter's algorithm over axis-aligned faces in texel space, camera front-right-above (depth recedes up-right).
A preview for shape and depth only; the game's lighting differs. The cube list comes from make_mallorn_door.CUBES.
"""
import sys

from PIL import Image, ImageDraw

sys.path.insert(0, "mods/lothlorien/tools")
import make_mallorn_door as md  # noqa: E402
from make_mallorn_wood import recolour  # noqa: E402

KX, KY = 0.45, 0.35          # screen shift per texel of depth
SHADE = {"front": 1.0, "side": 0.72, "top": 1.12}
P = "mods/lothlorien/lothlorien_rp/textures/blocks/"


def tint(c, f):
    return tuple(min(255, int(v * f)) for v in c[:3]) + (255,)


def door_faces(top, bottom, ox, oy, mirror):
    """Faces of one door (two blocks) as (depth key, kind, list of (polygon in texel space, colour))."""
    faces = []
    for part, tex, by in (("top", top, 0), ("bottom", bottom, 16)):
        for c0, c1, r0, r1, z0, z1, side, strip in md.CUBES[part]:
            d0, d1 = z0 + 8, z1 + 8                      # depth from the door's front plane
            X0, X1 = (16 - c1, 16 - c0) if mirror else (c0, c1)

            def sx(c):                                     # texel column -> screen column of its left edge
                return ox + (16 - c - 1 if mirror else c)

            front = []
            for r in range(r0, r1):
                for c in range(c0, c1):
                    px = tex.getpixel((c, r))
                    if px[3]:
                        x, y = sx(c), oy + by + r
                        front.append(([(x, y, d0), (x + 1, y, d0), (x + 1, y + 1, d0), (x, y + 1, d0)], tint(px, SHADE["front"])))
            faces.append((d0, 1, front))
            side_x = ox + X1                              # the right-hand side face (visible from the right)
            sides = []
            for r in range(r0, r1):
                for j in range(d1 - d0):
                    px = tex.getpixel((min(15, side + min(j, 2)), r))
                    y = oy + by + r
                    sides.append(([(side_x, y, d0 + j), (side_x, y, d0 + j + 1), (side_x, y + 1, d0 + j + 1), (side_x, y + 1, d0 + j)], tint(px, SHADE["side"])))
            faces.append(((d0 + d1) / 2, 0, sides))
            tops = []
            for c in range(c0, c1):
                for j in range(d1 - d0):
                    px = tex.getpixel((c, min(15, strip + min(j, 2))))
                    x, y = sx(c), oy + by + r0
                    tops.append(([(x, y, d0 + j), (x + 1, y, d0 + j), (x + 1, y, d0 + j + 1), (x, y, d0 + j + 1)], tint(px, SHADE["top"])))
            faces.append(((d0 + d1) / 2, 0, tops))
    return faces


def render(doors, wall, scale, heartwood=False):
    """doors: list of (top, bottom) textures; the second one is mirrored (hinge right). Wall 1 block around."""
    n = len(doors)
    bw, bh = n + 2, 4
    w, h = int((bw * 16 + 8) * scale), int((bh * 16 + 8) * scale)
    im = Image.new("RGBA", (w, h))
    dr = ImageDraw.Draw(im)
    for y in range(h):
        dr.line([(0, y), (w, y)], fill=(110 + 60 * y // h, 160 + 40 * y // h, 215, 255))
    off = (2, 6)

    def proj(p):
        x, y, d = p
        return ((x + d * KX + off[0]) * scale, (y - d * KY + off[1]) * scale)

    faces = []
    for i, (top, bottom) in enumerate(doors):
        faces += door_faces(top, bottom, 16 * (i + 1), 16, mirror=i == 1)
    faces.sort(key=lambda f: (-f[0], f[1]))
    for _, _, quads in faces:
        for poly, col in quads:
            dr.polygon([proj(p) for p in poly], fill=col)
    for bx in range(bw):                                   # the wall: front faces flush with the door's front
        for byy in range(bh):
            if 1 <= bx <= n and 1 <= byy <= 2:
                continue
            for r in range(16):
                for c in range(16):
                    x, y = 16 * bx + c, 16 * byy + r
                    dr.polygon([proj(p) for p in [(x, y, 0), (x + 1, y, 0), (x + 1, y + 1, 0), (x, y + 1, 0)]],
                               fill=wall.getpixel((c, r)))
    return im


def main():
    out = sys.argv[1]
    variants = sys.argv[2:] or ["A", "A2", "B"]
    planks = Image.open(P + "mallorn_planks.png").convert("RGBA")
    hplanks = Image.open(P + "mallorn_heartwood_planks.png").convert("RGBA")
    rows = []
    for v in variants:
        top, bottom, _, _ = md.build(v)
        ht, hb = recolour(top), recolour(bottom)
        rows.append([render([(top, bottom)], planks, 7), render([(top, bottom)] * 2, planks, 7),
                     render([(ht, hb)] * 2, hplanks, 7), render([(top, bottom)] * 2, planks, 2.5)])
    W = max(sum(i.width + 16 for i in r) for r in rows) + 16
    H = sum(max(i.height for i in r) + 16 for r in rows) + 16
    sheet = Image.new("RGBA", (W, H), (40, 44, 52, 255))
    d = ImageDraw.Draw(sheet)
    y = 16
    for v, r in zip(variants, rows):
        d.text((4, y), v, fill=(255, 255, 255, 255))
        x = 16
        for i in r:
            sheet.alpha_composite(i, (x, y))
            x += i.width + 16
        y += max(i.height for i in r) + 16
    sheet.save(out)


if __name__ == "__main__":
    main()
