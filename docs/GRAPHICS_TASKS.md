# Lothlórien — graphics tasks

Work list for whoever makes the art (image generator + manual cleanup). Each step lists the
files to produce, where they go, and what the code assumes about them. Textures live in
`lothlorien_rp/textures/`. **Claude appends requirements to the "Requirements" section of a step
whenever a code change creates a new constraint on the art** — read that section before starting a step.

General rules for every texture: PNG, 16×16 unless a step says otherwise, tileable on all four
sides for block textures, no per-tile lighting baked in (Minecraft lights it), replace the file
in place (same name) so no JSON changes are needed.

---

## Step 1 — Mallorn wood set (Phase 3)

Currently **placeholders** copied from vanilla: pale oak wood, yellow poplar leaves. Replace each
file with the real Mallorn art. Every block below already exists in the pack and uses these files.

| File | Used by | Placeholder source |
|---|---|---|
| `textures/blocks/mallorn_log_side.png` | log sides, **wood (all six faces)** | `pale_oak_log_side` |
| `textures/blocks/mallorn_log_top.png` | log cut ends (top/bottom) | `pale_oak_log_top` |
| `textures/blocks/mallorn_stripped_log_side.png` | stripped log sides, **stripped wood (all faces)** | `stripped_pale_oak_log_side` |
| `textures/blocks/mallorn_stripped_log_top.png` | stripped log cut ends | `stripped_pale_oak_log_top` |
| `textures/blocks/mallorn_planks.png` | planks, stairs, slab, double slab, fence, fence gate, button, pressure plate | `pale_oak_planks` |
| `textures/blocks/mallorn_door_bottom.png` | door, lower half | `pale_oak_door_bottom` |
| `textures/blocks/mallorn_door_top.png` | door, upper half | `pale_oak_door_top` |
| `textures/blocks/mallorn_trapdoor.png` | trapdoor | `pale_oak_trapdoor` |
| `textures/blocks/mallorn_leaves.png` | leaves | `yellow_poplar_leaves` |
| `textures/items/mallorn_door.png` | door item icon (2D, like vanilla doors) | `pale_oak_door` (item) |

Design intent (from `design/lothlorien.md`): silver-grey bark, gold leaves; planks ideally with
straight grain rather than zig-zag; fence, door and trapdoor "should look like carved" (they can get
their own textures later — the door and trapdoor already have separate files, the fence/gate share planks).

### Requirements (Claude adds to this list)

- **Leaves: the gold colour is baked into the PNG.** The block applies *no* biome tint, so what is
  in the file is what the player sees, in every biome. Transparent holes stay (alpha 0 pixels): the
  block renders `alpha_test`, so alpha is cutout only (fully opaque or fully transparent, no soft edges).
- **Log side/top must share one wood tone**; the ring layout on `_top` should match the inset of
  `_side`. Logs rotate (axis follows the clicked face) and the side texture is rotated 90° on
  horizontal logs, so avoid grain that only reads correctly in one direction, or accept the rotation.
- **`mallorn_log_side` also skins the "wood" block on all six faces** (bark on every side). It must
  look right on a top face too. Same for `mallorn_stripped_log_side` and stripped wood.
- **Planks are the texture of six other blocks.** Stairs and slabs sample the same 16×16 tile
  (half-height sides use the matching half), and the fence/gate/button/plate models cut small
  pieces out of it. Avoid a single large feature centred on the tile. Check tiling as a 20×20 wall
  and floor (plan, Phase 3).
- **Door halves** are mapped onto a 3-pixel-thick panel: the full 16×16 face is the front and back;
  the edges use the outer 3 columns. Bottom and top must line up at the seam.
- **Trapdoor** renders `alpha_test_single_sided`: transparent pixels (windows, gaps) are allowed.
- **Stripped variants** should read as the same log with the bark removed.
- **Vibrant Visuals / PBR:** the pack declares `pbr`. With no `.texture_set.json` the blocks use
  default material values. Optional later: `<name>.texture_set.json` plus a `_mers` map (metalness,
  emissive, roughness) per tile; vanilla ships both for every wood tile.
- **Higher resolution is possible** (32×32, 64×64) if every texture of the step uses the same
  size; model UVs are relative to the tile. Tell Claude if you go above 16×16 so the docs are updated.

---

## Later steps

Added as phases arrive (Elanor/Niphredil flowers, golden leaf carpet, acorn, Elven lamp, ...).
Mallorn boats (see `NOT_IMPLEMENTED.md`) will need an entity model + texture and item icons.
Claude will append one section per phase with the file list and constraints.
