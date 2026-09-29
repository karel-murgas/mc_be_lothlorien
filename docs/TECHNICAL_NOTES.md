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
  region; then `0.5`/`4` plus old-growth birch (`birch_forest_mutated`); now `0.45`/`1`.
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
