# Butterfly (`lothlorien:butterfly`) - design sheet

Archetype: tiny hovering day flyer (firefly's `random_hover`, see `firefly.md`). Phase 14c, built 2026-10-02. **Not yet tested in game.**
Files: BP `entities/butterfly.json`, `spawn_rules/butterfly.json`. RP `entity/butterfly.entity.json`, `models/entity/butterfly.geo.json`,
`animations/butterfly.animation.json`, `render_controllers/butterfly.render_controllers.json`, `textures/entity/butterfly/butterfly_<colour>.png`, `.lang`.
Art: `tools/make_butterfly.py` (generated; add a colour by adding it to `COLOURS`, the BP property range/randomize and the RP texture list).

| Area | Decision |
| --- | --- |
| Colours | 8 bright, saturated wing colours (owner wanted variety, not silver/gold/blue): red, orange, yellow, lime, turquoise, blue, violet, pink. Dark rim + pale spots in each. Equal chance |
| Variant | int property `lothlorien:wing` 0-7 (`client_sync`), set at `minecraft:entity_spawned` by `randomize`; render controller picks `Array.wings[property]`. Order = `COLOURS` order |
| Body | collision 0.3 x 0.3, 2 hp, speed 0.06, no attack, no baby/breed/tame/ride, silent, no drops, no XP, no catch yet |
| Spawn | surface on grass/dirt, biome tag `lothlorien`, light 8-15 (day), herd 3-5, weight 10, `density_limit.surface 10`, pool `animal`; standard `despawn_from_distance` |
| Behaviour | float, panic, `random_hover` (xz 8, y 2, height 1-2 above ground (integers only: fractions fail to load)), look around. No flower targeting (custom blocks cannot be targeted, see the bee spike) |
| Model | 1x1x4 body, 2x2x2 head, two flat 6x6 wings (`mirror` on the right one), 32x32 texture; wings flap +-45 deg about the body (z), body bobs |

## To test in game

1. Is the variety right in a herd of 3-5 (all 8 colours seen)? Are the colours bright enough in Vibrant Visuals?
2. Do the wings flap up/down (not twist), is the wing outline right side up on top and underneath, is the size good at 0.3?
3. Daytime density and height versus songbirds; should they stay lower / rarer?
