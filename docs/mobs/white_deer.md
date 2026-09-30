# White deer (`lothlorien:white_deer`) - design sheet

Archetype: rare, shy loner and guide (Phase 12). Built 2026-09-30 from the deer (`docs/mobs/deer.md`), **static checks only - nothing
below is tested in game** ("Tested" = `no` until a game run says otherwise). Guidance design, unverified assumptions and the test plan:
`docs/TECHNICAL_NOTES.md` (White deer guidance). Files: BP `entities/white_deer.json`, `spawn_rules/white_deer.json`,
`entities/guide_beacon.json` (helper), `scripts/white_deer.js` + `white_deer_rules.js`, wariness in `scripts/deer.js`; RP
`entity/white_deer.entity.json`, `render_controllers/white_deer.render_controllers.json`, `textures/entity/deer/deer_white.png`, `sounds.json`.

| Question | Decision | Tested |
| --- | --- | --- |
| Identifier, name, egg | `lothlorien:white_deer`, "White Deer", egg `#e3e7ee` / `#a6adbb` | no |
| Families | `lothlorien_white_deer`, `mob` (not `lothlorien_deer`) | no |
| Body | as the deer: collision 0.9 x 1.4, 14 hp, movement 0.24, walks, floats, avoids water and damage blocks, lava damage | no |
| Sex | `lothlorien:sex` doe/buck 50/50 at spawn; bucks have antlers (deer buck geometry) | no |
| Spawning | biome tag `lothlorien`, surface grass, light 7-15, **weight 1 (deer 10), herd 1, density_limit.surface 1**, distance 24-44, pool `animal` | no |
| Despawn | standard `despawn_from_distance`; a name tag keeps it | no |
| Group life | **loner**: no herd, no following, no breeding, no babies, no fawn texture, spawn egg on it does nothing | no |
| Taming, leash, riding | none (not tamable, **not leashable**, no balloon) | - |
| Wariness | same states and flight distances as the deer (`calm` 10 ... `l3` 30, alarmed 36 for 20 s), set by `deer.js` | no |
| Luring | **Mallorn acorn only**, in calm and Friend states (`can_get_scared`) | no |
| Guidance | right-click with a Mallorn acorn at Disharmony 0: leads to the nearest structure marker within 80 blocks; acorn used only when guidance starts | no |
| Guiding goals | `state_guiding`: `follow_target_leader` towards `lothlorien:guide_beacon` (priority 2), avoid wolves/monsters (4); panic 1 stays above | no |
| Panic, alarm | panics when hurt; a player hurting it or a deer within 20 blocks alarms it (guidance ends) | no |
| Drops | the deer's tables by sex: doe leather 0-2 + venison 1-3; buck + antler 30 % (player kill). XP 1-3 on player kill | no |
| Model, animations | deer doe/buck geometries and procedural animations, texture `deer_white.png` (placeholder palette swap) | no |
| Sounds | the deer's adult sounds (placeholder horse) | no |
