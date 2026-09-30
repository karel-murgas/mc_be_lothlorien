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
  frequency only sets the scale. Compare on the same seed.
  `0.3`/`0.25`: still near-endless. Reading: with five temperate forest types as targets their
  union is itself huge, so the noise blob, not the forest, now bounds a region. Now `0.3`/`0.5`.
  `0.3`/`0.5` (new world, same seed): still endless, same place. Reading: since `10` gave
  mid-sized regions, any frequency <= 1 makes blobs thousands of blocks wide, far larger than
  any forest. Now `0.3`/`2` and targets cut to `forest`, `flower_forest`, `birch_forest_mutated`
  (dropped `birch_forest`, `dappled_forest`) so the forest outline bounds regions again.
  Expect some forests to be cut by blob edges again; that is the price of a bounded size.
  `0.3`/`2` in game over several seeds: much better, bounded regions (one long narrow one, due to
  that forest's shape); most too small for a heart. River-transparent depth liked. Now `0.3`/`1.25`.
  `0.3`/`1.25`: rarer, not bigger (2 small regions after minutes of flying). Once blobs exceed the
  forests, size is set by the target union and lower frequency only spaces regions out. Now
  `0.4`/`1.25` with `birch_forest` back (bigger union, more regions). **Untested in game**: whether
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

**A. Runtime depth** (`scripts/depth.js`, pure; sampler in `main.js`): probes rings at
8/16/24/32/40 blocks (probes at most 10 blocks apart, 83 in total) at the **surface** under
each point; the first ring with a foreign point bounds the border distance. Levels: edge
(border <= 16), inner (<= 40), heart (farther). `minecraft:river` counts as inside. Runs every
3 s per player, never per tick. `/scriptevent lothlorien:depth` prints the estimate and the
ms per estimate (200-run average) — **record it here**: `_ms per estimate: ?_`.

Fixed 2026-09-29 (user saw "inner" from one side and "heart" from the other): `getBiome`
throws in unloaded chunks and those probes were skipped, so a border ahead of a flying player
(chunks not loaded yet) was ignored and the rings ran out as "heart". Now an unreadable probe
stops the search and the level is the lowest one still certain, shown with `?` in the debug
bar. Probes also sampled at the player's height; biomes are 3D, so flying sampled the air.
Old limits were 24/60 on rings to 80 (partly beyond the loaded area). Tests: `tests/run.mjs`.
The outline follows vanilla forest shapes, so "heart" means far from any border, not a
designed centre. Verified in game after the fix (2026-09-29, user). Known: the level updates
only every 3 s (`DEPTH_INTERVAL_TICKS`), which reads as a lag when crossing a border; not yet
addressed.

**B. Worldgen heart approximation**: feature rule
`lothlorien:grove_flowers_feature_rules` (after_surface_pass, tag `lothlorien`) places
dense dandelion patches only where `query.noise(origin/120)` > 0.3, so grove-like zones
appear as large slow-varying regions independent of the biome border. Superseded in Phase 6: the dandelion patches were replaced by Elanor/Niphredil (see below). Noise is world-position based, so a grove can fall
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

## Phase 5 - giant Mallorns (DONE 2026-09-30, accepted in game by the user)

Shipped: two lookout trees (woven 5 and 7: flet, ladder, loot chest) and four plain giants (plain 2, 3, 6 and
8), generated as one jigsaw structure (`lothlorien:giant_mallorn`) in the biome, about 1 in 4 with a flet.
Accepted in game but not measured separately: whether the trunk anchor keeps trunks at least 48 apart, and
whether any jigsaw block is left at a trunk base. Recheck these if two giants ever look too close.
The history below is kept because it records the traps.

- **What:** 4x4 trunk 30-38 high (tip narrows to 2x2), sunk 5 blocks into the ground with buttress roots.
  A plank platform (radius 5.5-7, fence rim) sits on 6-8 level branches 9-12 below the top. A vanilla
  ladder runs up the north face of the trunk (column x 0, z -1) through a hole in the floor. A chest
  against the east face uses `loot_tables/chests/mallorn_flet.json`. There are no leaves from the floor
  to 3 above it within radius+4, so the view is open.
- **Leaves** are normal worldgen leaves (`persistent` false). Any leaf more than 8 steps through leaves
  from a log is dropped at generation time (decay reach is 10), so nothing thins out later. There are
  about 5-10 such leaves per tree.
- **Variants** (`VARIANTS` in `tools/build_structures.mjs`, options of `buildFletMallorn`). Tree NN of every
  variant uses the same seed.
  - `flet`: the original design, with branches under the floor. The defaults must keep producing the same
    trees, because flet 7 is the reference.
  - `woven` (woven + lush, added 2026-09-29, not yet seen in game): the support branches run at floor level
    through the platform, with planks filling the gaps, and their leafy ends reach past the rim. Lush adds
    1-2 whorls of leafy level branches on the bare trunk plus longer leafy low branches.
  - To experiment, add an entry to `VARIANTS` and the name to `VARIANTS` in `scripts/showcase.js`, then run
    `node tools/build_structures.mjs <variant>`.
- **Chosen for worldgen (2026-09-29): woven 5 and woven 7** (`CHOSEN` in `tools/build_structures.mjs`). Only
  these ship in the pack. `node tools/build_structures.mjs` rebuilds exactly that set, and
  `node tools/build_structures.mjs <variant|all>` adds curation candidates for the showcase. They never enter
  worldgen; run the plain command again before committing.
- **Pipeline:** the shape is in `tools/flet_mallorn.mjs` (pure; reuses `makeBuilder` from
  `mallorn_tree.js`). `node tools/build_structures.mjs [variant|all] [count] [firstSeed]` writes
  `structures/lothlorien/mallorn_<variant>_NN.mcstructure` (40x54x40, trunk NW cell at x/z 18, ground at y 5,
  about 700 KB each) and `scripts/giant_trees.js` (the CHOSEN names). Rerunning a variant replaces that
  variant only.
  The format and the traps are in `.claude/skills/bedrock-modding/references/09-structures.md`.
- **Worldgen: jigsaw structure `lothlorien:giant_mallorn`** (stable since 1.21.120; no experiment needed).
  - `worldgen/structures/giant_mallorn.json`: biome tag `lothlorien`, step `surface_structures`, no terrain
    adaptation. `max_depth` is 0 (one piece, no jigsaw blocks). `start_height` is -5 from `world_surface`, so
    the roots go into the ground.
  - `worldgen/template_pools/giant_mallorn.json`: generated from CHOSEN.
  - `worldgen/structure_sets/giant_mallorn.json`: random_spread, now spacing 13 / separation 6 (see below).
    An early separation 3 with spacing 6 was rejected by the engine (separation must be less than spacing / 2),
    so nothing generated (2026-09-30).
  - With that fixed, `/locate` found giants but nothing was built (2026-09-30).
    - `/place structure` said "Jigsaw structure generation failed. Structure placed out of bounds".
    - Six one-change test structures were placed in one new world. **The cause was `max_depth: 0`**: only
      the tests with depth 1 or 3 built. Size, height, reach, the `.mcstructure` format and `"rigid"` made
      no difference. `max_depth` is now 1.
    - `max_distance_from_center` is 116 as in vanilla's camp. The earlier 32 was not the cause.
  - **Working in game (2026-09-30):** `/place structure` and natural generation build whole giants across
    chunk borders.
  - Spacing 6 / separation 2 was far too dense: about 5 giants in a medium Lothlorien patch, one pair of
    trunks only about 28 blocks apart. The piece is rotated around its corner, so a trunk can move by
    about the piece width. Spacing 13 / separation 6 was tried next; the user asked for about 11.
  - **Now (2026-09-30, not yet seen in game): one set for all giants, with the trunk anchored.**
    - The pool (`CHOSEN`, with weights) holds the flet trees woven 5 and 7 at weight 2 each and the plain
      giants 2, 3, 6 and 8 at weight 3 each, so about 1 giant in 4 has a flet.
    - The set is spacing 6 / separation 2. About 5 giants per medium patch, about 1-2 of them flets, which
      is roughly what a separate flet grid of spacing 12 would give.
    - One set means two giants never compete for space. Structure sets cannot exclude each other; Java's
      `exclusion_zone` is not in Bedrock's documented fields.
    - Trunk anchor: every piece's bottom trunk cell (1, -5, 1) is a `minecraft:jigsaw` block
      (`JigsawBlock` entity: name `lothlorien:giant_trunk`, target and pool `minecraft:empty`, final_state
      `lothlorien:mallorn_log`), and the structure's `start_jigsaw_name` is that name. The trunk should
      then sit on the start point however the piece is rotated, so trunks are at least 3 chunks (48
      blocks) apart.
    - Plain giants are variant `plain` (`flet: false`): woven branches and lush foliage, no platform, ladder
      or chest. `/scriptevent lothlorien:showcase plain` shows them.
    - The user found their crowns too flat (2026-09-30). Plain giants now get 3-6 ring branches instead of
      6-8, each starting 4 below to 3 above the old floor level. They tilt up 20-55% per step, may bend 45
      degrees on the way (`bentBranch`), and grow leaves along their top as well as a blob at the tip.
      Their crown branches start just above the ring, not 4 blocks up. Lookout trees are unchanged.
  - `/locate structure lothlorien:giant_mallorn` and `/place structure lothlorien:giant_mallorn` work.
- **History:**
  - 2026-09-29: a 40-wide `structure_template_feature` was cut badly at chunk borders.
  - 2026-09-30: a script-grown marker (`structureManager.place` once the footprint was loaded) replaced it.
    It was dropped the same day, unseen, because trees appeared only within simulation distance.
- **Written 2026-09-30, not yet seen in game.** Open questions:
  - Is the trunk base exactly at ground level? The surface heightmap may be off by one.
  - Jigsaw may rotate the piece. Do custom `minecraft:block_face` logs and fence connections rotate
    correctly? Test with `/scriptevent lothlorien:showcase woven 7 90`. If branch logs point the wrong way,
    use `mallorn_wood` (the same on every side) for branches.
- **Curation:** `/scriptevent lothlorien:showcase [variant]` lays out candidates on a grid (4 per row, 48
  apart, variants in separate rows) south-east of the player, with a sign such as "woven 3" in front of
  each ladder. Trees in unloaded chunks are retried for 3 minutes. `/scriptevent lothlorien:showcase woven 3`
  places one tree next to you (a bare number means flet).
- **Chest loot is verified in game** (2026-09-29): the chest `LootTable` field in the structure fills the
  chest when it is opened. Still unchecked: do the fence connections hold? Does the ladder face the right way
  (`facing_direction` 2)? Do normal Mallorns grow into the platform?
- **Editing the loot by hand:** `lothlorien_bp/loot_tables/chests/mallorn_flet.json`. Pool 1 rolls once
  (miruvor or lembas). Pool 2 rolls 3-5 times from a weighted list. `weight` is relative chance, and
  `set_count` sets the stack size. Item ids have to exist; `.\mods verify lothlorien` catches typos. Then run
  `.\mods deploy lothlorien` and re-enter the world. The table is rolled when a chest is first opened, so
  unopened chests pick up the change. To see a roll without a chest, `/loot spawn ~ ~1 ~ loot "chests/mallorn_flet"`
  should work (not tested).
- Tests: `tests/run.mjs` checks, over 30 seeds per variant, that the ladder is unbroken, there is a floor at the
  exit, the chest has room, leaves are within reach and everything fits the box.

## Phase 6 - ground identity and flora (step 5, procedural trees, postponed on purpose)

Blocks: plants `elanor`, `niphredil`, `athelas`, `golden_fern` (`minecraft:geometry.cross`, `alpha_test`, no
collision, break instantly, soil-only `placement_filter`) and two **segmented ground covers**, `mallorn_leaf_carpet`
(opaque) and `mallorn_blossom` (cutout), made by `.claude/skills/bedrock-blocks/scripts/gen_ground_cover.py`.
Covers work like vanilla leaf litter: state `lothlorien:amount` 1-4 = that many 8x8 quarter-tiles (1 px tall, one geo per
amount, `geometry.lothlorien.ground_cover_1..4`), rotated by `placement_direction` permutations. Using the item on
the cover (or on the ground under it) adds a segment; breaking drops one item per segment (`scripts/ground_cover.js`).
Worldgen places weighted amounts (carpet 4:3:2:1, blossoms 6:3:1:1) in random directions: 16 single-block features
each, states given in `places_block`. Each plant has an **item with the same identifier**
(`replace_block_item`, 2D `icon`, creative group flower) and a block with no menu category, the door pattern.
All art is placeholder; the list for the graphics agent is in `GRAPHICS_TASKS.md` step 6.

Worldgen (all native JSON, no script):

- **Litter with trees**: `mallorn_trees_feature_rules` now places `select_mallorn_tree_with_litter_feature`, an
  `aggregate_feature` (`early_out: first_failure`) of the tree, a carpet scatter (90 tries, gaussian +-5) and a
  blossom scatter (5 tries), all around the tree origin. Same idea as vanilla `*_with_leaf_litter`.
- **Elanor**: the old dandelion grove rule, now `elanor_patch_feature_rules` (`query.noise` > 0.3, 3 patches per chunk).
- **Niphredil**: same idea with an offset, slower noise and a stricter threshold (0.35), so its zones are separate
  from Elanor's and rarer. The design says "more common deeper in", which JSON cannot express (no depth
  in worldgen); noise zones are the approximation.
