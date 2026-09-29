# Lothlórien Bedrock Add-On — Knowledge Base

_Last updated: 2026-09-28_

## 1. Design goal

Create a rare, large, peaceful custom Overworld biome inspired by Lothlórien.

The biome should not feel like "vanilla forest with yellow leaves". It should have its own:

- world-generation identity,
- tree system,
- ecology,
- resource loops,
- building materials,
- atmosphere,
- wildlife behavior,
- exploration rewards,
- moral/behavioral mechanic ("Disharmony"),
- progression from biome edge toward its deeper/older areas.

NPCs and quests are explicitly postponed until the biome itself is complete and fun to discover.

---

## 2. Core biome identity

### Visual identity

- Bright, clear green grass.
- Clean blue water.
- Mallorns with pale/silver bark and golden foliage.
- Golden fallen-leaf ground cover.
- Occasional falling golden leaf particles.
- Brighter, calmer night atmosphere than surrounding biomes.
- Silver/blue moonlit feeling at night rather than normal dark hostile forest.
- Silver-lighted Elven lamps around structures.
- Fireflies visible at night.
- Sparse but memorable Elven structures.

Bedrock client biome definitions can directly customize:

- grass color,
- foliage color,
- water surface color,
- fog,
- ambient sounds,
- biome music,
- sky color,
- Vibrant Visuals lighting / atmosphere hooks.

### Gameplay identity

- No normal hostile mob spawning inside the biome.
- Passive/magical fauna.
- Valuable plants and materials to bring home.
- Sustainable Mallorn farming without destroying the generated forest.
- A player behavior system: killing creatures inside Lothlórien creates Disharmony.
- Being peaceful long enough grants "Friend of Lothlórien".
- The deeper parts of the biome should feel older, stranger, richer and more magical.

---

## 3. World generation

### Biome placement

Use a custom Bedrock biome that partially replaces suitable vanilla forest biomes.

Likely targets:

- forest,
- birch forest,
- flower forest,
- possibly selected old-growth forest variants after testing.

Goal:

- rare,
- relatively large contiguous regions,
- not many small patches.

Current Bedrock partial biome replacement is stable (no experimental toggle required) from 1.21.110.

### Edge vs interior vs heart

Desired conceptual zones:

#### Edge
- smaller/younger Mallorns,
- more ordinary grass,
- fewer magical flowers,
- fewer fireflies,
- normal deer,
- structures uncommon.

#### Inner forest
- larger Mallorns,
- more golden ground cover,
- more Elanor/Niphredil,
- songbirds/fireflies more noticeable,
- white deer possible,
- unicorns possible,
- more Elven traces.

#### Heart / ancient grove
- ancient/epic Mallorns,
- heavy golden leaf cover,
- especially bright/silver nighttime feel,
- sacred clearings,
- shrines/flets,
- Western Corn glades,
- rare white deer,
- better unicorn presence,
- richest flower generation.

### Important technical limitation

Bedrock partial biome replacement operates by replacing vanilla biome selections. Custom replacement targets cannot simply name another custom biome, so creating literal nested custom biomes ("Lórien edge" -> "Lórien heart") is not straightforward.

Initial implementation strategy:

1. Generate one Lothlórien biome.
2. Use worldgen noise / rare features / special grove structures to create "heart-like" regions.
3. At runtime, sample nearby biome positions to estimate whether a player is near the biome edge or deep inside it.
4. Use that runtime depth for ambience, fauna behavior and certain scripted effects.

A later technical spike can investigate scripted post-generation decoration if true geometric "center" worldgen proves important enough.

---

## 4. Mallorn tree system

Mallorns are the defining asset of the biome.

### Small Mallorns

Use Bedrock's built-in `minecraft:tree_feature` for common smaller trees.

Benefits:

- natural variation,
- efficient world generation,
- suitable for player-grown trees.

### Medium to epic Mallorns

Use a procedural tree-generation toolkit written by an LLM / coding agent.

Workflow:

1. Generator creates a candidate tree in a test world.
2. Human visually inspects it.
3. Keep good trees; reject ugly trees.
4. Save good examples as `.mcstructure`.
5. Worldgen selects among structure variants with weighted randomness.

Generator should support reusable primitives such as:

