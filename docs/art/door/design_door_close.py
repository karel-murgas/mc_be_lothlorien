"""Oblique close-up of double doors in a planks wall, one per variant.
Run from the workspace root: python -B mods/lothlorien/docs/art/door/design_door_close.py OUT.png VARIANT ...
"""
import sys
sys.path.insert(0, "mods/lothlorien/docs/art/door"); sys.path.insert(0, "mods/lothlorien/tools")
import render_door_3d as r, make_mallorn_door as md
from PIL import Image
planks = Image.open(r.P + "mallorn_planks.png").convert("RGBA")
ims = []
for v in sys.argv[2:]:
    t, b, _, _ = md.build(v)
    im = r.render([(t, b)] * 2, planks, 12)
    ims.append(im.crop((int(12 * 12), int(12 * 18), int(12 * 55), int(12 * 56))))
sheet = Image.new("RGBA", (sum(i.width + 10 for i in ims), ims[0].height), (40, 44, 52, 255))
x = 0
for i in ims:
    sheet.alpha_composite(i, (x, 0)); x += i.width + 10
sheet.save(sys.argv[1])
