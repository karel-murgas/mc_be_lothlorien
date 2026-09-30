# Deer (`lothlorien:deer`) - design sheet

Archetype: skittish prey (herd grazer). Analogues: rabbit (avoid player, panic), cow/sheep (breed, baby,
tempt). Phase 11, built 2026-09-30, **static checks only - nothing below is tested in game yet** ("Tested"
column = `no` until a game run says otherwise; record the game version and date when it does).
Files: BP `entities/deer.json` (generated once from a throw-away script, now edited by hand), `spawn_rules/deer.json`,
`loot_tables/entities/deer.json` + `deer_buck.json`, `items/venison_raw|venison_cooked|deer_antler.json`,
`recipes/furnace_venison.json`, `scripts/deer.js` + `deer_rules.js`. RP `entity/deer.entity.json`,
`models/entity/deer.geo.json`, `animations/deer.animation.json`, `render_controllers/deer.render_controllers.json`,
`textures/entity/deer/`, `sounds.json`. Art is produced by `tools/make_deer.py` (see "Art" below).

## A. Identity and body

| Question | Decision | Tested |
| --- | --- | --- |
| Identifier, name, egg | `lothlorien:deer`, "Deer", egg brown `#9a6a3e` / cream `#f1e4c3` | no |
| Families | `lothlorien_deer`, `mob`. Not `rabbit`/`sheep`: vanilla wolves and foxes must not hunt it by family | no |
| Size | collision 0.9 x 1.4, baby `scale 0.5`, dedicated fawn geometry (client scale 2) | no |
| Health, speed | 14 hp, movement 0.24 (between cow 0.2 and rabbit 0.3); no attack, no knockback resistance | no |
| Summonable / spawnable | yes / yes | no |
| Sex | property `lothlorien:sex` doe/buck (client synced), 50/50; bucks have antlers | no |

## B. Where and how many

| Question | Decision | Tested |
| --- | --- | --- |
| Biomes, surface | surface, on `grass_block`, biome tag `lothlorien` only | no |
| Light, time | light 7-15 (day and moonlit clearings; no time filter) | no |
| Group | herd 2-4, weight 10, `density_limit.surface 8`, `distance_filter` 12-44; 10 % of spawns are fawns | no |
| Pool | `population_control: animal` (shared with cows and sheep; engine pools are fixed) | no |
| Special spawns | none. White deer (Phase 12) will be a variant | - |
| Despawn | standard `despawn_from_distance`; name tag keeps it (verified for the Phase 10 critter) | no |

## C. Body in the world

| Question | Decision | Tested |
| --- | --- | --- |
| Movement | walks; `jump.static`; avoids water and damage blocks; no `can_climb` (no ladders, vines, scaffolding) | no |
| Water | floats (`behavior.float`), breathes air | no |
| Hazards | lava 4/tick like vanilla; fire and fall damage are engine defaults | no |
| Pushed, leash | pushable by entities and blocks; leashable (adult can be a leash anchor) | no |
| Lightning | nothing | - |

## D. Behaviour

Goal priorities: 0 float, 1 panic (x1.8), 2 breed, 3 tempt, 4 avoid, 5 follow parent (baby), 6 stroll (x0.7),
7 look at player, 9 look around.

| Question | Decision | Tested |
| --- | --- | --- |
| Idle life | strolls, looks around, ears and tail flick (animation). **No grazing**: `eat_block` turns grass into dirt and would bare the golden forest floor | no |
| Reaction to the player | flees by **wariness state** (see below); sneaking halves the flight distance | flees in survival at Disharmony I; not from a **creative** player (1.26.52, 2026-09-30) |
| Reaction to mobs | flees wolves within 12 and monsters within 8 | no |
| Vanilla mobs reacting to it | none (own family) | - |
| Panic | on any damage (x1.8); fawns too | no |
| Hostile | not hostile, no attack | - |

