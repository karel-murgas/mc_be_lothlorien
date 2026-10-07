# Elven Warden (`lothlorien:elven_warden`) - design and plan, v1

Archetype: ranged defender, "iron golem with a bow", natural spawner plus persistent village guards. Status 2026-10-07 (game 1.26.52,
Script API 2.8.0): part A (BP entity, spawn rule, scripts, village pieces, offline tests) is **built**, part B (RP art) is built by a
second worker, **nothing is tested in game yet**; see section 10 for the owner decisions that override sections 1-9 where different. Every engine assumption is tagged **[V]** verified against a file on disk, **[D]**
documented only (MS docs / d.ts), **[U]** unverified, test first. Owner requirements of 2026-10-07 are the spec; the settlement
plan (`docs/design/lothlorien_elven_settlements_plan.md`, "Elven Guardians") is the long-term context. The plan's "persistent
watchpost guardians" are NOT this mob: this one is a normal natural spawn (owner decision), watchposts can add persistent ones later.

## 1. Decisions at a glance

| Topic | Decision |
|---|---|
| Spawn | Two spawn-rule conditions (ground in the biome, mallorn-plank decks), pool `animal`, `spawn_category creature`, herd 1-2, low weight. Script thins natural spawns by the existing depth estimator: keep 100 % at the **edge** (border <= 16) and on **plank decks**, 10 % elsewhere. |
| Despawn | Natural wardens: standard `{"despawn_from_distance": {}}`, nothing persistent, name tag keeps it. Village wardens: persistent group (section 10). |
| Weapon | Bow in main hand via `minecraft:equipment` loot table, `minecraft:shooter` arrow, `behavior.ranged_attack`. Quiver is model-only. |
| Targets | Monster family minus an exclusion list (enderman, warden, wither, piglins, creaking, aquatic, shulker). **Creepers are shot and spiders always** (owner 2026-10-07; section 3 table is superseded). Never players, never other families. |
| Monsters hunt it | **Baseline without script: family `irongolem`** (zombies, skeletons, spiders, slimes, illagers, drowned... already hunt that family) + arrows trigger their `hurt_by_target`. Script "hit on sight" is an optional second layer (section 4). |
| Players | Ignored. `hurt_by_target` retaliates against whoever hurt it (player included), `alert_same_type` makes nearby wardens assist. Script cancels warden arrow damage to players/wildlife unless provoked. |
| Disharmony | **Owner 2026-10-07: a kill = weight 1 (listed explicitly in `KILL_WEIGHTS`), hitting = 0; no `ALWAYS_COUNT`.** The old proposal (weight 4, counts outside the biome) is dropped; owner will rework Disharmony later. |
| Village wardens | **Added 2026-10-07:** template entities in the village pieces (2 on the central tree deck, 1 on node_b/c/f and tower_a/c), group `lothlorien:village_warden` (persistent + home 20) through the structure's `definitions` list. Section 10. |
| Stats | 26 hp, speed 0.27, follow range 28, shoots every 1.5-2.5 s up to 22 blocks, mob arrow (skeleton damage class). No drops, no XP. |

## 2. Research: ranged bow AI (vanilla)

- **Skeleton** (`reference/vanilla/current/behavior_packs/vanilla_1.26.50/entities/skeleton.json`) **[V]**: bow comes from
  `minecraft:equipment {"table": "loot_tables/entities/skeleton_gear.json"}` (table gives `minecraft:bow`, vanilla_1.21.110 copy);
  `minecraft:shooter {"def": "minecraft:arrow", "sound": "bow"}`; `behavior.ranged_attack` priority 0, `attack_interval` 3 s
  (2 s on hard), `attack_range {min 0, max 15}`; melee fallback when `has_ranged_weapon` is false (we drop that).
  Bogged/parched (vanilla_1.26.30) use `attack_interval 3.5`, `attack_radius 15` **[V]**.
