"""Run from the workspace root: python -B mods/lothlorien/docs/art/door/design_door_big.py OUT.png [VARIANT ...]
Big view: per variant single + pair (silver), pair (heartwood) at 10x on sky, and the 1x/2x/3x pair in a wall."""
import sys
from PIL import Image, ImageDraw
sys.path.insert(0, "mods/lothlorien/tools")
import importlib, make_mallorn_door as md
from make_mallorn_wood import recolour
S = 9
def sky(w, h):
    im = Image.new("RGBA", (w, h))
    for y in range(h):
        ImageDraw.Draw(im).line([(0, y), (w, y)], fill=(110 + y * 60 // h, 160 + y * 40 // h, 215, 255))
    return im
variants = sys.argv[2:] or ["A", "B"]
rows = []
for v in variants:
    _, _, icon, full = md.build(v)
    m = full.transpose(Image.FLIP_LEFT_RIGHT)
    h, hm = recolour(full), recolour(m)
    items = []
    for doors in ([full], [full, m], [h, hm]):
        im = sky(16 * len(doors) * S, 32 * S)
        for i, d in enumerate(doors):
            im.alpha_composite(d.resize((16 * S, 32 * S), Image.NEAREST), (16 * S * i, 0))
        items.append(im)
    ic = Image.new("RGBA", (16 * 6, 16 * 12 + 8), (139, 139, 139, 255))
    ic.alpha_composite(icon.resize((96, 96), Image.NEAREST), (0, 0))
    ic.alpha_composite(recolour(icon).resize((96, 96), Image.NEAREST), (0, 104))
    items.append(ic)
    rows.append(items)
W = max(sum(i.width + 20 for i in r) for r in rows) + 20
Hh = sum(max(i.height for i in r) + 20 for r in rows) + 20
sheet = Image.new("RGBA", (W, Hh), (40, 44, 52, 255))
y = 20
for r in rows:
    x = 20
    for i in r:
        sheet.alpha_composite(i, (x, y)); x += i.width + 20
    y += max(i.height for i in r) + 20
sheet.save(sys.argv[1])