- **Athelas**: 1 in 5 chunks gets one small clump (10 tries, +-3). **Golden fern**: 1 in 2 chunks, 22 tries, +-6.
- Old `grove_flower_*` files removed. `single_block_feature` uses `enforce_placement_rules: true`, so the plants'
  `placement_filter` (grass, dirt, podzol, moss, ...) decides where they can stand.

Falling leaves: `rp/particles/falling_leaf.json` (`lothlorien:falling_leaf`, slow drifting fall, expires on
contact) spawned by `fallLeaves` in `main.js` every 12 ticks per player inside the biome: a random column within
14 blocks, topmost block must be a Mallorn leaf, `leaf_fall.js` (pure, tested) walks down to the first leaf with
open air below. One particle per player per 12 ticks, so it is sparse by design.

**Untested in game** (written without game access): everything above. Check first: (1) plants and carpet appear
in the creative menu and place on grass; (2) `/place feature lothlorien:select_mallorn_tree_with_litter_feature`
leaves carpet and blossoms around the trunk; (3) heightmap y in `after_surface_pass` may land on canopy, in
which case flowers only appear in the open (expected); (4) `scatter_chance` is accepted in the rules;
(5) particle spawns, falls and disappears on the ground; (6) creative groups `itemGroup.name.flower` / `.leaves`.

