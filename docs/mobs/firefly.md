# Firefly (`lothlorien:firefly`) - design sheet

Archetype: tiny hovering night flyer (analogue: bee `navigation.hover` / `random_hover`). Phase 14, built 2026-10-02.
**In game (1.26.52, Vibrant Visuals): glow, bottle icon, night spawning and catching with a glass bottle all work (owner, 2026-10-02).**
Files: BP `entities/firefly.json`, `spawn_rules/firefly.json`, `items/bottle_of_fireflies.json`. RP `entity/firefly.entity.json`,
`models/entity/firefly.geo.json`, `animations/firefly.animation.json`, `render_controllers/firefly.render_controllers.json`,
`textures/entity/firefly.png` (+ `firefly_mers.tga`, `firefly.texture_set.json`), `textures/items/bottle_of_fireflies.png`, `.lang`, `item_texture.json`.
Art: `tools/make_firefly.py` (generated; green abdomen glows). Feature commit: `715d705`.

| Area | Decision |
| --- | --- |
| Body | collision 0.2 x 0.2, 2 hp, speed 0.08, no attack, no baby/breed/tame/ride, silent, no drops, no XP |
| Spawn | surface on grass/dirt, biome tag `lothlorien`, light 0-7 (night, shade), herd 2-4, weight 6, `density_limit.surface 6`, pool `animal`; standard `despawn_from_distance` |
| Behaviour | float, panic, `random_hover` (xz 6, y 3, height 1-3 above ground), look around |
| Glow | PBR texture set (vanilla glow squid / allay way): `firefly.texture_set.json` + `firefly_mers.tga`, emissive (G) 255 on every face of the green abdomen, 0 elsewhere; works under Vibrant Visuals. Owner: whole abdomen glows (not only the underside), no halo particle. Did not glow: `entity_emissive_alpha` alpha mask, `ignore_lighting` render controller, unlit `particles_alpha` sprite. No dynamic light |
| Catch | glass bottle on firefly: `minecraft:interact` (`use_item`, `transform_to_item` `lothlorien:bottle_of_fireflies`), event `lothlorien:caught` -> group with `instant_despawn` |
| Item | Bottle of Fireflies, stack 16, items menu. Icon: vanilla empty bottle with two bright dots and a dim one, each in a lime glow (side 230, diagonal 130 alpha); the rest of the glass stays empty (owner: no green fill). Release / Firefly Jar / lamp use: later (plan Phase 14) |

## To test in game (1.26.52)

1. Do the wings flutter in the right plane; is the model visible at size 0.2?
