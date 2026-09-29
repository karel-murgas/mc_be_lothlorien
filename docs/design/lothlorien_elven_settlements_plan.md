# Lothlórien Expansion Plan — Elven Settlements, Trading & Guardians

_Last updated: 2026-09-29_

## Goal

Add a later-phase Elven society layer to Lothlórien without turning it into a vanilla village reskin.

The system should combine:

- custom Elven settlements,
- custom Elf entities,
- profession-specific trading,
- player-specific Disharmony / Friend of Lothlórien reactions,
- bow-using Elven Guardians,
- border/watchpost presence,
- future quest hooks.

This comes **after** the core biome, trees, flora, Disharmony system, and basic wildlife are stable.

## Settlement hierarchy

### Edge watchpost
Small, relatively common near the biome boundary:

- raised flet/watch platform,
- silver lamp,
- 1–3 Guardians,
- perhaps one resting Elf.

Purpose:

- visually mark the protected forest,
- intercept hostile mobs wandering in,
- give Guardians an obvious home.

### Woodland dwelling cluster
Small settlement around several Mallorns:

- 2–5 tree platforms,
- bridges,
- garden,
- lamps,
- small work area,
- roughly 3–8 Elves.

### Inner grove
Rarer and larger:

- interconnected flets,
- healer garden,
- gathering platform,
- fountain/pool,
- craft platform,
- several professions,
- Guardians.

### Heart settlement
Very rare.

Not a giant city in v1; rather a particularly impressive multi-tree settlement or ceremonial grove.

## Settlement generation

Use modular `.mcstructure` pieces and jigsaw/template systems where practical.

Reusable modules:

- dwelling flet,
- bridge segment,
- tree platform,
- stair/spiral access,
- garden,
- healer garden,
- craft platform,
- watch platform,
- lamp fixture,
- fountain/pool,
- gathering platform,
- guardian post.

Add hidden functional markers to structures:

- `home_marker`
- `work_marker`
- `gather_marker`
- `guardian_post`
- `trade_spawn`
- `structure_marker`

These markers can later drive population, schedules, white-deer guidance, and quests.

## Elf entity architecture

Create custom Elf entities rather than modifying vanilla villagers.

Shared behavior:

- wander,
- look at nearby players,
- move toward assigned points,
- flee hostile monsters,
- react to Disharmony,
- interact/trade.

Do **not** try to reproduce every vanilla village mechanic.

Elves do not need:

- villager breeding rules,
- iron golem spawning,
- zombie-villager conversion,
- full vanilla bed/job-site logic.

A purpose-built society is cleaner.

## Visual variation

Prefer one common Elf model with controlled variants:

- several faces,
- hair colors/styles,
- clothing colors,
- profession accessory,
- male/female/androgynous presentation variants,
- cloak/no cloak,
- bow/quiver accessories for Guardians.

Professions should be readable without looking like bright vanilla villager uniforms.

## Initial professions

### Gardener

Buys:
- ordinary flowers,
- seeds,
- honey/bone meal if useful,
- selected natural materials.

Sells:
- Elanor,
- Niphredil,
- Athelas,
- Western Corn seed,
- decorative vegetation,
- Mallorn blossoms.

Friend-only candidates:
- Western Corn,
- rarer flowers,
- perhaps a Mallorn acorn if balance permits.

### Healer

Buys:
- Athelas,
- honey,
- bottles,
- selected potion ingredients.

Sells:
- Athelas salve,
- healing supplies,
- Miruvor ingredients,
- Miruvor for trusted players.

### Woodwright

Buys:
- useful building materials,
- iron/copper components,
- selected overworld woods.

Sells:
- Mallorn planks,
- carved wood pieces,
- doors/trapdoors/fences,
- decorative blocks
- elven bow as top reward (bit stronger or faster then normal, standard interaction with enchantments).

Avoid making Mallorn logs so cheap that tree farming becomes pointless.

### Lamplighter / Artisan

Buys:
- glass,
- amethyst,
- copper/iron,
- light-producing ingredients.

Sells:
- silver Elven lamps,
- decorative lamp variants,
- Firefly Jars if appropriate,
- carved decorative pieces.

### Loremaster — later

Potential later role for:
- lore,
- clues,
- maps/hints,
- quest progression.

## Disharmony-aware trading

This should be **player-specific**.

That matters in multiplayer: one player may be Friend of Lothlórien while another has Disharmony III.

### Technical architecture

Native Bedrock trade tables live on the trading entity. Entity component groups/events can swap a trader's table, but that changes the Elf for everyone.