- tapered trunk,
- curved branch,
- forked trunk,
- secondary branches,
- roots,
- ellipsoid foliage clusters,
- irregular/noisy canopy,
- asymmetry,
- hollow spaces,
- hanging branch geometry.

Planned categories:

- medium Mallorn,
- large Mallorn,
- ancient Mallorn,
- epic landmark Mallorn.

Epic Mallorns should be worldgen landmarks, not something a sapling grows beside the player's chicken coop.

### Mallorn farming / acorns

Player must be able to farm Mallorn wood sustainably.

Use a custom Mallorn nut/acorn item:

- obtainable from Mallorn leaf drops,
- plantable,
- grows into a small/medium farmable Mallorn,
- supports bone meal if practical,
- generated/player-grown Mallorn leaves must have a sustainable expected acorn return.

Target balance:

- ordinary tree should, on average, return more than one acorn,
- acorns should not rain from every leaf,
- ancient/epic Mallorns are not grown from ordinary acorns.

Use custom block loot tables for Mallorn leaves.

---

## 5. Mallorn wood set

Full custom pale Mallorn building set:

- log,
- stripped log,
- wood,
- stripped wood,
- planks,
- stairs,
- slabs,
- fence,
- fence gate,
- door,
- trapdoor,
- pressure plate,
- button,
- sign,
- hanging sign.

Art direction:

- pale/silver wood,
- elegant subtle grain,
- planks should use straighter cleaner board lines rather than vanilla-like zig-zag visual noise,
- door/trapdoor/fence/gate should look carved,
- leaf/branch/flowing Elven motifs without becoming overly ornate.

Potential later decorative blocks:

- carved Mallorn panel,
- lattice,
- pillar,
- railing.

---

## 6. Flora

### Primary special flora

#### Athelas
- medicinal herb,
- found in Lothlórien for gameplay convenience even though it is not specifically a Lothlórien-exclusive plant in Tolkien lore,
- raw use gives weak healing or becomes an ingredient,
- processed into stronger Athelas salve,
- ingredient in Miruvor.

#### Elanor
- small golden flower,
- strong visual identity,
- usable in recipes,
- possibly an ingredient in Miruvor.

#### Niphredil
- delicate pale/white flower,
- more common deeper inside,
- usable in recipes,
- possibly an ingredient in Miruvor.

#### Western Corn
- special crop used for Lembas,
- discovered in rare clearings / deeper Lothlórien,
- player can bring seeds/grain home and cultivate it,
- should grow reasonably quickly,
- should tolerate lower light better than wheat if practical,
- farmable anywhere once acquired.

### Secondary vegetation

Keep the vegetation set focused rather than adding dozens of magical plants.

Current planned ambient flora:

- golden fern,
- Mallorn blossom / fallen blossoms,
- golden fallen-leaf carpet.

No separate custom grass or star-moss is currently required; the biome's grass block itself should be a vivid green.

---

## 7. Lembas

Lembas should be a real progression loop, not a single crafting recipe from vanilla wheat.

Suggested loop:

1. Discover Western Corn in Lothlórien.
2. Collect seed/grain.
3. Grow it at home.
4. Craft grain into Lembas dough or an intermediate.
5. Bake an unwrapped Lembas cake.
6. Combine with a Mallorn leaf to create wrapped Lembas.

Gameplay identity:

- excellent expedition food,
- high saturation,
- compact/efficient,
- possibly fast eating,
- not simply "Golden Carrot but numerically larger".

Potential implementation:

- unwrapped cake = ordinary/good food,
- wrapped Lembas = superior travel food.

---

## 8. Miruvor

Miruvor is included even though the Fellowship received it from Rivendell; this add-on is not planned to create a separate Rivendell biome.

Likely ingredients:

- Athelas,
- Elanor and/or Niphredil,
- one additional sensible vanilla ingredient after balancing.

Desired role:

- expensive emergency/travel drink,
- restores some health,
- brief regeneration,
- possibly modest resistance or speed,
- should not obsolete normal potions.

Exact recipe/effect numbers are deferred to balancing.

---

## 9. Wildlife

### Deer

Common Lothlórien animal.

Behavior:

- usually in small groups,
- skittish,
- flees more strongly from Disharmonious players.

