"""NOT IN USE since 2026-10-02 (flicker still unsolved, see TECHNICAL_NOTES "Flicker"): inset leaf cube for the Mallorn leaf blocks (`geometry.lothlorien.mallorn_leaf_cube`).

Why: vanilla `geometry.full_block` leaves flicker when custom cutout leaf blocks touch (owner, 2026-10-02): the faces of two
neighbouring leaf blocks lie on exactly the same plane and z-fight (data-driven culling of those faces stopped the flicker,
but the canopy looked hollow and needs an experimental toggle). A cube inset by INSET model units on every side keeps every
face drawn (solid canopy, no toggle) but puts the two faces of a pair INSET*2 apart. One bone `leaf`, material instance names
`up`, `down`, `side`. Raise INSET if it still shimmers far away; lower it if seams show.

Record: inset 0.1 (isotropic off) stopped the flicker but showed a slight gap; at 0.05 with `isotropic` on the flicker came back, so the
owner turned the cube off and kept `isotropic` (the trees look better). Not known whether 0.05 or isotropic brought it back.

  python -B tools/make_leaf_cube_geo.py [INSET]     (default 0.05; writes lothlorien_rp/models/blocks/mallorn_leaf_cube.geo.json)
"""
import json
import os
import sys

INSET = float(sys.argv[1]) if len(sys.argv) > 1 else 0.05


def face(material):
    return {"uv": [0, 0], "uv_size": [16, 16], "material_instance": material}


def main():
    size = round(16 - 2 * INSET, 4)
    geo = {"format_version": "1.26.50", "minecraft:geometry": [{
        "description": {"identifier": "geometry.lothlorien.mallorn_leaf_cube", "texture_width": 16, "texture_height": 16},
        "bones": [{"name": "leaf", "pivot": [0, 0, 0], "cubes": [{
            "origin": [-8 + INSET, INSET, -8 + INSET], "size": [size, size, size],
            "uv": {"north": face("side"), "south": face("side"), "east": face("side"), "west": face("side"),
                   "up": face("up"), "down": face("down")}}]}]}]}
    out = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "lothlorien_rp", "models", "blocks", "mallorn_leaf_cube.geo.json")
    with open(out, "w", encoding="utf-8", newline="\n") as f:
        f.write(json.dumps(geo, indent=2) + "\n")
    print("inset", INSET, "size", size)


if __name__ == "__main__":
    main()
