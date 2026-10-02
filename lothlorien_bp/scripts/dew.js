import { world, system } from "@minecraft/server";
import { MALLORN_LEAVES } from "./nectar_rules.js";
import { DEW_CHANCE, NEW_DEW_BOTTLE_DAMAGE, addDrop, dewAfterTick, leavesAbove } from "./dew_rules.js";
import { GLASS_BOTTLE, mainhandSlot, swapHeldBottle, newItem } from "./bottles.js";
import { repeatedUse } from "./use_guard.js";

// Phase 14b: morning dew on the Mallorn ground covers (leaf litter, blossoms). The bool state `lothlorien:dew` is set
// by random tick in the morning window under Mallorn leaves and cleared outside it. A glass bottle on dewy cover
// starts a Dew bottle (durability item, damage = missing drops); each further use adds a drop; at 8 drops it becomes a
// Bottle of morning dew. Rules: dew_rules.js.
const DEW = "lothlorien:dew";
const DEW_BOTTLE = "lothlorien:dew_bottle";
const MORNING_DEW = "lothlorien:morning_dew";

system.beforeEvents.startup.subscribe(({ blockComponentRegistry }) => {
  blockComponentRegistry.registerCustomComponent("lothlorien:dew_cover", {
    onRandomTick({ block, dimension }) {
      const dewy = block.permutation.getState(DEW) === true;
      const { x, y, z } = block.location;
      const next = dewAfterTick(dewy, world.getTimeOfDay(), DEW_CHANCE[block.typeId] ?? 0, Math.random(), () =>
        leavesAbove((dy) => dimension.getBlock({ x, y: y + dy, z })?.typeId, (id) => MALLORN_LEAVES.has(id))
      );
      if (next !== dewy) block.setPermutation(block.permutation.withState(DEW, next));
    },
  });
});

function collect(player, block) {
  const held = mainhandSlot(player)?.getItem();
  if (held?.typeId === GLASS_BOTTLE) {
    const bottle = newItem(DEW_BOTTLE);
    bottle.getComponent("minecraft:durability").damage = NEW_DEW_BOTTLE_DAMAGE;
    swapHeldBottle(player, bottle);
  } else if (held?.typeId === DEW_BOTTLE) {
    const durability = held.getComponent("minecraft:durability");
    const result = addDrop(durability.damage);
    const slot = mainhandSlot(player);
    if (result.full) slot.setItem(newItem(MORNING_DEW));
    else {
      durability.damage = result.damage;
      slot.setItem(held);
    }
  } else return;
  block.setPermutation(block.permutation.withState(DEW, false));
  block.dimension.playSound("bucket.fill_water", block.center(), { pitch: 1.8 });
}

world.beforeEvents.playerInteractWithBlock.subscribe((event) => {
  const { block, player, itemStack } = event;
  if (itemStack?.typeId !== GLASS_BOTTLE && itemStack?.typeId !== DEW_BOTTLE) return;
  if (!(block.typeId in DEW_CHANCE) || block.permutation.getState(DEW) !== true) return;
  event.cancel = true;
  if (repeatedUse(player, "dew")) return;
  const { location, dimension } = block;
  system.run(() => {
    const b = dimension.getBlock(location);
    if (b && b.typeId in DEW_CHANCE && b.permutation.getState(DEW) === true) collect(player, b);
  });
});
