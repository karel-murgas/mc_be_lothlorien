// Deer antler block: it can be placed on any face of any block (like an item frame) and falls off, as an
// item, when what it hangs on disappears. The block has no placement_filter (its block list can only name a
// subset of blocks), so support is handled like Starstone's surface devices: event-driven, no polling.
//   - beforeOnPlayerPlace refuses an unreadable support;
//   - when a player breaks a block or an explosion destroys one, the six neighbours are checked and every
//     antler whose support is now air or liquid is destroyed with its drops.
import { system, world } from "@minecraft/server";
import { isUnsupported, supportOffset } from "./antler_rules.js";

// The Elven lamps share the antler's support rule (up = on a block, down = hung from one).
const SUPPORTED_IDS = new Set([
  "lothlorien:deer_antler",
  "lothlorien:elven_lantern",
  "lothlorien:elven_lantern_heartwood",
  "lothlorien:firefly_jar",
  "lothlorien:elven_chandelier",
]);
const NEIGHBOURS = [
  [1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1],
];

function dropIfUnsupported(dimension, { x, y, z }) {
  const antler = dimension.getBlock({ x, y, z });
  if (!SUPPORTED_IDS.has(antler?.typeId)) return;
  const offset = supportOffset(antler.permutation.getState("minecraft:block_face"));
  if (!offset) return;
  const support = dimension.getBlock({ x: x + offset.x, y: y + offset.y, z: z + offset.z });
  if (!isUnsupported(support && { isAir: support.isAir, isLiquid: support.isLiquid })) return;
  dimension.runCommand(`setblock ${x} ${y} ${z} air destroy`);
}

function checkAround(dimension, location) {
  const { x, y, z } = location;
  for (const [dx, dy, dz] of NEIGHBOURS) {
    try {
      dropIfUnsupported(dimension, { x: x + dx, y: y + dy, z: z + dz });
    } catch {
      // chunk unloaded meanwhile
    }
  }
}

system.beforeEvents.startup.subscribe(({ blockComponentRegistry }) => {
  const handler = {
    beforeOnPlayerPlace(event) {
      try {
        const offset = supportOffset(String(event.face).toLowerCase());
        if (!offset) return;
        const { x, y, z } = event.block.location;
        const support = event.dimension.getBlock({ x: x + offset.x, y: y + offset.y, z: z + offset.z });
        if (!support || isUnsupported({ isAir: support.isAir, isLiquid: support.isLiquid })) event.cancel = true;
      } catch {
        event.cancel = true; // an unreadable support is not a valid placement
      }
    },
  };
  blockComponentRegistry.registerCustomComponent("lothlorien:antler_support", handler);
  blockComponentRegistry.registerCustomComponent("lothlorien:lamp_support", handler);
});

export function startAntlerSupport() {
  world.afterEvents.playerBreakBlock.subscribe(({ block }) => {
    if (block) checkAround(block.dimension, block.location);
  });
  world.afterEvents.blockExplode.subscribe(({ block, dimension }) => {
    if (block) checkAround(dimension, block.location);
  });
}
