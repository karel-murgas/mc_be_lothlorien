# Lothlórien — technical notes

Facts checked against the installed game data (`C:\mcmods\reference\vanilla\current`) and the docs,
kept here so later phases do not re-derive them. Design lives in `design/`.

## Biome (Phase 1)

Files:

| File | Role |
|---|---|
| `lothlorien_bp/biomes/lothlorien.biome.json` | server biome: climate, surface, replacement, tags |
| `lothlorien_rp/biomes/lothlorien.client_biome.json` | grass/foliage/water/sky colours, fog, music, VV identifiers |
| `lothlorien_rp/fogs/lothlorien_fog_setting.json` | `lothlorien:fog_lothlorien` |

- **Only `minecraft:replace_biomes` makes a custom biome generate**, stable (no experiment)
  since 1.21.110; `format_version` must be ≥ `1.21.110`. It re-labels part of the areas the
  vanilla generator already chose as a target biome. It **cannot change terrain shape**:
  Lothlórien has forest terrain because it only replaces forests.
- `targets` are **namespaced** ids (`minecraft:forest`). Bare `forest` (what the wiki
  and older docs show) fails in 1.26 with "No biome found with name: 'forest'" and the
  whole biome is dropped. Custom biomes cannot be targets, so
  a nested "heart" biome is not possible (see design KB §3).
- `amount` (0–1] ≈ fraction of target area replaced; `noise_frequency_scale` (0–100]:
  higher = smaller, more frequent patches. Tuning log: `0.35`/`10` gave a mid-sized, long narrow
  region; then `0.5`/`4` plus old-growth birch (`birch_forest_mutated`); then `0.45`/`1`, which in game
  (2026-09-29) still cut a `minecraft:forest` at a taiga edge into a few-tree strip beside a large
  unconverted forest. Now `0.45`/`0.25` plus `dappled_forest` (new temperate forest, 1.26.50) in the **same**
  entry, so one noise field covers all forest types and adjacent ones merge. `roofed_forest` was
  tried and dropped: replaced dark forest would likely lose woodland mansions. Considered, not
  added: `meadow`/`cherry_grove` (mountain biomes), `mega_taiga` (cold); no old-growth oak biome
  exists (old birch = `birch_forest_mutated`, already in). `plains` would widen regions most (our
  trees fill it) but is very common and shares this entry's `amount`; undecided.
  In game (2026-09-29): `0.45`/`0.25` gave a region too big to find its end while flying. Likely
  cause: near 0.5 the replaced side of the noise is one connected web (percolation), so blobs chain
  across forests. Now `0.3`/`0.25`: amount is the dial for both coverage and connectivity;
  frequency only sets the scale. Compare on the same seed. **Untested in game**: whether
  0.25 is accepted (if not, the biome is dropped and `/locate` fails) and the resulting region sizes.
  Goal (user): a forest is converted **whole or not at all**, and neighbouring forest types
  join into one region. JSON cannot select per forest; the approximation is noise so slow
  that it is nearly constant across one forest, so `amount` decides roughly what share of
  forests convert. The biome can never be wider than the forests it replaces: its outline
  follows the vanilla forest shape.
- Append new replacement entries at the **end** of the array; inserting earlier shifts the
  noise of existing ones.
- Stable server components: `climate`, `creature_spawn_probability`, `humidity`,
  `map_tints`, `mountain_parameters`, `partially_frozen`, `replace_biomes`,
  `surface_builder`, `surface_material_adjustments`, `tags`. Fog/sky/grass colour are
  **client** components (`minecraft:client_biome`), not server ones — some tutorials put
  `fog_appearance` / `surface_parameters` in the server file; the vanilla files do not.
- Client grass/foliage take a flat colour (`"color": "#rrggbb"`, as vanilla `pale_garden`)
  or `{"color_map": ...}`.

### Tags decide almost everything

Spawn rules and feature rules find biomes only by tag.

- `overworld` → vanilla overworld features (ores, grass, flowers...).
- `forest` → vanilla forest trees (`forest_surface_trees_feature`). Kept for now as the
  placeholder tree cover; the golden foliage tint makes them read as "not a normal forest".
  Drop it once Mallorns exist, and re-add the vanilla features we still want explicitly.
