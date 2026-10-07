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
(its actionbar shows depth) and `harmony [value]` (the deer test plan needs it; was `disharmony [points]` before 2026-10-07). Dev tooling belongs outside the packs.

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
`button`, `pressure_plate`. Textures and models are generated by `tools/make_mallorn_*.py` (final; only the
leaves are a placeholder); art status is in `GRAPHICS_TASKS.md`. Every block except leaves/double slab has an item
that *replaces* the auto block item (needed for `minecraft:fuel`; the door also gets a 2D icon).
Recipes and unlocks mirror vanilla wood types (planks from log/stripped log/wood/stripped wood
unlock on that item; the rest on planks; wood/stripped wood on log/stripped log).

**Two plank sets (2026-09-30).** Planks from log/wood are the silver `mallorn_planks`; planks from stripped
log/wood are `mallorn_heartwood_planks` (recipes `mallorn_heartwood_planks_from_stripped_{log,wood}`). The
heartwood family (`mallorn_heartwood_` + planks, stairs, slab, double_slab, fence, fence_gate, door, trapdoor,
button, pressure_plate) is **generated** by `tools/make_heartwood_set.py` from the silver files: identifiers,
texture keys and map colour swapped, geometry shared. Change the silver block, then re-run it (the test "two
plank sets" fails when they drift). `blocks.js` lists both sets in `WOODS` (slab merge, button/plate support
loss); a double door pairs only with the same kind of door. Silver and heartwood fences connect to each other.

