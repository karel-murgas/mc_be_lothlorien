# Songbird (`lothlorien:songbird`) - design sheet

Archetype: ambient flyer that perches. Analogue: parrot (flight, `random_fly` landing on trees, `follow_mob`), pool
`ambient` like the bat. Phase 13, built 2026-10-02, **static checks only - nothing is tested in game** (every "Tested" = no).
Files: BP `entities/songbird.json`, `spawn_rules/songbird.json`, `loot_tables/entities/songbird.json`. RP
`entity/songbird.entity.json`, `models/entity/songbird.geo.json`, `animations/songbird.animation.json`,
`render_controllers/songbird.render_controllers.json`, `textures/entity/songbird/`, `sounds.json`, `.lang`.
Art: `tools/make_songbird.py` (generated box model, two plumages; same method as the deer).

| Area | Decision |
| --- | --- |
| Identity | "Songbird", egg grey-blue `#8e9bb0` / amber `#d29c3e`; families `lothlorien_songbird`, `mob` (own family: vanilla mobs ignore it) |
| Body | collision 0.4 x 0.5, 4 hp, speed 0.4, no attack. No baby, no breeding, no taming, no riding (owner: "do not over-engineer") |
| Plumage | property `lothlorien:plumage` blue 40 % / yellow 30 % / pink 30 % (random on spawn, client synced) picks the texture |
| Spawn | surface, on grass or dirt (the leaf-block filter was dropped 2026-10-02: no natural spawns met in game), biome tag `lothlorien`, light 8-15 (so day only), herd 1-3, weight 8, `density_limit.surface 6`, distance 12-44, pool `animal` like the parrot, deer, cows (switched from `ambient` 2026-10-02: no natural spawns met in game, and vanilla only uses `ambient` for the underground bat; unverified that this was the cause) |
| Despawn | standard `despawn_from_distance`; a name tag keeps it |
| Movement | flies (`navigation.fly`, `movement.fly`), no fall damage, floats on water, lava 4/tick |
| Behaviour | 1 float, 1 panic (x1.25), 3 `random_fly` (xz 16, y 2, **no tree landing**), 4 `follow_mob` (loose flocks, range 12), 5 look at player, 6 look around. Speed 0.4 (parrot) |
| Tree landing | **Off** (2026-10-02, owner: flight looked like diving). With `can_land_on_trees: true` the birds climbed high and dropped back down while moving only a block or two forward: in the Mallorn forest a trunk or canopy block is always within reach, and tree targets sit close sideways but far up or down. Without it they fly level and land on the ground; no canopy perching. Not yet re-tested in game |
| Player / Disharmony | none: it does not flee from players beyond panic and ignores Disharmony (the deer carry that) |
| Drops | feather 0-1 (looting +0-1), XP 1-2 on player kill |
| Animations | procedural Molang: `idle` (tail and head tilt), `hop` (on ground), `fly` (wing flap, legs tucked, only while not on ground), vanilla `look_at_target` on bone `head` |
| Sounds | **placeholder** vanilla parrot sounds at pitch 1.3-1.7 (ambient every 6-20 s); real birdsong is Phase 18 |

## To test in game (1.26.52)

1. New world (or new chunks): do songbirds appear in the Lothlorien biome by day, in small groups, silver and gold?
2. Do they land on Mallorn leaves and the ground, and take off again; does the flap show only in the air?
3. Count stays bounded after travelling away and back; bats and vanilla animals still spawn.
4. Kill one: feather drop; name-tagged one stays.
5. Open questions: does `spawns_on_block_filter` with leaf blocks actually spawn them in the canopy (else drop the
   leaves from the filter and rely on `can_land_on_trees`)? Do wing/leg rotation signs look right (wings spread out)?