- **Pillager** (vanilla_1.21.50) uses a crossbow + `behavior.charge_held_item`; not our model **[V]**.
- Arrow entity (`arrow.json` 1.26.50) picks its component group in `entity_spawned` by the **shooter's family**: `mob` family +
  no crossbow in hand -> `minecraft:mob_arrow` (power 1.6, uncertainty_base 16). So the warden family list **must contain `mob`**,
  else the arrow may fall to no group **[V]**. Damage 0..0 in data = engine computes from speed (`ceil_pre_critical_damage`,
  `difficulty_randomization multiplicative`), the same class as a skeleton shot **[D]**.
- ranged_attack fields (MS docs, creator repo `minecraftBehavior_ranged_attack.md`) **[D]**: `attack_interval` {min,max} seconds,
  `attack_range {min,max}`, `attack_radius`, `attack_radius_min`, `in_range_movement_mode` (`hold_position` | `follow_target`),
  `target_in_sight_time`, `x_max_rotation`, `y_max_head_rotation`, `swing`, `set_persistent` (default false: keep it false so the
  mob stays despawnable), `speed_multiplier`. `minecraft:shooter` also has `projectiles` (conditional list), `power`, `sound`.
- **Held bow rendering [V pattern, U for custom]**: vanilla has no bow attachable file (the `attachables/` folders hold only
  spears). Skeleton's client entity (`resource_packs/vanilla/entity/skeleton.entity.json`) sets `"enable_attachables": true`;
  its geometry (`models/entity/skeleton.geo.json`, `geometry.skeleton.v1.8`) has bones `rightArm > rightItem` (pivot `[-6,15,1]`)
  and `leftArm > leftItem`; the engine draws the equipped item at `rightItem`. Arm pose: `animation_controllers/humanoid` controllers
  `holding` (animation `holding`, uses `variable.is_holding_right`) and `bow_and_arrow` (state `bow_and_arrow` while
  `query.has_target`: both arms raised toward `query.target_x/y_rotation`). So a custom humanoid needs: a geometry with those
  bone names, `enable_attachables`, those two controllers (referenced by their vanilla identifiers, global to all packs **[U]**),
  skeleton's `pre_animation` (`variable.tcos0 ...`) for `animation.humanoid.move`. Vanilla 1.8 client files list controllers
  without `scripts.animate`; the mod's format is 1.10.0 with explicit `scripts.animate` (see `deer.entity.json`), so the plan lists them
  explicitly **[U: wiring is by analogy, copy the pillager `pillager_root_controller` pattern if the arms stay down]**.

## 3. Research: targeting

### What vanilla monsters hunt (scan of every vanilla entity file, latest version of each) **[V]**

`nearest_attackable_target` filters, by family. Hunters of the **`irongolem`** family (the only vanilla entities that mention it,
all as a target): zombie, husk, drowned, zombie villager (v1, v2), skeleton, stray, bogged, parched, wither skeleton, spider, cave spider,
slime, magma cube, silverfish, witch (prioritized), pillager, vindicator, evoker, ravager, vex, breeze. **Not** creeper, phantom, blaze,
ghast, enderman (family target only `endermite`), guardian. Other families: `snowgolem` (zombie, spider, slime, drowned, vindicator...), `villager`
(zombie, illagers, drowned, vex). `hurt_by_target` (retaliation against any attacker): zombie/skeleton/stray/spider/husk exclude only
`breeze`; creeper, witch, blaze, silverfish, drowned, vex, wither have it unfiltered; **slime, magma cube, phantom, guardian have none**.
Iron golem itself: `type_family ["irongolem","mob"]`, targets `monster` minus creeper, `hurt_by_target` except creeper, 64 follow range.
Nothing else in the vanilla behaviour packs reads `irongolem` (no villager or golem logic in JSON), so the family gives no side effect
in data; hard-coded engine checks (village golem counts, raids) are **[U]**.

### Warden's own targeting