- `animal` → vanilla passive spawns.
- **No `monster`** → vanilla hostile surface spawn rules (zombie, skeleton, creeper, spider,
  witch, enderman...) do not match. Not covered by this: phantoms (player insomnia, not
  biome), patrols/raids, spawners, mobs walking in, other add-ons' mobs. Also check
  slimes and drowned during the spike.
- `lothlorien` → our own tag for our feature/spawn rules.
- The biome is 3D: caves under a replaced forest may also be Lothlórien, and then equally
  monster-free. Test it; decide whether that is acceptable.

## Debug instrument

`/scriptevent lothlorien:debug` toggles an actionbar showing the biome id underfoot and the
hostile mobs within 64 blocks (in-biome / total). `/scriptevent lothlorien:survey` samples
the loaded surface within 160 blocks and reports the Lothlórien share, how much of it is
water, and the direction/coordinates of its centre. At world load the script says in chat
whether the biome registered. Spike-only; remove or gate it later.

`/locate biome` returns the **nearest** point of the biome, often its edge, and that edge
can be shallow coastal water: vanilla forest extends into water where the terrain dips
below sea level, and replacement keeps the terrain. Survey, then walk to the centre.

General biome knowledge (for any mod) is in `.claude/skills/bedrock-modding/references/06-biomes.md`.

## Phase 1 test checklist (new world each time the biome JSON changes)

Worldgen changes affect only newly generated chunks — always test in a fresh world.

1. `/locate biome lothlorien:lothlorien` finds it; teleport there.
2. Region size: large contiguous areas, not confetti. Tune `noise_frequency_scale` / `amount`.
3. Border: walk across; grass/foliage/water/fog change should be clearly visible.
4. Night, Normal/Hard: debug readout shows 0 hostiles inside over several minutes, while
   the surrounding forest has some. Mobs can still walk in.
5. Caves under the biome: hostiles or not?
6. Vibrant Visuals on/off: colours and fog still look right.

## Phase 2 — edge/heart spike

**A. Runtime depth** (`scripts/main.js`, `estimateDepth`): probes 12 directions x rings at
12/24/40/60/80 blocks with `dimension.getBiome`; the first ring containing a non-Lothlórien
point is the nearest-border distance. Levels: outside / edge (<=24) / inner (<=60) / heart
(farther or no border found). Runs every 3 s per player, never per tick; worst case 61
probes. Transitions are logged in chat for players with the debug tag, and the level shows
in the debug actionbar. `/scriptevent lothlorien:depth` prints the estimate plus the
measured ms per estimate (200-run average) — **run it in-game and record the number here**:
`_ms per estimate: ?_`. Limits: rings only see loaded chunks (unloaded probes are skipped,
so depth can read low near the simulation edge), and the outline follows vanilla forest
shapes, so "heart" means far from any border, not a designed centre.

**B. Worldgen heart approximation**: feature rule
`lothlorien:grove_flowers_feature_rules` (after_surface_pass, tag `lothlorien`) places
dense dandelion patches only where `query.noise(origin/120)` > 0.3, so grove-like zones
appear as large slow-varying regions independent of the biome border. Placeholder flower
only; swap in Elanor/Niphredil later. Noise is world-position based, so a grove can fall
on the edge; it is not tied to depth. That is the honest limit of JSON worldgen.

Test (fresh world): fly over a Lothlórien region; patches should cluster in a few large
zones. Judge whether that reads as "deeper = richer". If not, the next option is scripted
post-generation decoration keyed to `estimateDepth` (not committed to; see plan).

## Phase 3 — Mallorn wood set

Block format is **1.26.50** and both manifests need `min_engine_version` 1.26.50 (multi-box
collision, `minecraft:tags` and `minecraft:sound` are format-gated; `tag:*` keys no longer work).
Reference implementations used: Bedrock Wiki custom fences, trapdoors, multi-blocks, block traits.

