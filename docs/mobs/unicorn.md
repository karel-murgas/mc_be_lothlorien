# Unicorn (`lothlorien:unicorn`) - design sheet

Archetype: rare, timid horse that only a Friend of Lothlorien can approach and bond with (Phase 15). Built 2026-10-02 from the
vanilla horse (body, walk and look animations) and the deer's Disharmony wariness. **Tried in game 2026-10-02 and accepted by the owner**: spawning, taming, riding without a saddle, one-block steps
while ridden and the head turn all work (flight distances and spawn frequency not specifically measured; "Tested" column left as written). Files: `tools/make_unicorn.py` writes BP `entities/unicorn.json` and the RP entity,
geometry, animation, render controller and texture; BP `spawn_rules/unicorn.json`, `scripts/unicorn.js` + `unicorn_rules.js`,
wariness in `scripts/deer.js`; RP `sounds.json`, `texts/en_US.lang`.

| Question | Decision | Tested |
| --- | --- | --- |
| Identifier, name, egg | `lothlorien:unicorn`, "Unicorn", egg `#f3f1f7` / `#b9a6d6` | no |
| Body | collision 1.4 x 1.6, **the best horse**: 30 hp, movement 0.3375, jump strength 1.0 (vanilla ranges 15-30, 0.1125-0.3375, 0.4-1.0) | no |
| Model, art | vanilla `geometry.horse.v3` without saddle, bridle, bags and mule ears, plus a three-step horn; pearl coat (white horse tinted), lilac mane and tail, ivory horn. Placeholder-grade art, not yet judged against the forest | no |
| Animations | the horse's walk and look-at-player; **no rearing, grazing or tail flick** (the engine feeds `variable.stand_anim` only to the vanilla horse) | no |
| Spawning | biome tag `lothlorien`, grass or dirt, light 7-15, **weight 2 (deer 10), single animal, density_limit.surface 1**, distance 24-44, pool `animal`. No depth filter. Wild ones despawn normally | no |
| Wariness | the deer's states by Disharmony (`deer.js`, `WARY_TYPES`), but the **stranger (calm, not Friend) is fled from like Disharmony I (13 / 6)**; Friend 3 / 2; l2 20 / 10; l3 30 / 15; alarmed 36 / 18 for 20 s; wolves 12, monsters 8. Fast flight (walk x1.4-1.6, sprint x1.7-2.1) | no |
| Luring | **Elanor in a Friend's hand only** (holding it stops the flight, `can_get_scared` false). Calm strangers and every Disharmony level cannot lure it | no |
| Taming | **a bond in three offers**: right-click with Elanor as a Friend, three times, at least 10 s apart (`OFFER_GAP_TICKS`); each takes one Elanor (not in creative), hearts after 1 and 2, totem burst at the bond. Refusals (item kept): not Friend ("does not trust you yet"), Disharmony I+ ("restless spirit"), alarmed, too soon. Trust (`lothlorien:trust` 0-3) and the pause time stay on the unicorn, so offers can be spread over visits | no |
| Riding | after the bond: `lothlorien:bonded` group = `rideable` + `input_ground_controlled` + `can_power_jump` + `player_ride_tamed`: steps up one block while ridden (`variable_max_auto_step` 1.0625), **no saddle needed, none can be put on** (no equippable slot; a wild unicorn has no `rideable` at all). Owner id is a dynamic property; anyone else's mount interaction is cancelled ("bonded to someone else") | no |
| Lead, armor, breeding | **not leashable**, no armor slot, no breeding, no foals (owner brief: "lurable by Elanor, but not leashable"; breeding was not asked for) | no |
| Persistence | bonded = `minecraft:persistent`; a name tag keeps a wild one | no |
| Disharmony | a bonded unicorn ignores the player's state (no flight). Hurting any unicorn alarms the animals within 20 blocks, like the deer; it stays bonded. **A player kill inside the biome counts 3 points** (owner decision 2026-10-02; worse than the white deer's 2; `KILL_WEIGHTS` in `scripts/disharmony.js`) | no |
| Drops | none (drops.md: "nothing, but should be tamable"); no XP | - |
| Sounds | the horse's idle, hit and death, soft steps (placeholder) | no |

Open for the game test: whether a custom entity can be mounted and steered with `input_ground_controlled` without `is_saddled`;
whether the owner-only `beforeEvents.playerInteractWithEntity` cancel stops the mount; horn proportions; flight distances;
spawn frequency (uncommon but visible); riding while the wariness events re-add the state group.