```json
"minecraft:behavior.nearest_attackable_target": {
  "priority": 2, "reselect_targets": true, "must_see": true, "within_radius": 24, "scan_interval": 10,
  "entity_types": [{ "max_dist": 24, "filters": { "all_of": [
    { "test": "is_family", "subject": "other", "value": "monster" },
    { "test": "is_family", "subject": "other", "operator": "!=", "value": "enderman" },
    { "test": "is_family", "subject": "other", "operator": "!=", "value": "warden" },
    { "test": "is_family", "subject": "other", "operator": "!=", "value": "wither" },
    { "test": "is_family", "subject": "other", "operator": "!=", "value": "zombie_pigman" },
    { "test": "is_family", "subject": "other", "operator": "!=", "value": "piglin" },
    { "test": "is_family", "subject": "other", "operator": "!=", "value": "creaking" },
    { "test": "is_family", "subject": "other", "operator": "!=", "value": "aquatic" },
    { "test": "is_family", "subject": "other", "operator": "!=", "value": "shulker" },
    { "test": "is_family", "subject": "other", "operator": "!=", "value": "creeper" } ] } }]
},
"minecraft:behavior.hurt_by_target": {
  "priority": 1, "alert_same_type": true,
  "entity_types": { "max_dist": 64, "filters": { "test": "is_family", "subject": "other", "operator": "!=", "value": "lothlorien_warden" } }
}
```
Field names and defaults from the MS docs **[D]** (`hurt_by_target.entity_types.max_dist` default **16**: raise it, or a player shooting
from 20 blocks is never answered; vanilla pillager sets 64 **[V]**). Every filter shape above is copied from vanilla files **[V]**.
Why the exclusions (recommendation, owner may overrule):

| Mob | Decision | Reason |
|---|---|---|
| Enderman, endermite stays targetable | enderman excluded | owner: mutual peace; arrows cannot hit it, shooting provokes it |
| Creeper | **excluded (default), owner question** | a shot creeper walks to the shooter (it has unfiltered `hurt_by_target`) and blows up a deck 16 blocks up; iron golems ignore creepers for the same reason (`iron_golem.json` **[V]**). A warden never kills creepers actively, they are the players' problem as today. Include later with a minimum-range kite once `attack_radius_min` is understood **[U]**. |
| Spider, cave spider | included | neutral in daylight but the family is monster; harmless if it draws a few arrows. Optional daylight exclusion with a `light_level` filter on `other` **[U]** |
| Slime, magma cube | included | no `hurt_by_target`, but they hunt `irongolem` so the family gives them the aggro |
| Phantom | included | flies, no retaliation at all; arrows may miss, harmless |
| Drowned | included | only reachable from shore, fine |
| Zombie pigman, piglin(s) | excluded | neutral (Nether only); also `piglin` in the monster scan list |
| Warden (vanilla), wither, creaking, guardian family (`aquatic`), shulker | excluded | 500/600 hp bosses and untargetable or end/ocean mobs |
| Villager-family illagers (pillager, vindicator, evoker, ravager), vex, witch, breeze | included | real threats to the village |

### Assist
`alert_same_type: true` (silverfish uses it, `silverfish.json` **[V]**) alerts "nearby mobs of the same type" **[D]**; the radius is not
stated **[U]**. Fallback if it only reaches a few blocks: `minecraft:on_hurt_by_player` (exists, pillager uses it **[V]**) fires an event
that adds a group with `minecraft:angry` (`broadcast_anger true`, `broadcast_range` 24 (default 20), `duration` 30, `calm_event`) **[D]**,
the wolf/piglin way; `angry` only broadcasts and does not itself pick targets, so test which of the two gets neighbours to shoot.

## 4. "Hit on sight" in Script API 2.8.0 (`reference/server-2.8.0.d.ts`)

