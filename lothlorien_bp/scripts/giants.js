import { world, system } from "@minecraft/server";
import { GIANT_TREES } from "./giant_trees.js";

// Phase 5: giant Mallorns in world generation. A structure feature is cut at chunk borders (seen in game
// 2026-09-29), so worldgen only places a lothlorien:giant_mallorn_seed block at the trunk's north-west cell
// (feature_rules/mallorn_giant_feature_rules.json). Its tick checks that the tree's whole footprint is loaded,
// then places one of GIANT_TREES there with the structure manager; the trunk replaces the seed block.
// Structure layout (keep in step with tools/build_structures.mjs): trunk NW cell at x/z TRUNK_AT, the first
// block above the ground at y ROOT_DEPTH, SIZE wide.
const TRUNK_AT = 18;
const ROOT_DEPTH = 5;
const SIZE = 40;

function footprintLoaded(dimension, corner) {
  for (const dx of [0, SIZE / 2, SIZE - 1]) {
    for (const dz of [0, SIZE / 2, SIZE - 1]) {
      if (!dimension.isChunkLoaded({ x: corner.x + dx, y: corner.y, z: corner.z + dz })) return false;
    }
  }
  return true;
}

system.beforeEvents.startup.subscribe(({ blockComponentRegistry }) => {
  blockComponentRegistry.registerCustomComponent("lothlorien:giant_seed", {
    onTick({ block, dimension }) {
      const { x, y, z } = block.location;
      const corner = { x: x - TRUNK_AT, y: y - ROOT_DEPTH, z: z - TRUNK_AT };
      if (!footprintLoaded(dimension, corner)) return; // try again on the next tick
      const name = GIANT_TREES[Math.floor(Math.random() * GIANT_TREES.length)];
      try {
        world.structureManager.place(`lothlorien:${name}`, dimension, corner);
      } catch (e) {
        console.warn(`[lothlorien] giant Mallorn ${name} at ${x} ${y} ${z} not placed: ${e}`);
      }
    },
  });
});
