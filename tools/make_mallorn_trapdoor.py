"""Mallorn trapdoor: texture (16x16, silver + heartwood) and the trapdoor geometry's edge UVs.

  python -B tools/make_mallorn_trapdoor.py [--out DIR] [--no-geo]

The star window (owner's pick, final 2026-10-01): a gold eight-pointed star (Star of Earendil as a sparkle: four-point
body with concave sides, a short diagonal point at each corner) in a silver ring, sky between, inside the door's
painted frame. Chosen over a star with gold corner leaves and a star-shaped opening in boards (not kept).

Same style as the door (tools/make_mallorn_door.py, whose canvas and shading this reuses): flat like vanilla, a
painted 2-texel frame (outline + frame line), cutouts (render method alpha_test_single_sided), silver art in the
PLANK/BARK/GOLD palette so the heartwood twin is an exact recolour. The geometry is one 16x16x2.9 cube: up face = the
texture, down face the same turned 180 degrees; its four edge faces stretch the frame line (row 1) over their depth,
so every texel inside the frame may be cut through (checked).
"""
import argparse
import json
import math
import os
import sys

from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import make_mallorn_door as door  # noqa: E402
from make_mallorn_wood import recolour  # noqa: E402

N = 16
C = 8.0                 # centre of the tile (between texels 7 and 8)
RING = (4.6, 5.7)       # inner and outer radius of the silver ring (texels from the centre)
STAR = [                # 12x12, drawn at (2, 2); shading by position in star_window()
    "............",
    ".....##.....",
    ".#...##...#.",
    "..#.####.#..",
    "...######...",
    ".##########.",
    ".##########.",
    "...######...",
    "..#.####.#..",
    ".#...##...#.",
    ".....##.....",
    "............",
]


def polar(x, y):
    dx, dy = x + 0.5 - C, y + 0.5 - C
    return dx, dy, math.hypot(dx, dy)


def frame(c):
    """Painted frame: dark outline + frame line on all four sides (rows 16-31 of the door canvas are filler)."""
    c.rect("O", 0, 16, 15, 31)
    c.rect("O", 0, 0, 15, 0)
    c.rect("O", 0, 15, 15, 15)
    c.rect("O", 0, 0, 0, 15)
    c.rect("O", 15, 0, 15, 15)
    c.rect("R", 1, 1, 14, 1)
    c.rect("R", 1, 14, 14, 14)
    c.rect("F", 1, 2, 1, 13)
    c.rect("F", 14, 2, 14, 13)


def star_window():
    c = door.Canvas()
    for y in range(2, 14):
        for x in range(2, 14):
            if RING[0] <= polar(x, y)[2] < RING[1]:
                c.set(x, y, "T")
    for r, line in enumerate(STAR):              # lit top-left half (G), shaded bottom-right half (g), core (Y)
        for i, ch in enumerate(line):
            if ch == "#":
                dx, dy, rr = polar(2 + i, 2 + r)
                c.set(2 + i, 2 + r, "Y" if rr < 1 else "G" if dx + dy < 0 else "g")
    frame(c)
    return c


def build():
    px = door.shade(star_window())
    im = Image.new("RGBA", (N, N), (0, 0, 0, 0))
    for y in range(N):
        for x in range(N):
            if px[y][x] is not None:
                im.putpixel((x, y), px[y][x] + (255,))
    for i in range(N):                           # the edge faces show the frame line: opaque
        for x, y in ((i, 1), (1, i)):
            assert im.getpixel((x, y))[3] == 255, f"texel ({x},{y}) is on an edge face"
    return im


def write_geometry(path):
    """Point the four edge faces at the frame line (row 1), stretched over the 2.9-texel depth."""
    with open(path) as f:
        geo = json.load(f)
    cube = geo["minecraft:geometry"][0]["bones"][0]["cubes"][0]
    for face in ("north", "east", "south", "west"):
        cube["uv"][face] = {"uv": [16, 2], "uv_size": [-16, -1]}
    with open(path, "w", newline="\n") as f:
        json.dump(geo, f, indent=2)
        f.write("\n")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", help="textures folder (default: the pack's lothlorien_rp/textures)")
    ap.add_argument("--no-geo", action="store_true", help="do not touch the geometry")
    a = ap.parse_args()
    here = os.path.dirname(os.path.abspath(__file__))
    rp = os.path.join(here, "..", "lothlorien_rp")
    out = os.path.join(a.out or os.path.join(rp, "textures"), "blocks")
    os.makedirs(out, exist_ok=True)
    im = build()
    im.save(os.path.join(out, "mallorn_trapdoor.png"))
    recolour(im).save(os.path.join(out, "mallorn_heartwood_trapdoor.png"))
    print("wrote silver + heartwood trapdoor textures")
    if not a.no_geo and not a.out:
        write_geometry(os.path.join(rp, "models", "blocks", "mallorn_trapdoor.geo.json"))
        print("trapdoor edge faces -> frame line")


if __name__ == "__main__":
    main()