| Question | Answer |
|---|---|
| Hook for target acquisition? | **Yes, indirectly [D].** JSON `minecraft:on_target_acquired {"event": "lothlorien:target_acquired", "target": "self"}` (component exists, vanilla drowned, wolf, spider use it **[V]**) runs an event; `world.afterEvents.dataDrivenEntityTrigger` (d.ts line 7161, fires "after a data driven entity event is triggered", options `entityTypes`, `eventTypes`) delivers it. That a component-trigger event reaches the afterEvent is **[U]** (first spike). |
| Can script read the warden's target? | **No.** `Entity` in the d.ts has no target getter; the two `readonly target: Entity` hits are other classes (checked). Script must infer the target. |
| Inferring it | Nearest `monster`-family entity (minus the exclusion list) within 24 blocks of the warden, preferring `warden.getEntitiesFromViewDirection({families:["monster"], maxDistance: 28})` (ray from its head: it faces its target when it acquires one **[U]**) and falling back to `dimension.getEntities({location, maxDistance, families:["monster"], excludeFamilies:[...]})` nearest first. |
| Does a token hit make the monster aggro? | **Plausible, undocumented [U].** `Entity.applyDamage(amount, {cause: EntityDamageCause.entityAttack, damagingEntity: warden})` is documented as able to "spur additional behaviors"; returns false for amount <= 0, so use `0.5`. Whether it sets the victim's last-attacker (the thing `hurt_by_target` reads) is unknown. **Zero-code test first:** `/damage <spider> 0.5 entity_attack entity <warden>` in a world (command exists in Bedrock, [U] for this syntax in 1.26.52); if the spider turns on the warden, `applyDamage` almost surely does the same. Use a spider or zombie villager, not a slime (no `hurt_by_target`). |
| Polling? | None. One `dataDrivenEntityTrigger` subscriber (filtered by `entityTypes` and `eventTypes`), a per-target cooldown map (5 s) because reselection can re-fire the event. |

**Recommendation.** Layer 1 (certain, build now): family `irongolem` + normal arrows. Result: monsters in the families above hunt the warden by
their own sight rules (zombie `within_radius 25`, must_see), the first arrow triggers `hurt_by_target` for everything else. This already is
"both sides attack each other" and needs no script. Layer 2 (optional, only after the `/damage` test and only if playtest shows monsters
standing around unaware): the acquisition-event token hit for the monsters layer 1 misses (witch, vex, blaze, creeper if ever allowed;
phantom and guardian cannot be helped, they never retaliate). Layer 2 is about 40 lines in `elven_warden.js`, pure rules in `elven_warden_rules.js`.
The owner's original fallback ("family vanilla monsters target") is therefore the baseline, not a fallback; no vanilla entity is overridden.

## 5. Spawning

### Rule (`spawn_rules/elven_warden.json`)
Same skeleton as `spawn_rules/white_deer.json` (mod convention): `population_control: animal` (the proven surface pool, `spawning.md` songbird trap),
entity `spawn_category: creature`, `herd {min 1, max 2, event lothlorien:spawn_natural, event_skip_count 0}` (every member judged, like the white deer),
`density_limit.surface 3`, `distance_filter` 16-48, biome tag `lothlorien`, no brightness filter (day and night guard) **[U: omitting it]**.
Two conditions (alternatives, spawning.md): ground `grass_block`/`dirt`, weight 4; decks `lothlorien:mallorn_planks`, `lothlorien:mallorn_heartwood_planks`, weight 6.
Deer 10 and squirrel 12 outweigh it. Risks: shares the `animal` cap with deer, cows, sheep **[V: fixed engine pools]**; `spawns_on_block_filter` with custom block
ids works for custom blocks in principle but the surface sampler may only pick heightmap columns, i.e. **may never choose a deck 16 up [U, the biggest
risk]**. Fallback: village piece marker or `structure`-saved entity (persistent, so not "normal rules"; owner call), or a one-time script top-up.

### Edge thinning (the white-deer pattern, `white_deer.js` `judgeNaturalSpawn`, `white_deer_rules.js` `SPAWN_KEEP_BY_DEPTH`)
- Herd event sets bool property `lothlorien:natural`; `world.afterEvents.entitySpawn` (skip `EntityInitializationCause.Loaded`), one tick later: read and clear the flag
  (judged once, not on every chunk load), compute `depthAt(dimension, location).level` (0 outside, 1 edge, 2 inner, 3 heart), and
  `onDeck = block below the feet is in DECK_BLOCKS`. Keep with chance `1.0` if edge or on deck, `0.10` inner/heart, `0` outside; else `entity.remove()`.
  `remove()` fires no death event and drops nothing (spawning.md, white deer design); the pack has not run this in game yet **[U]**.
