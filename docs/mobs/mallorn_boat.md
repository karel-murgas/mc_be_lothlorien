# Mallorn boats

**Final (owner, 2026-10-01).** Verified in game, except the last round (chest 2 back, seat 0.35, shared `lead`
locator at (20, 11, 0) fixing a content-log error), which was approved from renders. History: git log of this file
and `tools/make_mallorn_boat*.py`.

Four boats: `lothlorien:mallorn_boat`, `mallorn_chest_boat`, `mallorn_heartwood_boat`, `mallorn_heartwood_chest_boat`.
**One command regenerates every file**: `python -B tools/make_mallorn_boat_family.py` (runs both model generators;
heartwood art = recolour of the silver art; chest geometry; icons; BP entities, items, recipes, loot; RP client
entities; lang and item_texture entries). Do not hand-edit the generated files.

## Engine side
- BP entities are copies of vanilla `boat` / `chest_boat` (1.26.30) with `runtime_identifier` `minecraft:boat` /
  `minecraft:chest_boat`: the hard-coded boat class does placing, steering, the boat UI and the 27-slot chest.
  Bamboo-raft seat group dropped; own loot tables. Chest boat seat at x 0.35 (vanilla 0.2 would sit in the chest).
- Items: `entity_placer` + `liquid_clipped`, stack 1, creative group `itemGroup.name.boat`.
- Recipes: boat = 5 planks in a U (silver or heartwood planks); chest boat = chest over the boat (shaped only).
- Client: the `hull` bone is turned by the actor yaw (a runtime boat does not turn a custom model); one `lead`
  locator, identical in every geometry (they share locators), on the bow neck; paddles row while ridden and moving;
  the chest is the vanilla chest drawn by a second render controller from `textures/entity/boat/chest_boat_oak`
  (nothing of Mojang's copied).
- Lead: right-click enters the boat, as with vanilla boats; shears cut it.

## Models (owner's brief and decisions)
Elven boat: long and slender, pointed at both ends, ends higher than the middle, clear front (swan neck at the bow,
geometry +X), no sail. Mallorn palette: silver planks, gold gunwale and leaves; heartwood = golden wood, silver trim.
- **Default** (owner chose it after asking whether the art follows the Minecraft style guide):
  `tools/make_mallorn_boat_planks.py`, 28 elements: straight midship, bow and stern tilted up, turned side planks
  meeting at stem posts, watertight bottom, swan neck with a level head. Chest boats use the same hull with the
  straight midship 2 longer at the stern so the chest sits further back (x -10..2).
- **"Prettier boats"** (opt-in, per player): `tools/make_mallorn_boat.py`, the stepped 158-cube model (also draws the
  icon); breaks the style guide on element count and stair curves, hence opt-in. Chest at x -10..2 fits as it is.
- Switch: RP pack setting `lothlorien:pretty_boats` (manifest v3 `settings`; Resource Packs -> Lothlorien RP -> gear
  icon), read by the boat and chest render controllers. Verified in game.
- Icon: vanilla boat-icon projection (inventory pose [30, 225, 0]), chest boats with the vanilla chest drawn in.
