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

## Models (owner's brief 2026-10-01)
Elven boat: long and slender, pointed at both ends, ends higher than the middle, clear front, no sail, carving
optional; mallorn palette (silver planks, gold gunwale and leaves). Bow = geometry +X. Two models, same paddles:
- **Default** (owner's choice after the style-guide question): `tools/make_mallorn_boat_planks.py`, 28 elements:
  straight midship, bow and stern bones tilted up 14 deg, turned side planks meeting at a stem post, watertight
  bottom (strips under the turned planks + a keel), swan neck of three elements with a level head.
- **"Prettier boats"** (opt-in): `tools/make_mallorn_boat.py`, the stepped 158-cube model (also writes the icon).
- Switch: RP pack setting `lothlorien:pretty_boats` (manifest v3 `settings`, per player, gear icon in the resource
  pack list) read by `controller.render.lothlorien.mallorn_boat`.

## Round results (owner, 2026-10-01)
- Placeholder: placing, riding, steering, leashing work. Model did not rotate, no visible front, leash knot high.
- Model v1: "awesome"; turns; the neck was at the back (BOW flipped to +1); lead knot moved 2 lower and 2 towards
  the tip, onto the neck; paddles asked for (added: leaf-bladed, rowing while ridden and moving); icon redrawn in the
  vanilla boat icon's projection (inventory pose [30, 225, 0]).
- Lead cannot be removed by right-click (right-click enters the boat; vanilla boat has the same setup). To test:
  shears; compare with an oak boat. Option if needed: sneak + use unleashes (script).
- Owner asked whether the model follows the style guide. It does not on two model rules (element count, curves as
  stairs). Kept as the "stepped" model (`tools/make_mallorn_boat.py`, deployed); a vanilla-style draft with 22 rotated
  elements is `tools/make_mallorn_boat_planks.py` (writes the same files). Owner to choose.

## In-game check (round 4)
- [ ] Default model: shape, joints, no water showing through the floor, swan head, lead knot.
- [ ] Settings: Resource Packs -> Lothlorien RP -> gear icon shows "Prettier boats"; toggling switches the model.
- [ ] Paddles row on both models; icon.
- [ ] Shears remove the lead.
