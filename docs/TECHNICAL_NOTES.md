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

## Pack cleanup (2026-09-30)

Helper `/scriptevent` commands that only served development were taken out of `lothlorien_bp/scripts/`:
`showcase`, `grow`, `growbig`, `treestats`, `treecount`, `critters`, `deer`, `survey` and the world-load biome
registration message. Copies live in `tools/dev_scripts/` (see its README); the last commit that still had them
in the pack is `dc1182e` (`git show dc1182e:lothlorien_bp/scripts/<file>`). Kept in the pack: `depth`, `debug`
(its actionbar shows depth) and `disharmony [points]` (the deer test plan needs it). Dev tooling belongs outside the packs.

## Debug instrument

`/scriptevent lothlorien:debug` toggles an actionbar showing the biome id underfoot, the depth
level and the hostile mobs within 64 blocks (in-biome / total). Kept in the pack (it shows the depth).
**Removed from the pack (2026-09-30 cleanup, code in `tools/dev_scripts/biome_debug.js`, git `dc1182e`):**
`/scriptevent lothlorien:survey` (Lothlórien share and centre within 160 blocks) and the world-load chat
line saying whether the biome registered.

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
  4 planted). Placement is spread over ticks with `system.runJob`. Debug command `growbig`: removed from the pack, see `tools/dev_scripts/tree_debug.js`.
- **Where trees come from:** the generators run in script, so they work for saplings only (the old debug commands are in `tools/dev_scripts/tree_debug.js`).
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
  prints the numbers offline. The in-game helpers `grow`, `growbig` and `treestats` were removed from the pack in the 2026-09-30 cleanup
  (`tools/dev_scripts/tree_debug.js`, git `dc1182e`); copy it back in for the test, or plant saplings. **The 20-tree cut-down test is still to do.**
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
Density check (helper removed from the pack, now `tools/dev_scripts/tree_debug.js`): `/scriptevent lothlorien:treecount [radius]` reports trees per chunk of biome and canopy cover around you (loaded chunks only; stand inside the biome in a freshly generated area).

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
      or chest. `showcase` (now `tools/dev_scripts/showcase.js`, removed from the pack) showed them.
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
    correctly? Test with the dev-only `showcase woven 7 90` (`tools/dev_scripts/showcase.js`). If branch logs point the wrong way,
    use `mallorn_wood` (the same on every side) for branches.