**Carved fence (2026-10-01, owner: "beautiful" in game; icon and rail colour fixed after, recheck).** `tools/make_mallorn_fence.py` writes
`mallorn_fence.geo.json` (bones `post`, `north_rails`, `south_rails`, `west_rails`, `east_rails`: same names and
`bone_visibility` as before) and `mallorn_fence_carried.geo.json` (icon; its `item_display_transforms` are read
back and kept). Each rail is one 2x2 cube tilted 22.5 deg about x (inverted V towards the block edge); the other sides
are the north rails turned in quarter steps. Post faces use the block's `*` material (`mallorn_fence_post`, 4 sides x 4
columns); the rails and cap read a leaf-free strip of it (columns 5-6), grain turned along the rail with per-face
`uv_rotation` (owner: rails on the planks' lit edge looked white). Geometry format **1.26.50**: the icon keeps a `shelf`
display transform, which the game only accepts from 1.26.40 and otherwise drops the whole file (icons vanished, 2026-10-01).
Selection and collision boxes are unchanged. The test "fence: every material instance ..." checks both sets.

**Carved fence gate (2026-10-01, variant C; owner: works in game, liked).** `tools/make_mallorn_gate.py` (`VARIANT = "C"`) writes
`mallorn_fence_gate_closed.geo.json` (bones `posts`, `rails`; its `item_display_transforms` are read back, icon pose
`[30,135,0]` kept) and `_open.geo.json` (bones `posts`, `leaves`), sharing `seg()`/`turn()`/`geometry()` with the fence
generator. The +x half is built along z, turned onto +x; the -x half is it turned 180 deg. Open = each half turned a quarter
about its post (+x about (7,0) once, -x about (-7,0) three times), so the leaves lie at z -1..-7 like the old open model and
inside the open selection box. Both sets now use the `*` texture `mallorn_fence_post` / `mallorn_heartwood_fence_post`
(no new texture key). States, permutations, boxes, sounds, redstone and recipes unchanged. Test "gate: ...".

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
  every 4 ticks (`minecraft:tick`). East/west wall buttons use `mallorn_button_ew(_pressed)` (a 4x6 box; the
  z-axis tilt of the 6x4 box stood them upright; `uv_rotation` 90 keeps the plank grain horizontal). The plate has
  `minecraft:placement_filter` `allowed_faces: ["up"]`: placed only on top of a block, popped off when it goes. Support loss is handled in `blocks.js` (breaking the block they sit on).
- Left out (signs, shelf, boats, ...): see `NOT_IMPLEMENTED.md` for reasons and retry notes.
- **Icons (2026-09-30; owner confirmed in game 2026-10-01 that the menu icons look right, 1.26.52).** Owner saw the stairs and gate icons turned, the slab big and high, the fence turned. Every non-cube plank-family block now names an icon geometry in `minecraft:item_visual` whose `item_display_transforms.gui` sets rotation, scale 0.625 and `fit_to_frame: false`: stairs `mallorn_stairs_item` (straight stair, tall half east, `[30,135,0]`, written by `gen_stairs.py`), gate `fence_gate_closed` `[30,135,0]`, slab `slab_bottom`, trapdoor, pressure plate `[30,225,0]`, fence `fence_carried` `[30,225,0]` translation -1 scale 0.62, button `mallorn_button_item` `[30,225,0]` (Java's 6x4x4 box looked turned and too wide in game, 2026-10-01; now 2x4x6 with the long face east; owner confirmed it in game 2026-10-01). Placed blocks, permutations and boxes are unchanged. Door keeps its 2D icon; planks/logs/wood are cubes. Poses come from Kaioga's 1.26.50 templates; the rule is in `bedrock-block-families/references/families.md` "Item icons", the test is "icons: ..." in `tests/run.mjs`. Check in game next to vanilla oak: stairs (tall half back left), slab (low, vanilla size), fence and gate (same diagonal as vanilla), trapdoor, plate, button.
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

Shipped: two lookout trees (round 5 and 7: flet, ladder, loot chest) and four plain giants (roundplain 2, 3, 6 and
8), generated as one jigsaw structure (`lothlorien:giant_mallorn`) in the biome, about 1 in 4 with a flet.
Accepted in game but not measured separately: whether the trunk anchor keeps trunks at least 48 apart, and
whether any jigsaw block is left at a trunk base. Recheck these if two giants ever look too close.
The history below is kept because it records the traps.

- **What:** round trunk (owner's design, 2026-10-01: the 4x4 with its four corner cells cut, 12 cells), 30-38 high (tip
  narrows to 2x2), sunk 5 blocks into the ground. Its foot is a flare of `mallorn_wood` (see **Round trunk** below).
  A plank platform (radius 5.5-7, fence rim) sits on 6-8 level branches 9-12 below the top. A vanilla
  ladder runs up the north face of the trunk (column x 1, z -1) through a hole in the floor. A chest
  against the east face uses `loot_tables/chests/mallorn_flet.json`. There are no leaves from the floor
  to 3 above it within radius+4, so the view is open.
- **Leaves** are normal worldgen leaves (`persistent` false). Any leaf more than 8 steps through leaves
  from a log is dropped at generation time (decay reach is 10), so nothing thins out later. There are
  about 5-10 such leaves per tree.
- **Variants** (`VARIANTS` in `tools/build_structures.mjs`, options of `buildFletMallorn`). Tree NN of every
  variant uses the same seed. Two ship: `round` (lookout tree) and `roundplain` (`flet: false`: no platform, ladder
  or chest). Both use `woven` + `lush` + `round`.
  - `woven`: the support branches run at floor level through the platform, planks fill the gaps, and their leafy
    ends reach past the rim. `lush`: 1-2 whorls of leafy level branches on the bare trunk plus longer leafy low branches.
  - The older square-trunk variants (`flet`, `woven`, `plain`, shipped until 2026-10-01) were dropped; the options
    still exist in `buildFletMallorn`, so they can be recreated (git before the round-trunk commit `d09188f`).
  - To experiment, add an entry to `VARIANTS` and the name to `VARIANTS` in `tools/dev_scripts/showcase.js`, then run
    `node tools/build_structures.mjs <variant>`.
- **Round trunk** (owner, 2026-10-01, seen in game in a flat world; accepted). Built from scratch after a first try
  (square roots plus corner patches) looked blocky:
  - The trunk is the 4x4 without its corner cells. Diagonal branches start on the face cell beside the missing
    corner (their first step is along x), a straight north branch never starts on the ladder column, and the ladder
    moved to x 1.
  - `roundFoot`: a skirt 2 high round the trunk plus 5-7 buttress ridges (reach 1-3 cells, up to 4 high at the
    trunk, narrowing and dropping outwards), uneven by design, filling the cut corners where wide. Above ground it
    is `mallorn_wood` (bark on top too), below ground logs down to -5. It has its own random generator, so the rest
    of a tree is the same for a seed. The ladder column and the cell in front stay free.
  - Trap: a root beside a cut corner touches the trunk only diagonally, and per-slot roots looked like columns.
    A radial flare does not have either problem.
- **Chosen for worldgen (seeds 2026-09-29, round trunk 2026-10-01): round 5 and round 7** (`CHOSEN` in `tools/build_structures.mjs`). Only
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
    - The pool (`CHOSEN`, with weights) holds the flet trees round 5 and 7 at weight 2 each and the plain
      giants (roundplain) 2, 3, 6 and 8 at weight 3 each, so about 1 giant in 4 has a flet.
    - The set is spacing 6 / separation 2. About 5 giants per medium patch, about 1-2 of them flets, which
      is roughly what a separate flet grid of spacing 12 would give.
    - One set means two giants never compete for space. Structure sets cannot exclude each other; Java's
      `exclusion_zone` is not in Bedrock's documented fields.
    - Trunk anchor: every piece's bottom trunk cell (1, -5, 1) is a `minecraft:jigsaw` block
      (`JigsawBlock` entity: name `lothlorien:giant_trunk`, target and pool `minecraft:empty`, final_state
      `lothlorien:mallorn_log`), and the structure's `start_jigsaw_name` is that name. The trunk should
      then sit on the start point however the piece is rotated, so trunks are at least 3 chunks (48
      blocks) apart.
    - Plain giants are variant `roundplain` (`flet: false`; `plain` before 2026-10-01): woven branches and lush foliage, no platform, ladder
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
    correctly? Test with the dev-only `showcase round 7 90` (`tools/dev_scripts/showcase.js`). If branch logs point the wrong way,
    use `mallorn_wood` (the same on every side) for branches.
- **Curation** (helper moved out of the pack 2026-09-30 to `tools/dev_scripts/showcase.js`; git `dc1182e`): `/scriptevent lothlorien:showcase [variant]` lays out candidates on a grid (4 per row, 48
  apart, variants in separate rows) south-east of the player, with a sign such as "round 3" in front of
  each ladder. Trees in unloaded chunks are retried for 3 minutes. `/scriptevent lothlorien:showcase round 3`
  places one tree next to you (a bare number means round).
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
open air below. One particle per player per 12 ticks, so it is sparse by design. Since 2026-10-02 the texture is a 40x8 sheet (4 leaf shapes + 1 blossom, `tools/make_falling_leaf.py`) and the particle picks a frame with molang in `uv` (`particle_random_1 < 0.14 ? 4 : floor(particle_random_2 * 4)`) and a size 0.10-0.14; to check in game.

**Untested in game** (written without game access): everything above. Check first: (1) plants and carpet appear
in the creative menu and place on grass; (2) `/place feature lothlorien:select_mallorn_tree_with_litter_feature`
leaves carpet and blossoms around the trunk; (3) heightmap y in `after_surface_pass` may land on canopy, in
which case flowers only appear in the open (expected); (4) `scatter_chance` is accepted in the rules;
(5) particle spawns, falls and disappears on the ground; (6) creative groups `itemGroup.name.flower` / `.leaves`.

### Vanilla plants in the biome (checked against the 1.26.50 feature rules, 2026-09-29)

Vanilla places plants by biome tag, and the only removal lever is the tag. The biome has `overworld` (needed for
ores, caves, structures, spawns), `bee_habitat`, `lothlorien`, no `forest`. Rules that still match:
`scatter_tall_grass_feature` (grass and tall grass, the wanted ground cover), `scatter_overworld_flower_feature`
(dandelion/poppy mix, 1 chunk in 32), pumpkins (1 in 300), reeds near water (1 in 6), extra mushrooms.
Ferns, forest flowers and forest grass belong to `forest`/`taiga`/... tags and do not apply. The leftovers are rare and
deliberately not fought: excluding them needs a tag such as `plains` or `mooshroom_island`, which also switches on
villages or mooshroom spawns. Decorative wild flowers were tried and removed (see below). **Wild flowers REMOVED 2026-10-02 (owner).** The custom two-block rose bush / peony / lilac features never showed up in game; the native route (our own rule calling `minecraft:legacy:flower_forest_flower_feature`, no biome tag, because the `flower_forest` tag also brings vanilla trees, bee and rabbit spawns and camps) produced poppies and bushes but no big flowers. All `wild_*` features and `wild_flower_patch_feature_rules` were deleted. Maybe later: Elven roses as our own plant (owner idea). The two-block placement notes in the Phase 6 tuning text above are historical.
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
own grass). Bone meal table: golden fern 12 -> 8, plain fern 6. **Owner 2026-10-02: too much golden fern (huge patches, the floor is already golden from litter and leaves): the rule is now 1 iteration (was 2) at 1 chunk in 2, the patch 10 tries (was 16) within a gaussian +-4 (was +-6): about 3.5x fewer ferns, in small patches.** Bone meal table unchanged.

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
**Flicker, 2026-10-02 (owner in game):** the two saplings STOPPED flickering when their geometry changed from box-UV zero-thickness cubes (which carried degenerate top/bottom faces) to the single-face `plant_cross` model. So the cause there was the model, not the texture. The Mallorn leaves still flicker; they are `minecraft:geometry.full_block` with three textures (up/down/side) and `alpha_test`. Next test ideas, cheapest first: (1) leaves with a vanilla leaf texture on all faces (art vs block definition); (2) a custom cube inset by 0.01 so faces of neighbouring leaf blocks are not coplanar (top green / bottom silver textures fight on stacked leaves; side faces meet mirrored). **Test 1 (2026-10-02, owner in game): vanilla `leaves_oak_carried` on all faces of the Mallorn leaves STILL flickered, vanilla leaves do not**, so the cause is the block definition / texture data, not our art. Online search: Microsoft's material_instances reference lists the render method `alpha_test_to_opaque` ("used for a block like the leaves": cutout near, opaque far; vanilla leaves use it; `alpha_test_single_sided_to_opaque` is "used for a block like the sugar cane"), and the wiki says custom leaves should use `minecraft:culling_layer.leaves` (needs creator features, not used, see `bedrock-blocks` notes). **Test 2, deployed 2026-10-02:** `mallorn_leaves` uses `alpha_test_to_opaque` on all instances; `mallorn_golden_leaves` stays `alpha_test` as the control. Both leaf textures now carry a dark neighbour colour under their transparent texels (`shade_hidden` in `make_mallorn_leaves.py`; vanilla leaves keep dark green there, ours was black, which the far render shows as black holes). **Result (owner in game, 2026-10-02): the flicker is unchanged on both leaf blocks, BUT the leaves were invisible from far away before and are now visible: `alpha_test_to_opaque` (with the dark hidden colour) fixed that. KEEP IT. Both leaf blocks use it now (the golden leaves too, since the control is no longer needed).** The flicker is still open; remaining ideas: an inset cube (0.01) so neighbouring faces are not coplanar, `minecraft:culling_layer.leaves` (creator features), comparing every other component of vanilla leaves with ours (`light_dampening`, tags, `isotropic`, face dimming). **Test 3, culling (2026-10-02): it STOPPED the flicker on the Mallorn leaves (owner: only the golden leaves, still on `full_block`, flickered), but the canopy looked hollow and it needs the experimental 'upcoming creator features' toggle, so it was reverted.** Custom 16x16x16 cube + `block_culling` rules (format 1.21.80, `same_culling_layer`, six faces) + `culling_layer: minecraft:culling_layer.leaves`. Conclusion: the flicker is z-fighting between the coplanar faces of touching leaf blocks (green top vs silver bottom, mirrored sides). (The content log of that session held only Molang errors of other packs' player animations, none from lothlorien.) **Test 4, inset cube (deployed 2026-10-02):** both leaf blocks use `geometry.lothlorien.mallorn_leaf_cube` (`tools/make_leaf_cube_geo.py`, inset 0.1 model unit per side: all faces drawn, no hollow canopy, no toggle; the faces of two touching blocks are 0.2 unit apart). Material instance names `up` / `down` / `side` (golden leaves alias all three to one picture). **Result (owner, 2026-10-02): the flicker was gone at inset 0.1 (isotropic off) but the gap between leaf blocks was slightly visible; at inset 0.05 with `isotropic` on, the flicker CAME BACK. The owner turned the inset cube OFF (both leaf blocks are `minecraft:geometry.full_block` again, material instances `up`/`down`/`*`) and kept `isotropic` on up/down (the trees look better). LEAF FLICKER IS UNSOLVED.** What is known: it stops with data-driven culling (hollow canopy, experimental toggle) and with a 0.1 inset cube (visible gap); it does not depend on the texture (vanilla texture still flickers), the render method (`alpha_test_to_opaque` fixed the far-away invisibility but not the flicker) or the colour under the holes. Not known whether `isotropic` or the smaller inset brought it back at 0.05. Cheap next tests: inset 0.1 with isotropic on (separates the two causes); inset only on the faces that are up, north, east (halves the visible gap); the remaining comparison items (friction, face_dimming, `ambient_occlusion` 0.8 on the sides). **Test 5, culling layer on the built-in cube (deployed 2026-10-02):** `mallorn_leaves` has `"culling_layer": "minecraft:culling_layer.leaves"` on `minecraft:geometry.full_block`, no custom cube, no `block_culling` file, experimental toggle OFF (copied from Kaioga's Block Templates 1.26.50 leaves, which claim no toggle; Microsoft still calls it experimental). `mallorn_golden_leaves` is unchanged as the control. Check: does the green canopy still flicker, does it look hollow, and is there a content-log error about `culling_layer`? **Result (owner in game, 2026-10-02): the flicker is still there; no content-log error about `culling_layer` with the toggle off. Reverted.** Owner, same day: no inset-cube tests for now; the leaf flicker stays open.

### Mallorn leaves vs vanilla leaves, parameter by parameter (2026-10-02)

"Disk" = read from the vanilla resource pack in `reference/vanilla/current/resource_packs/vanilla/blocks.json` (client side). Vanilla's behaviour
values are hardcoded in the engine (no JSON on disk); those rows come from the Minecraft wiki and Microsoft's reference and are marked "docs".

| Parameter | Vanilla leaves | Ours | Verdict |
|---|---|---|---|
| render_method | `alpha_test_to_opaque` (docs) | `alpha_test_to_opaque` | same since 2026-10-02 (fixed the invisibility from far away) |
| faces sharing a plane | culled by `culling_layer.leaves` (docs) | plain `full_block` again (inset cube tried 2026-10-02, flicker unsolved; `make_leaf_cube_geo.py` kept, not in use) | culling stopped the flicker but made the canopy hollow and needs the experimental toggle; the 0.1 inset cube stopped it too but showed a gap |
| ambient_occlusion | exponent 0.8 (disk) | 0.0 | deliberate: faces next to logs went black (verified in game); keep |
| isotropic | `up` and `down` true (disk): the top and bottom texture is turned randomly per position | not set | **deployed 2026-10-02** on `up` and `down` of both leaf blocks (owner agreed, "may be good for other reasons"); to check in game: the canopy seen from above should not repeat one pattern, and the green top / silver bottom must still look right turned by 90 degrees |
| textures | atlas entry `leaves` holds 4 textures plus 4 `_opaque` twins (disk) | one texture per face; hole texels carry a dark neighbour colour | equivalent (the opaque far render shows that colour) |
| tint | foliage tint by biome (carried texture pre-tinted) | colours baked, never tinted | by design |
| sound | `grass` (disk) | `grass` | same |
| hardness / blast resistance | 0.2 / 0.2 (docs) | 0.2 / 0.2 | same |
| flammable | 30 / 60 (docs, Java values) | 30 / 60, lava always | same |
| light dampening | partial, 1 (docs) | 1 | same |
| redstone conductor | no | no | same |
| tool | hoe and shears; drops only with shears / silk touch (docs) | `is_hoe_item_destructible` only | gameplay difference, not visual |
| states | `persistent_bit`, `update_bit` | `lothlorien:persistent` + script decay (reach 10, vanilla 4 in Bedrock) | by design (big trees) |
| waterlogging, composting 30 % | yes (docs) | no | not done, not visual |
| friction | engine default for leaves, not on disk | default | not compared |

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
  (about 6 HP), Speed I 30 s, lifts Poison. Recipe (3x3): `ENE / SHS / NSL` = 2 Elanor, 2 Niphredil, 3 salves (6 Athelas), 1 Mallorn nectar (Phase 14b; was a honey bottle), 1 leather.
  Balance: one sip is a Healing II potion plus a run, so the skin is paid up front (about 10 items, 3 glass bottles' worth) and throttled by the cooldown.
  **Verified in game (was unverified):** `onCompleteUse` firing for a non-food item with `use_modifiers`, cooldown starting on use, durability bar showing, `durability.damage`
  write-back via the mainhand slot. If `onCompleteUse` does not fire, fall back to `onUse` + a manual timer.
- Effects come from script because item-JSON food effects are not available in format 1.26.50 (not verified; scripts are the working pattern here).
- **Test list:** items appear in the creative menu and recipe book (salve unlocks on picking up Athelas, Miruvor on getting a salve); drink
  animation and can-drink at full hunger; effects apply; numbers feel expensive but not silly (Phase 20 balance pass).

## Harmony (2026-10-07, built; unit tests only, NOT yet tested in game)

Replaces Disharmony (the Phase 9 section below is superseded). Spec, numbers and in-game checks: `docs/design/harmony_rework_plan.md`.

- **Files.** `scripts/harmony.js` (pure, tested: constants, `bandOf`, `DEED_COSTS`, `applyPenalty`, `recordDeed`, `recordDeath`, `tick`,
  `statusText`, `BAND_ICONS`, `serialize`/`parse`), `scripts/harmony_game.js` (wiring), consumers `deer.js`/`deer_rules.js` (wariness per band),
  `squirrel_rules.js`, `white_deer_rules.js`, `unicorn_rules.js` (refusals), `elven_warden.js` (fight hook). Commit `5587e94` (rules, consumers, Hated
  wardens, texts); icons and docs came after it.
- **Model.** One integer -60...+10 per player. +1 per 60 s inside the forest (to +10), +1 per 120 s outside but never above 0. A deed restarts the minute
  timer; above 0 a cost counts double. Bands: Friend +10, Guest 0..9, Uneasy -1..-14, Shunned -15..-29, Hated -30..-60.
- **Storage.** Dynamic property `lothlorien:harmony` = `{harmony, timer}`, **written only when the value changes** (the old code wrote every second). No
  migration: the old `lothlorien:disharmony` property is ignored. Debug: `/scriptevent lothlorien:harmony [value]` shows or sets it.
- **Deed classification** (`entityDie`, only `damageSource.damagingEntity` = player, projectiles included; counts when the player **or** the victim is inside
  the forest): `inanimate` family nothing; `lothlorien:unicorn` 10; `lothlorien:white_deer` 6; `lothlorien:elven_warden` kill 6; player 3; `monster` family 1; any other mob (animal) 3.
  A warden *fight* costs 1 (first player hit after 60 s, `recordWardenFight` in `harmony_game.js`, called by `elven_warden.js`). Dying changes nothing except
  dying inside the forest while Hated: set to -29.
- **Hated tag.** The script keeps the player tag `lothlorien_hated` in step with the band (set on entering Hated, removed on leaving, checked on join);
  `entities/elven_warden.json` `nearest_attackable_target` has an entry for players with `has_tag lothlorien_hated`. Not yet seen in game.
- **Display.** Action bar, inside the forest only: `<icon> <band name>`, no number. Icons are a custom font glyph page `lothlorien_rp/font/glyph_E5.png`
  (256x256, 16x16 cells, cell n = U+E500+n: friend, guest, uneasy, shunned, hated), generated by `tools/make_harmony_icons.py`; `BAND_ICONS` in `harmony.js`
  holds the characters. **Documented, not yet verified in game: that an add-on glyph page renders in the action bar** (technique in the `bedrock-art` skill,
  `references/font-glyphs.md`). Chat: one line per band change, a rate-limited hint (30 s) for a deed that keeps the band; texts are in `localization/catalog.json`.
  The glossary entry `glossary.disharmony` is still the old word (changing the glossary would invalidate every translation).

## Disharmony core (Phase 9, 2026-09-30) - SUPERSEDED by Harmony above (kept as history)

- Rules in `scripts/disharmony.js` (pure, tested), wiring in `scripts/disharmony_game.js`; state per player in dynamic
  property `lothlorien:disharmony` (`{points, calm, friend}`). `/scriptevent lothlorien:disharmony [points]` shows or sets it.
- Decided with the user: a point decays after **3 min inside** the biome, **6 min outside** (KB said "inside only"; changed).
  Status text is shown on the actionbar only inside the biome. **The actionbar belongs to this status** (and the dev debug readout):
  one-off messages (white deer, Great Mallorn sprout) go to chat, or they overwrite the status (owner, 2026-09-30; a test checks it). A kill restarts the decay timer; **player death resets
  points and all timers**. Friend = 10 minutes at 0 points inside; progress is paused outside (neither gained nor lost) and Friend lasts
  outside (status just hidden); only a kill or a death loses it.
- A kill counts when a player is `damageSource.damagingEntity` (projectile shooters included) and the victim stood in the biome.
  It adds `killWeight(typeId)` points (`KILL_WEIGHTS` in `disharmony.js`): 1 for anything, **2 for the white deer** (owner, 2026-09-30:
  a white hart counts as two deer; 0 points -> Disharmony II at once, each point still decays on its own timer).
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
- **Harmony avoidance without per-player filters** (was Disharmony until 2026-10-07): entity filters cannot read a player's Harmony (it is a
  dynamic property). So the entity has one component group per wariness state (`lothlorien:state_calm|l1|l2|l3|friend|alarmed`),
  each holding its own `behavior.avoid_mob_type` (flight distance, sneaking halves it) and, where allowed, `behavior.tempt`.
  `scripts/deer.js` runs every 2 s: each player votes with their own state for the deer within 40 blocks, the most severe state among
  players inside their own state's flight radius wins (none close enough: the nearest player), and the script fires `lothlorien:set_<state>` only when the `lothlorien:wariness` property differs. Trade-off: the avoid component still flees from every player at the winning state's distance.
- **Alarm**: a player hurting (or killing) a deer fires `lothlorien:alarm` on every deer within 20 blocks: group `state_alarmed`
  (flee 36, no luring) with a `minecraft:timer` of 20 s whose event `lothlorien:alarm_over` re-triggers the state stored in
  the property. The script skips deer with `lothlorien:alarmed` so it never cuts an alarm short.
- **Food**: Western Corn grain (`lothlorien:western_corn_grain`) is the deer's only food since 2026-09-30 (owner): tempt, `breed_items` and the
  fawn's `ageable.feed_items`. Before it was Mallorn acorn or apple; the acorn now belongs to the white deer only. Seeds do not count.
- **Goal priorities matter**: breed 2, tempt 3, avoid 4. Tempt must outrank avoid or a deer lured with corn would run away
  the moment the player comes within flight distance (edge oscillation). Breeding must outrank both or it never completes
  with the player standing next to the pair.
- **Priority alone does not keep a lured deer (playtest 2026-09-30)**: deer walked up to a player holding corn, then fled even when
  the player stood still. Tempt stops once the deer has arrived, and avoid (flight 10 blocks) takes over. Fix: in calm and Friend, the
  player entries of `avoid_mob_type` also need `has_equipment` (subject other, domain hand, operator !=, the lure item), and
  `can_get_scared` is false. Fed deer get `lothlorien:tame` -> `state_tame` (no flight from players): `set_calm`/`set_friend` are
  sequences (reset, then add `state_calm`/`state_friend` or `state_tame` by the property); every state event removes `state_tame`.
  `deer.js` tames on corn interaction and untames the one a player hurts; `white_deer.js` tames at guide start.
  Tame and untame are entity events (`become_tame`, `untame`), not `setProperty`: a property set by script is invisible to
  getProperty and event filters until the next tick, so `set_calm` in the same tick would still add `state_calm` (bug in the
  first version, caught before a playtest). The state event is re-applied one tick later.
- **Tame or leashed deer are kept** (owner, 2026-09-30: "mimic tamed animals"): group `lothlorien:kept` = `minecraft:persistent`.
  The engine exempts vanilla tamed mobs (`minecraft:is_tamed`), not our property, so persistence is explicit. `untame` removes it
  only when `is_leashed` is false; `unleashed` only when `lothlorien:tame` is false.
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
2. Walk at a deer: it should flee at ~10 blocks (5 when sneaking). Hold Western Corn grain: it comes closer (acorn, apple and corn seeds do not lure); run at it: it gets scared.
3. `/scriptevent lothlorien:harmony -40` then approach: flight at ~30 blocks (Hated), corn no longer lures. `... 0`, wait: back to 10. Friend (`... 10`, or 10 peaceful minutes inside the biome): you can walk up to ~3 blocks.
4. Hit one deer (or shoot): the rest of the herd within 20 blocks bolts for ~20 s.
5. Run animation: does the gallop show while fleeing? Does it show while strolling (it must not)? Adjust the 3.5 threshold.
6. Kill a few: venison, leather, bucks sometimes antlers; cook venison in furnace, smoker, campfire; eat it.
7. Breed two with Western Corn grain: fawn appears, follows parent, grows up in about 20 min (corn grain speeds it up), a buck fawn gets antlers when grown. Acorns do nothing to deer.
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
  frequency is lower than the 1/16 per chunk on paper. (An earlier version replaced the litter; the user did not want antlers to look like they float.)
- **Natural drop**: rule `deer_antler_drop_feature_rules` (after surface pass, biome tag, `scatter_chance` 1/16 per chunk) -> scatter of 3
  tries within about 3 blocks -> weighted pick of four facings, all `up`. Was 1/64 (between giants, ~1/36, and lookout trees,
  ~1/144); raised to 1/16 on 2026-10-02, see below; a test pins it. Real frequency will be lower (tries on leaves, water or off-biome fail): tune
  the denominator after walking around.
- **Worldgen verified in a save (2026-10-02, 1.26.5x, `tools/world_scan.py`)**: world "T" had 97 Lothlorien chunks saved and antlers in
  2 of them (4 antlers: one at -97 106 -159, three at 10..11 98 -181..-184), all `up` on grass. So the feature works and the rate is
  about 1/50 chunks as planned; the owner roamed several Lothloriens without seeing one, so on the floor under the canopy that is too rare to find.
  **Owner decision: raised to 1/16 per chunk** (about one site per ~12 chunks); not yet seen in game.
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

### Grass under plants and covers (DONE, owner verified in game 1.26.52, 2026-10-01)

All plants, covers and thin blocks have `"minecraft:light_dampening": 0` (the default 15 casts a full shadow).
That is not enough under the canopy: Bedrock bug **MCPE-184249** (https://bugs-legacy.mojang.com/browse/MCPE-184249)
turns grass under custom plants into dirt in low light anyway; vanilla plants are exempt. Background and failed
attempts: `.claude/skills/bedrock-blocks/references/blocks.md` ("WORKAROUND: grass under custom plants").

**WORKAROUND (owner's idea; remove when Mojang fixes the bug):** the grass may die, the plant hides it. Elanor,
Niphredil, Athelas, golden fern, leaf carpet and blossoms have state `lothlorien:on_grass`; when true they draw a
biome-tinted grass top 0.1 px above the ground (`*_grass` geometry twins, material `grass_overlay` = vanilla
`grass_top`, `tint_method: grass`). The flowers use `geometry.lothlorien.plant_cross` (a copy of the built-in cross).
Applied by `.claude/skills/bedrock-block-families/scripts/add_grass_overlay.py` (re-run after `gen_ground_cover.py`).
`scripts/grass_overlay.js` sets the state on player placement when the block below is grass; worldgen features
place it true; bone meal calls `markOnGrass`. Breaking a plant with the state turns the dirt below back into grass.
Only place/break events, no timers (owner: no regularly running scripts). Deer and white deer also spawn on `dirt`.

- Not covered: removal without a player (explosion, water, piston, fire) leaves dirt; slope edges show dirt sides.
- Rejected on the way (owner, 2026-10-01): a 15-30 s tick restoring the grass (`afc6019`); test components
  `precipitation_interactions none` / `replaceable` (`506c5da`) did not help.
- **To switch off:** revert `defae73`, then remove `add_grass_overlay.py` and its notes in the skills.

## White deer guidance (Phase 12, 2026-09-30, rebuilt with engine pathfinding; DONE: owner playtest 1.26.52 - guidance, gift and nut growth work)

**Gift (owner, 2026-09-30, replaces leading to flet giants; static checks only):** leading to the nearest flet marker was no better
than wandering (the 80-block, loaded-chunk search only found trees already in sight). Finding farther trees is not possible from
script: the placed jigsaw instances live in the world save with no API; `/locate structure` finds them but `runCommand` returns only
`successCount`; Script API 2.8.0 has no world seed (random_spread positions need it); `getBiome`/`getBlock` throw in unloaded
chunks; and random_spread cannot be made a fixed grid (separation must be under half the spacing). So the deer now chooses the
destination itself: `findGiftSpot` (white_deer.js) samples the surface biome on an 8-block grid within 96 blocks (loaded chunks
only; other biomes = known border, rivers ignored), then 16 headings on rings 56..36 blocks (`GIFT_RINGS`, great_mallorn_rules.js;
inside the default simulation distance of 4 chunks whatever the player's setting, owner's wish) with Lothlorien biome and standable
ground (`groundFeet`). `pickGiftSpot`: farthest from any known border wins, ties within 8 blocks go to the longer walk. First version
(same day) took the farthest ring with any spot inside and used depth only within it: the owner was led to the edge (a far edge spot
beat a nearer deep one, and `depthAt` at a far spot probes 40 more blocks out, into unloaded chunks, so it reads low).
Dynamic properties on the deer:
`lothlorien:gift_spot` (JSON, kept until the gift is laid, so a broken guidance resumes with another acorn) and `lothlorien:gifted`.
On arrival `giveGift` spawns the nut (lore set by script: JSON items have no lore) with totem particles. `ARRIVE_DIST` 3 (the spot is
standable; `pickWaypoint`'s final ring now starts at radius 0). The marker block (`lothlorien:structure_marker`) and its search were removed
the same day (owner): gone from the flet giants (rebuilt; plain giants byte-identical), the block file, lang and tests. Worlds generated
before keep one buried block per flet giant, 4 below the ground inside the trunk, which now loads as an unknown block.
The nut (`items/great_mallorn_nut.json`, `blocks/great_mallorn_sprout.json`, `scripts/great_mallorn.js` + `great_mallorn_rules.js`, art
`tools/make_mallorn_seeds.py`): the sprout copies the sapling's states, soil filter and geometry; random tick stage 0 -> 1 -> grow. Growing
reads the structure's filled cells once per session (`Structure.getBlockPermutation` over 40x54x40 in job steps), checks each against the
world with `isNatural` (terrain, plants, leaves, unstripped logs, water; anything else = built = wait and tell players within 32 blocks,
at most every 5 min), then `structureManager.place` with the sprout in trunk cell TRUNK_AT+1 at ground level (`treeOrigin`). The
jigsaw anchor block in the bottom trunk cell is replaced by `mallorn_wood` after placing (script placement keeps jigsaw blocks). Any
part of the space unloaded = try again on a later tick. Untested: growth time, the obstruction message, rotation (none: always north).

History: the first build (commit `3426cec`) made the white deer a coat variant of `lothlorien:deer`, lured and offered with
Western Corn grain, and walked it by script teleport steps. The owner rejected teleport-walking and asked for a separate
animal offered a Mallorn acorn; this section describes the rebuild. Second owner round (2026-09-30, built the same day, static checks
only): leashable with "a lead always wins", always an antlered hart with a sure antler drop, a kill costs Harmony (6 since 2026-10-07; 2 Disharmony points before), natural
spawns thinned by depth, markers only in Mallorns with a chest (markers later removed, see Gift); ordinary deer eat only Western Corn grain.

Files: BP `entities/white_deer.json`, `spawn_rules/white_deer.json`, `loot_tables/entities/white_deer.json`, `entities/guide_beacon.json`,
`scripts/white_deer.js` (game wiring, gift spot and delivery), `scripts/white_deer_rules.js` (pure numbers, waypoints, leash rule, depth
spawn table, tested), `scripts/deer.js` + `deer_rules.js` (wariness and alarm for both deer types), `scripts/harmony.js` (deed cost),
`scripts/main.js` (`depthAt`), the gift files (see Gift). RP `entity/white_deer.entity.json`,
`render_controllers/white_deer.render_controllers.json`, `entity/guide_beacon.entity.json`, `models/entity/guide_beacon.geo.json` (one zero-size
cube: renders nothing but passes the verifier's "geometry has no cubes" check), `textures/entity/guide_beacon.png` (16x16, fully transparent),
`textures/entity/deer/deer_white.png` (from `tools/make_deer.py`), `sounds.json`, `texts/en_US.lang`. Dev only (not shipped):
`tools/dev_scripts/guide_goal/` (goal variants, switch script, experiment steps).

**Decisions (change any of them if the owner wants otherwise):**

- **Separate entity `lothlorien:white_deer`, "White Deer"**, spawn egg (white `#e3e7ee` / grey `#a6adbb`). A **loner**: the deer has no herd
  goal in its entity (its groups come from the spawn rule's `herd` and its breeding), so the white deer simply has neither: spawn herd 1-1, no
  `breedable`/`behavior.breed`/`offspring`, no baby group, no `ageable`/`follow_parent`, no `spawn_egg_interaction` (an egg on it makes no fawn),
  not tamable. **Leashable** since the owner's second round (2026-09-30, "I would like lead to work on him"): `minecraft:leashable {}` in
  `components`, as the vanilla cow (defaults: soft/hard/break distances, can be stolen); no `leashable_to` (nothing is tied to it). No balloon:
  `minecraft:balloonable` is an Education Edition feature, leaving it out costs nothing. Own family `lothlorien_white_deer` (+ `mob`).
- **Lead vs guidance (rule "a lead always wins")**: `offerRefusal` and `phase` in `white_deer_rules.js`, read in `white_deer.js` through
  `getComponent("minecraft:leashable")?.isLeashed` (2.8.0 `EntityLeashableComponent.isLeashed`). A leashed white deer refuses the acorn
  (acorn kept; checked again when the gift spot search finishes); leashing it while it guides ends the guidance on the next 5-tick check
  (beacon removed, `guide_end` back to its wariness). Picked over "unleash it when guidance starts" (takes the player's lead away) and
  "ignore the lead" (the follow goal and the lead would tug against each other).
- **Always antlered (white hart)**: no `lothlorien:sex` property, no doe/buck groups or events; the client entity has one geometry,
  `geometry.lothlorien.deer_buck`, and the render controller uses `Geometry.default`. One texture `deer_white.png` (the unused white fawn
  texture was deleted and `make_deer.py` no longer writes it). The ordinary deer keeps its sexes. A white deer saved before this change
  may keep an old `adult_*` group name the entity no longer defines (expected to be dropped by the engine; its loot now comes from `components`).
- **Drops (consistent with `design/drops.md`, "Deer and white deer")**: own table `loot_tables/entities/white_deer.json` in `components`:
  leather 0-2 and venison 1-3 exactly as a buck deer, plus **one deer antler every time, on any death** (no `killed_by_player`, no chance:
  it cannot breed, so there is nothing to farm, and a hart killed by a wolf still leaves its antlers). XP 1-3 on a player kill.
  Killing it costs **6 Harmony** (see Harmony).
- **Spawn rule** (`spawn_rules/white_deer.json`): same surface, grass, light 7-15 and biome tag as the deer; **weight 3** (deer 10, whose herds
  are 2-4), **herd 1** with herd `event` `lothlorien:spawn_natural`, `density_limit.surface` **1** (at most one white deer in a player's spawn
  area), `distance_filter` 24-44 (a bit farther than the deer's 12, so it is not seen popping in), pool `animal`. Then thinned by depth (below).
- **Spawn by depth** (owner, 2026-09-30: fewer near the edges, more in the heart). Spawn rules cannot read the mod's depth, so: the spawn
  rule spawns everywhere in the biome; its herd event sets the entity property `lothlorien:natural`; `white_deer.js` listens to
  `world.afterEvents.entitySpawn` (cause not `Loaded`), one tick later reads the flag, clears it, estimates `depth.js` at the deer's own spot
  (the same ring probe as the player readout, `depthAt` from `main.js`, about 80 probes, only for this rare mob) and keeps it with
  `SPAWN_KEEP_BY_DEPTH` = outside 0, edge 0.15, inner 0.5, heart 1, else `entity.remove()`. **One place to tune**: `SPAWN_WEIGHT` and
  `SPAWN_KEEP_BY_DEPTH` in `white_deer_rules.js` (a test keeps `SPAWN_WEIGHT` equal to the spawn rule's weight).
  Expected frequency, before the density limit: weight 3 against the deer's 10 x ~3 per herd = about 1 white deer per 10 deer spawned in
  the heart, 1 per 20 in the inner forest, 1 per ~67 at the edge (was 1 per 30 everywhere). With `density_limit` 1 you meet at most one at a
  time; in the heart one should usually show up within a visit of some minutes. Unverified in game: tune after walking around.
  Options weighed: (a) spawn-rule conditions that correlate with depth (none exist: no biome-distance filter, height does not follow depth);
  (b) script-driven spawning near players (full control, but bypasses the engine's cap, light and placement rules and needs its own counting);
  (c) **chosen**: data-driven spawn + script filter, cheap (runs only when a white deer spawns) and safe: `/summon` and the spawn egg do not
  fire the herd event, so they are never filtered, and if the herd event does not reach the entity the filter simply never fires (base rate
  everywhere: fails open). The herd `event` was preferred over `minecraft:permute_type` with `<event>` because vanilla relies on it for
  natural spawns (fox babies, horse colours). Test hook: `/summon lothlorien:white_deer ~ ~ ~ lothlorien:spawn_natural` goes through the filter.
  Residual effects: a removed spawn was a spawn attempt used up (that cycle spawns nothing else there); the pool and density limit count
  live entities, so the cap is free again at once; `remove()` drops no loot, gives no XP and is not a death (no Harmony cost, no alarm). The
  deer exists for one tick at 24-44 blocks (not normally seen). Assumptions: that the herd event replaces or runs along with
  `minecraft:entity_spawned` (both paths end in `set_calm`, so either works), and that the flag is readable one tick after the spawn event.
- **Wariness**: the same state groups and flight distances as the deer (`calm` 10 / 5 sneaking ... `l3` 30, alarmed 36 for 20 s), driven by
  `deer.js` (`DEER_TYPES` in `deer_rules.js`). Only the **Mallorn acorn** lures it (calm and Friend only; the held acorn stops its flight, see "Priority alone does not keep a lured deer"); apples do not.
  Hurting or killing it alarms deer within 20 blocks, and hurting a deer nearby alarms it too (it is shy, not deaf); an alarm ends a guidance.
- **Ordinary deer**: back to its pre-`3426cec` entity, client entity and render controller (no coat, no guiding state); since 2026-09-30 its
  only food is Western Corn grain (see Deer).

**The offer**: right-click an adult white deer holding a **Mallorn acorn** (`lothlorien:mallorn_acorn`) as a **Friend of Lothlórien** (owner rule, 2026-10-02: gifts
need Friend; before that Disharmony 0 was enough). Harmony below 0: "shies from your restless spirit"; calm but not yet Friend: "watches you,
but does not trust you yet" (acorn kept). The entity has a `minecraft:interact` entry for a hand holding the acorn
(`use_item false`, text "Offer Acorn"): the 2.8.0 declarations say `playerInteractWithEntity` fires after a *successful* interaction, so
without an interaction on the entity the script might never hear of it (**unverified** which is needed). The script then picks the gift spot
(see Gift); the acorn is consumed (survival) **only when guidance starts** (spot found, first waypoint found, beacon spawned).
Corn grain does nothing to the white deer (it is the ordinary deer's food).

- **Target**: the gift spot (see Gift at the top of this section). Until 2026-09-30 it was the nearest hidden marker block in a flet giant
  within 80 blocks (loaded chunks, `getBlocks` over chunk columns in a job); removed with the markers.

**Walking = engine pathfinding towards a moving helper (design from "Pathfinding options / decision" below):**

- `lothlorien:guide_beacon`: no gravity, no collision, not pushable (no `pushable_by_*`; `minecraft:pushable` made the entity fail to load in format 1.26.50, game log 2026-09-30), no damage (`damage_sensor` all), fire immune, knockback resistance 1,
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
  and waits, and goes back to the waypoint when the player catches up; **final hop** = the spot itself or the nearest standable column
  within 5 blocks of it, reached = arrived. A lost beacon (unloaded, `/kill`) is respawned.
- Standable column (`stand()` in `white_deer.js`): a downward ray from 6 above to 6 below the deer's feet; leaves are looked through (canopy
  over the forest floor), liquid and any `*log*`/`*_wood` block reject the column, passable plants are ignored (ray default), and an upward
  ray needs 1.9 blocks of headroom. The deer itself is **never teleported**.
- **Session end** (arrived, gave up, player gone, hurt): the beacon is removed, `guide_end` restores the stored wariness via `alarm_over`.
  Endings: player beyond 48 blocks, player loses Harmony (a deed), 30 s without getting a block closer to the spot (counts as arrived
  within 14 blocks), 5 minutes, arrived within 3 blocks (horizontal) of the spot or at the final waypoint. Arrived = the nut is laid.
- **Stray beacons**: sessions are not saved, so on world load and then every 100 ticks every `guide_beacon` without a live session is removed
  (all three dimensions, loaded chunks). Exception for the experiment: a beacon **named or tagged `guide_beacon`** is left alone (its own timer
  removes it). A white deer still in `state_guiding` after a reload is released by `deer.js` within 2 s of a player being near.
- Two white deer guiding close together may follow each other's beacon: accepted by the owner (no per-area limit).
- **Not done**: sounds on the way and at arrival (totem particles only).

**Unverified assumptions (the experiment settles the first three):** (1) that `follow_target_leader` accepts a non-mob helper entity (no
movement, no AI) as leader at all; the docs only say "entities passing `leader_filters`"; (2) whether its leader search range is `within_radius`
(24) or something shorter, and whether it re-paths at once when the leader is teleported (`always_look_for_leader`, `search_cooldown 5`); (3) that
`follow_distance 1` makes it stop near a beacon at its feet (the "wait") rather than fidget; (4) that the beacon is truly invisible: zero-size cube
and transparent texture, but it may still cast a small shadow or show a hit box outline; (5) whether `playerInteractWithEntity` needs the
`minecraft:interact` entry, and whether the acorn (a block placer item) places a sapling instead when you miss the deer; (6) all the old items:
probe rays under custom ground cover, placeholder white texture; (7) second round: that the
spawn rule's herd `event` reaches a herd of one (skip count 0) and the flag is set one tick later, that `entitySpawn` does not report a
natural spawn as `Loaded`, that `isLeashed` turns true as soon as a lead attaches, and that the `follow_target_leader` goal does not fight a lead
in the 5 ticks before the guidance ends.

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
  (with `minecraft:bribeable` for the feeding); it cannot target a custom spot. Script API 2.8.0 has no way to set a navigation target;
  `home`/`go_home` (spawn point), POI/dweller/village goals cannot be pointed at a custom spot.
- **Chosen design: waypoint beacon** (built 2026-09-30, see above). Fallbacks in order: `follow_mob` with the same filter, then
  `nearest_attackable_target` + `move_towards_target`, ready in `tools/dev_scripts/guide_goal/`.

### White deer test plan (nothing here has been run in game; natural spawns need a NEW world)

Leave and re-enter the world to load the entity and script changes. `/summon` works in an old world: steps 1, 3, 3b and 4-7 (and the
`spawn_natural` filter check in step 2) do not need a new world; step 2's natural spawns (fresh chunks) do.

1. `/summon lothlorien:white_deer` a few times: white coat, pale pink ears, nose and hooves; **every one has antlers**; never a fawn. Spawn egg
   "White Deer Spawn Egg" in the creative menu; using an egg on a white deer does nothing special. Content log clean (watch for
   `guide_beacon` geometry or render errors, and for unknown-group messages from white deer saved before this change).
   **Lead**: a lead attaches and it follows on the lead; while leashed, offer an acorn: "will not lead while it is held on a lead", acorn kept.
2. NEW world, natural spawns: walk the biome; white deer appear alone, never in herds; noticeably more in the heart than near the edges
   (`/scriptevent lothlorien:debug` shows the depth). Count deer and white deer per depth level over a while and note the numbers here.
   Filter check in any world: `/summon lothlorien:white_deer ~ ~ ~ lothlorien:spawn_natural` at the edge should vanish about 85 times in
   100 (heart: never; outside the biome: always); plain `/summon` and the egg always stay.
3. `/give @s lothlorien:mallorn_acorn 16`; as a Guest or Friend (Harmony 0 or more) hold it: a calm white deer comes to you (tempt), an apple or corn does not lure it.
   Ordinary deer: only Western Corn grain lures them (acorn, apple and seeds do not); two deer fed corn grain breed.
3b. Kill a white deer (survival, inside the biome, Harmony 0): always one deer antler plus leather 0-2 and venison 1-3; Harmony drops to -6
   (`/scriptevent lothlorien:harmony` shows it; chat says the forest frowns). A white deer killed by `/kill` or a wolf also drops the antler.
4. No spot: right-click an adult white deer with the acorn outside Lothlorien, far from its edge: "has nowhere to lead you from here",
   acorn NOT consumed. The hover text says "Offer Acorn".
5. Gift walk, inside the biome: offer the acorn: "takes the acorn ... Follow it", acorn consumed (survival only). **Watch the walk**: real
   walk animation, jumps up blocks, goes round trees and pits, avoids water, no sliding or teleporting; it moves in hops, stops and waits
   when you are more than 12 blocks behind, carries on when you catch up, and after about 36-56 blocks stops with "bows its head ... a Great
   Mallorn nut"; the nut lies there with totem particles, glint and lore. No visible beacon, no shadow travelling ahead of it. Offer another
   acorn: "has given its gift already", acorn kept. Break a walk off (walk away) and offer again: it resumes towards the same spot.
6. Refusals and endings: `/scriptevent lothlorien:harmony -1`, offer: "shies from your restless spirit". Start a guidance, then
   a deed (or `... -3`) or hit the deer: it stops (hit: deer nearby bolt). Walk 50 blocks away: it gives up. Put a lead on
   it mid-guidance: "is held on a lead and stops leading you", it stays on the lead. After each ending
   `/testfor @e[type=lothlorien:guide_beacon]` should find nothing within about 5 s.
7. Save and reload mid-guidance: the deer returns to normal wariness within about 2 s of you being near; no beacon left
   (`/testfor @e[type=lothlorien:guide_beacon]`).
8. Great Mallorn nut (any world; `/give @s lothlorien:great_mallorn_nut` or creative Nature tab): planting on grass shows the space
   warning; bone meal: "will not be hurried", no bone meal used. Next to a small build (planks within 20 blocks): chat names the block in
   the way (at most every 5 min). In the open, `/gamerule randomtickspeed 100` for a moment: a flet giant (platform, ladder, loot chest)
   grows with the trunk on the sprout at ground level; no jigsaw block left at the bottom of the trunk. Break a sprout: the nut drops.
   A creeper blast next to a sprout leaves it standing.
9. Two players: only the offering player is followed; a second player with low Harmony nearby does not change the guidance. Two white deer
   guiding close together may swap beacons (accepted).
10. Performance: the gift spot search and the tree's space check must not spike a tick (job-sliced).

## Phase 14b - Mallorn nectar, morning dew, Star canopy (2026-10-02; static checks + unit tests only, NOT yet seen in game)

- **Nectar bloom** `lothlorien:nectar_bloom` (`scripts/nectar.js`, rules `nectar_rules.js`): state `lothlorien:nectar` 0-3, four crossed-plane
  textures (`tools/make_nectar_bloom.py` writes block, item, loot and art). Hangs under a block via `placement_filter` (`allowed_faces: ["down"]`,
  filter = Mallorn leaves, logs, planks). Random tick, 1/7 per stage, only with Mallorn leaves (green or golden) directly above. Glass bottle on a
  full bloom -> `lothlorien:mallorn_nectar`, bloom back to 0. Loot table pays the bloom item only for shears. Worldgen: `nectar_bloom_scatter_feature`
  (8 tries, y +2..18, gaussian x/z +-4) places `nectar_bloom_full_feature` (stage 3, `may_attach_to.top` = leaves) at the end of
  `select_mallorn_tree_with_litter_feature`, after blossoms and litter. Sapling-grown trees get 0-2 dry blooms (`trees.js`, `treeBloomCount`).
- **Morning dew** (`scripts/dew.js`, `dew_rules.js`): bool state `lothlorien:dew` on leaf litter and blossoms, component `lothlorien:dew_cover`
  (random tick). Window = time of day 23000..3000; in it a dry cover turns dewy with its chance (litter 1/8, blossom 1/2) if Mallorn leaves are within
  40 blocks above (checked only after the dice succeed); outside it dew clears. Dewy cover swaps its `*` material to `<name>_dew` (a permutation,
  `tools/make_dew_textures.py`). Glass bottle on dewy cover -> `lothlorien:dew_bottle` (durability 8, damage = missing drops, new = 1 drop); each
  further use adds a drop; at 8 it becomes `lothlorien:morning_dew`. Bottle icons: `tools/make_nectar_dew.py`.
- **Star canopy** `lothlorien:star_canopy` (`tools/make_star_canopy.py`): full block, `light_emission` 6, 6-frame blended flipbook
  (`textures/flipbook_textures.json`, `ticks_per_frame` 40), emissive MERS strip. Recipe LLL/DDD/TTT = 3 Mallorn leaves, 3 Bottles of morning dew,
  3 deepslate tiles -> 9. Unknown until seen: whether flipbook + MERS strip work on a custom block.
- Miruvor now takes Mallorn nectar. Blossoms are placed before leaf litter in the tree aggregate.
- Not done / open: trader honey trades (settlements), tick-rate measurement, tuning, in-game test of all of the above.

## Phase 15 - swan and ground squirrel (built and tried in game 2026-10-02: squirrel and deer work very well, swan floats with an occasional dip, left as is)

Design sheets: `docs/mobs/swan.md`, `docs/mobs/squirrel.md`. What to know when touching them:

- **Shared wariness.** Swan and squirrel carry the deer's state groups, events (`lothlorien:set_<state>`, `alarm`, `alarm_over`) and
  properties (`wariness`, `alarmed`), so `deer.js` drives all four (`WARY_TYPES` in `deer_rules.js`); a test pins the flight radii of
  both new entities to `FLIGHT_RADIUS`. Alarms cross species: hurting a deer alarms the swans and squirrels within 20 blocks.
- **Swan spawns in rivers.** Rivers are separate biomes; the swan's spawn filter is `any_of` the `lothlorien` or `river` tag and
  `swan.js` removes natural spawns with no Lothlorien biome within 48 blocks (25 biome samples, once per spawn).
- **Squirrel errand = white deer machinery.** `squirrel.js` drives the engine's `follow_target_leader` with a moved
  `guide_beacon` (away point, dig, onto the player); `white_deer.js` exports `stand`, `consumeAcorn` and `addBeaconSource` for it
  (the stray-beacon sweep would otherwise delete the squirrel's beacon). Gift = `/loot spawn x y z loot "gifts/squirrel"`.
- **Gifts need Friend of Lothlorien** (owner rule 2026-10-02): the squirrel's offer and, since the same day, the white deer's
  (`offerRefusal` in both `*_rules.js`). Luring and taming stay open to calm players.
- **Verified in game 2026-10-02**: the squirrel errand (beacon following, `/loot spawn` from script) and the Friend gating work. The swan floats
  with the chicken's float goal but dips now and then (the turtle's `navigation.generic` + `random_swim` dived like a fish, `minecraft:buoyant` sank it).
  River spawning of swans was not specifically checked.

## Phase 15 - unicorn (built and tried in game 2026-10-02, owner accepted)

Design sheet: `docs/mobs/unicorn.md`. What to know when touching it:

- **Generated.** `tools/make_unicorn.py` writes the BP entity (the state groups are repetitive) and all client files; edit the generator, not the output.
  It reads the vanilla horse geometry, animations and white-horse texture from `reference/vanilla/current`.
- **Shares the deer's wariness** (`WARY_TYPES`, same events `set_<state>`, `alarm`, `alarm_over`; `deer.js` drives it). Its `calm` group flees like `l1`
  and only `friend` has the Elanor lure, so a test pins calm to the `l1` radius and the rest to `FLIGHT_RADIUS`.
- **Bond = three Elanor offers** (`unicorn.js`): `lothlorien:trust` (entity property), `lothlorien:last_offer` and `lothlorien:owner` (dynamic properties).
  `lothlorien:become_tame` adds `lothlorien:bonded` (rideable, jump, persistent), a separate group that the state events never remove; `bond()` re-applies the
  wariness event a tick later so `state_tame` replaces the player flight.
- **No `minecraft:tameable`/`tamemount`**: both would consume items or tame by their own rules without the Friend check.

## Phase 17b - Elven rope (2026-10-02, commit 903a520; climbing and icon accepted by the owner in game, 1.26.52)

Owner's design: 1 Bottle of morning dew over 1 golden fern -> 1 rope (shaped recipe, the workspace forbids shapeless). Item
`lothlorien:elven_rope` (stack 64, item component `lothlorien:rope`, `onUseOn`); block `lothlorien:elven_rope`, state
`lothlorien:face` north/south/east/west = the clicked face (the wall is on the opposite side), flat on the wall like a ladder,
dark grey, a knot every 8 units. Art: `tools/make_elven_rope.py`.
- **Placing** (`scripts/elven_rope.js`, pure rules in `elven_rope_rules.js`): on a side face, one piece per item in the stack: down
  from the clicked cell first, then up. Top/bottom faces do nothing. Using the rope on any piece extends that rope: down from its
  bottom, then up from its top. A piece needs air and a wall behind it.
- **Breaking any piece breaks the whole rope**: every piece drops as one stack at the broken piece (no rain of ropes), nothing in
  creative. The block has no loot table on purpose. Losing the wall of any piece (a block broken by a player or an explosion next to
  it; not pistons or other causes) drops the whole rope as well.
- **WORKAROUND - climbing is by script** (no data-driven climbable for a custom block in 1.26.52; listed in the workspace's
  `docs/workarounds.md`, re-check after every game update and replace with the real feature when it exists), every tick for a player standing in a rope cell
  (`startRopeClimbing`). **Final, accepted by the owner:**
  - Up (Jump or forward): levitation only. `levitationStep` picks the level each tick from the levitation formula (`LEVITATION`;
    level n settles at ~0.91 n blocks/s after ~5 ticks) to reach `CLIMB.jumpSpeed` / `forwardSpeed` = 4 at once and hold it.
  - Down (no input): slow falling, plus one tick of levitation I whenever the last tick fell faster than `CLIMB.downSpeed` = 4
    (`brakes`). Lands at about 3.3 blocks/s; the levitation icon flickers while sliding. Owner: both acceptable.
  - Targets come from the owner's measurements of a vanilla ladder (speeds up to about 4 both ways), taken with
    `tools/dev_scripts/ladder_speed.js`.
  - Failed, do not retry: teleporting a step per tick (jumpy, blocks going down), steering velocity with `applyKnockback`,
    slow falling while climbing up (only added an icon), slow falling alone going down (passes 7 blocks/s).
  - Trap hit: `brakes` was once not imported; the tick's try/catch hid the ReferenceError and the brake silently did nothing.
    A test now checks the imports.
  - **HUD icons** cannot be hidden per effect (`showParticles: false` does not do it; one hardcoded `mob_effects_renderer`).
    Options weighed: hide the whole strip while on a rope via a JSON UI override and a title marker (fragile, untried), replace the
    vanilla icon textures (changes potions too, rejected by the owner). Owner kept the icons.
- Art: the placed rope has one knot per block (owner liked it). The final item icon is a short rope with one
  overhand knot, a one-pixel hole and dark-grey edge pixels. The owner accepted this version on 2026-10-03;
  earlier coiled-hank and loop studies are retained in git history.
- The two lookout giants (`round_05`, `round_07`) use the rope instead of the vanilla ladder (`tools/flet_mallorn.mjs`, `B.rope`);
  structures rebuilt with `node tools/build_structures.mjs`. Existing worlds keep their ladders, new chunks get ropes.

## Phase 17 - Elven lighting (2026-10-03)

Generator: `tools/make_elven_lamps.py`. Owner accepted the silver Elven Lantern design and preferred its compact
hand-drawn inventory icon on 2026-10-03. The lantern has a small foot, open four-sided amber chamber framed
by real silver-wood arches, a broad stepped canopy, and a silver collar beneath its gold finial. It can stand or
hang by the finial. Its previous lean/vine studies and the temporary Arch Study item are retired; git retains them.
The original two-sided missing-glow problem came from the older core's face UVs. The current core paints every
outward side. The lowest foot layer was removed at the owner's request; this revision awaits an in-game check.

- Silver lantern: `lothlorien:elven_lantern`, light 14, crafted from two Mallorn trapdoors and a Bottle of Fireflies.
- Golden lantern: `lothlorien:elven_lantern_heartwood`, the same geometry with the established stripped Mallorn
  silver-to-heartwood palette mapping (`make_mallorn_wood.to_gold`), silver collar and finial, two heartwood
  trapdoors in its recipe. Generated and previewed 2026-10-03; in-game verdict pending.
- Elven chandelier: light 15, ceiling only. Antler arms and five hanging lights; crafted from four deer antlers,
  Elven rope and the silver lantern. Owner accepted the placed model in game 2026-10-02. Icon redrawn at inventory
  scale 2026-10-03; in-game verdict pending.
- Firefly jar: light 11, floor only, blend glass, moss and animated flies. Owner accepted the placed model in game
  2026-10-02. Icon redrawn with a compact glass rim and two flies 2026-10-03; in-game verdict pending.
- All four lamp items use `items` / `itemGroup.name.lanterns`. The animated glow and fly tiles use MERS maps.

Static verification and deployment do not prove rendering or Creative menu placement. Check the golden palette,
icon scale and all lamp groups in game, plus the jar's glass sorting and the lantern's four-sided glow.

## Elven village (jigsaw, R3 layout)

Layout redesign R3 written 2026-10-07, offline-checked only (sim + tests), **not yet seen in game**. Design:
`docs/design/lothlorien_jigsaw_settlement.md`; engine notes: `.claude/skills/bedrock-modding/references/10-jigsaw-pieces.md`.

Rebuild everything (pieces, pools, structure; it first deletes old village pieces and pools): `node tools/build_village.mjs`
(geometry in `tools/village_mallorn.mjs`, exports from `build_structures.mjs` / `flet_mallorn.mjs`). Then `.\mods verify lothlorien`.

**Connector standard** (every piece obeys it; the generator and `tests/run.mjs` check it):
- One `minecraft:jigsaw` per connection in the deck layer, on the outer face of the piece's bounding box, in the middle of a
  3-wide walk opening, facing outward. `name` = `lothlorien:village_deck` (upper-level connectors of towers:
  `village_deck_hi`, so they only act as parents), `target` = `village_deck`, joint `aligned`, `final_state` planks.
- Cross-section (depth 1, the connector cell itself): deck under 5 cells, walk cells -1..+1 with 3 air above, rails
  (`RAIL`) at +-2 one above the deck. Platform connectors are **rim connectors**: the platform box is the deck footprint,
  the connector sits on a box face at an offset (0..+-3) along a straight face run; no stub walkways.
- **Rails:** one constant `RAIL` in `village_mallorn.mjs` (now `lothlorien:mallorn_fence`); the owner may swap it. Rails are
  straight runs and square corners only (rim = deck cells with a missing 8-neighbour; outer corner posts at the stair).
  `writeRails` stores `minecraft:connection_*` states: another rail block needs its own states there.
- Heights: FLOOR_H 16 (lower deck above nominal ground), upper deck +8 (LEVEL_H), ROOTS 18. Pieces are `rigid`.
- **Crowns:** a tree = platform piece + crown piece. The platform has an upward jigsaw (`facing_direction` 1, joint
  `rollable`, name = target `lothlorien:village_crown`, `final_state` the plain mallorn log, whose default block_face is
  vertical) on its trunk axis in the top layer, 5 above the highest deck; the crown's jigsaw faces down (0) in its box's
  bottom centre. So a crown box starts 6 above the deck: above the 3-high headroom and the top of a rise-2 arch box
  (deck + 5), and a crown may overhang a neighbouring bridge without colliding. The trunk continues from the jigsaw upward
  inside the crown. Both vertical jigsaws are **unverified in game** (Java rules assumed; the sim models them).

| Piece (structure `lothlorien:village/<name>`) | Box x*y*z | Connectors | Points at pool |
|---|---|---|---|
| `central_mallorn_01` start, 21x21 octagon deck, 5x5 round trunk, rope, anchor | 21x40x21 | 4 (N E S W, offsets -3 2 4 -2) | bridges (crown: crowns_central) |
| `combo_<node>_<entry face>_<bridge>` (P6, 35 files): ONE piece = slab-arched bridge + the node/tower it leads to; entry = the bridge's far end (north face, name `village_deck`, pool empty), exits = the node's other connectors (name `village_deck_hi`, so they only act as parents), crown jigsaw on the node trunk | 11-17 x 40 (48 with a tower) x 18-32 | 1 entry + 1-4 exits | combos (crown: crowns) |
| `crown_small / medium / large` | 15x16x15, 17x20x17, 21x24x21 | down jigsaw | empty |
| `crown_central_a / b` | 33x34x33, 27x30x27 | down jigsaw | empty |
| `balcony_braced` (P6) half-round rim balcony on a 5-cell log pillar 40 below the deck, 8 log braces under the deck, lantern | 7x44x7 | 1 | empty |
| `lookout_01` platform on a pillar | 9x38x9 | 1 | empty |
| `railing_end` plug | 5x2x1 | 1 | empty |

- **Trees in the giant Mallorn style (P9, 2026-10-07; generated, not yet seen in game):** the village trees reuse the Phase 5
  generator's pieces (`roundFoot`, `bentBranch`, `trimFarLeaves` from `flet_mallorn.mjs`, parameterised with defaults that keep
  the six shipped giants byte-identical). Platform pieces: trunk 3x3 (nodes and towers; central 5x5 round), the giants' bark root
  flare at nominal ground level (skirt + 5-7 buttress ridges, up to 4 high, `mallorn_wood`), flare footprint 8 deep, trunk on
  down to ROOTS as plain logs, bent low branches with leaf blobs on the bare trunk (central: 7-8, longer), woven struts and
  hanging blobs under each deck as before. Crowns: the trunk keeps the taper rule (full section to 40 %, central 30 %), 7-14 bent
  branches (45 degree turns, rise on 45 % of the steps, length fitted so tip + blob stay in the box) each with a big blob, a blob
  hugging the trunk and a cap. Diagonal corner lanterns of square-trunk nodes moved out to (3,3) (at (2,2) they cut the walk
  round the 3x3 trunk) and are skipped where a rail stands. Bigger crowns made the 5-long bridge too short (crowns of
  neighbouring nodes collided and some nodes lost their crown): straight bridges are now 7..15. Sim 100 seeds: 0 failures,
  trees 9.5 per village, crowns 9.1, small fallback 0.2 per village (the same as before P9).
- **Bridges:** walking surface in half blocks `k(z) = min(z, L-1-z, top)`, top 2 (rise 1) for L <= 7 and 4 (rise 2) for
  L >= 9; even k = planks at layer k/2, odd k = bottom `lothlorien:mallorn_slab` (`minecraft:vertical_half` = bottom, a
  vanilla-named state) at layer (k+1)/2, so every step is 0.5 block (steppable without jumping). Rails stand one cell above
  the block the walker stands on (above a bottom slab that leaves a half-block gap, like a fence on a slab in vanilla).
  Dog-legs: two straight 5-wide parts joined by 3 full-width rows on the plateau (rails turn at square corners); L and R
  files because the engine never mirrors.
- **Spiral stair** (towers): the 16 cells of the 5x5 ring round the 3x3 trunk, one half-step per cell (cell i: surface
  3 + i half blocks, planks on even, bottom slab on odd), 3 air above each; the upper deck is cut over ring cells 9..13 and
  the last two cells (14, 15) are the exit onto it; rails float one above the stair block on the outer side from cell 3
  on, and the cut gets rails except at the exit. The upper deck clips away what lies beyond the stair well (tower_a: no
  south arm), otherwise the well rail would cut that part off.
- **Pools** (`village_*.json`): `start` central; `combos` (every combo: straight 3, dog-leg 2, +2 for tower combos so most villages climb; early ends railing 10, balcony 6,
  lookout 2; fallback `exits`); `exits` (railing 4, braced balcony 2, lookout 1; fallback `plugs`); `plugs`; `crowns` (large 3, medium 2; fallback `crowns_fallback`);
  `crowns_fallback` (large 12, medium 8, small 1: trees at max_depth only see the fallback pool, so it must offer big crowns too); `crowns_small`; `crowns_central`.
  There is no `bridges`/`nodes` pool any more: a platform exit gets a bridge only together with its destination tree.
- **Structure** `lothlorien:elven_village`: start pool `village/start`, `start_jigsaw_name` `lothlorien:village_anchor`
  (trunk base of the central tree), `max_depth` **2** (central 0, combo 1 = bridge + tree, combo 2; a crown is a sibling, not a deeper level; exits left at the end get railing / balcony / lookout), bridge 1, node 2, bridge 3, node 4; the nodes of the
  last generation still get full crowns and a last bridge to a balcony or lookout), `start_height` -18,
  `heightmap_projection` `world_surface`, `terrain_adaptation` none, biome filter `lothlorien`, max distance 116.
  **No structure set**: only `/place structure lothlorien:elven_village` (owner decision).

- **P6: no bridge to nowhere, no hanging balcony (2026-10-07; generated and sim-checked, not yet seen in game).** `tools/village_combo.mjs`
  builds the combos: the node is rotated so the chosen entry connector faces the bridge, bridge and node share one deck there
  (rails linked inside the piece), and the exits only act as parents. A (node, entry face) pair gets a straight bridge (7..15 in turn) and every
  second pair also a dog-leg (4 variants in turn); pairs where another connector shares the entry face (tower_b south) or where the bridge sticks out
  of the node's width are skipped (a wider union box would cover the cells in front of the exits: no child could ever be placed). A platform exit that fits
  no combo ends in `railing_end`, a `balcony_braced` or `lookout_01`. The balcony cannot be braced to the parent's trunk (the trunk lies inside the
  parent's box, a child piece cannot reach it), so it stands on its own pillar to the ground with braces under the deck. `balcony_small` is deleted.
  Rail mender: a combo carries two markers (bridge middle, tree axis) so the whole length (up to 32) is inside the scan radius 17 (tested).
  Sizes: 35 combos, 5.3 MB of structure files in all (a node + bridge each, 70-180 KB).
**Simulator** `node tools/village_sim.mjs [seeds] [firstSeed]` (PNGs of 6 seeds + one side view in
`temp/elven_village/sim/`, old PNGs deleted first; `VILLAGE_MAX_DEPTH=n` overrides max_depth for tuning). It reads the real
`.mcstructure` and pool files, assembles villages with the Java algorithm incl. vertical rollable jigsaws, and checks:
connectors meet (deck, rails, rail links across the joint), crown trunk continuity and crown box above the headroom, no
box overlaps, termination, **3D walkability** (surfaces are planks/slabs, 2 blocks clear above, steps of <= 0.5 between
4-neighbours, every walk cell reachable from the central deck), plus rope sides, leaf decay and one-way rail links.
Numbers (100 seeds, max_depth 2): pieces 10 / 34.2 / 50, trees 3 / 9.7 / 14, towers 2.2, villages using 2+ levels 80, up to 3 levels, combos 6.5 straight +
2.2 dog-leg per village, exits ending in railing 8.8 / braced balcony 4.5 / lookout 1.9, **bridges without a destination tree 0, unsupported balconies 0**,
open connectors 0.4, crowns 9.3 (1.3 small); **0 unreachable walk cells, 0 box overlaps, 0 wrong rope sides, 0 decaying leaves, 0 failures**.

**Engine-state fixes (round 2, 2026-10-07; in-game check pending).** From the owner's world save
(`.claude/skills/bedrock-modding/references/10-jigsaw-pieces.md` section 6):
- *Leaves:* the orphan trim (`trimFarLeaves`, 8 steps) is the last clearing step in `buildTree` and `buildCrown`; the test
  checks every shipped structure (no orphan leaves).
- *Fences:* templates are symmetric (tested); Bedrock drops a link toward the later-placed neighbour in some cells (cause
  unknown), so rails are straight runs with square corners and the rail block is one constant for the owner to change.
- *Rope:* `lothlorien:elven_rope_hanging` (structure-only twin, `minecraft:cardinal_direction`, hidden from Creative) is
  used by the central tree and the flet giants; assumes Bedrock turns `cardinal_direction` like `block_face`.

**Known limits:** a platform exit beside another platform can still end in a railing a few blocks from that platform (no loops yet: P7); the crown of a tree
beside an upper-level balcony or bridge can find no room even as `crown_small` (0.2 per village, the trunk then ends in a
log stub); a chain of towers climbs 8 per step (decks at 16, 24, 32 above the nominal ground; with ROOTS 18 the trunks
still reach the ground); rigid placement on uneven terrain.

**In-game test checklist:** world in the Lothlorien biome or any world, `/place structure lothlorien:elven_village`.
Check: (1) it places without an error message; (2) central tree with the rope reaching the deck, crown on top;
(3) every tree has a crown (vertical jigsaw works, crowns spin) and the trunk is continuous; (4) bridges meet platforms
exactly in all 4 rotations and the arches walk without jumping (slabs); (5) the spiral stair in towers: walkable, rails,
2 blocks headroom, exit onto the upper deck; (6) rails: which links the engine drops (owner picks the rail block later);
(7) ropes face the trunk; (8) lanterns present; (9) no jigsaw blocks left; (10) layouts differ, 8-10 trees, a second level
in most; (11) trunk bottoms vs terrain, open stubs.

**Fence link repair (2026-10-07, written, not yet seen in game).** Village rail pieces carry an invisible marker entity `lothlorien:rail_mender`; `scripts/rail_mender.js` mends dropped `minecraft:connection_*` links (own fences only, never off) once when the marker loads, then removes it. Whether Bedrock jigsaw places template entities is unverified. Details: workspace skill `bedrock-modding/references/10-jigsaw-pieces.md`.

## Elven Warden (2026-10-07, built; static checks and unit tests only, NOT yet seen in game)

Design and owner decisions: `docs/mobs/elven_warden.md` (section 10). Bow-armed defender `lothlorien:elven_warden` (family `irongolem`: vanilla
monsters hunt it), natural spawns (spawn rule + one-time depth / deck judge in `scripts/elven_warden.js`, tuning constants in
`elven_warden_rules.js`) and persistent village wardens (template entities in `central_mallorn_01` x2, `node_b/c/f`, `tower_a/c` x1; group
`lothlorien:village_warden` via the structure `definitions` list; `build_village.mjs` `WARDENS` / `wardenCells`). Friendly-fire guard on
`world.beforeEvents.entityHurt`. Event-driven only, no `runInterval`. Despawn: standard `despawn_from_distance`, no filters (Phase 10 trap);
only the village group adds `minecraft:persistent`. Harmony: fight -1, kill -6, Hated players shot on sight (see Harmony). Open: template entities in jigsaw pieces, home point,
bow from the equipment table. Depth-estimate cost per natural spawn still unmeasured (`/scriptevent lothlorien:depth`).
