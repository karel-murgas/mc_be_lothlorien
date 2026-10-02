# Lothlórien Bedrock Add-On — High-Level Implementation Plan

_Last updated: 2026-09-28_

## Guiding principles

1. Build a thin vertical slice first.
2. Test risky Bedrock mechanics before producing lots of art/content.
3. Keep code/data systems generic enough to reuse.
4. Use LLMs for repetition and procedural generation, but keep visual curation human.
5. Avoid burning expensive coding-model usage on asset grunt work.
6. Commit each working milestone to Git.
7. Test in a disposable world; worldgen changes require newly generated chunks.

---

# Tool roles

## Claude — coding / architecture

Use Claude primarily for:

- Bedrock pack architecture,
- TypeScript Script API work,
- feature rules / biome JSON,
- custom entity behavior,
- Disharmony system,
- custom crops/items,
- procedural tree/structure generator,
- automated validation scripts,
- debugging difficult Bedrock behavior,
- code review.

Preserve Claude usage by:

- giving it focused tasks,
- keeping stable reference docs in the repository,
- using deterministic scripts/tests where possible,
- not asking it to regenerate textures/audio,
- splitting implementation into small milestones.

## Graphics pipeline — image model + asset tools

The user plans to use "Codex for graphics".

Important distinction:

- If "Codex" means the OpenAI coding agent, it is useful for automating graphics pipelines, file conversion, validation and texture-processing scripts, but it is not itself the image renderer.
- Actual visual generation should use the image-generation model/tool available in that workflow.
- Codex can still be very useful for turning generated art into Minecraft-ready assets.

Use graphics tooling for:

- Mallorn bark/leaves/planks,
- carved wood set,
- flowers/crops,
- food/item icons,
- animal texture concepts,
- lanterns,
- antlers,
- structure decorative textures.

Use Blockbench for:

- deer model,
- unicorn model,
- bird model,
- firefly model if needed,
- entity animations,
- any custom block geometry.

Useful secondary tools:

- Aseprite / Paint.NET / GIMP for manual cleanup,
- ImageMagick/Python scripts for resizing, palette checks and batch validation.

## Local sound model — audio

Use local sound generation for:

- wind,
- birds,
- distant song,
- soft chimes,
- night ambience,
- structure ambience,
- optional biome music stingers.

Post-processing:

- trim/normalize locally,
- export to Minecraft-compatible `.ogg`,
- keep loops seamless,
- test loudness inside Minecraft rather than only in an audio player.

FFmpeg is useful for conversion/normalization.

## Minecraft-specific tools

Recommended:

- Minecraft Bedrock (current stable)
- optionally Minecraft Preview for API experiments
- Visual Studio Code
- Node.js
- TypeScript
- `@minecraft/server`
- MCTools starter or Microsoft's add-on starter project
- `just-scripts local-deploy`
- Git
- Blockbench
- Minecraft Editor and/or Structure Blocks
- Snowstorm for particle authoring if useful

---

# Phase 0 — Project skeleton and reference baseline

## Goal

Create a minimal add-on repository that builds, deploys and reloads reliably.

## Tasks

- create behavior pack,
- create resource pack,
- TypeScript module,
- local deploy command,
- Git repository,
- debug logging,
- test-world workflow,
- project namespace,
- repository docs:
  - `DESIGN.md`
  - `TECHNICAL_NOTES.md`
  - `ASSET_GUIDE.md`
  - reference links.

## Success criterion

One trivial custom block/item/entity loads correctly and the project can be redeployed quickly.

## Primary tool

Claude.

---

# Phase 1 — Biome technical spike

This is the first real risk test.

## Build

Minimal Lothlórien biome with:

- partial replacement of vanilla forest,
- vivid green grass,
- clean blue water,
- custom fog,
- temporary golden foliage tint,
- no `monster` tag,
- `/locate biome` working.

Do not build the full content set yet.

## Tests

- biome generates in sufficiently large areas,
- inspect border quality,
- hostile mobs do not naturally spawn inside,
- hostile mobs can still walk in from outside,
- verify night brightness/visual options,
- test both normal graphics and Vibrant Visuals if relevant.

## Success criterion

Walking across a border clearly feels like entering a different biome and ordinary hostile spawning is suppressed.

