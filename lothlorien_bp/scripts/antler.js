// Deer antler block: it can be placed on any face of any block (like an item frame) and falls off, as an
// item, when what it hangs on disappears. The block has no placement_filter (whose block list could only
// name a subset of blocks), so the support check is a slow tick.
import { system } from "@minecraft/server";
import { isUnsupported, supportOffset } from "./antler_rules.js";

system.beforeEvents.startup.subscribe(({ blockComponentRegistry }) => {
  blockComponentRegistry.registerCustomComponent("lothlorien:antler_support", {
    onTick({ block, dimension }) {
      try {
        const offset = supportOffset(block.permutation.getState("minecraft:block_face"));
        if (!offset) return;
        const { x, y, z } = block.location;
        const support = dimension.getBlock({ x: x + offset.x, y: y + offset.y, z: z + offset.z });
        if (!isUnsupported(support && { isAir: support.isAir, isLiquid: support.isLiquid })) return;
        dimension.runCommand(`setblock ${x} ${y} ${z} air destroy`);
      } catch {
        // chunk unloaded meanwhile
      }
    },
  });
});
