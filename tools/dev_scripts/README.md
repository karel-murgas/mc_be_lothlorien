# Dev scripts (not shipped)

In-game helper scripts removed from `lothlorien_bp/scripts/` so they do not ship in the pack.
They are plain copies of the old code, not wired up: to use one, copy it into
`lothlorien_bp/scripts/`, import it from `main.js` (call its handler from `onScriptEvent`), and
take it out again before committing. The pre-cleanup state is commit `dc1182e`.

| File | Command |
|---|---|
| `showcase.js` | `/scriptevent lothlorien:showcase [variant] [n] [rot]` lays out giant Mallorn structures |
| `tree_debug.js` | `lothlorien:grow [n]`, `growbig [n]`, `treestats [n]`, `treecount [radius]` |
| `critter_watch.js` | `lothlorien:critters [watch]` counts deer near the player |
| `deer_debug.js` | `lothlorien:deer` counts deer by wariness and sex |
| `guide_goal/` | not a command: white deer guide goal switch (`switch_guide_goal.mjs leader\|follow_mob\|target`) and the in-game goal experiment (`--experiment` / `--clean`); steps in `guide_goal/README.md`. (The waypoint proof of concept `guide_waypoints.mjs` moved into `lothlorien_bp/scripts/white_deer_rules.js`.) |
| `ladder_speed.js` | `lothlorien:ladder_speed` toggles a readout of real climb speeds on a ladder and on the Elven rope (by input) |
| `biome_debug.js` | `lothlorien:survey` biome share; world-load biome registration message |

Kept in the pack on purpose: `lothlorien:depth` (depth estimate and timing), `lothlorien:debug`
(actionbar with depth level), `lothlorien:disharmony [points]` (needed by the deer test plan).
