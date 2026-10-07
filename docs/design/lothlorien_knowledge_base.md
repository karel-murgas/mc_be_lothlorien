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
- moral/behavioral mechanic ("Harmony", see section 10),
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
- A player behavior system: Harmony. Peaceful time in Lothlórien raises it, killing creatures there lowers it.
- Reaching full Harmony makes you a "Friend of Lothlórien".
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
- flees more strongly from players with low Harmony.

Drops:

- venison,
- hide/leather-like drop if useful,
- chance of antler depending on final model/sex variant.

Venison should be useful enough that killing deer is a real temptation.

### White deer

Uncommon special variant.

Behavior:

- peaceful and rare,
- reacts strongly to the player's Harmony band,
- can act as an exploration guide.

Proposed mechanic:

- offer the white deer a Mallorn acorn while the player is a Friend of Lothlórien (Harmony +10),
- once in its life it leads the player to a spot inside Lothlórien and leaves its gift there: a Great Mallorn nut that grows into a
  giant Mallorn with a flet.

(Leading to the nearest structure through hidden marker blocks was built and dropped on 2026-09-30: a script can only search loaded
chunks, so it found trees already in sight, and placed custom structures cannot be located from script.)

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

- flees players who are not Friends,
- only becomes approachable/tamable under "Friend of Lothlórien".

Taming requirement:

- the player is a Friend of Lothlórien (Harmony +10, reached by 10 peaceful minutes in the forest from 0),
- while Friend status is active, offering Elanor initiates the unicorn's trust/taming interaction,
- only then can horse-like taming proceed.

This is intentionally strict: any single deed (even a monster kill, cost 1, doubled at +10) costs the Friend status.

---

## 10. Harmony system

This is one of the biome's signature mechanics. It replaced the earlier "Disharmony" counter (owner decision 2026-10-07). The full
design, numbers and in-game checks are in `harmony_rework_plan.md` (same folder); the rules live in `scripts/harmony.js` (pure) and
`scripts/harmony_game.js` (wiring).

### Model

Each player has one integer, **Harmony**, from -60 to +10 (one point is about one minute of peaceful time in the forest), starting at 0.

- Inside the forest it rises +1 per minute up to +10; outside it rises +1 per 2 minutes but never above 0 (positive Harmony is kept).
- A deed restarts the minute timer. Deeds cost points: animals 3, monsters 1 (so luring monsters to the wardens stays a tactic),
  white deer 6, unicorn 10, fighting a warden 1 per fight, killing a warden 6, killing a player 3. While Harmony is above 0 a cost
  counts double.
- A deed counts when the player **or** the victim is inside the forest. Only direct player kills count (projectiles included);
  falls, lava and tamed wolves do not. Chopping wood and picking flowers cost nothing for now.
- Dying changes nothing, except dying inside the forest while Hated: Harmony is set to -29.
- Stored per player in the dynamic property `lothlorien:harmony`, written only when it changes.

### Bands

| Harmony | Band | Effect |
|---|---|---|
| +10 | Friend of Lothlórien | calmest wildlife, gifts and taming, white deer guidance, best trades |
| 0 to +9 | Guest | calm wildlife; animals do not trust you yet |
| -1 to -14 | Uneasy | animals keep more distance, "restless" refusals; trades dearer |
| -15 to -29 | Shunned | wildlife flees far; trades refused |
| -30 to -60 | Hated | wildlife flees furthest; **wardens shoot on sight** (player tag `lothlorien_hated`); trades refused |

Basic blocks and materials never stop dropping; the system discourages violence, it does not make the biome unusable.

### UI

Add-ons cannot register a native status effect with an icon, and a vanilla potion effect must not be hijacked. Instead, inside the
forest the action bar shows `<icon> <band name>` for every band (no number; the number is only in the debug readout
`/scriptevent lothlorien:harmony [value]`). The five icons are glyphs of a custom font page in the resource pack
(`font/glyph_E5.png`, U+E500...U+E504, made by `tools/make_harmony_icons.py`); each differs in colour and shape. Band changes also
send one chat line with flavour; a deed that keeps the band sends a short hint at most every 30 s.

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
- Harmony (bands, deeds, Hated wardens)
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

- Harmony band thresholds (the Uneasy/Shunned edge at -15 is a starting value) and deed costs,
- recovery rate (1 point per minute inside),
- Western Corn growth rate,
- acorn drop rate,
- Lembas hunger/saturation values,
- Miruvor recipe cost/effects,
- deer/unicorn/firefly spawn weights,
- structure rarity.

These are balance parameters, not unresolved design questions.
