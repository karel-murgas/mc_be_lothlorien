import { system, world } from "@minecraft/server";
import { SUPPORT_POLICIES } from "./support_policies.js";
import { createSupportMotionService } from "./support_motion_service.js";
import { supportOffset } from "./antler_rules.js";
import { dropWholeRope } from "./elven_rope.js";

const AXES = [{ x: 0, y: -1, z: 0 }, { x: 0, y: 1, z: 0 },
  { x: 0, y: 0, z: 1 }, { x: 0, y: 0, z: -1 }, { x: 1, y: 0, z: 0 }, { x: -1, y: 0, z: 0 }];
const read = (dimension, position) => { try { return dimension.getBlock(position); } catch { return undefined; } };
export function describeSupport(block) {
  const policy = SUPPORT_POLICIES[block.typeId];
  if (!policy) return undefined;
  const p = block.permutation, part = p.getState("minecraft:multi_block_part") || 0;
  const face = policy.mount === "rope" ? p.getState(block.typeId.endsWith("_hanging") ?
    "minecraft:cardinal_direction" : "lothlorien:face") : p.getState("minecraft:block_face");
  const offset = policy.mount === "face" || policy.mount === "rope" ? supportOffset(face) :
    { x: 0, y: policy.mount === "ceiling" ? 1 : -1 - (policy.mount === "door" ? part : 0), z: 0 };
  if (!offset) return undefined;
  const { x, y, z } = block.location;
  return { identity: `${block.typeId}|${face || policy.mount}|${part}`,
    supports: [{ position: { x: x + offset.x, y: y + offset.y, z: z + offset.z },
      valid: support => policy.allowed ? policy.allowed.includes(support.typeId) : !support.isAir && !support.isLiquid }] };
}
function remove(block) {
  if (block.typeId.startsWith("lothlorien:elven_rope")) {
    const face = block.permutation.getState(block.typeId.endsWith("_hanging") ? "minecraft:cardinal_direction" : "lothlorien:face");
    dropWholeRope(block.dimension, block.location, face);
    return;
  }
  // Native multiblock destruction handles the other door part and a single item.
  const { x, y, z } = block.location;
  block.dimension.runCommand(`setblock ${x} ${y} ${z} air destroy`);
}
export const supportMotion = createSupportMotionService({ now: () => system.currentTick,
  schedule: (fn, ticks) => system.runTimeout(fn, ticks), read, describe: describeSupport, remove,
  onGone(dimension, record) {
    if (!record.identity.startsWith("lothlorien:elven_rope")) return;
    const [, face] = record.identity.split("|");
    // Native popped loot covers the vanished piece; remove the connected remainder.
    dropWholeRope(dimension, record.position, face);
  },
});
system.beforeEvents.startup.subscribe(({ blockComponentRegistry }) => {
  blockComponentRegistry.registerCustomComponent("lothlorien:motion_support", {
    beforeOnPlayerPlace(event) {
      const policy = SUPPORT_POLICIES[event.permutationToPlace.type.id];
      if (policy?.mount !== "face") return;
      const face = String(event.face).toLowerCase();
      const offset = supportOffset(face);
      if (!offset) { event.cancel = true; return; }
      // Bind the actual clicked face without resetting powered or other states.
      event.permutationToPlace = event.permutationToPlace.withState("minecraft:block_face", face);
      const { x, y, z } = event.block.location;
      const support = read(event.dimension, { x: x + offset.x, y: y + offset.y, z: z + offset.z });
      if (!support || support.isAir || support.isLiquid) event.cancel = true;
    },
    onTick({ block }) { supportMotion.observe(block); },
    onPlace({ block }) { supportMotion.observe(block, { reset: true }); },
  });
});
world.afterEvents.pistonActivate.subscribe(event => {
  try {
    const position = event.block.location;
    supportMotion.onPiston({ dimension: event.dimension, position,
      axis: AXES[event.block.permutation.getState("facing_direction")], isExpanding: event.isExpanding, piston: event.piston });
  } catch { /* unloaded piston */ }
});
world.afterEvents.playerBreakBlock.subscribe(({ block, dimension }) => {
  supportMotion.invalidate(dimension, block.location);
  supportMotion.resetAround(dimension, block.location);
});
world.afterEvents.playerPlaceBlock.subscribe(({ block, dimension }) => {
  supportMotion.invalidate(dimension, block.location);
  supportMotion.observe(block, { reset: true });
  supportMotion.resetAround(dimension, block.location);
});
world.afterEvents.blockExplode.subscribe(({ block, dimension }) => {
  supportMotion.invalidate(dimension, block.location);
  supportMotion.resetAround(dimension, block.location);
});
