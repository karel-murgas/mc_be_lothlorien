# Features left out, and why

Things a vanilla wood type has (or we considered) that the mod does not have. Read this before
starting any of them, so nobody re-researches a dead end. Facts were checked against the installed
game data (1.26.52), the Microsoft creator docs and the Bedrock Wiki, in 2026-09.

| Feature | Status | Reason / what a retry needs |
|---|---|---|
| **Signs, hanging signs** | Impossible | Text editing is a hard-coded feature of the vanilla sign block entity. No `minecraft:sign` component exists for custom blocks; `block_entity` only stores dynamic properties (and, experimental, a container). A non-editable "plaque" block is the only substitute. |
| **Shelf** | Left out | The vanilla shelf's point is holding items. A custom block can only do that with `minecraft:block_entity` `container`, which is **experimental** ("Upcoming Creator Features") in 1.26.50. A shelf without storage is just decoration, so it was removed. Retry when `container` is released; the wiki page for `minecraft:block_entity` describes it. |
| **Boats, chest boats** | Deferred, probably possible | A custom entity can copy vanilla `boat.json` (`buoyant`, `physics`, `rideable` with seats, `is_collidable`, family `boat`). Unknown: whether paddling/steering is hard-coded to `minecraft:boat` rather than the components; if it is, movement would have to be driven by script. Needs a **spike first**: custom entity + item that spawns it, ride it on water. Also needs: entity model (Blockbench), texture, item icons, recipe, loot. Design wish: carved, beautiful Mallorn boats. |
| **Sapling** | Done (Phase 4) | Acorn item places `mallorn_sapling`; see `TECHNICAL_NOTES.md`. |
| **Fence gate "in wall" lowering** | Not done | Vanilla lowers a gate 3 px between walls. Needs neighbour detection for a `in_wall` state; cosmetic. |
| **Door hinge from click position** | Simplified | The API gives no cursor position in `beforeOnPlayerPlace`, so the hinge is chosen from a neighbouring door only (door on the placer's left -> hinge right, else left). |
| **Stair/slab waterlogging visuals, snow logging** | Partial | Slabs, stairs, fences, gates and trapdoors accept water; no snowlogging. |
| **Leaf decay, acorn drops** | Done (Phase 4), untested in game | Original plan, as built (`scripts/trees.js`): Leaves are currently permanent and drop only with shears (5% stick). Decay is a script job: leaves get `minecraft:random_ticking` and a custom component whose `onRandomTick` searches (breadth-first, max 6 blocks, through Mallorn leaves) for a Mallorn log/wood; none found -> break with drops. Player-placed leaves must not decay (vanilla "persistent"): a `lothlorien:persistent` state set in `beforeOnPlayerPlace`; worldgen/structure leaves keep the default (decaying). Cost is bounded (random ticks only, early exit). Do it with the Phase 4 tree work so saplings drop from it. |
| **Chest/boat, hopper, dispenser interactions** | n/a | Not part of the wood set. |
| **Shed antlers as a world feature / placeable block** | Done (Phase 11), untested in game | See `TECHNICAL_NOTES.md` (Deer antler). The chandelier use belongs to Phase 17. |
| **Deer grazing** | Left out | Vanilla `eat_block` turns grass blocks into dirt, which would bare the golden forest floor. A grazing animation without the block change needs script. |
| **White deer guidance to structures** | Replaced 2026-09-30 by the gift, untested in game | Leading to hidden markers in flet giants was dropped and the markers removed (script only sees loaded chunks; placed structures cannot be located). The white deer now leads once to a spot it picks and lays a Great Mallorn nut (`docs/mobs/white_deer.md`, `TECHNICAL_NOTES.md` White deer guidance). Not done: sounds, the in-game goal experiment (`tools/dev_scripts/guide_goal/`). |

## Redstone

Custom blocks **can** open by redstone, contrary to the first assessment. The wiki warns that
`onRedstoneUpdate` also fires on placement and chunk load, so a naive toggle misbehaves. The mod
avoids that by storing the last power state it acted on (`lothlorien:powered`) and only reacting
when power really changes; `open` then follows power. Door parts are combined (either half powered
counts). **Untested in game** — if doors flip on world load or on placement, look at
`lothlorien:redstone_toggle` in `scripts/blocks.js`. Note `minecraft:redstone_consumer` stops a block
conducting redstone; that is fine for these thin blocks.