**Wariness states** (component groups `lothlorien:state_<name>`, switched by events `lothlorien:set_<name>`;
`scripts/deer.js` sets them every 2 s from the players' Disharmony, radius 40):

| State | Disharmony | Flight distance (walking / sneaking) | Food lures it |
| --- | --- | --- | --- |
| `calm` | 0 | 10 / 5 | yes |
| `l1` | I | 13 / 6 | no |
| `l2` | II | 20 / 10 | no |
| `l3` | III | 30 / 15 | no |
| `friend` | Friend of Lothlorien | 3 / 2 | yes |
| `alarmed` | (any) | 36 / 18 for 20 s, then back to the stored state | no |

A player hurting a deer alarms every deer within 20 blocks of it (`lothlorien:alarm`, timer 20 s).
With several players near, the **most severe state among players inside their own state's flight radius** wins
(Disharmony III within 30, II within 20, I within 13, calm within 10, Friend within 3); if nobody is that close, the
nearest player decides. The flight component still applies to every player, so a calm player 25 blocks from a deer that
reacts to a Disharmony III player also scares it.

## E. Player interaction

| Question | Decision | Tested |
| --- | --- | --- |
| Luring | Mallorn acorn or apple, `can_get_scared` (fast movement scares it); off from Disharmony I and while alarmed | no |
| Leading | leashable | no |
| Breeding | same two foods, `require_tame false`, any doe/buck pair, fawn follows parent, grows up in 20 min (feed to speed up) | no |
| Babies | fawn model with spots; spawn egg on an adult makes a fawn | no |
| Taming, healing, riding | not wanted | - |
| Other | name tag (nameable) | no |
| Mod systems | Disharmony + Friend via the wariness states; white-deer guidance is Phase 12 | no |

## F. Death and rewards

| Question | Decision | Tested |
| --- | --- | --- |
| Drops | doe: leather 0-2, raw venison 1-3 (cooked if killed burning), looting +0-1. Buck: the same + **deer antler** 30 % (+5 % per looting level), player kills only. Fawns drop nothing | no |
| Venison | raw: 3 hunger, 1.8 saturation; cooked: 8 hunger, 12.8 saturation (steak level, tag `minecraft:is_meat` so wolves take it); furnace, smoker, campfire | no |
| XP | 1-3 on player kill, 1-7 on breeding | no |
| Antler use | item only for now; chandelier with the lamp is Phase 17. The item is a placeable block (floor shed, wall trophy), a rare natural drop in the biome and one in flet chests (`TECHNICAL_NOTES.md`, Deer antler) | - |

## G. Look and sound

| Question | Decision | Tested |
| --- | --- | --- |
| Model | generated box model, fallow-deer look (tawny coat, pale spots, white rump, dark spine). Three geometries in one file: doe, buck (with antler bones `antler_l/r`), fawn; the render controller picks one (`is_baby`, then `lothlorien:sex`). No bone is called `head` (`head_joint`): the engine derives an armour locator from a `head` bone and the fawn's clashed with the adult's (see `bedrock-mobs` client.md) | loads without content-log errors (1.26.52, 2026-09-30) |
| Variants | none yet; the white deer gets its own texture in Phase 12 | - |
| Animations | procedural Molang: `walk` (diagonal legs, speed weighted), `run` (gallop pairs, body bob, raised tail, weight from `query.ground_speed` 3.5..6 m/s, **threshold unverified**), `idle` (ear and tail flicks), own `look_at_target` (copy of the vanilla one for `head_joint`) | no |
| Sounds | placeholder vanilla horse sounds (breathe, hit, death, soft step; baby_horse for fawns); real sounds in Phase 18 | no |
| Particles | none | - |

## H. Health of the world

Protocol: `.claude/skills/bedrock-mobs/references/testing.md`; instrument `/scriptevent lothlorien:critters [watch]`
(counts deer) and `/scriptevent lothlorien:deer` (wariness, sex, fawns, alarmed).

| Question | Decision | Tested |
| --- | --- | --- |
| Counts bounded after travel | as Phase 10 (same despawn and density rules) | no |
| Crowds out vanilla animals | shares the `animal` pool; watch numbers next to cows/sheep | no |
| Named mobs survive | as Phase 10 | no |

## Art (model, body textures and antler icon final 2026-09-30; open items in `GRAPHICS_TASKS.md` step 11)

`tools/make_deer.py` writes geometry, both entity textures and the three item icons; `.claude/skills/bedrock-mobs/scripts/preview_entity.py`
renders a software preview (orthographic, approximate rotation convention) for judging shapes before the game.
The texture was made by rule (colour ramps with hue shift, hand-placed spots, top/front light, AA-free flat shapes)
following `bedrock-modding/references/10-art-style.md`. Accepted in game (1.26.52, 2026-09-30).