## Primary tool

Claude.

---

# Phase 2 — Edge/heart feasibility spike

Do this early because the depth gradient is a defining feature.

## Prototype A: runtime depth detector

Every few seconds:

- get player position,
- sample biome at multiple radii/directions,
- estimate:
  - edge,
  - inner,
  - deep/heart.

Do not sample every tick.

Measure performance.

## Prototype B: worldgen heart approximation

Experiment with:

- rare grove features,
- noise-controlled vegetation,
- landmark structures,
- feature density variation.

Decide whether this is visually sufficient.

## Optional advanced spike

Only if needed:

- investigate scripted post-generation decoration for deep areas.

Do not commit to this unless simpler worldgen fails.

## Success criterion

We know how much of "deeper = more magical" can be achieved safely.

## Primary tool

Claude.

---

# Phase 3 — Mallorn block family

## Build first

- log,
- stripped log,
- leaves,
- planks,
- stairs,
- slabs.

Then expand:

- fence/gate,
- carved door,
- carved trapdoor,
- signs,
- button/plate.

## Art workflow

1. generate concept/texture candidates,
2. convert to Minecraft resolution,
3. manually clean important tiles,
4. test tiling in a large wall/floor,
5. test under real Minecraft lighting.

## Important art test

Build a 20x20 plank wall and floor.

If the texture looks repetitive/striped/dirty at that scale, fix it before generating the whole wood family.

## Primary tools

Graphics pipeline + Claude for JSON.

---

# Phase 4 — Small Mallorn + sustainable acorn loop

## Build

- custom acorn/nut item,
- plantable sapling/acorn block,
- small procedural Mallorn,
- Mallorn leaf loot table (saplings/acorns),
- Mallorn leaf decay (see `NOT_IMPLEMENTED.md`): leaves not connected to a log fall off,
- bone meal support if practical.

## Balance test

Cut down 20 player-grown Mallorns.

Measure:

- average acorns returned,
- average wood,
- growth reliability.

Target:

- comfortably renewable,
- not absurdly abundant.

## Success criterion

Player can bring one viable Mallorn home and establish a sustainable tree farm.

## Primary tools

Claude + graphics.

---

# Phase 5 — Procedural Mallorn generator

**Status: done 2026-09-30.** The procedural generator shipped as one parametrised builder, not a primitive
toolkit: `tools/flet_mallorn.mjs` (variants round / roundplain) plus `tools/build_structures.mjs` (writes
`.mcstructure`) and the showcase curation command (moved out of the pack to `tools/dev_scripts/showcase.js`, 2026-09-30). Six curated giants generate as a jigsaw structure. Details
and traps: `docs/TECHNICAL_NOTES.md`, Phase 5.

Build the reusable structure-generation toolkit before hand-authoring many trees.

## Generator primitives

- line,
- curved line,
- tapered cylinder,
- branch,
- fork,
- root,
- ellipsoid,
- noisy foliage blob,
- replace-air-only placement,
- seed-based randomness.

## Generator parameters

- trunk height/radius,
- taper,
- curvature,
- fork probability,
- branch start height,
- branch count,
- branch length,
- upward bias,
- crown radius/height,
- foliage density,
- root count/length,
- asymmetry.

## Workflow

Generate batches:

- 20 medium candidates,
- keep 4–6,
- 20 large candidates,
- keep 4–6,
- 10 ancient candidates,
- keep 2–4,
- several epic candidates,
- keep only genuinely impressive examples.

Save selected trees as structures.

## Success criterion

A forest generated from the selected library does not look cloned.

## Primary tool

Claude for generator code; Minecraft for visual curation.

---

# Phase 6 — Ground identity and flora

Add in this order:

1. golden leaf carpet,
2. Elanor,
3. Niphredil,
4. Athelas,
5. golden fern,
6. Mallorn blossom,
7. falling-leaf particles.

Then Western Corn.

## Why this order

The biome should visually work before gameplay plants become complex.

## Primary tools

Graphics + Claude.

---

# Phase 7 — Western Corn and Lembas loop

## Implement

- crop block/growth states,
- seed/grain item,
- growth conditions,
- harvesting,
- dough/intermediate,
- baked cake,
- Mallorn-leaf wrapping,
- final Lembas food behavior.

