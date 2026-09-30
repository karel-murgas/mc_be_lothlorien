# White deer (`lothlorien:white_deer`) - design sheet

Archetype: rare, shy loner and guide (Phase 12), always an antlered **white hart**. Built 2026-09-30 from the deer (`docs/mobs/deer.md`);
owner decisions of 2026-09-30 (second round: leash, always antlered, sure antler, double Disharmony, depth-dependent spawns, markers only
in Mallorns with a chest) built the same day. **Static checks only - nothing below is tested in game** ("Tested" = `no` until a game run
says otherwise). Guidance design, unverified assumptions and the test plan:
`docs/TECHNICAL_NOTES.md` (White deer guidance). Files: BP `entities/white_deer.json`, `spawn_rules/white_deer.json`,
`entities/guide_beacon.json` (helper), `scripts/white_deer.js` + `white_deer_rules.js`, wariness in `scripts/deer.js`; RP
`entity/white_deer.entity.json`, `render_controllers/white_deer.render_controllers.json`, `textures/entity/deer/deer_white.png`, `sounds.json`;
BP `loot_tables/entities/white_deer.json`.

| Question | Decision | Tested |
| --- | --- | --- |
| Identifier, name, egg | `lothlorien:white_deer`, "White Deer", egg `#e3e7ee` / `#a6adbb` | no |
| Families | `lothlorien_white_deer`, `mob` (not `lothlorien_deer`) | no |
| Body | as the deer: collision 0.9 x 1.4, 14 hp, movement 0.24, walks, floats, avoids water and damage blocks, lava damage | no |
| Sex | none: **always an antlered hart** (deer buck geometry `geometry.lothlorien.deer_buck` only; no `lothlorien:sex` property, no doe groups or events) | no |
| Spawning | biome tag `lothlorien`, surface grass, light 7-15, **weight 3 (deer 10), herd 1, density_limit.surface 1**, distance 24-44, pool `animal`; herd event `lothlorien:spawn_natural` flags natural spawns | no |
| Spawn by depth | natural spawns only: kept with chance **outside 0 / edge 0.15 / inner 0.5 / heart 1** by `scripts/depth.js` at the spawn spot, the rest removed by `white_deer.js` right after spawning. Table and weight: `SPAWN_KEEP_BY_DEPTH`, `SPAWN_WEIGHT` in `white_deer_rules.js`. `/summon` and the egg are never filtered | no |
| Despawn | standard `despawn_from_distance`; a name tag keeps it | no |
| Group life | **loner**: no herd, no following, no breeding, no babies, no fawn texture, spawn egg on it does nothing | no |
| Taming, leash, riding | not tamable, no riding; **leashable** (`minecraft:leashable {}` like the vanilla cow; not a leash anchor itself); no balloon (`minecraft:balloonable` is an Education Edition feature: leaving it out costs nothing) | no |
| Lead vs guidance | **a lead always wins**: a leashed white deer refuses the acorn ("will not lead while it is held on a lead", acorn kept); leashing it during a guidance ends the guidance at once (beacon removed, back to its wariness state) | no |
| Wariness | same states and flight distances as the deer (`calm` 10 ... `l3` 30, alarmed 36 for 20 s), set by `deer.js` | no |
| Luring | **Mallorn acorn only**, in calm and Friend states (`can_get_scared`) | no |
| Guidance | right-click with a Mallorn acorn at Disharmony 0: leads to the nearest structure marker within 80 blocks; **markers sit only in Mallorns that hold a chest** (today the two flet giants); none in reach: "nowhere to lead you", acorn kept; acorn used only when guidance starts | no |
| Guiding goals | `state_guiding`: `follow_target_leader` towards `lothlorien:guide_beacon` (priority 2), avoid wolves/monsters (4); panic 1 stays above | no |
| Panic, alarm | panics when hurt; a player hurting it or a deer within 20 blocks alarms it (guidance ends) | no |
| Drops | own table `white_deer.json`: leather 0-2 + venison 1-3 (as a buck deer, looting +0-1) and **one deer antler, always, on any death** (no player-kill or chance condition: it cannot breed, so nothing can be farmed; a hart killed by a wolf still leaves its antlers). XP 1-3 on player kill | no |
| Disharmony | a player kill inside the biome counts **double** (2 points, like two deer; `KILL_WEIGHTS` in `scripts/disharmony.js`) | no |
| Model, animations | deer buck geometry and the deer's procedural animations, texture `deer_white.png` (placeholder palette swap) | no |
| Sounds | the deer's adult sounds (placeholder horse) | no |