Therefore, for personalized prices and item selection:

1. player interacts with custom Elf,
2. script reads that player's Disharmony/Friend state,
3. default interaction is cancelled,
4. scripted trade UI opens,
5. available goods and prices are generated for that player,
6. inventory is validated server-side,
7. transaction is performed.

A native `economy_trade_table` can still be prototyped, but scripted trading is the safer target architecture if per-player reputation matters.

## Proposed reputation trade states

### Friend of Lothlórien

- best prices,
- complete profession stock,
- rare Friend-only items,
- warm greeting/animation,
- possible small occasional bonus.

Starting balance idea:
- about 10–15% cheaper than neutral.

### Disharmony 0, not yet Friend

- normal prices,
- normal stock,
- rare/special stock locked.

### Disharmony I

- mild price increase,
- rare stock removed,
- cooler reactions.

Starting balance idea:
- +15–25% cost.

### Disharmony II

- substantial price increase,
- limited stock,
- no rare plants,
- no Miruvor,
- no Mallorn acorn,
- no premium lamps/decor.

Starting balance idea:
- +40–60% cost.

### Disharmony III

- normal trading refused,
- civilians keep distance,
- Guardians observe the player,
- no automatic aggression purely from Disharmony.

Disharmony should remain reversible.

## Elven Guardians

Guardians are a separate combat entity, not traders with bows.

Primary jobs:

- defend edge watchposts,
- defend settlements,
- kill hostile monsters entering Lothlórien,
- visibly reinforce that the forest is protected.

### Combat targeting

Use entity-family filtering.

Target:
- vanilla/custom hostile entities in the `monster` family.

Do not target:
- passive wildlife,
- deer,
- unicorns,
- fireflies,
- civilians,
- ordinary players.

### Ranged combat

Use Bedrock ranged/projectile AI:

- bow-like projectile,
- maintain useful range,
- fire at current target,
- reposition when enemies close in.

Start with ordinary arrow-like damage.

Potential later polish:
- custom Elven arrow visual,
- elegant draw/fire animation,
- slightly different bow cadence.

## Guardian behavior toward players

Disharmony alone should **not** make Guardians attack.

### Friend / Disharmony 0
- relaxed,
- normal greeting,
- ignores player as combat target.

### Disharmony I
- more watchful,
- no hostility.

### Disharmony II
- may follow/observe from modest distance around settlement,
- still does not attack.

### Disharmony III
- may position between player and sensitive areas,
- may eventually escort outward,
- trading unavailable,
- still no attack solely from Disharmony.

### If player attacks an Elf

Separate from Disharmony:

- Guardian retaliates,
- nearby Guardians may assist,
- hostility is incident-based,
- attack also raises Disharmony strongly.

Design distinction:

**Disharmony = you are unwelcome.**

**Attacking Elves = you are an active threat.**

## Edge Guardians

The edge-guardian idea gives Phase 2's runtime edge detector a concrete use.

### First version

Guardians live at generated watchposts.

This is simple and deterministic.

### Later enhancement

Use the edge-depth detector:

- classify local area as `EDGE`,
- check nearby Guardian/watchpost population,
- maintain a small capped patrol presence,
- never continuously spawn units around the player.

Constraints:

- no spawn spam,
- no population-cap leaks,
- no obvious popping into existence,
- explicit despawn/return-to-post behavior.

A polished final version should prefer patrols anchored to watchpost markers.

## Monster-defense behavior

Suggested rules:

- moderate target radius,
- prioritize nearby monsters,
- do not chase far outside Lothlórien,
- return to post after combat,
- settlement Guardians remain close to settlement,
- edge Guardians defend boundary/watchpost areas.

Disharmony interaction:

- Guardian kills monster -> no player Disharmony.
- Player kills monster in Lothlórien -> peaceful streak still breaks.

That preserves the unicorn challenge.

## Population and persistence

### Civilians
Settlement Elves are persistent once populated.

Do not use uncontrolled natural spawning.

Population should derive from settlement size/markers.

### Guardians
Watchpost/settlement Guardians are persistent and anchored to home areas.

Optional patrol Guardians need strict caps.

### Stored Elf data
Possible persistent fields:

- profession,
- visual variant,
- home settlement ID,
- home marker,
- work marker,
- optional name,
- deterministic stock seed.

Player reputation remains stored on the **player**, not the Elf.

## Trade stock variation

Not every Elf of a profession should sell exactly the same things.

Example:

Gardener A:
- Elanor,
- Athelas,
- Western Corn.

Gardener B:
- Niphredil,
- golden fern,
- Mallorn blossom.