### Vanilla plants in the biome (checked against the 1.26.50 feature rules, 2026-09-29)

Vanilla places plants by biome tag, and the only removal lever is the tag. The biome has `overworld` (needed for
ores, caves, structures, spawns), `animal`, `bee_habitat`, `lothlorien`, no `forest`. Rules that still match:
`scatter_tall_grass_feature` (grass and tall grass, the wanted ground cover), `scatter_overworld_flower_feature`
(dandelion/poppy mix, 1 chunk in 32), pumpkins (1 in 300), reeds near water (1 in 6), extra mushrooms.
Ferns, forest flowers and forest grass belong to `forest`/`taiga`/... tags and do not apply. The leftovers are rare and
deliberately not fought: excluding them needs a tag such as `plains` or `mooshroom_island`, which also switches on
villages or mooshroom spawns. Decorative flowers added on purpose: `wild_flower_patch_feature_rules` (one small patch in 1 chunk in 3).
**Untested in game**: segment merging and break drops, the 16 permutations, `states` inside `places_block`.

### Tuning after the first in-game look (2026-09-29)

Elanor was too common in the inner zone: noise threshold 0.3 -> 0.5, 2 patches per chunk, 18 tries per patch.
Athelas is now confined to rare noise zones (threshold 0.45 on its own offset field), 1 chunk in 2 within them, 8 tries.
Worldgen cannot see depth, so "scarce until the heart" is approximated with rare zones; a scripted post-generation
pass keyed to `estimateDepth` is the real fix if that is not enough. Carpet density was judged fine.

