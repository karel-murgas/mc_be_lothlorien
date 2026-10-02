# Ground squirrel (`lothlorien:squirrel`) - design sheet

Archetype: small shy ground animal with a gift errand. Analogue: rabbit/chicken for the body, the white deer for the errand
(guide beacon, `follow_target_leader`). Phase 15, built 2026-10-02, **tried in game by the owner the same day: works very well** (spawn, wariness, Friend errand and gifts); sounds are placeholders. Owner brief: brown (no gold or silver); give it a nut and, **as a Friend of Lothlorien
only**, it runs off and brings back a small gift; the gifts make leaf litter and ground petals renewable, and sometimes
athelas or corn seeds.
Files: BP `entities/squirrel.json`, `spawn_rules/squirrel.json`, `loot_tables/gifts/squirrel.json`, `scripts/squirrel.js` +
`squirrel_rules.js`, wariness in `scripts/deer.js`. RP `entity/squirrel.entity.json`, `models/entity/squirrel.geo.json`,
`animations/squirrel.animation.json`, `render_controllers/squirrel.render_controllers.json`,
`textures/entity/squirrel/squirrel_{brown,russet,dark}.png`, `sounds.json`, `.lang`. Art: `tools/make_swan_squirrel.py`.

| Area | Decision |
| --- | --- |
| Identity | "Ground Squirrel", egg brown `#7c5232` / cream `#ecdcb4`; families `lothlorien_squirrel`, `mob`. No climbing (Bedrock has no animal climbing AI), so it scampers on the ground |
| Body | collision 0.4 x 0.5, 4 hp, speed 0.28, no attack. No baby, breeding, taming, riding, lead. Nameable |
| Coat | property `lothlorien:coat`: brown 55 % / russet 25 % / dark brown 20 % (random on spawn, client synced). Pale and dark flank stripes, cream belly, banded plume tail |
| Spawn | surface on grass or dirt, biome tag `lothlorien`, light 7-15, herd 1-2, weight 12, `density_limit.surface 6`, distance 12-40, pool `animal` |
| Despawn | standard `despawn_from_distance`; a name tag keeps it |
| Behaviour | 0 float, 1 panic (x1.5), 3 tempt (Mallorn acorn, calm and Friend states only), 4 avoid (Disharmony states), 6 stroll, 7 look at player, 8 look around |
| Disharmony | the deer's states and distances (see `swan.md`), via `deer.js`; a player holding a Mallorn acorn does not scare it in calm and Friend states |
| The offer | right-click holding a Mallorn acorn (`minecraft:interact` entry, "Offer Acorn"). Refused, acorn kept: Disharmony I+ ("shies from your restless spirit"), calm but not Friend ("does not trust you yet"), cooldown ("busy with its stash"), or no standable spot 10-14 blocks away |
| The errand | Friend only (**owner rule: gifts need Friend, the white deer too**). The acorn is eaten when the errand starts. `state_guiding` group: the squirrel follows an invisible `lothlorien:guide_beacon` that `squirrel.js` moves: (1) **away** to a standable spot 10-14 blocks off (20 s at most), (2) **dig** 3-5 s standing still, (3) **return** onto the player. Within 2.5 blocks it drops the gift (`/loot spawn ... loot "gifts/squirrel"`) at its feet, hearts, message in chat |
| Endings | player 40+ blocks away, 2 minutes, squirrel or player gone, or the squirrel hurt (alarmed) end it without a gift; the acorn is gone |
| Cooldown | 10 minutes of world time per squirrel (dynamic property `lothlorien:gift_ready_at`, world absolute time) |
| Gift table | `loot_tables/gifts/squirrel.json`, one roll, weights: leaf litter (golden leaf carpet) 28 x2-4, ground petals (Mallorn blossom) 28 x2-4, Western Corn seeds 14 x1-3, athelas 8 x1-2, elanor 8 x1-2, niphredil 6 x1-2, golden fern 6, Mallorn acorn 2. Litter and petals thus become renewable (owner: "great"). Tune the weights here |
| Drops | none (XP 1-2 on player kill) |
| Animations | procedural Molang: `idle` (tail and head sway), `walk` (diagonal legs, body bob, tail), vanilla `look_at_target` |
| Sounds | **placeholder**: vanilla rabbit sounds at pitch 1.5-1.9, a faint chicken step |

## To test in game (1.26.52)

1. Do squirrels appear by day on the forest floor, singly or in pairs, in three browns?
2. They keep their distance; holding an acorn, a calm squirrel comes up to you.
3. Not a Friend (`/scriptevent lothlorien:disharmony 0` shows state): "does not trust you yet", acorn kept.
4. Friend (10 minutes at 0 points inside the biome): offer an acorn. Does it run off, dig, come back to you (even if you walk
   away a little), and drop litter / petals / a plant at your feet? Does the `loot spawn` command work from the script
   (owner's `/loot spawn ~ ~1 ~ loot "chests/mallorn_flet"` form is the model)? Second acorn at once: "busy with its stash".
5. **Open question**: does the follow goal reach a beacon that is moved around, and does the squirrel keep up when you move?
   Hurt it during the errand: it drops the errand.