- **Curation** (helper moved out of the pack 2026-09-30 to `tools/dev_scripts/showcase.js`; git `dc1182e`): `/scriptevent lothlorien:showcase [variant]` lays out candidates on a grid (4 per row, 48
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

## Fauna spawning spike (Phase 10, 2026-09-30, built; v3 despawn game-tested OK)

- Placeholder `lothlorien:test_critter` (gold rabbit model/texture, vanilla walk AI, has a spawn egg). Files: `entities/test_critter.json`,
  `spawn_rules/test_critter.json`, RP `entity/test_critter.entity.json`. Delete or reuse for Phase 11.
- Spawn rule: surface, grass, light 7-15, herd 1-2, `density_limit.surface 6`, `distance_filter` 12-44, biome tag `lothlorien` only.
  `population_control: "animal"` is a fixed engine pool shared with cows, sheep, etc. (no custom pools exist): the critter
  competes with vanilla animals for that cap. Watch whether Lórien animals crowd out (or are crowded out by) vanilla ones.
- Despawn v2 (after game test 1): not persistent, `random_chance` 20, farther than 54 blocks from a player. v1 also had `inactivity_timer` 300 (copied from vanilla rabbit/sheep, which also require light < 8, i.e. they despawn only at night): a rabbit trapped in a hole, 100+ blocks away, never despawned. Suspects: (a) the inactivity timer never elapses for a mob that keeps trying to walk; (b) despawn filters only run while the entity ticks, i.e. inside simulation distance, so the working window is only "54 blocks .. simulation distance"; a mob left far away is saved with its chunk and is not evaluated. Retest v2 by standing ~58-62 blocks from a critter (simulation distance 4 = 64 blocks).
  (Correction: the note that "no vanilla entity uses `despawn_from_distance`" was wrong; the search only covered the old base
  `vanilla/` folder. Every current vanilla mob (1.26.x update packs) uses `{"despawn_from_distance": {}}`.)
- Despawn v3 (2026-09-30): `{"despawn_from_distance": {}}`, the engine's standard rules. Per the docs, `filters` REPLACE those rules,
  including the instant despawn at the simulation edge, so v1/v2 could never remove a critter left beyond simulation distance.
  Standard rules (documented defaults): > 128 blocks from every player = removed at once; 32-128 = 1-in-800 roll after 30 s
  inactive; at the simulation edge = removed at once. Retest: (a) leave a critter behind, go past simulation distance, come
  back: it must be gone; (b) stand ~40-60 blocks away for a few minutes: numbers should thin out slowly; (c) name-tag one and
  repeat (a): it must stay. Knowledge: `.claude/skills/bedrock-mobs/references/spawning.md`.
  **Game-tested 2026-09-30 (1.26.52): works** - critters despawn, including ones spawned under v1/v2 (the rule comes from
  the current pack when the chunk loads). Name-tagged critter stays (c): OK. Phase 10 spike done.
- Instrument `/scriptevent lothlorien:critters [watch]` (counts): removed from the pack 2026-09-30, now `tools/dev_scripts/critter_watch.js` (git `dc1182e`).
- Test in a NEW world (spawn rules need no new chunks, but the biome does): (1) stand in Lórien, `watch` on, count should climb to
  the density limit and stay; (2) run 200+ blocks away and back several times, count near you must recover, "farther loaded" must
  not grow unbounded; (3) leave 2-3 min far away, then return: old critters gone or few; (4) compare with vanilla animals in the
  adjacent forest (same pool); (5) two players in different places if possible. Record numbers here.


## Deer (Phase 11, 2026-09-30, built; static checks only, not yet tested in game)

- Design sheet with every decision: `docs/mobs/deer.md`. Replaced the Phase 10 `test_critter` (files deleted; the
  dev-only critters counter counted deer; it has since left the pack).
- **Disharmony avoidance without per-player filters**: entity filters cannot read a player's Disharmony (it is a
  dynamic property). So the entity has one component group per wariness state (`lothlorien:state_calm|l1|l2|l3|friend|alarmed`),
  each holding its own `behavior.avoid_mob_type` (flight distance, sneaking halves it) and, where allowed, `behavior.tempt`.
  `scripts/deer.js` runs every 2 s: each player votes with their own state for the deer within 40 blocks, the most severe state among
  players inside their own state's flight radius wins (none close enough: the nearest player), and the script fires `lothlorien:set_<state>` only when the `lothlorien:wariness` property differs. Trade-off: the avoid component still flees from every player at the winning state's distance.
- **Alarm**: a player hurting (or killing) a deer fires `lothlorien:alarm` on every deer within 20 blocks: group `state_alarmed`
  (flee 36, no luring) with a `minecraft:timer` of 20 s whose event `lothlorien:alarm_over` re-triggers the state stored in
  the property. The script skips deer with `lothlorien:alarmed` so it never cuts an alarm short.
- **Goal priorities matter**: breed 2, tempt 3, avoid 4. Tempt must outrank avoid or a deer lured with an acorn would run away
  the moment the player comes within flight distance (edge oscillation). Breeding must outrank both or it never completes
  with the player standing next to the pair.
- Sex and antlers: enum property `lothlorien:sex` (client synced) picked by `minecraft:entity_spawned` / `entity_born`; the render
  controller shows bones `antler_*` only for `buck` adults (`part_visibility`). Loot differs by sex through two adult groups
  (`adult_doe`, `adult_buck`), because loot-table conditions cannot test a custom property; babies have no loot group.
- Venison is marked meat with the item tag `minecraft:is_meat` (wolves heal with it). **Not** `is_meat` inside `minecraft:food`: item format 1.26.50 rejects that field (game log, 2026-09-30: "Failed to parse field minecraft:food -> is_meat"), and the items did not load. One furnace recipe carries the tags furnace, smoker, campfire
  like vanilla `furnace_beef`.
