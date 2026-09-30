# White deer (`lothlorien:white_deer`) - design sheet

Archetype: rare, shy loner and guide (Phase 12), always an antlered **white hart**. Built 2026-09-30 from the deer (`docs/mobs/deer.md`);
owner decisions of 2026-09-30 (second round: leash, always antlered, sure antler, double Disharmony, depth-dependent spawns; third round: the Great Mallorn nut gift
replaces leading to flet giants, markers removed) built the same day. **Static checks only - nothing below is tested in game** ("Tested" = `no` until a game run
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
| Taming, leash, riding | not tamable, no riding; **leashable** (`minecraft:leashable` with only `on_leash`/`on_unleash` events for persistence; not a leash anchor itself); no balloon (`minecraft:balloonable` is an Education Edition feature: leaving it out costs nothing) | no |
| Lead vs guidance | **a lead always wins**: a leashed white deer refuses the acorn ("will not lead while it is held on a lead", acorn kept); leashing it during a guidance ends the guidance at once (beacon removed, back to its wariness state) | no |
| Wariness | same states and flight distances as the deer (`calm` 10 ... `l3` 30, alarmed 36 for 20 s), set by `deer.js` | no |
| Luring | **Mallorn acorn only**, in calm and Friend states; holding the acorn stops its flight from that player, `can_get_scared` false | yes (2026-09-30) |
| Tame | a white deer that accepts the acorn (guidance starts) is tamed like the deer (`lothlorien:tame` -> `state_tame` after guiding); hurting clears it. Tame or leashed = persistent (`lothlorien:kept`, same events as the deer) | yes (2026-09-30) |
| Guidance (gift) | right-click with a Mallorn acorn at Disharmony 0: **once per deer** it leads to a spot inside Lothlorien 36-56 blocks away, as far from the known biome border as possible, i.e. towards the heart (loaded biome grid within 96 blocks; ties go to the longer walk; fixed to the default simulation distance, not the player's setting) and lays a **Great Mallorn nut** there. The spot is kept on the deer until the gift is given (another acorn resumes a broken guidance); afterwards the acorn is refused and kept. No spot: "nowhere to lead you", acorn kept; acorn used only when guidance starts. (Until 2026-09-30 it led to the nearest flet-giant marker within 80 blocks: dropped, the trees were already in sight.) | yes (2026-09-30) |
| Gift: Great Mallorn nut | unique (no recipe, no loot), glint, rare, stack 1, lore about the space it needs. Planted on sapling soil: `great_mallorn_sprout` grows like the Mallorn sapling (2 stages, 1/7 per random tick, light >= 9) into a **flet giant** (woven 5 or 7: platform, ladder, loot chest), anywhere. Bone meal refused ("will not be hurried"). Planting warns about the space (40 wide, 50 high, roots 5 deep); growth waits while anything built stands where the tree puts a block and tells nearby players what and where. Sprout: blast-proof, not flammable, breaks back into the nut | yes (2026-09-30) |
| Guiding goals | `state_guiding`: `follow_target_leader` towards `lothlorien:guide_beacon` (priority 2), avoid wolves/monsters (4); panic 1 stays above | yes (2026-09-30) |
| Panic, alarm | panics when hurt; a player hurting it or a deer within 20 blocks alarms it (guidance ends) | no |
| Drops | own table `white_deer.json`: leather 0-2 + venison 1-3 (as a buck deer, looting +0-1) and **one deer antler, always, on any death** (no player-kill or chance condition: it cannot breed, so nothing can be farmed; a hart killed by a wolf still leaves its antlers). XP 1-3 on player kill | no |
| Disharmony | a player kill inside the biome counts **double** (2 points, like two deer; `KILL_WEIGHTS` in `scripts/disharmony.js`) | no |
| Model, animations | deer buck geometry and the deer's procedural animations, texture `deer_white.png` (placeholder palette swap) | no |
| Sounds | the deer's adult sounds (placeholder horse) | no |