Friend status can reveal an extra rare slot.

Mandatory progression items such as Western Corn should always have a non-trader fallback source in world generation.

## Economy philosophy

Do not automatically make emeralds the universal currency.

Possible valued materials:

- amethyst,
- honey,
- glass,
- books,
- feathers,
- copper,
- flowers,
- selected rare vanilla ingredients.

Different professions can value different things.

Benefits:

- Lothlórien gets its own economic identity,
- normal survival resources remain relevant,
- a villager trading hall is not required.

Avoid inventing a new currency in v1 unless gameplay strongly demands it.

## Interaction feedback

Use behavior/sound to communicate reputation.

### Friend
- warm greeting,
- calm posture,
- occasional wave/nod.

### Neutral
- normal interaction.

### Disharmony I
- cooler greeting,
- slight hesitation.

### Disharmony II
- backing away,
- guarded voice line,
- Guardian attention.

### Disharmony III
- refuses trade,
- civilians move away,
- Guardians visibly observe.

The actionbar status remains the authoritative Disharmony/Friend display.

## Suggested implementation order

### A. Guardian combat spike
Make an ugly placeholder Guardian.

Test:
- target `monster` family,
- bow/ranged attack,
- navigation,
- target distance,
- return/home behavior,
- never attack player/wildlife by mistake.

### B. One trader Elf
Create one generic civilian.

Test:
- placeholder model,
- interaction event,
- scripted UI,
- one buy transaction,
- one sell transaction,
- inventory validation.

### C. Connect Disharmony to trading
Implement:
- Friend,
- neutral 0,
- Disharmony I,
- Disharmony II,
- Disharmony III.

Verify in multiplayer that two players see different prices/stock from the same Elf.

### D. Profession framework
Make professions data-driven rather than hardcoded separately.

Suggested layout:

```text
elf_professions/
    gardener
    healer
    woodwright
    artisan
```

Each defines:
- base stock,
- wanted items,
- base prices,
- Friend stock,
- Disharmony restrictions,
- visual role ID.

### E. Settlement marker system
Implement hidden markers and settlement IDs.

### F. First watchpost
Build:
- one flet,
- one lamp,
- two Guardian posts.

Generate it and populate Guardians.

### G. Small dwelling cluster
Generate:
- homes,
- one profession,
- one Guardian,
- gathering marker.

### H. Full profession roster
Add Gardener, Healer, Woodwright, Artisan.

### I. Edge patrol polish
Only after watchposts and persistence logic are stable.

### J. Schedules and gathering behavior
Add daily movement/social behavior after functional systems work.

### K. Quest hooks
Do not build quests yet, but expose:
- profession,
- settlement ID,
- Friend state,
- Disharmony,
- interaction events,
- structure markers.

## First milestone definition of done

The settlement system is architecturally proven when:

- one watchpost generates naturally,
- two bow-using Guardians kill a zombie entering Lothlórien,
- one small settlement generates,
- Gardener and Healer Elves exist,
- the same trader gives player-specific prices,
- Friend gets better prices and special stock,
- Disharmony I pays more,
- Disharmony II sees reduced stock,
- Disharmony III is refused,
- attacking an Elf causes nearby Guardians to defend them,
- Guardians do not attack merely because of Disharmony,
- multiplayer players can have different reputation responses from the same Elf.

## Official Bedrock references

- Entity families:
  https://learn.microsoft.com/en-us/minecraft/creator/documents/introductiontoentityfamilies?view=minecraft-bedrock-stable
- Entity AI components:
  https://learn.microsoft.com/en-us/minecraft/creator/documents/entitycomponentsguide?view=minecraft-bedrock-stable
- Nearest attackable target:
  https://learn.microsoft.com/en-us/minecraft/creator/reference/content/entityreference/examples/entitygoals/minecraftbehavior_nearest_attackable_target?view=minecraft-bedrock-stable
- Custom projectiles / ranged attacks:
  https://learn.microsoft.com/en-us/minecraft/creator/documents/custom_projectiles?view=minecraft-bedrock-stable
- Trade tables:
  https://learn.microsoft.com/en-us/minecraft/creator/documents/createtradetable?view=minecraft-bedrock-stable
- Entity events/component groups:
  https://learn.microsoft.com/en-us/minecraft/creator/documents/entityevents?view=minecraft-bedrock-stable
- Player/entity interaction event:
  https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/minecraft/server/playerinteractwithentitybeforeevent?view=minecraft-bedrock-stable
- Script UI:
  https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/minecraft/server-ui/actionformdata?view=minecraft-bedrock-stable