- Animations are procedural Molang (no keyframes): walk = `query.modified_distance_moved` diagonal legs; run = gallop pairs with
  weight `clamp((query.ground_speed - 3.5) / 2.5, 0, 1)`. **The 3.5 m/s threshold is a guess**; if the gallop never shows or shows
  when strolling, tune it in `entity/deer.entity.json` (and `run` weight). Bone rotation convention used by the preview and the
  model (from vanilla horse): bone x rotation positive = top leans towards -z (forward); z rotation is right-handed.
- Model and textures come from `tools/make_deer.py` (see `GRAPHICS_TASKS.md` step 11). Sounds are placeholder vanilla horse sounds.

### Deer test plan (new world not required for the entity; the biome needs new chunks)

1. `/summon lothlorien:deer` several times: adult does (no antlers), bucks (antlers), a fawn now and then; spawn egg works; egg on an adult makes a fawn.
2. Walk at a deer: it should flee at ~10 blocks (5 when sneaking). Hold an acorn or apple: it comes closer; run at it: it gets scared.
3. `/scriptevent lothlorien:disharmony 4` then approach: flight at ~30 blocks, acorn no longer lures. `... 0`, wait: back to 10. Friend (10 calm minutes inside the biome): you can walk up to ~3 blocks.
4. Hit one deer (or shoot): the rest of the herd within 20 blocks bolts for ~20 s.
5. Run animation: does the gallop show while fleeing? Does it show while strolling (it must not)? Adjust the 3.5 threshold.
6. Kill a few: venison, leather, bucks sometimes antlers; cook venison in furnace, smoker, campfire; eat it.
7. Breed two with acorns: fawn appears, follows parent, grows up in about 20 min (acorns speed it up), a buck fawn gets antlers when grown.
8. Spawning: dev-only `critters watch` (copy `tools/dev_scripts/critter_watch.js` back in): herds of 2-4 appear in the biome, stay bounded after travelling (Phase 10 protocol); do they crowd cows/sheep?
9. Look: side, front and back views of adult doe, buck and fawn; note what to redo for the graphics pass.

## Deer antler block (Phase 11, 2026-09-30, built; static checks only, not yet seen in game)

- `lothlorien:deer_antler` is a block; the item of the same name (bucks drop it) is its `block_placer`. Traits `placement_position`
  (`minecraft:block_face`) and `placement_direction` (`minecraft:cardinal_direction`). **Top face = a shed antler lying on the
  floor** (geometry `deer_antler_floor`, rotated by cardinal direction); **side face = antler trophy on a wooden plaque** (geometry
  `deer_antler_wall`, back against the wall, rotated by the clicked face: north 0, west 90, south 180, east 270 as for stairs). No ceiling
  placement. Whether the rotations are right (plaque really against the wall, front out) is the first thing to check in game.
- **Placement (final form, 2026-09-30)**: one model, a big pair of mounted antlers filling the 16x16 face (same cube list for all three
  placements; floor and ceiling versions are the wall model turned by coordinates in `tools/make_antler_block.py`). The user wanted it
  placeable like an item frame: **any face of any block, ceiling too**. So the block has **no `minecraft:placement_filter`** (a filter's
  `block_filter` can only name blocks or tags, and two earlier list/tag attempts were rejected as a strange workaround). The survival
  check an item frame has comes from script, **event-driven like Starstone's surface devices (which also use script: `beforeOnPlayerPlace`
  plus checks on break events; there is no data-only route)**: `scripts/antler.js` (`lothlorien:antler_support`, pure rule in
  `antler_rules.js`). `beforeOnPlayerPlace` refuses an unreadable or air/liquid support; after `playerBreakBlock` and `blockExplode` the
  six neighbours are checked and an antler whose support (opposite of its `minecraft:block_face`) is air or liquid is destroyed with `setblock
  ... air destroy`. No polling tick (an earlier version used `minecraft:tick`). Not covered: pistons, water flow, other mods removing blocks.
  Untested: whether the support offsets match the face semantics, and whether `destroy` drops the item.
  Permutations: block_face `up` = floor (4 rotations by cardinal direction), `down` = ceiling (4), four wall faces (rotated by face).