Drops:

- venison,
- hide/leather-like drop if useful,
- chance of antler depending on final model/sex variant.

Venison should be useful enough that killing deer is a real temptation.

### White deer

Uncommon special variant.

Behavior:

- peaceful and rare,
- reacts strongly to Disharmony,
- can act as an exploration guide.

Proposed mechanic:

- offer the white deer Western Corn while the player has Disharmony 0 / Friend status,
- it attempts to lead the player toward the closest nearby Lothlórien structure.

Implementation idea:

- every generated Lothlórien structure contains a hidden marker block,
- white deer searches for the nearest marker in a practical loaded radius,
- it pathfinds / moves toward that direction,
- if no marker is found, no guidance occurs.

This should be treated as a feature prototype because arbitrary worldgen structure lookup is not as simple as vanilla dolphin treasure behavior for custom structures.

### Songbird

Small ambient flying creature.

Role:

- makes canopy feel alive,
- contributes daytime soundscape.

Drop:

- feather.

No valuable unique loot required.

### Firefly

Small nocturnal ambient creature.

Requirements:

- visually emissive/glowing,
- low population, not swarms,
- careful spawn density and despawn rules.

Interaction:

- catchable with a glass bottle,
- becomes Bottle/Jar of Fireflies,
- can later be released,
- placeable Firefly Jar is a possible decorative light item.

Important: visual entity emissiveness does not guarantee true moving dynamic block light; use emissive visuals/particles for flying fireflies and use a placeable block for actual light.

### Unicorn

Uncommon but visible often enough that normal players can realistically encounter one.

Base:

- horse-like entity,
- custom appearance and behavior.

Behavior:

- flees Disharmonious players,
- only becomes approachable/tamable under "Friend of Lothlórien".

Taming requirement:

- player has Disharmony 0,
- player has maintained Disharmony 0 while in Lothlórien for at least 10 continuous minutes,
- this grants Friend of Lothlórien,
- while Friend status is active, offering Elanor initiates the unicorn's trust/taming interaction,
- only then can horse-like taming proceed.

All kills in Lothlórien count, including hostile mobs.

This is intentionally stricter: even killing a hostile creature that wandered into the biome breaks the peaceful streak.

---

## 10. Disharmony system

This is one of the biome's signature mechanics.

### Trigger

Whenever an entity dies:

1. Was the killer a player?
2. Did the kill occur inside Lothlórien?
3. If yes, increase that player's Disharmony.

All direct player kills count:

- passive animals,
- neutral mobs,
- hostile mobs.

Indirect/environmental deaths not caused by the player do not count.

### Persistence

Disharmony should be stored per player using script dynamic properties.

Suggested behavior:

- persists when leaving the biome,
- decays only through peaceful time spent inside Lothlórien,
- therefore the player "restores harmony" by spending peaceful time there rather than simply waiting elsewhere.

### Initial tuning proposal

Treat the exact numbers as starting values, not final balance:

- Disharmony I: 1 kill
- Disharmony II: 2–3 accumulated points
- Disharmony III: 4+ accumulated points
- one point decays after ~5 minutes spent in Lothlórien without a new kill.

### Effects

#### Disharmony I
- animals keep more distance,
- unicorns flee,
- rare flower bonus drops reduced.

#### Disharmony II
- deer/white deer become much harder to approach,
- fireflies move away,
- flower special/seed drops strongly reduced,
- white deer guidance unavailable.

#### Disharmony III
- wildlife strongly avoids player,
- unicorn interaction unavailable,
- rare special plant drops suppressed,
- future shrine blessings/NPC reactions can use this state.

Basic blocks/materials should not stop dropping; the system should discourage violence, not make the biome unusable.

### Friend of Lothlórien

Condition:

- Disharmony = 0,
- remain at 0 while inside Lothlórien for at least 10 continuous minutes.

Effects:

- unicorns may be approached/tamed,
- white deer can guide,
- wildlife uses its calmest behavior,
- could slightly improve rare flower harvesting if balance needs a positive reward.

Leaving Lothlórien can pause/remove the visible Friend status; the exact persistence semantics should be chosen during implementation.

### UI

Current Bedrock add-on APIs do not provide a normal supported way to register an entirely new native potion/status effect with its own icon/name.

