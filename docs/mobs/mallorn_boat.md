# Mallorn boat

Status (2026-10-01): boat entity **works in game** (placeholder round). Elven model v1 deployed, **in-game check pending**.

## Approach
- BP `entities/mallorn_boat.json`: the vanilla 1.26.30 boat copied, with
  `"runtime_identifier": "minecraft:boat"` so the engine's hard-coded boat class (paddle steering,
  boat UI) drives it. Bamboo-raft seat group dropped. Loot drops `lothlorien:mallorn_boat`.
- Item `items/mallorn_boat.json`: `minecraft:entity_placer` + `minecraft:liquid_clipped`, stack 1.
  Recipe: 5 mallorn planks in a U (vanilla boat shape).
- RP: own client entity; `animations/mallorn_boat.animation.json` turns the `hull` bone by the actor
  yaw (the runtime boat does not turn a custom model by itself). `lead` locator on the bow gunwale.
  No paddles (vanilla paddles are hard-coded). Engine notes: `.claude/skills/bedrock-mobs/references/boats.md`.

## Model (owner's brief 2026-10-01)
Elven boat: long and slender (40 long, 16 wide), pointed at both ends, ends higher than the middle,
clear front, no sail, carving optional. `tools/make_mallorn_boat.py` builds it from a length profile
(stepped hull, covered bow and stern decks, swan-neck bow with a gold tip, short stern point) and paints
it in the mallorn palette: silver strakes, gold gunwale, three gold leaves on each bow flank. `BOW` in the
script picks the bow end.

## Placeholder round results (owner, 2026-10-01)
Worked: placing, riding, steering, leashing ("the rest seems alright"; drop on breaking not reported separately). Found: model did not rotate, no visible front, leash
knot high above the boat -> fixed in model v1 (rotation animation, `lead` locator), to confirm.

## In-game check for model v1
- [ ] Hull turns with the boat; bow (tall gold-tipped neck) points the way you paddle.
- [ ] Rider sits inside at a sensible height; second passenger seat.
- [ ] Leash knot on the bow.
- [ ] Looks: shape, texture next to mallorn planks / fence / door; icon.