Blocks (`lothlorien:` + `mallorn_`): `log`, `stripped_log`, `wood`, `stripped_wood`, `planks`,
`leaves`, `stairs`, `slab`, `double_slab` (hidden), `fence`, `fence_gate`, `door`, `trapdoor`,
`button`, `pressure_plate`. Textures are placeholders (pale oak wood, yellow poplar
leaves); art tasks are in `GRAPHICS_TASKS.md`. Every block except leaves/double slab has an item
that *replaces* the auto block item (needed for `minecraft:fuel`; the door also gets a 2D icon).
Recipes and unlocks mirror vanilla wood types (planks from log/stripped log/wood/stripped wood
unlock on that item; the rest on planks; wood/stripped wood on log/stripped log).

- Tools: every wood block carries `minecraft:is_axe_item_destructible`; leaves use the hoe tag.
- Logs: `block_face` trait + rotation permutations; axe strips (`lothlorien:strippable`).
- Stairs: native corners. `placement_direction` with `minecraft:corner_and_cardinal_direction`
  gives `minecraft:cardinal_direction` + `minecraft:corner` (none/inner_left/inner_right/
  outer_left/outer_right), and the engine keeps `corner` updated when neighbours change; no script.
  Left/right follow Java: for a north-facing stair, left = west, right = east. 5 shapes x 2 halves
  x 4 directions = 40 permutations, multi-box collision.
  **Axis trap:** block geometry draws x mirrored (a cube at +x lands on the block's WEST side),
  while `collision_box` uses world x. The first corner attempts (both the engine state and a
  script-computed one) wrote the models like collision boxes, so every corner showed mirrored and
  no rotation could fix it. The geometry cubes are the collision boxes with x negated.
  Confirmed in game 2026-09-29. Regenerate block + geos with the shared
  `.claude/skills/bedrock-blocks/scripts/gen_stairs.py` (see the bedrock-blocks skill).
- Slabs: `vertical_half`; merging in a `playerInteractWithBlock` world event (clicking the slab, or a
  neighbouring block whose face points into a cell holding a slab). Stripping logs is the same
  kind of event: a block component's `onPlayerInteract` blocks placement against the block.
- Fence: wiki example; the `connection` trait connects to fences, gates and solid blocks; vanilla
  fences connect via `minecraft:has_fence_connections`.
- Door: 2-part multi-block, `open` + `hinge_right` states; script picks the hinge on placement
  (door on the placer's left -> hinge right, else left). Rotations are derived, not copied.
- Trapdoor/gate/door open by interact and by redstone (`lothlorien:redstone_toggle`: edge-detected
  against a stored `powered` state because the engine also fires updates on placement/chunk load).
- Button/plate: `minecraft:redstone_producer`; button releases after 30 ticks, plate polls
  every 4 ticks (`minecraft:tick`). Support loss is handled in `blocks.js` (breaking the block they sit on).
- Left out (signs, shelf, boats, ...): see `NOT_IMPLEMENTED.md` for reasons and retry notes.
- **Untested in game** (no game access while writing): everything above. Check first: door swing/hinge, gate open pose, slab merge, log rotation, redstone opening.

## Phase 4 — small Mallorn and the acorn loop

Files: `scripts/mallorn_tree.js` (pure generator, no Minecraft imports), `scripts/trees.js` (growth,
bone meal, leaf decay, instruments), `blocks/mallorn_sapling.json`, `items/mallorn_acorn.json`.

- **Loop:** leaves drop acorns (2% per leaf, `loot_tables/blocks/mallorn_leaves.json`), the acorn item
  places `mallorn_sapling` (hidden from the menu; its loot is one acorn), the sapling grows a tree.
  Saplings need grass/dirt-like soil (`placement_filter`, engine breaks it when the soil goes) and light >= 9.
- **Growth:** `lothlorien:sapling` random tick; stage 0 -> 1 -> tree, each step 1/7 per tick (vanilla-like).
  The trunk needs room (air/leaves/soft plants); branches and leaves are placed only where free.
  Bone meal: 45% to advance one step, handled in a `playerInteractWithBlock` world event.
- **Tree:** each tree draws an archetype (slender, round, spreading, tiered, tall) that sets trunk height
  (6-13), crown size and branch habit. Straight trunk. Branches: 3-5 **level** branches (different
  directions, same height, no rise) just under the crown = a base for a platform; 0-3 short lower branches at
  random heights; 1-5 rising branches through the crown. Every branch may carry a leaf blob; the crown is a
  main blob (maybe off-centre) + blobs, so crown bottoms are uneven. Seed-based, ~all trees distinct.
  Average ~32 logs (~127 planks) and ~200 leaves (5-95%: ~100-320).
- **Big Mallorn:** four saplings in a 2x2 square grow one tree with a 2x2 trunk (like vanilla dark oak): 15-24
  high, flared root logs, crown of a big blob plus 3-5 satellites, 5-8 level platform branches (3-7 long) under the
  crown, 2-5 low and 3-6 rising branches. ~140 logs (~560 planks), ~1500 leaves (~30 acorns if all cleared, for the
  4 planted). Placement is spread over ticks with `system.runJob`. Debug: `/scriptevent lothlorien:growbig [n]`.
- **Where trees come from:** the generators run in script, so they work for saplings and debug commands only.
  Feature rules cannot call script, so **world generation cannot use them directly**; natural Mallorns need
  pre-generated `.mcstructure` files placed by a feature (Phase 5).
- **Leaf decay:** leaves have state `lothlorien:persistent`. Player placement sets it true (never decays);
  grown/worldgen leaves are false and, on a random tick, break with drops if no Mallorn log/wood is
  within 10 steps through leaves (unloaded neighbour = assume connected). Reach was 6 at first and stripped
  leaves off live big trees (crown leaves sit 8+ steps from any log; game-tested 2026-09-29). Verdicts are
  cached per leaf for 60 s (path marking) to keep random-tick cost down; a felled tree's leaves therefore
  start decaying up to a minute later.
- **Balance (estimate):** 2% per leaf x ~200 leaves = ~4 acorns if every leaf is cleared; clearing about
  half gives ~2, so a tree replaces itself with margin without acorns raining; bigger trees pay more. `node tests/tree_stats.mjs [n] [chance]`
  prints the numbers offline. In game: `/scriptevent lothlorien:grow 20` plants 20 trees on a grid around
  you, `/scriptevent lothlorien:treestats` reports the generator averages. **The 20-tree cut-down test is still to do.**
- **Untested in game** (written without game access): random ticking without a `minecraft:random_ticking`
  component (if leaves never decay or saplings never grow, add it first), `block.getLightLevel()` values,
  `crop_growth_emitter` particle name, bone meal event cancel, sapling `placement_filter` with the
  block-item route. Plain-Node generator stats are verified.

## Phase 4b — natural Mallorns (native worldgen, no script)

`feature_rules/mallorn_trees_feature_rules.json` (surface_pass, tag `lothlorien`, 5 tries per chunk) places
`select_mallorn_tree_feature` (weighted: 25 simple, 60 fancy, 15 mega/2x2). The three are vanilla
`minecraft:tree_feature`s with our log and leaf blocks: `mallorn_simple_tree_feature` (trunk+canopy, 6-10),
`mallorn_fancy_tree_feature` (fancy_trunk with branches, ~7-16) and `mallorn_mega_tree_feature` (2x2 trunk,
branch canopies). Shapes are vanilla's; they lack our platform branches and archetypes, which stay for
sapling-grown trees. The `forest` tag was removed from the biome so vanilla forest trees stop generating.
Leaves come out with the default state `persistent=false`, so they decay like grown ones.
Test without a new world: `/place feature lothlorien:select_mallorn_tree_feature ~ ~ ~` (or one of the three
directly) on grass. **Untested in game:** custom blocks inside `tree_feature`, log orientation (default state),
density (5/chunk is a guess), mega tree size.
Density check: `/scriptevent lothlorien:treecount [radius]` reports trees per chunk of biome and canopy cover around you (loaded chunks only; stand inside the biome in a freshly generated area).