Therefore:

- do NOT fake Disharmony by hijacking a vanilla potion effect,
- store it as scripted state,
- show state changes with titles/toasts/actionbar,
- while inside Lothlórien show a compact actionbar status such as:
  - `Disharmony I`
  - `Disharmony II`
  - `Disharmony III`
  - `Friend of Lothlórien`

This avoids overriding vanilla UI assets and avoids conflicts with unrelated potion effects.

---

## 11. Antlers

Sources:

- deer drop,
- naturally generated shed antlers placed on the forest floor.

Uses:

- decorative antler item,
- antler chandelier / wall decoration,
- possible later crafting ingredient.

Natural shed antlers are important so peaceful players can obtain them without killing deer.

---

## 12. Lighting

### Elven silver lamp

Signature Lothlórien light source.

Art direction:

- elegant silver/white fixture,
- narrow cool/silver glow,
- more refined than a vanilla lantern.

Possible recipe ingredients:

- iron,
- glass,
- amethyst,
- glowstone or another vanilla light ingredient.

Do not add a new ore only to justify the lamp.

### Firefly jar

Possible secondary decorative light:

- captured fireflies in a jar,
- warm, living-looking light,
- can potentially release the fireflies again.

---

## 13. Structures

Initial structure set:

- simple flet/watch platform,
- tree dwelling platform,
- double-tree bridge/platform,
- shrine among roots,
- small garden,
- clear pool/fountain,
- woodland resting pavilion,
- small Elven camp,
- hidden cache,
- ceremonial platform,
- rare interconnected Mallorn cluster.

Generation philosophy:

- most of biome remains wilderness,
- signs of Elves are occasional,
- impressive Elven locations are rare,
- no giant city in the first version.

Structures are generated from saved `.mcstructure` templates.

Many can be generated or scaffolded procedurally by LLM-written code and curated by hand.

---

## 14. Ambient audio

Custom sounds are supported through resource packs.

Desired daytime palette:

- soft leaves,
- birds,
- occasional distant song,
- water,
- rare subtle chime.

Desired nighttime palette:

- quieter birds,
- gentle insects/fireflies,
- soft wind,
- rare distant melodic/voice-like ambience,
- silver chime near Elven structures.

Music:

- optional and infrequent,
- should not constantly announce "fantasy biome music".

Local sound-generation model will be used to create source audio, then exported/processed to Minecraft-compatible `.ogg`.

---

## 15. Particles

Planned custom particles:

- slow falling golden Mallorn leaves,
- subtle firefly glow/halo,
- optional faint particles around sacred/heart structures.

Particles should be restrained; the biome should feel magical, not like someone detonated a particle editor.

---

## 16. Hostile mob policy

Goal: no normal natural hostile spawning in Lothlórien.

Implementation:

- do not give the custom biome the vanilla `monster` biome tag,
- explicitly test vanilla hostile spawn rules,
- test special cases such as:
  - mobs walking in from neighboring biomes,
  - raids/patrol-like mechanics,
  - phantoms,
  - addon mobs from other packs,
  - spawners/summoned mobs.

Hostiles entering through non-natural-spawn means are allowed to exist; killing them still breaks the Friend streak if the kill happens inside Lothlórien.

---

## 17. Custom mob population safety

This project should explicitly test Bedrock spawn/despawn behavior before building the full fauna roster.

Current Bedrock supports:

- spawn population-control pools,
- per-entity density limits,
- `minecraft:despawn`,
- distance/inactivity/simulation-edge despawn rules.

Every naturally spawning custom wildlife entity should have deliberate despawn configuration unless there is a clear reason for persistence.

This is especially important for:

- fireflies,
- songbirds,
- deer.

Unicorns may use stricter persistence rules after being tamed, while wild unicorns should despawn normally.

---

## 18. Banner pattern decision

A genuinely new native Loom banner pattern is **parked / not planned for v1**.

Reason:

- Bedrock banner texture atlases are not generally extensible by normal resource packs,
- current Script API banner functionality manipulates existing banner pattern types rather than registering new native patterns.

Possible later alternatives:

1. custom decorative Elven banner block/item,
2. reward a predesigned vanilla banner using existing layer combinations,
3. revisit if Mojang exposes custom banner-pattern registration in future APIs.

---

## 19. Explicitly deferred

Not part of the first biome release:

- NPCs,
- quests,
- large Elven city,
- Elven cord / hithlain gameplay,
- custom native banner pattern,
- separate Rivendell biome,
- new fantasy ore.

These can be added only after the biome itself is stable and fun.

---

## 20. Current content inventory

### Blocks / building
- Mallorn log / wood / stripped variants
- Mallorn planks
- stairs/slabs
- carved door/trapdoor
- fence/gate
- signs
- golden leaf carpet
- Elven silver lamp
- Firefly Jar (likely)
- antler chandelier/decor

### Flora
- Mallorn
- Athelas
- Elanor
- Niphredil
- Western Corn
- golden fern
- Mallorn blossom
- fallen golden leaves

### Fauna
- deer
- white deer
- songbird
- firefly
- unicorn

### Items / consumables
- Mallorn acorn/nut
- Mallorn leaf
- Western Corn seed/grain
- Lembas dough/intermediate
- wrapped Lembas
- Athelas / salve
- Miruvor
- venison
- feather
- antler
- Bottle/Jar of Fireflies

### World content
- small Mallorns
- medium/large/ancient/epic Mallorns
- flets
- shrines
- pools/gardens
- bridges/platforms
- Western Corn glades
- ancient/sacred groves

### Systems
- partial biome replacement
- edge/interior/heart depth approximation
- peaceful hostile-spawn policy
- Disharmony
- Friend of Lothlórien
- white-deer guidance
- unicorn taming gate
- ambient soundscape
- custom particles

---

## 21. Reference links

Official Bedrock Creator documentation:

- Custom partial biome replacement:
  https://learn.microsoft.com/en-us/minecraft/creator/documents/biomes/custompartialbiomereplacement?view=minecraft-bedrock-stable

- Custom biome tutorial:
  https://learn.microsoft.com/en-us/minecraft/creator/documents/biomes/custombiometutorial?view=minecraft-bedrock-stable

- Client biome definitions:
  https://learn.microsoft.com/en-us/minecraft/creator/reference/content/clientbiomesreference/examples/components/client_biome_definition?view=minecraft-bedrock-stable

- Tree feature:
  https://learn.microsoft.com/en-us/minecraft/creator/reference/content/featuresreference/examples/features/minecraft_tree_feature?view=minecraft-bedrock-stable

- Structure template feature:
  https://learn.microsoft.com/en-us/minecraft/creator/reference/content/featuresreference/examples/features/minecraft_structure_template_feature?view=minecraft-bedrock-stable

- Custom entity creation:
  https://learn.microsoft.com/en-us/minecraft/creator/documents/introductiontoaddentity?view=minecraft-bedrock-stable

- Spawn deep dive:
  https://learn.microsoft.com/en-us/minecraft/creator/documents/spawning/entityspawningdeepdive?view=minecraft-bedrock-stable

- Entity despawn component:
  https://learn.microsoft.com/en-us/minecraft/creator/reference/content/entityreference/examples/entitycomponents/minecraftcomponent_despawn?view=minecraft-bedrock-stable

- Custom sounds:
  https://learn.microsoft.com/en-us/minecraft/creator/documents/addcustomsounds?view=minecraft-bedrock-stable

- Screen/actionbar API:
  https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/minecraft/server/screendisplay?view=minecraft-bedrock-stable

- Block loot component:
  https://learn.microsoft.com/en-us/minecraft/creator/reference/content/blockreference/examples/blockcomponents/minecraftblock_loot?view=minecraft-bedrock-stable

- Microsoft Bedrock samples:
  https://github.com/microsoft/minecraft-samples


## 22. Intentionally tunable balance values

The design is considered structurally settled. These values should be tuned through survival playtests rather than fixed now:

- Disharmony thresholds,
- Disharmony decay time,
- exact Friend timer if 10 minutes proves too short/long,
- Western Corn growth rate,
- acorn drop rate,
- Lembas hunger/saturation values,
- Miruvor recipe cost/effects,
- deer/unicorn/firefly spawn weights,
- structure rarity.

These are balance parameters, not unresolved design questions.