**Bone meal** (`scripts/bonemeal.js`, table in `flora_table.js`): vanilla bone meal on grass in the biome grew dandelions and
poppies. The script cancels bone meal used on a grass block inside the biome and scatters 12 tries within 3 blocks: short
grass 58, Elanor 14, Niphredil 12, golden fern 12, Athelas 4 (weights). Consumes one bone meal in survival.
**Untested in game**: that cancelling the event stops the vanilla effect, and the `crop_growth_emitter` particle name.

Second tuning (same day): Elanor zones (noise field A) and Niphredil zones (field B) are independent, so in one region
you can see one without the other; that is what happened in the inner zone (Niphredil zones were also stricter than
Elanor's original ones, and after Elanor was cut to 0.5 Niphredil at 0.35 was the rarer of the two by accident).
Now Niphredil has a sparse baseline everywhere (1 chunk in 3, 6 tries) plus zones at threshold 0.25. Athelas: sparse baseline
everywhere (1 chunk in 10, 4 tries, "rare but obtainable") plus zones at threshold 0.3 (1 in 2 chunks, 8 tries), the
"mediocre inside" part. Both zone fields are noise, not depth (see above).

Third tuning: golden fern cut to 1 chunk in 4 with 12 tries (was 1 in 2, 22). Added vanilla `minecraft:fern` (`plain_fern_patch_feature_rules`,
1 chunk in 2, 14 tries) and extra `minecraft:short_grass` (`extra_grass_patch_feature_rules`, every chunk, 26 tries, on top of vanilla's
own grass). Bone meal table: golden fern 12 -> 8, plain fern 6.

Fourth tuning (in game: only Niphredil showed among the custom flowers). Lesson: `query.noise` thresholds are very steep. 0.3 gave "many"
Elanor, 0.5 gave none, so a zone-only rule can vanish entirely. Every flower now has a sparse baseline everywhere plus noise zones:
Elanor zone 0.4 (2 patches) + baseline 1 chunk in 3 (5 tries); Niphredil zone 0.35 (2 patches) + baseline 1 in 5 (5 tries, was 1 in 3);
Athelas unchanged (zone 0.3, baseline 1 in 10). Do not go above ~0.4 on a zone rule without a baseline.

Fifth tuning: flower frequency was good, patches too dense: Elanor patch 18 -> 9 tries, Niphredil patch 26 -> 11. More ground cover: plain fern every
chunk with 22 tries, golden fern 1 chunk in 2 with 16, extra grass 60 tries. Athelas a little more: baseline 1 in 7, zones 2 in 3.

Sixth tuning. Patches: Elanor and Niphredil zone patches are now 4 tries within +-2 (about 2-4 flowers, some tries fail), baselines 3 tries +-2.
Wild decorative flowers are now the **two-block vanilla plants** (rose bush 5, peony 3, lilac 3) instead of poppy/cornflower/allium.
A two-block plant is an `aggregate_feature` (`early_out: first_failure`): `wild_<plant>_lower_feature` (`upper_block_bit: false`,
placement rules on) then `wild_<plant>_top_feature`, a one-iteration `scatter_feature` with `y: 1` that places the upper half
(`upper_block_bit: true`, no placement rules). Patch size 4 tries +-2. **Untested in game**: the `y: 1` offset in a scatter, the state name
`upper_block_bit` on rose_bush/peony/lilac (it is what vanilla `tall_grass` uses), and a lower half left alone if the upper cannot be placed.

**Flicker** (user report: custom cutout plants, ferns and Mallorn leaves shimmer at high frequency; vanilla grass does not). The textures
have strictly binary alpha, so it is not semi-transparent pixels. Hypothesis (later disproved as the sole cause: the user sees it in Fancy and Vibrant Visuals alike): the pack declares `pbr` but had no `.texture_set.json`, so
these blocks got default material values, unlike vanilla plants which ship a MERS map (metalness 0, emissive 0, roughness ~170,
subsurface ~105). Added `<name>.texture_set.json` + `<name>_mers.tga` (flat vanilla-like values) for elanor, niphredil, athelas, golden_fern,
mallorn_blossom, mallorn_leaves, mallorn_sapling, mallorn_leaf_carpet. **Unconfirmed**: check in game; if it still flickers, try
`alpha_test_single_sided` on the plants and note whether it happens with Vibrant Visuals off. Replacement art needs its own MERS map.

Flicker follow-up: user confirmed it flickers in both Fancy and Vibrant Visuals, so the MERS maps are not the fix (kept, harmless). Open; the
checklist is in `GRAPHICS_TASKS.md` ("Open problem: cutout flicker"). Suspects: thin cutout silhouettes plus mipmaps, transparent-pixel
colour bleed, `alpha_test` mode.

Bone meal on our own flora (`scripts/bonemeal.js`, tables in `flora_table.js`): on Elanor, Niphredil, golden fern or Athelas it grows more of the
same nearby, like vanilla flowers (6 placement tries within 3 blocks; Athelas 2; a try needs grass with air above; works outside the biome too).
On a leaf carpet or blossoms block it adds one segment; when the block is full (4) it starts a new one on nearby grass. Always consumes one
bone meal in survival. **Untested in game.**

Bone meal fix after the first test (user: a cover block spawned many covers, Athelas gave about 6 plants, Niphredil 8-10, although the code allows at
most 2 Athelas and 6 others per use): the interact event fired several times per use, so every use acted several times. Now one use per player per
10 ticks (`repeated()` in `bonemeal.js`). Spread tries are 4 for Elanor, Niphredil and golden fern, 2 for Athelas (a try can fail, so expect fewer).
A full leaf carpet / blossoms block now drops one item on bone meal instead of spawning new covers (what vanilla leaf litter and pink petals do; from
memory of the vanilla behaviour, not checked in game). The same repeated firing may affect the segment merge on click in `ground_cover.js`
(item consumed twice?); not reported so far.

## Phase 7 - Western Corn and Lembas

Files: `blocks/western_corn.json`, `scripts/crop.js` (component + bone meal helpers), `scripts/crop_rules.js` (pure growth numbers,
tested), `scripts/lembas.js`, items `western_corn_seeds`, `western_corn_grain`, `lembas_dough`, `lembas_cake`, `lembas_wrapped`,
recipes `lembas_dough`, `lembas_wrapped`, `furnace_/smoker_lembas_cake`, loot tables `western_corn(.json|_mature.json)`, features
`western_corn_*` + two feature rules. All art is placeholder (`GRAPHICS_TASKS.md` step 7).

**The loop:** find wild corn in Lothlorien -> harvest (mature: 1-2 grain + 1-3 seeds; young: 1 seed) -> plant seeds on farmland
anywhere -> grow -> craft **dough** (2x2 shaped: 3 grain + 1 sugar -> 2 dough) -> smelt in furnace or smoker -> **Lembas cake**
(6 nutrition, "good" saturation, 1.6 s, a bit better than bread) -> craft with one Mallorn leaves block (leaf above cake) ->
**wrapped Lembas** (8 nutrition, "supernatural" saturation = 19.2, eaten in 1.0 s, lifts the Hunger effect through the item
component `lothlorien:lembas`). Numbers are a first guess: the plan (Phase 7 test list) asks for a balance pass.

- **Crop block:** state `lothlorien:growth` 0-7, `minecraft:geometry.cross`, stage texture chosen by 7 permutations, mature
  loot table chosen by a permutation that overrides `minecraft:loot`. Seeds place only on farmland (`block_placer.use_on`);
  the block's own `placement_filter` also allows grass/dirt/podzol so that **worldgen** can stand mature wild corn on grass. Random-tick growth
  (`lothlorien:crop`, `growChance` in `crop_rules.js`) happens only when the soil is farmland: 1/3 per tick on wet farmland, 1/5 dry;
  x0.6 at light 6-8, x0.3 at light 4-5, none below 4 (wheat stops below 9, so corn also grows slowly at night and in dim glades).
  Random ticks reach a block about once a minute, so ripening takes roughly 20-35 minutes. Bone meal (`bonemeal.js`) adds 2-5 stages.
- **Worldgen (native JSON):** `western_corn_patch_feature_rules` (own noise field, threshold 0.4, 1 in 2 chunks in a zone, 7 tries +-2) and a very
  sparse baseline `western_corn_sparse_feature_rules` (1 chunk in 14, 3 tries +-1) so it is always findable. Both place growth 7. "Rare clearings /
  deeper" cannot be expressed in JSON (no depth in worldgen); the noise zones approximate it. Plan for Phase 19: tune density; the design
  says the mandatory item needs a non-trader fallback source, which this is.
**Game-tested 2026-09-29 (user, 1.26.52): phase done.** Wild corn found in Lothlorien; the crop grows with bone meal; dough recipe and baking work; Lembas cake and wrapped Lembas can be eaten. Two Content Log fixes were needed: `saturation_modifier` must be a number (named values are format 1.10 only), and food needs `minecraft:use_animation: "eat"` (else it could not be eaten). **Still not observed** (the list below is otherwise superseded): natural growth speed and low-light behaviour on farmland, wet vs dry farmland, mature vs young harvest drops (permutation loot override), the Hunger lift of wrapped Lembas, and hunger/saturation balance (Phase 20).
- **Was untested when written, check first:** (1) seeds plant on farmland and only there; (2) the stage textures change as it
  grows (permutation material_instances); (3) breaking a ripe crop gives grain and seeds, a young one only a seed (a `minecraft:loot` override in a
  permutation is unverified; fallback if not honoured: mature drops would be seeds only, so move the drop into a `onPlayerBreak` script);
  (4) wild corn appears in Lothlorien in small clumps on grass; (5) random ticks grow the crop (also needs no `minecraft:random_ticking` component, like the
  sapling: if it never grows, add that first); (6) `moisturized_amount` is readable and wet farmland is faster; (7) recipes appear in the recipe book and
  the furnace/smoker accept dough; (8) `minecraft:use_modifiers` use_duration 1.0 for wrapped Lembas and `onConsume` firing; (9) creative groups
  `itemGroup.name.seed`, `.crop`, `.miscFood`.
- **Not done on purpose:** trampled farmland leaving the crop on dirt (it survives on dirt but stops growing); water-flow breaking; fortune.

## Phase 8 - Athelas salve and Miruvor

Files: items `athelas_salve`, `miruvor`; recipes `athelas_salve`, `miruvor`; `scripts/athelas.js` (components `lothlorien:salve`,
`lothlorien:miruvor` applying effects in `onConsume`, same pattern as `lembas.js`). Art is placeholder (generated bottles, `GRAPHICS_TASKS.md`).
**Status: game-tested 2026-09-29 (user, 1.26.52): salve and Miruvor skin work, cooldown and sip counting fine.**

- **Harvest:** unchanged. Athelas is a plant block; breaking it drops the Athelas item (default self-drop, no loot table). Raw Athelas is
  *not* edible: the item already places the block, and one item cannot both place and be eaten. "Raw = weak healing" from the design is dropped
  in favour of the salve.
- **Salve:** 2 Athelas (vertical) over a glass bottle -> 1 salve. Drink 1.6 s, always drinkable, stack 16. Regeneration II 6 s (about 5 HP), lifts Poison.
- **Miruvor (Skin):** a reusable skin, not a stack. `minecraft:durability` 4 = 4 sips, stack 1, 30 s cooldown between sips
  (`minecraft:cooldown`, category `lothlorien_miruvor`), drink 2.0 s. Not food: `use_modifiers` + `use_animation: drink`, and the effects and
  the durability loss run in `onCompleteUse` (`athelas.js`); the last sip removes the item. Per sip: instant health I (4 HP), Regeneration II 8 s
  (about 6 HP), Speed I 30 s, lifts Poison. Recipe (3x3): `ENE / SHS / NSL` = 2 Elanor, 2 Niphredil, 3 salves (6 Athelas), 1 honey bottle, 1 leather.
  Balance: one sip is a Healing II potion plus a run, so the skin is paid up front (about 10 items, 3 glass bottles' worth) and throttled by the cooldown.
  **Verified in game (was unverified):** `onCompleteUse` firing for a non-food item with `use_modifiers`, cooldown starting on use, durability bar showing, `durability.damage`
  write-back via the mainhand slot. If `onCompleteUse` does not fire, fall back to `onUse` + a manual timer.
- Effects come from script because item-JSON food effects are not available in format 1.26.50 (not verified; scripts are the working pattern here).
- **Test list:** items appear in the creative menu and recipe book (salve unlocks on picking up Athelas, Miruvor on getting a salve); drink
  animation and can-drink at full hunger; effects apply; numbers feel expensive but not silly (Phase 20 balance pass).

## Disharmony core (Phase 9, 2026-09-30, not yet tested in game)

- Rules in `scripts/disharmony.js` (pure, tested), wiring in `scripts/disharmony_game.js`; state per player in dynamic
  property `lothlorien:disharmony` (`{points, calm, friend}`). `/scriptevent lothlorien:disharmony [points]` shows or sets it.
- Decided with the user: a point decays after **3 min inside** the biome, **6 min outside** (KB said "inside only"; changed).
  Status text is shown on the actionbar only inside the biome. A kill restarts the decay timer; **player death resets
  points and all timers**. Friend = 10 minutes at 0 points inside; progress is paused outside (neither gained nor lost) and Friend lasts
  outside (status just hidden); only a kill or a death loses it.
- A kill counts when a player is `damageSource.damagingEntity` (projectile shooters included) and the victim stood in the biome.
- Later phases read the state with `disharmonyOf(player)` + `levelFor` / `isFriend`.