## Test

- farming outside Lothlórien,
- growth speed,
- low-light behavior,
- recipe discoverability,
- hunger/saturation balance.

## Success criterion

Finding the crop gives a permanent useful thing to bring home.

## Primary tool

Claude; graphics for crop and food icons.

---

# Phase 8 — Athelas / Miruvor

Implement:

- Athelas harvesting,
- Athelas salve,
- Elanor/Niphredil recipe roles,
- Miruvor item,
- consumption behavior.

Keep first balance conservative.

Avoid making Miruvor cheaper/better than all vanilla potions.

## Primary tools

Claude + graphics.

---

# Phase 9 — Disharmony core

Implement before fauna, so every animal can plug into the same API.

## Core service

Track:

- current Disharmony points,
- derived level,
- timestamp/time-since-last Lothlórien kill,
- peaceful time at zero,
- Friend status.

Persist player state via dynamic properties.

## Event handling

On entity death:

- detect player-caused kill,
- detect Lothlórien biome,
- add Disharmony.

## Decay

Prototype:

- one point per ~5 peaceful minutes inside biome.

## UI

Since custom native status effects are not a normal supported extension point:

- actionbar while inside biome,
- title/message when level changes,
- title/message when Friend status is gained/lost.

## Success criterion

Mechanic survives relogging and multiplayer players have independent state.

## Primary tool

Claude.

---

# Phase 10 — Fauna spawning safety spike

_Status 2026-09-30: done, game-tested (standard despawn rules work, name-tagged critters stay); see `TECHNICAL_NOTES.md` (Fauna spawning spike)._

Before creating all animals, make one ugly placeholder critter.

## Test

- biome-only spawn rules,
- population control,
- density limits,
- distance despawn,
- inactivity despawn,
- simulation-edge despawn,
- repeated travel through many chunks,
- multiplayer if possible.

Monitor entity counts.

This is important because custom mobs that persist incorrectly can consume population caps.

## Success criterion

After leaving and returning to areas, entity counts remain healthy and mobs continue spawning normally.

## Primary tool

Claude.

---

# Phase 11 — Deer

_Status 2026-09-30: built, deployed, and game tested. Model and textures final and approved. Shed-antler block + floor drop + flet chest entry built
(`TECHNICAL_NOTES.md`, Deer antler). Design sheet `docs/mobs/deer.md`, notes and test plan in `TECHNICAL_NOTES.md` (Deer)._

Implement first because it proves most terrestrial-animal mechanics.

## Features

- model,
- idle/walk/run,
- herd spawning,
- skittish behavior,
- Disharmony avoidance,
- venison,
- optional antler drop.

Add natural shed-antler world feature separately.

## Primary tools

Blockbench + graphics + Claude.

---

# Phase 12 — White deer guidance

_Status 2026-09-30: **done**. Tested in game by the owner (1.26.52): luring, taming, guidance, the gift and the Great Mallorn nut growing
into a flet giant work. The white deer is
its own entity `lothlorien:white_deer` (a rare loner: no herd, no breeding, no babies, not tamable); offering it a **Mallorn acorn** at
Disharmony 0 starts guidance (the knowledge base said Western Corn; the owner changed it to the acorn). It walks by the engine's own
pathfinding, following an invisible helper `lothlorien:guide_beacon` that script moves ahead in 8-14 block hops (goal
`follow_target_leader`; fallbacks prepared in `tools/dev_scripts/guide_goal/`, to be decided by an in-game experiment). Third owner round
(2026-09-30): leading to hidden markers in flet giants was dropped (a loaded-chunk search only finds trees already in sight; script cannot
locate placed structures) and the markers removed. Instead, once per deer, it leads 36-56 blocks to a spot it picks inside the biome and
lays its gift, a **Great Mallorn nut** that grows like a sapling into a flet giant anywhere. Second owner round, built 2026-09-30 (static checks only):
the white deer is always an antlered hart with a sure antler drop, leashable (a lead always wins over guidance), counts double for
Disharmony, spawns more in the heart than at the edges (script filter on natural spawns by depth); ordinary deer eat only Western Corn
grain. Design, assumptions, the goal experiment and the in-game test plan: `TECHNICAL_NOTES.md` (White deer guidance)._

