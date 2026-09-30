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
| `biome_debug.js` | `lothlorien:survey` biome share; world-load biome registration message |

Kept in the pack on purpose: `lothlorien:depth` (depth estimate and timing), `lothlorien:debug`
(actionbar with depth level), `lothlorien:disharmony [points]` (needed by the deer test plan).
