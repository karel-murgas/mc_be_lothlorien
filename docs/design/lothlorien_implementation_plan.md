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

# Phase 14b — Mallorn nectar (replaces the bees)

Decided 2026-10-02 (owner). Nectar replaces honey: **Miruvor takes Mallorn nectar instead of a honey bottle**, and the
settlement traders drop honey (supply and demand to be worked out with the settlements). Nectar is an ingredient
only, not drinkable. Source: the **nectar bloom**, refilling at about **one bottle per bloom per in-game day**. A second
Mallorn mechanic, **morning dew**, gives a different resource with its own use (being decided). The player can take both
home by growing a Mallorn from an acorn. No speed-up from nearby flowers (owner).

**Pace and simulation distance.** Random ticks (like vanilla crops and saplings) only happen inside the simulation
distance around a player, so a bloom fills only while someone is near. Accepted, vanilla-like. Comparison (our notes say
a block gets a random tick about once a minute: documented, not measured): Mallorn sapling 2 stages at 1/7 per tick,
about 15 min; Western Corn 7 stages at 1/3 (wet) or 1/5, 20-35 min. Bloom: 3 stages at 1/7 per tick, about 20 min = one
in-game day of being nearby.

## Source 1: Nectar bloom

A small hanging cluster of golden Mallorn flowers under Mallorn leaves (vanilla analogue: spore blossom).

- State `lothlorien:nectar` 0-3 (dry, budding, open, full), each stage visible; at 3 a golden drop hangs below.
- Fills by random tick (1/7 per stage), **only while Mallorn leaves (green or golden) are directly above it**; elsewhere
  it stays dry and is just decoration.
- Glass bottle on a full bloom: one Mallorn nectar, bloom back to 0.
- Shears take it as an item; by hand it breaks and drops nothing (vanilla vines). Hangs only under a full block face
  (leaves) like the spore blossom.
- Found on natural Mallorns (worldgen, a few per tree under the crown), and a sapling-grown Mallorn sometimes gets one.

## Morning dew on the blossom carpet (resource and use being decided)

The fallen-blossom carpet (`lothlorien:mallorn_blossom`) gathers dew towards dawn and loses it during the day. It gives
**not nectar but its own resource** (owner, 2026-10-02); candidates in the 2026-10-02 discussion: Phial-like starlight
water (Eärendil is the Morning Star), Disharmony cleansing, an Elven growth aid, a brewing ingredient.

- New bool state `lothlorien:dew`; a dewy carpet shows droplet glints (texture variant).
- Random tick, in the last part of the night: may set dew, only with Mallorn leaves somewhere above (search a few
  blocks up). During the day: each tick may clear it, so dew is gone by about midday. Tune so most carpets under a
  tree are dewy at sunrise (the last third of the night is only about 3 random ticks per block).
- Glass bottle on a dewy carpet: the dew resource, dew cleared. Worldgen makes few full carpets (5 scatter tries per
  tree, weights 24/12/4/4 for 1-4 petals: about one full carpet per two trees), so a "full carpets only" rule would
  make natural dew rare; decide with the resource.
- Taking it home is already possible: the carpet is placeable.

## Build

1. Item `lothlorien:mallorn_nectar` (bottle icon, golden), Miruvor recipe change. Dew item once its use is decided.
2. Nectar bloom block (4 stages, generated art), random tick + bottle in script (same kind as `crop.js`), shears drop.
3. Dew state on the blossom carpet (doubles its permutations: check the count), dew art, random tick + bottle.
4. Worldgen blooms on Mallorns; sapling chance in `trees.js`.
5. Tests in `tests/run.mjs` for the pure rules (fill chance, dew time window, "leaves above" check).

Engine note to verify: the random tick rate per block (our notes: about once a minute at the default
`randomtickspeed`); measure in game (a few blooms, a timer) before final tuning.

## Success criterion

In a new world, golden blooms hang under Mallorn crowns and fill over a day; blossom carpets glitter with dew at
sunrise and dry by noon; a bottle gives nectar from a bloom and the dew resource from a carpet; a bloom cut with shears and hung under a home-grown
Mallorn keeps working; Miruvor is crafted with nectar.

## Phase 14c — Butterflies (owner, 2026-10-02)

Daytime counterpart of the firefly, to make Lórien livelier (the job the bees were meant to do). Built on the firefly
(`docs/mobs/firefly.md`): tiny hovering flyer, `random_hover`, no AI towards blocks (custom blocks cannot be targeted,
see the bee spike). Spawns by day on grass in the biome (light high), small groups, pool `animal`, standard despawn.
2-3 wing colours as a variant property (silver-white, gold, pale blue), fluttering wing animation. No drops, no catch
for a start. Design sheet in `docs/mobs/butterfly.md` when built.

## Bee spike (2026-10-02, 1.26.52, removed in favour of the above)

A custom bee (`lothlorien:mallorn_bee`, vanilla `bee.json` copy) was built and tested in four rounds. In game: it
enters vanilla beehives and bee nests at night and leaves at sunrise; **`move_to_block.target_blocks` never targets
custom blocks** (bare ids, exact-state descriptors, with or without the waterlogged filter), while vanilla poppy and
dandelion work; with its own `lothlorien:has_nectar` property it brings nectar into a nest but **adds no honey**.
Pollinating our flowers would have needed script-guided flying (owner: no). Details in
`.claude/skills/bedrock-mobs/references/behaviour.md`; files in commit `8a9220b`.

---

# Phase 15 — Unicorn

Do this after Disharmony and animal infrastructure are stable.

## Features

- horse-derived locomotion,
- custom model/texture,
- uncommon spawn,
- strong avoidance of Disharmonious players,
- Friend-only approach,
- offer Elanor while Friend status is active to initiate trust/taming,
- rideable/tamable result.

Test multiplayer state carefully: one player's Disharmony must not make the unicorn incorrectly react to another player.

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

Use procedural scaffolding when useful, but curate every final structure.


## Primary tools

Minecraft Editor/Structure Blocks + Claude generator + graphics where needed.

---

# Phase 17 — Elven lighting

Add:

- silver Elven lamp,
- hanging variant if practical,
- Firefly Jar.

Test:

- normal rendering,
- Vibrant Visuals,
- interior/exterior brightness,
- nighttime Lothlórien ambience.

## Primary tools

Graphics + Claude.

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