- Cost: 83 probes (1 + rings 8,16,24,32,40) with two API calls each (`getTopmostBlock`, `getBiome`), only once per natural spawn, never per tick. The ms
  figure is still marked `?` in TECHNICAL_NOTES (Phase 2); run `/scriptevent lothlorien:depth` once and record it before shipping. Expected a few spawns per minute at most.
- Deck test uses the spawn point's own column, so a warden on a deck at the edge is kept by either rule; one on a deck deep in the forest is kept by the deck rule.
  Removing 90 % of ground spawns wastes attempts (that cycle spawns nothing else there) but caps count live mobs only, so nothing lingers.
- `/summon` and eggs never carry the flag, they always stay. Test hook: `/summon lothlorien:elven_warden ~ ~ ~ lothlorien:spawn_natural`.
- Alternatives considered: (a) pure spawn-rule edge detection, impossible (no biome-distance filter; TECHNICAL_NOTES Phase 2); (b) script-driven spawning at
  watchposts (design doc "first version"), full control but bypasses caps, later; (c) chosen: data spawn + script filter.
- Tuning home: constants `SPAWN_KEEP_EDGE`, `SPAWN_KEEP_DECK`, `SPAWN_KEEP_INNER`, `SPAWN_WEIGHT_GROUND/DECK` in `elven_warden_rules.js`, with a test that keeps weights equal to the rule file (as for the white deer).

### Despawn and persistence
`"minecraft:despawn": {"despawn_from_distance": {}}`, no `filters` (the trap that cost the Phase 10 critter two rounds; `spawning.md`, verified 2026-09-30). No `minecraft:persistent`, `set_persistent` false on both
target goals. Name tag keeps it (`minecraft:nameable`). A warden mid-fight beyond 128 blocks goes like any mob. No `remove_in_peaceful` (it is not hostile to players).

## 6. Players, friendly fire, Disharmony

- Never targets players (filter has no player family). Retaliates through `hurt_by_target` (max_dist 64). Incident ends when the target is lost.
- **Friendly fire** (arrows hit whoever is in the line, like skeleton arrows hit zombies):
  `world.beforeEvents.entityHurt` has `cancel` and `damageSource.damagingEntity` / `damagingProjectile` (d.ts line 10806, restricted privilege, read-only checks fine **[D]**).
  One subscriber, no polling, cancels damage when the source is a warden (or an arrow whose owner is) and the victim is: another warden, any `lothlorien:*` animal, or a player who has
  not hurt a warden in the last 60 s (Map filled by `afterEvents.entityHurt` when a warden is hurt by a player or his projectile). Whether a cancelled projectile hit still gives knockback or sticks the arrow **[U]**.
  Backup in JSON per wildlife entity: `minecraft:damage_sensor` with `other_with_families lothlorien_warden`; whether `other` is the arrow or its owner **[U]**.
  Villagers and vanilla golems in the line of fire are accepted (golem retaliates: it only ignores creepers).
- Wardens do not harm decks (no explosions, no fire arrows).
- **Disharmony.** `disharmony.js` `KILL_WEIGHTS`: white deer 2, unicorn 3, default 1; levels 1 point = I, 2-3 = II, 4+ = III, one point decays per 3 min inside **[V, disharmony.js]**.
  Proposal: `"lothlorien:elven_warden": 4` -> a kill puts the player straight to III (about 12 min inside to clear, trading refused, "Disharmony = unwelcome"). One assist-kill by a
  tamed wolf etc. does not count (only `damagingEntity` player, projectiles included **[V, disharmony_game.js]**). Today a kill only counts when the victim stands in the biome
  (`isInside`); a warden may die outside it, so add an `ALWAYS_COUNT` set (the warden) bypassing that check; one line plus a test in `tests/run.mjs` (lines ~824-835 test kill weights).
  Wounding (not killing) adds nothing in v1; retaliation is the consequence. A kill of a monster by a warden gives no player points (the existing rule already needs a player killer).

## 7. Stats