- **Natural drop only on ground blocks, never on litter**: the worldgen feature (`single_block_feature`) has its own support rule,
  `may_attach_to: { bottom: [grass, dirt, coarse dirt, podzol, dirt with roots, moss, mud, stone], min_sides_must_attach: 1 }` and
  `may_replace: [air]`. Leaf carpet or a blossom in the target cell blocks the placement (cell not air), and a cell above litter has litter
  below (not in the list), so an antler can never float on litter. The price is that about a third of the floor is excluded, so the real
  frequency is lower than the 1/64 per chunk on paper. (An earlier version replaced the litter; the user did not want antlers to look like they float.)
- **Natural drop**: rule `deer_antler_drop_feature_rules` (after surface pass, biome tag, `scatter_chance` 1/64 per chunk) -> scatter of 3
  tries within about 3 blocks -> weighted pick of four facings, all `up`. Giants are one structure per ~36 chunks (about 1 in 4 a lookout tree =
  ~1/144 per chunk), so 1/64 sits between them; a test pins that. Real frequency will be lower (tries on leaves, water or off-biome fail): tune
  the denominator after walking around.
- **Chest**: `loot_tables/chests/mallorn_flet.json` pool 2 has the antler, `set_count 1`, weight 2 (of 19).
- Verifier: a block that also mounts on walls is no longer classed as a "plant" (no composter / flower pot / bone-meal demands).
- Selection boxes: floor 16x4.5x16, wall 16x16x4.5 against the back, ceiling 16x4.5x16 at the top.

### Deer model changes after the first look (2026-09-30)

- User feedback: neck too long, **antlers leaned inward and met in the middle**, legs of two thicknesses unclear, antlers should be bigger; texture liked.
- **Rotation convention learned**: bone z rotation has the same negated handedness as x (see `bedrock-mobs/references/client.md`). Ears and antlers had
  the wrong sign (ears too, although that was not noticed); all four flipped, and `preview_entity.py` corrected.
- Neck 11 -> 8 units (head, ears and antlers moved down 3). Fawn neck 4 -> 3.
- **Legs: one slim cube per leg (2x13x2 adult, 1.5x6x1.5 fawn) instead of a 3-wide thigh over a 2-wide cannon.** Rendered the three options in the
  preview (`DEER_LEGS=slim|sturdy|step`): the stepped one looked like a sleeve, the 3-wide one was chunky for a deer, the slim one read best and is
  fewer elements (style guide). The texture paints coat down to 45 % then pale lower leg and a dark hoof.
- Antlers: each side now has a 9.5-unit beam, brow, bez and back tines, two upright crown prongs and two side tines (was a beam and three small bits).
- Blockbench MCP tools were not available in this session (they load after a restart); these edits were made in `tools/make_deer.py`.

### Fawn legs and whole-number box sizes (2026-09-30)

- The fawn showed a hole in the upper legs. Two causes removed: its legs were 1.5 wide (a fractional box size puts box-UV faces between texels),
  and the leg texture had a dithered dark notch at the coat/pale border that read as a hole on a 6-unit leg. Fawn legs are now 2x6x2, antler
  cubes have whole-number sizes (positions can stay fractional), and `tools/make_deer.py` now **fails if any size is fractional or any face texel is unpainted**.

### Spotted back, second pass (2026-09-30)

- From photos: the spots run along the whole back up to the rump patch (they stopped at about 3/4 before), and the field is outlined in **light**,
  not dark. Adult: rump patch 2 columns wide (was 3), no dark edge, back line and flank line in the lightest coat tone, one spot per column up to
  column 12. Fawn: same idea on its 2 coat rows, sparser so it does not read as a checkerboard.

### Game-log errors after the first full deploy (2026-09-30)

- `minecraft:food -> is_meat ... not present in the Schema` (both venison items failed to load): removed the field, tag `minecraft:is_meat` stays. The
  verifier now errors on it for item format 1.21+ (it only knew the old 1.10 field), and its compostable exemption for meat reads the tag.
