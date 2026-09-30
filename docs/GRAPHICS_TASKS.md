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

---

## Step 1b � Acorn and sapling (Phase 4)

Placeholders: `textures/blocks/mallorn_sapling.png` is vanilla `poplar_sapling`; `textures/items/mallorn_acorn.png`
is a hand-drawn 16�16 acorn. Replace both in place. The sapling is drawn as two crossed planes with
`alpha_test` (cutout, no soft alpha) and should read as a young golden-leaved tree.

---

## Step 6 - Ground identity and flora (Phase 6)

All files below are **placeholders** (vanilla flowers, a gold-tinted vanilla fern, a hand-drawn leaf).
Replace each in place (same name); no JSON changes needed. Plants are two crossed planes with
`alpha_test` (cutout, no soft alpha) and are also used as the 2D inventory icon, so each plant needs
**both** a block texture and an item texture (same picture, may differ in framing).

| Block file (`textures/blocks/`) | Item file (`textures/items/`) | Used by | Placeholder |
|---|---|---|---|
| `mallorn_leaf_carpet.png` | `mallorn_leaf_carpet.png` | golden leaf carpet, 1-4 segments per block | `mallorn_leaves` on dark gold |
| `elanor.png` | `elanor.png` | Elanor, small golden star-shaped flower | vanilla dandelion |
| `niphredil.png` | `niphredil.png` | Niphredil, delicate pale/white flower | vanilla lily of the valley |
| `athelas.png` | `athelas.png` | Athelas, medicinal herb (later ingredient of salve / Miruvor) | vanilla fern, tinted light green |
| `golden_fern.png` | `golden_fern.png` | golden fern, ambient ground cover | vanilla fern, tinted gold |
| `mallorn_blossom.png` | `mallorn_blossom.png` | fallen Mallorn blossoms, 1-4 segments per block (cutout, scattered petals) | drawn petal specks |

Particle: `textures/particle/mallorn_leaf.png` (**8x8**, one falling golden leaf, cutout alpha). The
particle (`particles/falling_leaf.json`) draws it 0.12 blocks wide, spinning, so it must read at a few pixels.

### Requirements (Claude adds to this list)

- **Carpet and blossoms are segmented like vanilla leaf litter**: a block shows 1 to 4 quarter tiles (each 8x8 px
  quadrant of the 16x16 texture, 1 px tall), rotated per block. Each quadrant must therefore look complete on its
  own, with no motif crossing the quadrant lines. The item file is the inventory icon (a heap of the item, 2D).
- **Blossoms are cutout** (alpha 0 between petals); the ground shows through.
- **Leaf carpet is opaque and seen from above**: it covers the grass texture under trees, so it must
  tile on all four sides and look good in large patches. Its top face uses the whole 16x16 tile; the
  1 px sides use the bottom row (`v = 15`), so keep that row a plausible leaf-edge colour. Patches
  are scattered (gaps between blocks show grass), so neighbouring blocks should not need to line up.
- **Golden fern and Athelas must be clearly different silhouettes** (fern: arching fronds; Athelas:
  low herb with small pale flowers) and Athelas must not read as "grass" from a distance.
- **Elanor vs Niphredil**: golden vs white must be distinguishable at a glance, in shade and at night.
- Colours are baked in: none of these blocks receives a biome tint.
- Plants sit on grass in a vivid-green, gold-foliage biome; avoid dark outlines that fight the gold.
- **PBR maps:** each step 6 block texture has a placeholder `<name>.texture_set.json` and `<name>_mers.tga` (flat values). When you
  replace a texture keep the set file; optionally paint a real MERS map (R metalness, G emissive, B roughness, A subsurface).

### Open problem: cutout flicker (for the graphics agent; also needs a code-side look)

Seen in game (user, 2026-09-29): the custom cutout blocks shimmer at high frequency while the camera moves or looks at them
(golden fern, Niphredil, Mallorn leaves; vanilla grass next to them is static). It is subtle, the plants do not disappear.
It happens with **both Fancy and Vibrant Visuals**, so it is not (only) a PBR/Vibrant problem. Ruled out: semi-transparent pixels
(all placeholder alpha is 0 or 255). Adding flat MERS maps did not settle it (that fix was tried before the user reported "both modes").
Things to check, cheapest first:

1. **Texture content.** Do the final textures have hard, clean silhouettes with no isolated single opaque pixels or 1 px gaps
   (cutout edges plus mipmaps shimmer when they are thin)? Compare with the vanilla fern / poplar leaf tiles: thicker shapes, coloured
   pixels under the transparent ones (edge padding, not black or white bleed). Transparent pixels should carry the neighbouring
   colour, not (0,0,0).
2. **Mip levels / padding** in `textures/terrain_texture.json` (`padding 8`, `num_mip_levels 4`): try 0-1 mip levels, or compare with
   the vanilla atlas settings.
3. **Code side (Claude):** `render_method` `alpha_test` vs `alpha_test_single_sided` on the plants, and whether the leaves show it too
   with a vanilla leaf texture swapped in (isolates art from block definition).

---

## Step 7 - Western Corn and Lembas (Phase 7)

All files are **placeholders** (vanilla wheat stages, seeds, wheat and bread, tinted gold; dough and wrapped Lembas hand-drawn
in a few pixels). Replace each in place (same name); no JSON changes needed.