| Item | Skeleton (V) | Pillager (V) | Warden |
|---|---|---|---|
| Health | 20 | 24 | **26** |
| Movement | 0.25 | 0.35 | **0.27** (walks, no sprint kiting) |
| Follow range | default | 64 | **28** |
| Shot interval | 3 s (2 s hard) | 1 s crossbow | **1.5-2.5 s**, flat (no hard variant) |
| Range | 15 | 8 | **attack_range max 22**, `in_range_movement_mode hold_position`, `speed_multiplier 1.0` |
| Melee | fallback 2 | fallback 3 | none; `knockback_resistance 0.2` |
| Drops / XP | bow, bones / 5+ | crossbow, ... | **none, 0 XP** (a kill is a Disharmony event, no farm; bow `drop_chance 0`) |

Two wardens kill a zombie in about 4 s, one loses against a skeleton pair without help: intended, they are a group mob. Arrow supply is unlimited (no inventory).
Collision 0.6 x 1.95. Other components: `type_family ["lothlorien_warden","irongolem","mob"]` (not `monster`), `navigation.walk {avoid_damage_blocks, avoid_water, can_path_over_water false}`,
`movement.basic`, `jump.static`, `behavior.float` 0, `breathable`, lava `hurt_on_condition`, `nameable`, `conditional_bandwidth_optimization`, `physics`, `pushable_by_*`, `despawn`, `equipment`, `shooter`.
Goals: 0 float, 1 hurt_by_target, 2 nearest_attackable_target, 2 ranged_attack, 5 random_stroll 0.8, 7 look_at_player (watchful, never hostile), 8 random_look_around. Optionally
`minecraft:home` (`restriction_radius 24`, `random_movement`) + `behavior.move_towards_home_restriction` so an edge warden does not wander into the field; `home` is set at spawn, vanilla uses it for bee/golem-type mobs **[V]**; unverified for a plain mob **[U]**.
Doors, ladders: not wanted v1 (custom mallorn doors are not vanilla door blocks **[U]**, ropes are script-climbed). Drops from decks: normal fall rules.

## 8. Implementation plan

### A. BP: entity, spawn rule, scripts, offline tests (Claude or Ornith; ~half a day)
1. `entities/elven_warden.json`: as sections 2, 3, 7. Property `lothlorien:natural` bool. Event `lothlorien:spawn_natural` sets it (it replaces `entity_spawned` for herd spawns,
   so it must also run everything `entity_spawned` would; v1 has nothing else to set). `on_target_acquired` -> `lothlorien:target_acquired` (layer 2, add only with it).
2. `loot_tables/entities/elven_warden_gear.json` (always `minecraft:bow`, 1 roll) and the `slot_drop_chance` shape from vanilla pillager captain `{slot, drop_chance}` **[V]**. No `loot` component.
3. `spawn_rules/elven_warden.json` as section 5.
4. `scripts/elven_warden_rules.js` (pure: `keepNaturalSpawn(level, onDeck, roll)`, `isFriendlyFire(...)`, constants) and `scripts/elven_warden.js`
   (entitySpawn judge, `beforeEvents.entityHurt` guard, provoked map); `startElvenWardens(depthAt, ...)` wired in `main.js` next to `startWhiteDeer`. `disharmony.js`: weight 4 + `ALWAYS_COUNT`.
5. `tests/run.mjs`: keep-chance table, weights equal to the spawn rule file, `KILL_WEIGHTS` warden = 4 and counts outside, friendly-fire decision table, entity JSON invariants
   (family has `mob` and `irongolem`, no `monster`/`player` in the targeting filters, `despawn_from_distance` and no `filters`, equipment drop chance 0, `set_persistent` absent).
6. `.\mods verify lothlorien`. Optional verifier rule: a ranged mob with `shooter` must have `mob` in its families (arrow group); with a broken fixture in `tools/verification/test_verify_addon.py`.