- `Geometry: model already has a locator armor_offset.default_neck that doesn't exactly match the one wanting to be added` for `geometry.lothlorien.deer`.
  Not documented anywhere; cause not proven. Hypothesis: the engine derives an armor locator from a bone named `neck`, adds it twice with different
  values, and keeps the first ("skipping new definition", so probably harmless). The bone is now `neck_joint` (geometry, baby geometry, animations) to
  avoid the trigger. **That did not help** (same log text after the rename; the rename stays, it is harmless). New hypothesis: the error comes from the
  render controller's `part_visibility` hiding the antler bones on does and fawns (the fawn geometry has no antlers and logged nothing). Antlers are now a
  separate geometry `geometry.lothlorien.deer_buck` (adult + antlers) next to `deer` (no antlers) and `deer_baby`, all on the same texture layout; the render
  controller picks by `query.property('lothlorien:sex')`. **If the error is still there, report it again.**

### Grass under leaf carpet turned to dirt (2026-09-30)

User report: grass under the golden leaf carpet on the forest floor turned to dirt. Cause: no block set
`minecraft:light_dampening`, which defaults to 15, so every carpet, petal, flower and the shed antler blocked all light
to the grass below (the leaves already had 1). Nothing in script or worldgen replaces grass. Added
`"minecraft:light_dampening": 0` to leaf carpet, blossom, Athelas, Elanor, Niphredil, golden fern, western corn,
sapling, deer antler, pressure plate and button. **In game to check:** grass under fresh carpet stays green (new world
for worldgen carpet; already-turned dirt does not turn back by itself, it regrows only by grass spreading).

## White deer guidance (Phase 12, 2026-09-30, rebuilt with engine pathfinding; static checks only, NOTHING tested in game)

History: the first build (commit `3426cec`) made the white deer a coat variant of `lothlorien:deer`, lured and offered with
Western Corn grain, and walked it by script teleport steps. The owner rejected teleport-walking and asked for a separate
animal offered a Mallorn acorn; this section describes the rebuild.