| File | Used by | Placeholder |
|---|---|---|
| `textures/blocks/western_corn_stage_0.png` ... `_7.png` (8 files) | crop block, one per growth stage (0 seedling, 7 ripe) | vanilla `wheat_stage_N`, tinted gold |
| `textures/items/western_corn_seeds.png` | seeds (plant on farmland) | vanilla wheat seeds |
| `textures/items/western_corn_grain.png` | harvested grain | vanilla wheat, tinted |
| `textures/items/lembas_dough.png` | dough (grain + sugar) | drawn blob |
| `textures/items/lembas_cake.png` | baked, unwrapped cake | vanilla bread, tinted |
| `textures/items/lembas_wrapped.png` | wrapped Lembas (the final food) | cake with a gold leaf stripe |

### Requirements (Claude adds to this list)

- **The crop is `minecraft:geometry.cross`** (two crossed planes, `alpha_test`), not the four-plane hash of vanilla wheat, so a
  stage texture is drawn on a full 16x16 tile and seen from both diagonals. Cutout only (alpha 0 or 255). If a real four-plane
  crop geometry is wanted, tell Claude: it needs a `.geo.json` (Blockbench) and one line in the block file.
- **Ripe (stage 7) must be unmistakable from a distance**: the crop is meant to be found in wild clearings, where every plant
  is stage 7. Make the ripe stage clearly golden/eared and the young stages green, so a farm reads as growing.
- **Western Corn must not look like wheat** at a glance (design: a special crop; also do not reuse wheat's colours exactly).
- Stages 0-7 are shown as a plant that fills the tile more with each stage; the tile bottom edge must sit on the soil line.
- **PBR maps:** each stage has a placeholder `.texture_set.json` and `_mers.tga` (flat vanilla-plant values), like step 6.
  Keep the set files when replacing a texture.
- Item icons are 2D 16x16, no baked lighting. Lembas cake and wrapped Lembas must be **distinct silhouettes** (the wrapped one
  is the leaf-wrapped, lighter, "elven" version) and the wrapped one is the one players eat most, so make it the nicest.
- The cutout flicker problem from step 6 applies to the crop textures too; check the same list.

---

## Step 8 - Athelas salve and Miruvor (Phase 8)

Placeholders (16x16, generated bottles): `textures/items/athelas_salve.png` (green salve in a cork-stopped vial) and
`textures/items/miruvor.png` (golden cordial). Replace in place. Miruvor should read as precious (gold, glow) and clearly differ from the salve.


---

## Step 11 - Deer (Phase 11)

Everything below is **generated placeholder art** (`tools/make_deer.py`, preview with `.claude/skills/bedrock-mobs/scripts/preview_entity.py`). Claude made a real
attempt following `bedrock-modding/references/10-art-style.md` (colour ramps with hue shift, light from above and front, hand-placed
spots, no noise or banding) and judged it only through the software preview, **never in game**. If it looks wrong or flat in game,
redo it by hand in Blockbench; the pipeline stays valid (same bone names, same file names).

| File | Used by | State |
| --- | --- | --- |
| `models/entity/deer.geo.json` (`geometry.lothlorien.deer`, `deer_baby`) | adult and fawn model, 64x64 texture, 1 px = 1 unit | generated boxes; proper Blockbench model with slanted parts, hock joints, a real muzzle would be better |
| `textures/entity/deer/deer.png` | adult (does and bucks; antler cubes are on the same sheet) | fallow-deer palette, pale spots, white rump, dark spine |
| `textures/entity/deer/deer_baby.png` | fawn | darker, bold spots along the back |
| `textures/items/venison_raw.png`, `venison_cooked.png` | items | chop on a bone, 16x16 |
| `textures/items/deer_antler.png` | item | pair of antlers on a skull plate, 16x16 |

### Requirements (Claude adds to this list)

- **Bone names are contracts**: `body neck head ear_l ear_r antler_l antler_r tail leg0..leg3` (leg0 hind right, leg1 hind left, leg2
  front right, leg3 front left). The animations (`animations/deer.animation.json`), vanilla `look_at_target` (rotates `head`) and the render
  controller (hides `antler_*` on does and fawns) depend on them. A Blockbench model must keep the names and pivots (legs at the hip).
- The baby geometry is authored at its **real in-game size** (the BP scales the baby by 0.5, the client entity scales the model by 2 to undo it).
- Both body textures share one sheet per model; if you go above 64x64 keep one size for adult and fawn (no mixels).
- **White deer (Phase 12)** will need its own adult texture (and a fawn one): white coat, pale pink nose and ears, optional faint silver shimmer.
- Sound: placeholder vanilla horse sounds until Phase 18.

### Step 11b - Deer antler block

`textures/blocks/deer_antler.png` (16x16 palette strips, bone columns 0-3, wood columns 4-7) and
`models/blocks/deer_antler_floor.geo.json`, `deer_antler_wall.geo.json` are generated (`tools/make_antler_block.py`). A hand-made model
(slanted beams, a real skull plate, carved Mallorn plaque) would be much nicer. Keep the geometry identifiers and the orientation: wall model
back at +z, front at -z; the floor shed lies along z.
