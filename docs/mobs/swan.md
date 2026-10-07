# Swan (`lothlorien:swan`) - design sheet

Archetype: calm water bird on the rivers and pools. Analogue: chicken (floats on water, walks ashore) for movement,
the deer for Harmony wariness. Phase 15, built 2026-10-02, **tried in game 2026-10-02: floats on the surface (chicken setup), still dips up to half a neck deep now and then; owner decided to leave it** (Movement row has the failed attempts). Owner brief: a white swan (no gold or silver on the animals), keeps its distance from players
by Harmony band like the deer, "makes the forest more alive and ambient".
Files: BP `entities/swan.json`, `spawn_rules/swan.json`, `loot_tables/entities/swan.json`, `scripts/swan.js` + `swan_rules.js`
(spawn judging), wariness in `scripts/deer.js`. RP `entity/swan.entity.json`, `models/entity/swan.geo.json`,
`animations/swan.animation.json`, `render_controllers/swan.render_controllers.json`, `textures/entity/swan/swan.png`,
`sounds.json`, `.lang`. Art: `tools/make_swan_squirrel.py` (generated box model, rotation-free: the curved neck is stepped boxes).

| Area | Decision |
| --- | --- |
| Identity | "Swan", egg white `#f2f4f8` / orange `#e0702a`; families `lothlorien_swan`, `mob`; `spawn_category` `water_creature` |
| Body | collision 0.8 x 1.2, 10 hp, no attack. No baby, breeding, taming, riding, luring (owner: no over-engineering). Leashable, nameable |
| Plumage | one white texture (cool violet shadows), orange beak with a dark knob, black lore and legs. Models also have separate wings and a tail |
| Spawn | **rivers are their own biome**, so the filter is `any_of` the `lothlorien` tag or the `river` tag; `spawns_on_surface` + `spawns_underwater` (like the salmon), pool `water_animal`, weight 10, herd 1-2, `density_limit.surface 3`, distance 12-40 |
| River judging | rivers all over the world pass that filter, so each natural spawn (herd event `lothlorien:spawn_natural` sets `lothlorien:natural`) is judged once in `swan.js`: it stays only if the Lothlorien biome is within 48 blocks (the spot plus 3 rings x 8 headings, `nearBiome` in `swan_rules.js`), else it is removed one tick later. `/summon` and eggs always stay |
| Despawn | standard `despawn_from_distance`; a name tag keeps it |
| Movement | chicken setup: `movement.basic`, `navigation.walk` with `can_path_over_water`, `behavior.float` (priority 0) keeps it on the surface. **First try (turtle's amphibious `navigation.generic` + `random_swim`, `can_sink false`) made the swans dive and swim like fish (owner, 2026-10-02): never use `random_swim` or amphibious navigation for a surface bird.** **Second try 2026-10-02 failed**: float goal alone floats but dips up to half a neck deep now and then (owner); adding `minecraft:buoyant` (as the boat has it, plus `base_buoyancy`, `simulate_waves`) logged "simulate_waves not valid here" and the swans sank straight to the bottom. Removed again; back to the float goal. Open: the occasional dip (options: raise the model in `swim`, tune `float`, or `buoyant` with `liquid_blocks` only, untried). `breathes_air` and `breathes_water`; lava 4/tick |
| Behaviour | 1 panic (x1.4), 4 avoid (Harmony wariness states, below), 0 float, 6 `random_stroll` (on land and across the water surface), 7 look at player, 8 look around |
| Harmony | the deer's states and flight distances by band (Guest = calm 10 / 5 sneaking, Uneasy = l1 13, Shunned = l2 20, Hated = l3 30, Friend 3, alarmed 36 for 20 s), set by `deer.js` (`WARY_TYPES`); hurting or killing any deer, swan or squirrel alarms every one of them within 20 blocks; wolves and monsters scare it too. A player kill costs 3 Harmony (an animal), counted when the player or the swan is inside the forest |
| Drops | feather 1-2 (looting +0-1), XP 1-3 on player kill |
| Animations | procedural Molang: `idle` (neck and tail sway), `walk` (waddle, on land), `swim` (sinks 1.5 units into the water, legs paddle), vanilla `look_at_target` |
| Sounds | **placeholder**: vanilla chicken sounds at pitch 0.7-0.9; real honks are Phase 18 |

## To test in game (1.26.52, new world or new chunks)

1. Do swans appear on a river that crosses or touches the biome, and on shallow water inside it? Not on a river far away
   (judging; a few may flicker in and vanish)?
2. **Open question**: with the chicken setup, do they float on the surface and drift across the water (not sink, not bob wildly),
   and does `random_stroll` take them over water at all, or do they sit still and only waddle on shore?
3. Do they swim away at the distances above; a lower band (Uneasy, Shunned, Hated) widens it; Friend lets you come within 3 blocks.
4. Count stays bounded (`density_limit` 3, pool `water_animal` shared with fish and dolphins); kill one: feather.
5. Is the model right (neck, beak, wings), and does the colour fit the forest next to the white deer?