Add variant / separate entity.

Guidance to a gift (built instead of the original marker idea, see status above):

- player offers a Mallorn acorn while eligible,
- the deer picks a spot inside the biome and leads there (engine pathfinding),
- it lays a Great Mallorn nut, once per deer.

Keep this feature optional until it proves stable.

## Primary tool

Claude.

---

# Phase 13 — Songbird

Implement:

- small model,
- perching/flying behavior,
- canopy-biased presence,
- feather drop,
- vocal sounds.

Do not over-engineer.

The bird exists primarily to make the biome feel alive.

_Status: built 2026-10-02 (spawns, flies and lands in game 2026-10-02; placeholder parrot sounds; lead untested). Design sheet and test list: `docs/mobs/songbird.md`._

## Primary tools

Blockbench + graphics + sound model + Claude.

---

# Phase 14 — Firefly

_Status: built 2026-10-02 (catch with glass bottle -> Bottle of Fireflies; release and jar still open; glow, icon, spawning and catching work in game). Design sheet: `docs/mobs/firefly.md`._

Implement carefully because many tiny entities can be expensive.

## Rules

- low density,
- night-biased,
- strong despawn rules,
- probably small clusters rather than swarms.

## Interaction

Glass bottle -> Bottle of Fireflies.

Later:

- placeable Firefly Jar,
- release action.

Use emissive rendering/particles for apparent glow; do not depend on true moving dynamic light.

## Primary tools

Graphics/Blockbench + Claude.

---

# Phase 14b — Mallorn nectar and morning dew (replaces the bees)

_Status: built 2026-10-02, static checks and tests only; not yet tried in game (notes: `docs/TECHNICAL_NOTES.md` "Phase 14b"). Open: measure the random tick rate and tune the chances and the dew window; check the Star canopy flipbook and glow, the hanging placement filter, and shears/loot in game._

Decided 2026-10-02 (owner). Nectar replaces honey: **Miruvor takes Mallorn nectar instead of a honey bottle**, and the
settlement traders drop honey (supply and demand to be worked out with the settlements). Nectar is an ingredient
only, not drinkable. A second Mallorn mechanic, **morning dew**, gives its own resource for decorative blocks. The
player can take both home by growing a Mallorn from an acorn. No speed-up from nearby flowers.

**Pace and simulation distance.** Random ticks only happen inside the simulation distance around a player, like vanilla
crops. Vanilla comparison (Minecraft wiki, Java averages; Bedrock assumed close, not measured): oak sapling about 15 min,
sugar cane about 18 min per block, sweet berry bush about 10-12 min from picked to ripe, wheat about 30 min; one in-game
day = 20 min. Ours (our notes: about one random tick per block per minute, documented, not measured): Mallorn sapling
about 15 min, Western Corn 20-35 min.

## Nectar bloom

A small hanging cluster of golden Mallorn flowers under Mallorn leaves (vanilla analogue: spore blossom).

- State `lothlorien:nectar` 0-3 (dry, budding, open, full), each stage visible; at 3 a golden drop hangs below.
- Fills by random tick, 1/7 per stage: **about 20 min (one in-game day) from empty to full on average**, randomised by
  the ticking itself (owner). Only while Mallorn leaves (green or golden) are directly above it; elsewhere it stays dry
  and is just decoration. **Standard simulation-distance mechanics only** (owner): no catch-up, a bloom fills only while
  a player is near, like vanilla crops.
- Glass bottle on a full bloom: one Mallorn nectar, bloom back to 0.
- Shears take it as an item; by hand it breaks and drops nothing (vanilla vines). Hangs only under a full block face.
- **Worldgen places blooms full** (owner): a few per natural Mallorn, under the crown. A sapling-grown Mallorn sometimes
  gets one.

## Morning dew (owner, 2026-10-02)

- **Where:** every Mallorn ground cover, blossom carpet and leaf litter, under Mallorn leaves. Most players meet it simply
  by being in Lórien at sunrise.
- **When:** dew appears from the start of the morning (so sleeping through the night still gives dew on waking: a
  random tick in the morning window sets it, not a tick at night) and is gone by mid-morning. Simulation distance is the
  intended limit: dew forms only around a player who is there.
