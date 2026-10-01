"""Run from the workspace root: python -B mods/lothlorien/docs/art/door/design_door_wall.py OUT.png [VARIANT ...]
Door variants sheet: single, double (second door mirrored like the hinge-right geometry), heartwood, icons."""
import sys
from PIL import Image, ImageDraw
sys.path.insert(0, "mods/lothlorien/tools")
import make_mallorn_door as md
from make_mallorn_wood import recolour
S = 6
P = "mods/lothlorien/lothlorien_rp/textures/blocks/"
planks = Image.open(P + "mallorn_planks.png").convert("RGBA")
hplanks = Image.open(P + "mallorn_heartwood_planks.png").convert("RGBA")

def scene(doors, wall, scale):
    """doors: list of 16x32 images; drawn in a doorway in a planks wall, sky behind the cutouts."""
    n = len(doors)
    w, h = 16 * (n + 2), 48
    im = Image.new("RGBA", (w, h))
    for y in range(h):  # sky behind: light blue to pale
        for x in range(w):
            im.putpixel((x, y), (120 + y, 165 + y // 2, 215, 255))
    for bx in range(n + 2):
        for by in range(3):
            if 1 <= bx <= n and by >= 1:
                continue
            im.alpha_composite(wall, (16 * bx, 16 * by))
    for i, d in enumerate(doors):
        im.alpha_composite(d, (16 * (i + 1), 16))
    return im.resize((w * scale, h * scale), Image.NEAREST)

rows = []
for v in sys.argv[2:] or [md.VARIANT]:
    top, bottom, icon, full = md.build(v)
    mirror = full.transpose(Image.FLIP_LEFT_RIGHT)
    hfull, hmirror = recolour(full), recolour(full).transpose(Image.FLIP_LEFT_RIGHT)
    parts = [scene([full], planks, S), scene([full, mirror], planks, S), scene([hfull, hmirror], hplanks, S),
             scene([full, mirror], planks, 2)]
    ic = Image.new("RGBA", (16 * 8 + 8, 16 * 8 * 2 + 8), (139, 139, 139, 255))
    ic.alpha_composite(icon.resize((128, 128), Image.NEAREST), (4, 4))
    ic.alpha_composite(recolour(icon).resize((128, 128), Image.NEAREST), (4, 136))
    parts.append(ic)
    rows.append((v, parts))
W = max(sum(p.width + 24 for p in ps) for _, ps in rows) + 40
H = sum(max(p.height for p in ps) + 40 for _, ps in rows) + 10
sheet = Image.new("RGBA", (W, H), (40, 44, 52, 255))
d = ImageDraw.Draw(sheet)
y = 10
for v, ps in rows:
    d.text((10, y), v, fill=(255, 255, 255, 255))
    x = 30
    for p in ps:
        sheet.alpha_composite(p, (x, y + 20)); x += p.width + 24
    y += max(p.height for p in ps) + 40
sheet.save(sys.argv[1])
