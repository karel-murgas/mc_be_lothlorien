# Lothlórien — technical notes

Facts checked against the installed game data (`E:\AI\ref\bedrock\current`) and the docs,
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
- `targets` are vanilla names **without** `minecraft:`. Custom biomes cannot be targets, so
  a nested "heart" biome is not possible (see design KB §3).
- `amount` (0–1] ≈ fraction of target area replaced; `noise_frequency_scale` (0–100]:
  higher = smaller, more frequent patches. Current values `0.35` / `10` are spike guesses.
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
hostile mobs within 64 blocks (in-biome / total). Spike-only; remove or gate it later.

## Phase 1 test checklist (new world each time the biome JSON changes)

Worldgen changes affect only newly generated chunks — always test in a fresh world.

1. `/locate biome lothlorien:lothlorien` finds it; teleport there.
2. Region size: large contiguous areas, not confetti. Tune `noise_frequency_scale` / `amount`.
3. Border: walk across; grass/foliage/water/fog change should be clearly visible.
4. Night, Normal/Hard: debug readout shows 0 hostiles inside over several minutes, while
   the surrounding forest has some. Mobs can still walk in.
5. Caves under the biome: hostiles or not?
6. Vibrant Visuals on/off: colours and fog still look right.