### B. RP: art (another worker)
Spec: tall slim humanoid ~1.95 blocks, hooded grey-green Lorien cloak (cloak bone on `body`, swings with walk speed), silver leaf clasp (3x3 px), long fair hair
(on `head`/`hat`, falls behind), longbow in the hand (item model is vanilla, no art needed), quiver with arrow fletching on the back. Files: `models/entity/elven_warden.geo.json`
with skeleton's bone names (`body, waist, head, hat, rightArm, rightItem, leftArm, leftItem, rightLeg, leftLeg`; `rightItem` pivot `[-6,15,1]`) **[V]**, one geometry only (no `head`-locator clash,
`bedrock-mobs/references/client.md`), 64x64 texture `textures/entity/elven_warden/elven_warden.png`, `entity/elven_warden.entity.json` (`enable_attachables: true`, materials `entity_alphatest`
for hood fringe, animations `animation.humanoid.move/look_at_target.default/holding/bow_and_arrow` plus a short own `walk_cloak` animation, `scripts.animate` list, skeleton's `pre_animation`),
`render_controllers/elven_warden.render_controllers.json`, spawn egg (grey-green `#6f7f66` / silver `#c9d1d6`). Use `bedrock-art` skill, Blockbench, no hand-written geometry. Sounds: none in v1 (owner).
Check: bow visible in hand and raised when `query.has_target`; arrow flies from the bow height.

### C. Verify, deploy, docs
1. `.\mods verify lothlorien`, then `.\mods deploy lothlorien`, `.\mods status` in sync (new world needed for natural spawns).
2. Lang: `entity.lothlorien:elven_warden.name`, `item.spawn_egg.entity.lothlorien:elven_warden.name` in the nine locales; extend `localization/catalog.json` (workspace `docs/localization.md`, mod `docs/LOCALIZATION.md`).
3. Docs: `TECHNICAL_NOTES.md` section "Elven Warden (Phase ?)", update this sheet's tested column, record the depth ms figure.
4. **In-game protocol** (first run answers the [U] items; log each result with date):
   1. `/summon lothlorien:elven_warden`: bow in hand, no content-log errors, arms raised when it has a target, silent.
   2. `/summon zombie ~5 ~ ~`, night spawns, skeleton, spider: warden shoots; the monster walks at the warden; first arrow answered. Repeat with witch, slime (family baseline), and a creeper (ignored by design).
   3. `/damage <spider> 0.5 entity_attack entity <warden>`: does the spider turn on the warden? Decides layer 2.
   4. Player hits a warden: it shoots back, neighbours within 20 blocks join (`alert_same_type` radius); it stops when you leave. Killing it: actionbar shows Disharmony III, also outside the biome.
   5. Player standing between a warden and a zombie, a deer in the line of fire: no damage taken (guard works), arrow knockback/sticking noted.
   6. `/summon ... lothlorien:spawn_natural` at edge, in the heart and on a deck: kept always / 10 % / always. `entitySpawn` cause for natural spawns is not `Loaded`.
   7. New world: spawn counts at the edge, in the forest, on the village decks (do natural spawns ever pick a deck?), population vs deer, despawn after 2-3 min far away, name tag keeps one.
5. Knowledge went to `.claude/skills/bedrock-mobs/references/combat.md` (separate workspace commit).

## 9. Open questions for the owner
1. Creepers: ignored by wardens (default, protects the decks) or shot (they will run at the warden and explode)?
2. Disharmony weight 4 (kill = Disharmony III) and should kills count outside the biome? Should merely hitting a warden add a point?
3. If natural spawns never land on the village decks: accept edge-only, or add a persistent, village-piece-placed warden (outside "normal" rules)?
4. Spiders in daylight: shoot them anyway (default) or leave neutral ones alone?
5. Do wardens ever fight vanilla iron golems or villager-defending mobs that get hit by stray arrows: acceptable?

## 10. Owner decisions (2026-10-07) and implementation status

Decisions that override sections 1-9: wardens **shoot creepers** (the creeper exclusion is gone; the creeper may blow up a deck, accepted) and
**spiders always**, also neutral daylight ones (no light filter). Disharmony: **kill = 1, hit = 0**. Monster aggression: baseline family
`irongolem` only; the script "hit on sight" layer 2 (section 4) is **skipped for now, future work** (needs the `/damage` test first and a
playtest showing monsters standing around unaware). Section 9 questions 1, 2, 4 are answered by this; 3 became "add village wardens" (below).

**Built (part A), files:** `lothlorien_bp/entities/elven_warden.json`, `spawn_rules/elven_warden.json`,
`loot_tables/entities/elven_warden_gear.json` (bow), `scripts/elven_warden_rules.js` (pure) + `elven_warden.js` (wired in `main.js`),
`KILL_WEIGHTS` in `disharmony.js`, localization in `localization/catalog.json` (rp pack: name + spawn egg, 9 locales),
`tools/build_structures.mjs` (`entityTag` options), `tools/build_village.mjs` (`WARDENS`, `wardenCells`), `tools/village_sim.mjs`
(wardens per village), tests `elven warden: ...` in `tests/run.mjs`. Spawn egg grey-green / silver is part of the RP client entity (worker B).
No sounds, no drops, no XP.

**Entity.** Family `lothlorien_warden, irongolem, mob`; 26 hp, speed 0.27, follow range 28; `equipment` (bow, mainhand drop chance 0),
`shooter arrow`, `ranged_attack` 1.5-2.5 s up to 22 blocks, `hold_position`; targets: monster minus enderman, warden, wither, zombie_pigman,
piglin, creaking, aquatic, shulker; `hurt_by_target` (max_dist 64, `alert_same_type`) skipping its own family. Property
`lothlorien:natural`; events `lothlorien:spawn_natural` (herd event, sets it) and `lothlorien:village_warden` (adds the group; summon hook).
There is **no** `entity_spawned` event: a warden has no state to set up.

**Natural spawns.** Two spawn-rule conditions (grass/dirt weight 4, mallorn / heartwood planks weight 6, herd 1-2, `animal` pool,
density 3, no brightness filter). `elven_warden.js`: one `entitySpawn` subscriber; a flagged (herd-event) warden is judged once one tick
later by `spawnKeepChance(level, onDeck)`: kept 100 % at the edge (level 1) and on any plank deck inside the biome, 10 % inner / heart, 0
outside; the rest is `remove()`d. No polling.

**Village wardens (persistent).** The structure NBT entity carries `definitions: ["+lothlorien:elven_warden", "+lothlorien:village_warden"]`
(the engine saves a placed mob's component groups as `+group` strings; **[U] that Bedrock applies them to a template entity**) and a
`Mainhand` bow, `Invulnerable` false. The group `lothlorien:village_warden` adds `minecraft:persistent` (never despawns, kept out of the
natural despawn logic) and `minecraft:home` (random_movement, radius 20) + `behavior.move_towards_home_restriction` (priority 4, below the
combat goals, so a warden returns to its tree after a fight; vanilla guardian uses the same home component without a home block). Placement
(`wardenCells`): lower deck (y = FLOOR_H), the cell and its 8 neighbours planks, 3x3x3 explicit air above, no rail within 2 cells, ring ~5
(central ~7) from the trunk, the second warden as far as possible from the first. Since a template entity does not run `entity_spawned`,
the script also hands out the bow to a warden with an empty main hand (`ensureBow`, on spawn / load events). Village sim: 3-10 wardens per
village (avg 6.3 over 10 seeds). **Flag: works only if Bedrock jigsaw places template entities (same open question as the rail mender),
and only if the home point is the placement point (the engine sets it at spawn/load) - both to be seen in the owner's next test.**

**Friendly fire.** `world.beforeEvents.entityHurt` exists in stable 2.8.0 (`reference/server-2.8.0.d.ts` line 22240, no beta tag): it
cancels damage from a warden's arrow to wardens, `lothlorien:*` creatures, vanilla `animal` family and any player who has not hit a warden
in the last 60 s (`afterEvents.entityHurt` fills the map; `Date.now()` is used because it is readable in restricted mode). Villagers and
golems in the line are accepted. [U] whether a cancelled projectile hit still gives knockback or sticks the arrow, and that
`damagingEntity` is the shooter for projectile damage.

**Unverified for the in-game test (in addition to section 8C.4):** template entities placed by jigsaw; `definitions` group applied;
saved-entity `Mainhand` list format accepted; home restriction from the placement point; `alert_same_type` radius; equipment table gives the
bow to `/summon`ed and spawn-egg wardens; `hold_position` accepted; deck spawn picking decks 16 up; ms cost of the depth estimate per spawn.