Files: BP `entities/white_deer.json`, `spawn_rules/white_deer.json`, `entities/guide_beacon.json`, `blocks/structure_marker.json`,
`scripts/white_deer.js` (game wiring), `scripts/white_deer_rules.js` (pure numbers, waypoints, tested), `scripts/deer.js` + `deer_rules.js`
(wariness and alarm for both deer types), `structures/lothlorien/*.mcstructure` (marker, unchanged since `3426cec`). RP `entity/white_deer.entity.json`,
`render_controllers/white_deer.render_controllers.json`, `entity/guide_beacon.entity.json`, `models/entity/guide_beacon.geo.json` (one zero-size
cube: renders nothing but passes the verifier's "geometry has no cubes" check), `textures/entity/guide_beacon.png` (16x16, fully transparent),
`textures/entity/deer/deer_white.png` (from `tools/make_deer.py`), `sounds.json`, `texts/en_US.lang`. Dev only (not shipped):
`tools/dev_scripts/guide_goal/` (goal variants, switch script, experiment steps).

**Decisions (change any of them if the owner wants otherwise):**

- **Separate entity `lothlorien:white_deer`, "White Deer"**, spawn egg (white `#e3e7ee` / grey `#a6adbb`). A **loner**: the deer has no herd
  goal in its entity (its groups come from the spawn rule's `herd` and its breeding), so the white deer simply has neither: spawn herd 1-1, no
  `breedable`/`behavior.breed`/`offspring`, no baby group, no `ageable`/`follow_parent`, no `spawn_egg_interaction` (an egg on it makes no fawn),
  not tamable. **Not leashable and no balloon** either (my choice: a wild guide animal, not livestock; a lead would also drag it off a guidance).
  Own family `lothlorien_white_deer` (+ `mob`), not `lothlorien_deer`.
- **Sex and model**: property `lothlorien:sex` 50/50 at spawn, does without and bucks with antlers, the same two adult geometries as the deer,
  one texture `deer_white.png` (the unused white fawn texture was deleted and `make_deer.py` no longer writes it).
- **Drops (consistent with `design/drops.md`, "Deer and white deer")**: the deer's own tables by sex: doe = leather 0-2 + venison 1-3;
  buck = the same + antler 30 % on player kills. XP 1-3 on a player kill. Killing it is still a kill for Disharmony.
- **Spawn rule** (`spawn_rules/white_deer.json`): same surface, grass, light 7-15 and biome tag as the deer; **weight 1** (deer 10, whose herds
  are 2-4), **herd 1**, `density_limit.surface` **1** (at most one white deer in a player's spawn area), `distance_filter` 24-44 (a bit farther
  than the deer's 12, so it is not seen popping in), pool `animal`. Expect roughly one white deer per 25-30 deer where they spawn; tune the weight.
- **Wariness**: the same state groups and flight distances as the deer (`calm` 10 / 5 sneaking ... `l3` 30, alarmed 36 for 20 s), driven by
  `deer.js` (`DEER_TYPES` in `deer_rules.js`). Only the **Mallorn acorn** lures it (calm and Friend only, `can_get_scared`); apples do not.
  Hurting or killing it alarms deer within 20 blocks, and hurting a deer nearby alarms it too (it is shy, not deaf); an alarm ends a guidance.
- **Ordinary deer**: back to exactly its pre-`3426cec` entity, client entity and render controller (no coat, no guiding state, no corn lure).

**The offer**: right-click an adult white deer holding a **Mallorn acorn** (`lothlorien:mallorn_acorn`) while your Disharmony is 0 (Friend
included; level I and up: "shies from your restless spirit"). The entity has a `minecraft:interact` entry for a hand holding the acorn
(`use_item false`, text "Offer Acorn"): the 2.8.0 declarations say `playerInteractWithEntity` fires after a *successful* interaction, so
without an interaction on the entity the script might never hear of it (**unverified** which is needed). The script then searches for the
nearest marker; the acorn is consumed (survival) **only when guidance starts** (marker found, first waypoint found, beacon spawned).
Corn grain has no role for deer any more.

- **Marker** `lothlorien:structure_marker` (unchanged): unbreakable, full cube with the Mallorn log side texture, no item, not in the creative menu
  (the verifier warns about the missing `menu_category`: intended). One per giant Mallorn at trunk cell (2, -4, 2), about 4 blocks under the
  ground inside the buried part of the trunk. Hand-place one for testing: `/setblock <x> <y> <z> lothlorien:structure_marker`.
- **Finding the marker** (unchanged): `dimension.getBlocks(BlockVolume, {includeTypes: [marker]}, true)` over chunk-sized columns, nearest
  first, in a `system.runJob` (one column per step), radius **80 blocks**, y from 40 below to 16 above the deer, loaded chunks only.

**Walking = engine pathfinding towards a moving helper (design from "Pathfinding options / decision" below):**

- `lothlorien:guide_beacon`: no gravity, no collision, not pushable, no damage (`damage_sensor` all), fire immune, knockback resistance 1,
  collision box 0.1, not spawnable, summonable, no spawn egg; `minecraft:timer` 330 s -> event `lothlorien:expire` -> `minecraft:instant_despawn`
  (safety net: a session lasts at most 300 s). Family `lothlorien_guide_beacon`.
- **One beacon per session**, `dimension.spawnEntity` at the first waypoint. `guide_start` puts the deer in `state_guiding`:
  **`minecraft:behavior.follow_target_leader`** priority 2 (panic 1 stays above, avoid 4 below; no tempt), `leader_filters` is_family
  `lothlorien_guide_beacon`, `follow_distance 1`, `within_radius 24`, `speed_multiplier 1.0`, `always_look_for_leader true`,
  `search_cooldown 5`; plus the wolf/monster avoid goal. The deer's stroll (6) and look goals are left alone.
- **The goal choice lives in one place**: `state_guiding` in `entities/white_deer.json`. `tools/dev_scripts/guide_goal/switch_guide_goal.mjs`
  rewrites it to `follow_mob` or `target` (see "How to test and how to switch goals" below); `tests/run.mjs` fails if the group holds anything
  but one of the three prepared variants, and names the shipped one.
- Script, every **5 ticks** (`GUIDE_TICKS`): deer within 3 blocks of the waypoint -> next waypoint (`pickWaypoint`: 14 blocks ahead, shorter
  down to 8, headings 0, +-30, +-60, +-90 degrees, last-turned side first); **no progress towards the waypoint for 5 s** -> skip that heading and
  pick another (all failed: start the round again); **player lags** (more than 12 blocks) -> the beacon moves to the deer's feet, so it stands
  and waits, and goes back to the waypoint when the player catches up; **final hop** = a standable column within 5 blocks of the marker
  (the marker itself is inside a trunk), reached = arrived. A lost beacon (unloaded, `/kill`) is respawned.
- Standable column (`stand()` in `white_deer.js`): a downward ray from 6 above to 6 below the deer's feet; leaves are looked through (canopy
  over the forest floor), liquid and any `*log*`/`*_wood` block reject the column, passable plants are ignored (ray default), and an upward
  ray needs 1.9 blocks of headroom. The deer itself is **never teleported**.
- **Session end** (arrived, gave up, player gone, hurt): the beacon is removed, `guide_end` restores the stored wariness via `alarm_over`.
  Endings as before: player beyond 48 blocks, player gains Disharmony, 30 s without getting a block closer to the marker (counts as arrived
  within 14 blocks), 5 minutes, arrived within 7 blocks (horizontal) of the marker or at the final waypoint.
- **Stray beacons**: sessions are not saved, so on world load and then every 100 ticks every `guide_beacon` without a live session is removed
  (all three dimensions, loaded chunks). Exception for the experiment: a beacon **named or tagged `guide_beacon`** is left alone (its own timer
  removes it). A white deer still in `state_guiding` after a reload is released by `deer.js` within 2 s of a player being near.
- Two white deer guiding close together may follow each other's beacon: accepted by the owner (no per-area limit).
- **Not done**: guidance to a specific structure type, remembering markers, sound or particles, Phase 16 structures (pools, shrines) must place
  the marker too.

**Unverified assumptions (the experiment settles the first three):** (1) that `follow_target_leader` accepts a non-mob helper entity (no
movement, no AI) as leader at all; the docs only say "entities passing `leader_filters`"; (2) whether its leader search range is `within_radius`
(24) or something shorter, and whether it re-paths at once when the leader is teleported (`always_look_for_leader`, `search_cooldown 5`); (3) that
`follow_distance 1` makes it stop near a beacon at its feet (the "wait") rather than fidget; (4) that the beacon is truly invisible: zero-size cube
and transparent texture, but it may still cast a small shadow or show a hit box outline; (5) whether `playerInteractWithEntity` needs the
`minecraft:interact` entry, and whether the acorn (a block placer item) places a sapling instead when you miss the deer; (6) all the old items:
`getBlocks` cost, probe rays under custom ground cover, the marker surviving worldgen, placeholder white texture.

### How to test and how to switch goals if the first does not work

1. **Goal experiment first** (about 10 minutes, old world fine): `tools/dev_scripts/guide_goal/README.md` has the exact steps. In short:
   `node mods/lothlorien/tools/dev_scripts/guide_goal/switch_guide_goal.mjs --experiment`, `.\mods deploy lothlorien --quick`, then in game
   `/summon lothlorien:white_deer`, an armor stand tagged `guide_beacon` 12 blocks away, `/event entity @e[type=lothlorien:white_deer,c=1]
   lothlorien:test_leader` (then `test_follow_mob`, `test_target`, `test_off`), and the same with a named, tagged real `lothlorien:guide_beacon`.
   Afterwards `--clean` (tests fail while the test groups are in the file; the quick pre-commit verify would not stop them).
2. **If follow_target_leader does not follow**: `node mods/lothlorien/tools/dev_scripts/guide_goal/switch_guide_goal.mjs follow_mob` (or `target`),
   change the line `assert.equal(variant, "leader", ...)` in `tests/run.mjs`, `.\mods deploy lothlorien`, commit. If no variant follows the real
   beacon but one follows the armor stand, the helper must be more mob-like: give `guide_beacon.json` a `minecraft:movement` 0,
   `navigation.walk` and `movement.basic` and retest (not done yet, to keep it inert).
3. If the deer wanders at a waypoint instead of standing: override its stroll inside `state_guiding` with
   `"minecraft:behavior.random_stroll": {"priority": 6, "interval": 1000000}` (a group component of the same name replaces the base one while the
   group is on; not tested for this deer).
4. Then the full test plan below.

### Pathfinding options / decision (2026-09-30, research only, nothing run in game)

The owner rejected teleport-walking (jerky, fights `random_stroll`, animation doubtful). Full comparison, verified component
names and the experiment: `.claude/skills/bedrock-mobs/references/pathfinding.md`.

- **Dolphins do not help**: `behavior.find_underwater_treasure` is hard-wired to vanilla underwater ruins/shipwrecks
  (with `minecraft:bribeable` for the feeding); it cannot target our marker. Script API 2.8.0 has no way to set a navigation target;
  `home`/`go_home` (spawn point), POI/dweller/village goals cannot be pointed at a custom spot.
- **Chosen design: waypoint beacon** (built 2026-09-30, see above). Fallbacks in order: `follow_mob` with the same filter, then
  `nearest_attackable_target` + `move_towards_target`, ready in `tools/dev_scripts/guide_goal/`.

### White deer test plan (nothing here has been run in game; natural spawns and the marker in trees need a NEW world)

Leave and re-enter the world to load the entity and script changes. `/summon` works in an old world: steps 1 and 3-7 do not need a new
world; step 2 (natural spawns in fresh chunks) and step 8 (markers inside generated trees) do.

1. `/summon lothlorien:white_deer` a few times: white coat, pale pink ears, nose and hooves; does and bucks (antlers); never a fawn. Spawn egg
   "White Deer Spawn Egg" in the creative menu; using an egg on a white deer does nothing special. A lead does not attach. Content log clean
   (watch for `guide_beacon` geometry or render errors too).
2. NEW world, natural spawns: walk the biome; white deer appear alone, rarely (count deer and white deer over a while), never in the herds.
3. `/give @s lothlorien:mallorn_acorn 16`; with Disharmony 0 hold it: a calm white deer comes to you (tempt), an apple does not lure it.
   Ordinary deer: acorn and apple lure them as before, corn grain does not.
4. No marker: right-click an adult white deer with the acorn far from any giant Mallorn (old world, no markers): "has nowhere to lead you",
   acorn NOT consumed. The hover text says "Offer Acorn".
5. Manual marker: `/setblock ~30 ~-4 ~ lothlorien:structure_marker`, then offer the acorn: "takes the acorn ... Follow it", acorn consumed
   (survival only). **Watch the walk**: real walk animation, jumps up blocks, goes round trees and pits, avoids water, no sliding or teleporting;
   it moves in hops towards the marker, stops and waits when you are more than 12 blocks behind, carries on when you catch up, and stops near
   the marker with "A great tree stands near". No visible beacon, no shadow travelling ahead of it.
6. Refusals and endings: `/scriptevent lothlorien:disharmony 1`, offer: "shies from your restless spirit". Start a guidance, then
   `/scriptevent lothlorien:disharmony 3` or hit the deer: it stops (hit: deer nearby bolt). Walk 50 blocks away: it gives up. After each
   ending `/testfor @e[type=lothlorien:guide_beacon]` should find nothing within about 5 s.
7. Save and reload mid-guidance: the deer returns to normal wariness within about 2 s of you being near; no beacon left
   (`/testfor @e[type=lothlorien:guide_beacon]`).
8. NEW world: find a giant Mallorn, dig down beside the trunk base: in survival the marker cannot be mined (looks like log bark); in creative
   `/testforblock` at trunk cell (2, -4, 2) relative to the trunk's north-west corner at ground level should say `lothlorien:structure_marker`.
   Summon a white deer within 80 blocks and offer an acorn: it leads to the nearest giant (up to 80 blocks, over hills and round trunks).
9. Two players: only the offering player is followed; a second player at Disharmony 3 nearby does not change the guidance. Two white deer
   guiding close together may swap beacons (accepted).
10. Performance: the marker search must not spike a tick (job-sliced); try with a high render distance.
