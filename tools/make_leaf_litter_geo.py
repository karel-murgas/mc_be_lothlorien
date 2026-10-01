"""Flat geometry for the Mallorn leaf litter and blossoms (owner, 2026-10-01: vanilla leaf litter is totally flat).

The shared ground_cover_N geometries (made by gen_ground_cover.py) are 1 px thick slabs. Litter and blossoms each get
their own geometry.lothlorien.leaf_litter_N / blossom_N (+ _grass twins for the grass overlay): one zero-thickness
8x8 plane per segment, up face only, LITTER_Y above the ground (above the grass overlay plane at 0.1 so it is
never hidden by it). Same quarter UVs as the slabs. Run after gen_ground_cover.py / add_grass_overlay.py:

  python -B tools/make_leaf_litter_geo.py
"""
import json
import os

LITTER_Y = 0.2
FAMILIES = ("leaf_litter", "blossom")
RP = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "lothlorien_rp", "models", "blocks")


def flat(src_cubes):
    out = []
    for c in src_cubes:
        up = c["uv"]["up"]
        out.append({"origin": [c["origin"][0], LITTER_Y, c["origin"][2]], "size": [8, 0, 8],
                    "uv": {"up": {"uv": up["uv"], "uv_size": up["uv_size"]}}})
    return out


def main():
    for family in FAMILIES:
        for n in range(1, 5):
            for suffix in ("", "_grass"):
                with open(os.path.join(RP, f"ground_cover_{n}{suffix}.geo.json"), encoding="utf8") as f:
                    g = json.load(f)
                d = g["minecraft:geometry"][0]
                d["description"]["identifier"] = f"geometry.lothlorien.{family}_{n}{suffix}"
                for bone in d["bones"]:
                    if bone["name"] == "cover":
                        bone["cubes"] = flat(bone["cubes"])
                out = os.path.join(RP, f"{family}_{n}{suffix}.geo.json")
                with open(out, "w", newline="\n", encoding="utf8") as f:
                    f.write(json.dumps(g, indent=2) + "\n")


if __name__ == "__main__":
    main()
