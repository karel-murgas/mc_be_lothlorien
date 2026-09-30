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
toolkit: `tools/flet_mallorn.mjs` (variants flet / woven / plain) plus `tools/build_structures.mjs` (writes
`.mcstructure`) and the showcase curation command. Six curated giants generate as a jigsaw structure. Details
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

_Status 2026-09-30: built and deployed, static checks only, **not yet tested in game**. Model and textures are generated
placeholders (`tools/make_deer.py`), queued in `GRAPHICS_TASKS.md` step 11. Shed-antler world feature not built
(`NOT_IMPLEMENTED.md`). Design sheet `docs/mobs/deer.md`, notes and test plan in `TECHNICAL_NOTES.md` (Deer)._

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

Add variant / separate entity.

Prototype structure marker system:

- player offers Western Corn while eligible,
- hidden marker block in Lothlórien structures,
- search practical radius,
- deer selects nearest known marker,
- guided movement.

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

## Primary tools

Blockbench + graphics + sound model + Claude.

---

# Phase 14 — Firefly

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

# Phase 14b — Lothlórien bees

A second kind of bee, `lothlorien:mallorn_bee`, that lives on Mallorns and works only with
Lothlórien flora. Chosen over overriding `minecraft:bee` (adding our flowers to vanilla bees): an
override conflicts with any other add-on that touches the bee and must be re-synced by hand with
every vanilla change. Vanilla bees stay untouched and ignore our flowers.

## Decided (2026-09-29)

- **Behaviour = vanilla bee.** Built from vanilla `bee.json` (newest copy: `vanilla_1.26.30`):
  hover, pollinate, go home at night and in rain, sting like vanilla (poison by difficulty, the
  bee dies after stinging, the swarm gets angry when its hive is broken or hit).
- **Flowers** (pollination targets, lure, breeding, baby feeding): Elanor, Niphredil, Athelas, and
  Mallorn blossom. Vanilla puts `cherry_leaves` and `pink_petals` in all four bee lists, and
  Mallorn blossom (our pink-petals analogue) gets the same treatment. `mallorn_leaves` do **not**
  count (decided, unlike vanilla `cherry_leaves`).
- **Honey**: plain vanilla honeycomb and honey bottles.
- **Western corn**: bees carrying nectar speed it up. Vanilla `minecraft:grows_crop` only knows
  vanilla crops, so a script (`crop.js`) advances `lothlorien:growth` for corn under a bee that has
  nectar, at a similar rate (vanilla: `chance 0.03`, 10 charges).
- **Texture**: a recolour of the vanilla bee texture (pale gold / silver), reusing the vanilla bee
  geometry and animations in the client entity file. No new model.
- **Hives**: natural (worldgen on Mallorns, sometimes on sapling-grown trees) and craftable.

## Research so far (documented, not verified in game)

- Bee flower handling is not engine-hardcoded: vanilla `bee.json` lists block and item ids in
  `move_to_block.target_blocks` (pollination), `tempt`, `breedable` and `ageable`. There is no
  flower tag, so a custom entity just lists our block ids.
- Entering a hive is data-driven on the bee side: `move_to_block` / `go_home` fire the event
  `minecraft:bee_returned_to_hive` on the target block. The hive side is engine code.
- The Bedrock hive block entity stores its occupants generically: `Occupants[]` with
  `ActorIdentifier`, `SaveData`, `TicksLeftToStay`, `ShouldSpawnBees` (minecraft.wiki, Bedrock block
  entity format). NBT-editor tricks storing `minecraft:npc` in a beehive exist, which suggests
  a hive can hold and release any entity, not just `minecraft:bee`. The Java-only rule "a non-bee
  never leaves the hive" does not apply to Bedrock.
- Honey level rises by 1 (1% chance: 2) when a bee that has nectar leaves the hive. How Bedrock
  decides "had nectar" is unknown: it may read `minecraft:is_charged` (the `has_nectar` group), the
  `minecraft:has_nectar` entity property, or check for `minecraft:bee`.
- Worldgen nests from a `single_block_feature` probably rely on `ShouldSpawnBees`, which spawns
  **vanilla** bees. Our natural nests need our bees instead (see below).
- The Script API (2.8.0) has no hive or occupant API: script can neither read nor fill a hive.

## Spike first, in game (about an hour): can our bee use vanilla hives?

Minimal `lothlorien:mallorn_bee` (vanilla copy, recoloured texture, spawn egg), an empty
`minecraft:beehive`, and a patch of Elanor. Check, in order:

1. The bee pollinates Elanor (proves `target_blocks` works with custom blocks).
2. It enters the hive at night and comes out again as `lothlorien:mallorn_bee`.
3. Honey level rises after nectar trips. If not, try adding the `minecraft:has_nectar` property
   (copying the vanilla property may be refused for a custom entity).
4. Breaking the hive angers it; shears or a bottle at level 5 work (they are hive behaviour, so they
   should).
5. A vanilla bee and ours share one hive without problems.

**If 1-4 pass (plan A):**
- Crafted hive = vanilla `minecraft:beehive`. Known problem (2026-09-29): Mallorn planks do not work
  in vanilla plank recipes yet; that is being fixed separately, and the beehive recipe follows from it.
  Optional extra: a Mallorn-styled hive recipe.
- Natural nest = vanilla `minecraft:bee_nest` holding **our** bees. Two ways, try in order:
  (a) a `.mcstructure` of a nest whose `Occupants` are `lothlorien:mallorn_bee` (written with a
  Python NBT tool or saved in game with a structure block), placed by a `structure_template_feature`
  next to the trunk; (b) a plain nest with no occupants plus a script that spawns 2-3 of our bees
  beside new nests. Homeless vanilla-style bees look for the nearest hive (`find_hive` group) and
  move in.

**If 2 or 3 fail (plan B): our own hive block** `lothlorien:mallorn_hive` (natural and crafted
variants), driven by script: the bee's `on_reach` fires a custom event and the script removes the
bee and counts it, plus its nectar, in block states (occupants 0-3, `honey_level` 0-5); it releases
them at dawn and when rain stops, spills them out angry when the hive is broken, and handles shears
(3 honeycomb) and a glass bottle (a honey bottle). A campfire below calms the bees, like vanilla.
More work, but all of it is under our control.

## Build (after the spike)

1. Bee entity + client entity + recoloured texture + spawn egg + names (`en_US`, `cs_CZ`).
2. Hive route from the spike (plan A or B).
3. Worldgen: aggregate `[select_mallorn_tree_feature, optional nest]` with our own copy of
   `beehive_feature` (vanilla `may_attach_to` names only oak/birch logs and leaves). The search must
   cover taller Mallorn trunks than the vanilla 0-6 blocks, or put the nest under a branch. Chance:
   start at 1 tree in 20.
4. Sapling growth (`trees.js`): a small chance of a nest when flowers are within 2 blocks, like vanilla.
5. Corn pollination script.
6. Tests in `tests/run.mjs` for the pure parts (corn growth chance, nest placement rules).

## Success criterion

In a new world, some Mallorns have nests with golden bees that work Elanor, Niphredil, Athelas and
blossom carpets, fill with honey that harvests like vanilla, speed up nearby corn, and sting like
vanilla bees. Vanilla bees and vanilla flowers behave as before.

## Primary tools

Claude (entity, features, script), image pipeline or a scripted hue shift for the texture.

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

Every guideable structure gets its hidden marker.

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