- **State:** bool `lothlorien:dew` (droplet glints in the texture). **Chance per random tick** (owner, 2026-10-02): in the
  morning window a dry cover turns dewy with its chance, **leaf litter 1/8, blossom 1/2** (owner: 1/8 rewards active collecting); outside the window any dew
  dries. A picked cover can turn dewy again in the same morning: staying in the grove pays. Doubles the litter and
  blossom permutations (check the count).
- **Collecting: a Dew bottle that fills up**, like Miruvor in reverse (owner: "like the bundle, but you can't empty it
  early"). Using a glass bottle on dewy cover turns it into a Dew bottle with one drop; each further drop fills it. Shown
  with the durability bar (Miruvor's mechanism, verified in game): damage counts the missing drops. At full it becomes a
  **Bottle of morning dew** (stackable). No way to pour it out.
- **Yield: about one bottle per tree per morning** (owner). World "T" scan (2026-10-02, `tools/world_scan.py`, ~713
  trees): about 34 leaf-litter carpets and 1.3 blossom carpets per tree, a full blossom carpet on fewer than 1 tree in
  10. **8 drops per bottle** (owner). Expected, with about 4 random ticks per cover in the window (rate not measured): one
  late pass collects 1-(7/8)^4 = 41% of litter (~14 drops) + ~94% of blossoms (~1): **about 2 bottles per tree**;
  picking repeatedly gives about 4/8 per litter + ~2 per blossom, ~20 drops (2.5 bottles). Above the earlier "one bottle
  per tree" on purpose (owner chose 1/8). Tune the chances and the window after measuring the tick rate.
- **Blossom worldgen fix:** the tree's aggregate places 90 leaf-litter tries before the 5 blossom tries, so litter
  takes the spots. Place blossoms first, same 5 tries (owner).
- **Uses** (owner): the Star canopy block (below), Elven rope (Phase 17b), and maybe a dew lantern (Phase 17 idea).
  Not a held lamp, not Athelas/healing (Miruvor's role).

## Star canopy (owner, 2026-10-02; built, not seen in game)

`lothlorien:star_canopy`: a "sky ceiling" block for Elven halls and the undersides of talans. Deep night blue with silver
stars that slowly twinkle (animated block texture: check flipbook support for custom blocks), **light level 6** (soft: a
ceiling of it lights a hall dimly, like a starry night). Glow under Vibrant Visuals through an emissive MERS texture set,
as on the firefly. **Recipe (owner): 3 Bottles of morning dew + 3 Mallorn leaves + 3 deepslate tiles -> 9 Star canopy** (leaves on top,
dew in the middle, stone below; 8 per bottle was judged too generous). Crafting probably uses up the glass bottles.

## Build

1. Item `lothlorien:mallorn_nectar` (golden bottle icon), Miruvor recipe change.
2. Nectar bloom block (4 stages, generated art), random tick + bottle in script (same kind as `crop.js`), shears drop,
   worldgen full on Mallorns, sapling chance in `trees.js`.
3. Dew states on leaf litter and blossoms, dew art, morning random tick, Dew bottle filling + Bottle of morning dew.
4. Blossom worldgen order (blossoms before litter).
5. Star canopy block.
6. Tests in `tests/run.mjs` for the pure rules (fill chance, dew time window, "leaves above", bottle filling).

Measure the random tick rate in game (a few blooms, a timer) before final tuning.

## Success criterion

In a new world, full golden blooms hang under Mallorn crowns and refill in about a day; at sunrise the ground under
Mallorns glitters with dew and a bottle filled from one tree's dew becomes a Bottle of morning dew; a bloom cut with
shears and hung under a home-grown Mallorn keeps working; Miruvor is crafted with nectar.

## Phase 14c — Butterflies (owner, 2026-10-02)

Daytime counterpart of the firefly, to make Lórien livelier (the job the bees were meant to do). Built on the firefly
(`docs/mobs/firefly.md`): tiny hovering flyer, `random_hover`, no AI towards blocks (custom blocks cannot be targeted,
see the bee spike). Spawns by day on grass in the biome (light high), small groups, pool `animal`, standard despawn.
Wing colours: **8 bright variants** as a variant property (red, orange, yellow, lime, turquoise, blue, violet, pink; owner
asked for colourful rather than silver/gold/blue), fluttering wing animation. No drops, no catch for a start.
**Built 2026-10-02**, untested in game; design sheet `docs/mobs/butterfly.md`.

## Bee spike (2026-10-02, 1.26.52, removed in favour of the above)

A custom bee (`lothlorien:mallorn_bee`, vanilla `bee.json` copy) was built and tested in four rounds. In game: it
enters vanilla beehives and bee nests at night and leaves at sunrise; **`move_to_block.target_blocks` never targets
custom blocks** (bare ids, exact-state descriptors, with or without the waterlogged filter), while vanilla poppy and
dandelion work; with its own `lothlorien:has_nectar` property it brings nectar into a nest but **adds no honey**.
Pollinating our flowers would have needed script-guided flying (owner: no). Details in
`.claude/skills/bedrock-mobs/references/behaviour.md`; files in commit `8a9220b`.

---

# Phase 15 — Unicorn

**Done 2026-10-02 (tried in game, accepted)** - see `docs/mobs/unicorn.md`.

Do this after Disharmony and animal infrastructure are stable.

## Features

- horse-derived locomotion,
- custom model/texture,
- uncommon spawn,
- strong avoidance of Disharmonious players,
- Friend-only approach,
- offer Elanor while Friend status is active to initiate trust/taming,
- rideable/tamable result,
- we may create more interesting taming process

Lurable by Elanor, but not leachable. Ridable, but without a saddle. Saddle can't be put on. Qualities of the best horse.

## Primary tools

Blockbench + graphics + Claude.

---

# Phase 16 — Structures

Start with a tiny set:

1. simple flet,
2. root shrine,
3. small pool/garden.

Then expand:

- bridge/platform,
- resting pavilion,
- ceremonial platform,
- rare ancient grove landmark.

Use procedural scaffolding when useful, but curate every final structure. Maybe some moss paths (moss then needs to be allowed for Lothlorien fauna and flora to spawn on)

## Primary tools

Minecraft Editor/Structure Blocks + Claude generator + graphics where needed.

---

# Phase 17 — Elven lighting

_Status: silver Elven Lantern, Firefly jar and chandelier built and accepted; golden heartwood lantern and revised icons deployed 2026-10-03. Sconce rejected; dew stays out of the lamp recipes. Details: `docs/TECHNICAL_NOTES.md` "Phase 17"._

Add:

- silver Elven lamp,
- hanging variant if practical,
- Firefly Jar.

Idea (2026-10-02, undecided): **dew lantern**, a slender silver hanging lantern with a glowing drop of morning dew
inside, light 15, crafted with a Bottle of morning dew (Phase 14b). Placed only, never a held light.

Test:

- normal rendering,
- Vibrant Visuals,
- interior/exterior brightness,
- nighttime Lothlórien ambience.

## Primary tools

Graphics + Claude.

---

# Phase 17b — Elven rope (hithlain)

Owner, 2026-10-02. Replaces the vanilla ladders in the flet giants (`great_mallorn` trees and the structures).
**Built 2026-10-02, accepted in game (climbing, icon); the decisions below are final, see `TECHNICAL_NOTES.md` Phase 17b:** recipe 1 dew + 1 golden fern -> 1 rope; hangs flat on the side of a block, one piece per item (stack), down first then up; any piece extends it; breaking any piece drops the whole rope where broken; climbing is script-driven.

- Crafted with a **Bottle of morning dew** (Phase 14b) plus a fibre (to decide); stackable item.
- **Placing:** use the rope on a block face; it unrolls straight down from there (or up, from a floor/ceiling: to decide)
  as far as the stack in hand allows, at most 64 (a full stack), stopping at the first block in the way. Each rope block
  uses one item.
- Climbable like a ladder or vanilla vines/scaffolding.
- **Breaking any piece breaks the whole rope** and gives every piece back.
- Open: how it attaches (side of a block vs under a ceiling), look (thin silver-grey, hangs in the middle of the cell),
  whether it can be extended by using more rope on its end.

---

# Phase 18 — Soundscape

Generate and integrate sound in layers.

## First pass

- day loop,
- night loop,
- several bird one-shots,
- leaf/wind one-shots,
- subtle chime.

## Second pass

- structure ambience,
- rare distant voice/song,
- optional music cue.

Keep rare sounds rare.

## Technical workflow

local model -> cleanup -> FFmpeg -> `.ogg` -> `sound_definitions.json` / `sounds.json` -> biome sound configuration.

## Primary tool

Local sound model.

---

# Phase 19 — Full edge/interior/heart polish

Now that content exists, tune where it appears.

Adjust:

- Mallorn category density,
- flower density,
- wildlife,
- fireflies,
- structures,
- leaf carpet,
- sound layers,
- nighttime visuals.

Use runtime depth estimate where useful.

The goal is experiential, not mathematical perfection.

Player should be able to say:

> "I'm clearly deeper in the forest now."

without looking at debug UI.

We should look at opportunities to apply Disharmony and Depth to make use of these mechanics.

---

# Phase 19b — Mallorn boats

Placed at the polish stage: nothing else depends on them, and the art is the expensive part.
Details and reasons: `NOT_IMPLEMENTED.md`.

## Spike first (half a day)

Custom boat entity copying vanilla `boat.json` (`buoyant`, `physics`, `rideable` seats,
`is_collidable`, family `boat`) plus an item that spawns it. Ride it on water.

Question to answer: is paddling/steering hard-coded to `minecraft:boat`, or does it work from the
components? If hard-coded, movement must be driven by script (read rider input, apply impulse).

## Build

- boat + chest boat entities (chest boat: seat + inventory, or a chest block riding along),
- carved, beautiful Mallorn model and texture (Blockbench + graphics pipeline),
- item icons, recipes (planks; chest boat = chest + boat), loot (drops the item when broken),
- water-only placement, break/despawn rules so idle boats do not pile up.

## Success criterion

A player can craft, launch, paddle and pick up a Mallorn boat, and it looks like it belongs to
the forest.

## Primary tools

Claude for the entity/script, Blockbench + graphics for the model.

---

# Phase 20 — Balance and survival playtest

Create a fresh survival world and play normally.

Test:

- finding biome,
- biome size,
- resource abundance,
- wood farming,
- Western Corn acquisition,
- Lembas usefulness,
- Miruvor cost,
- deer temptation vs Disharmony,
- Friend status difficulty,
- unicorn encounter frequency,
- custom mob population health,
- structure rarity,
- performance.

Do not balance from Creative-mode impressions.

---

# Phase 21 — Packaging / compatibility

Before calling v1 complete:

- test without experiments if possible,
- validate manifest/version requirements,
- package `.mcaddon`,
- test clean install,
- test multiplayer,
- test world reload,
- test new chunks,
- test interaction with at least a few other add-ons,
- document known incompatibilities,
- include backup warning for adding worldgen changes to existing worlds.

---

# Work allocation summary

| Work | Best primary tool |
|---|---|
| Pack architecture | Claude |
| Biome/worldgen JSON | Claude |
| Script API | Claude |
| Disharmony | Claude |
| Mob behavior | Claude |
| Procedural tree generator | Claude |
| Texture concepts | Image-generation tool |
| Texture processing/automation | Codex/coding agent or scripts |
| Entity/block models | Blockbench + graphics tool |
| Item icons | Graphics tool |
| Tree/structure visual curation | Minecraft + human |
| Sound generation | Local sound model |
| Audio conversion/integration | FFmpeg + Claude for config |
| Particles | Snowstorm + graphics + Claude |
| Testing/balance | Human + targeted Claude debugging |

---

# Recommended first milestone

Do **not** start by making all five animals.

The first satisfying milestone should be:

- custom Lothlórien biome,
- vivid grass + blue water,
- no normal hostile spawning,
- Mallorn log/leaves/planks,
- one small Mallorn,
- renewable acorn,
- golden leaf carpet,
- one Elanor flower,
- one falling-leaf particle,
- rough day/night ambience.

At that point, walk into the biome at sunset.

If it already feels special, the foundation works.

Then invest in giant trees, fauna and gameplay systems.

If it does not feel special yet, adding a unicorn will only give you a unicorn standing in the wrong forest.
