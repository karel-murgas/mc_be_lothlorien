# White deer guide goal: switch and experiment (not shipped)

The white deer walks to the guide beacon with one data-driven goal in the group `lothlorien:state_guiding` of
`lothlorien_bp/entities/white_deer.json`. That group is the **only** place the choice lives. Shipped: variant
`leader` (`minecraft:behavior.follow_target_leader`). Nothing here has been run in game (written 2026-09-30, 1.26.52).

| Variant | Goal(s) | Rank |
|---|---|---|
| `leader` | `behavior.follow_target_leader` (leader_filters = beacon family, follow_distance 1, within_radius 24, search_cooldown 5) | 1, shipped |
| `follow_mob` | `behavior.follow_mob` (filters = beacon family, search_range 24, stop_distance 1) | 2 |
| `target` | `behavior.nearest_attackable_target` (beacon family, max_dist 24, must_see false) + `behavior.move_towards_target` (within_radius 1) | 3 |

Definitions: `variants.mjs` (tests in `tests/run.mjs` keep it equal to the entity file).

## Switching (when the shipped goal does not work)

From the workspace root:

```powershell
node mods/lothlorien/tools/dev_scripts/guide_goal/switch_guide_goal.mjs              # which goal is in the file now
node mods/lothlorien/tools/dev_scripts/guide_goal/switch_guide_goal.mjs follow_mob   # or: target, leader
.\mods deploy lothlorien
```

Then commit `white_deer.json` in `mods/lothlorien/` and note the result in `docs/TECHNICAL_NOTES.md` (White deer guidance).

## Experiment (decides which variant; about 10 minutes, an old world is fine)

1. Add the three test groups (tag-filtered copies of the variants plus events `lothlorien:test_leader`,
   `lothlorien:test_follow_mob`, `lothlorien:test_target`, `lothlorien:test_off`) and deploy without the tests
   (they fail on purpose while the groups are in the file):
   ```powershell
   node mods/lothlorien/tools/dev_scripts/guide_goal/switch_guide_goal.mjs --experiment
   .\mods deploy lothlorien --quick
   ```
2. In game (leave and re-enter the world), survival or creative, Disharmony 0 (`/scriptevent lothlorien:disharmony 0`), flat open ground:
   ```
   /summon lothlorien:white_deer ~ ~ ~
   /summon minecraft:armor_stand ~12 ~ ~
   /tag @e[type=armor_stand,c=1] add guide_beacon
   /event entity @e[type=lothlorien:white_deer,c=1] lothlorien:test_leader
   ```
   Stand still or sneak (the deer still flees a walking player within 10 blocks when no goal is active).
   Watch: does it walk (walk animation, not sliding) to the stand and stop about 1 block short?
3. Same goal, harder: `/tp @e[type=armor_stand,c=1] ~20 ~ ~5` while it walks (does it re-path at once?); put the stand
   behind a 3-high wall of logs; 24 blocks away (edge of the radius); on top of a 3-block hill.
4. **The real beacon** (tests "must the leader be a mob?"): `/kill @e[type=armor_stand]`, then
   ```
   /summon lothlorien:guide_beacon ~10 ~ ~ 0 0 minecraft:entity_spawned guide_beacon
   /tag @e[type=lothlorien:guide_beacon,c=1] add guide_beacon
   ```
   It is invisible: `/tp @e[type=lothlorien:guide_beacon,c=1] ~ ~ ~` moves it to you. Does the deer come? Is there a
   shadow, a name plate, a hit box you can bump into? (There should be none, except the name plate the name
   gives it.) The name matters: the pack's script removes beacons that belong to no guidance session within about 5 s,
   unless they are named or tagged `guide_beacon`; those stay until their own 330 s timer removes them (worth checking
   too: it should vanish after 5.5 minutes).
5. If the armor stand is never followed: tag a pig standing in a 1x1 fence pen instead (a real mob as leader).
6. Repeat 2-5 with `/event entity @e[type=lothlorien:white_deer,c=1] lothlorien:test_follow_mob` and `... lothlorien:test_target`.
   `lothlorien:test_off` stops all three.
7. Clean up and pick the winner:
   ```powershell
   node mods/lothlorien/tools/dev_scripts/guide_goal/switch_guide_goal.mjs --clean
   node mods/lothlorien/tools/dev_scripts/guide_goal/switch_guide_goal.mjs <winner>
   .\mods deploy lothlorien
   ```
   Record in `docs/TECHNICAL_NOTES.md`: game version, which variant followed the armor stand, the pig and the real beacon,
   and how the walk looked. Then run the full white deer test plan there (acorn offer with a marker).

