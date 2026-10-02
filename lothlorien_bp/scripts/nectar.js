import { world, system } from "@minecraft/server";
import { MALLORN_LEAVES, nectarAfterTick, MAX_NECTAR } from "./nectar_rules.js";
import { GLASS_BOTTLE, swapHeldBottle, newItem } from "./bottles.js";
import { repeatedUse } from "./use_guard.js";

// Phase 14b: the nectar bloom hangs under Mallorn leaves. `lothlorien:nectar` 0-3 fills by random tick while Mallorn
// leaves are directly above; a glass bottle on a full bloom gives Mallorn nectar and empties it. Shears take the bloom
// as an item (loot table); breaking it by hand drops nothing. Rules: nectar_rules.js.
export const BLOOM = "lothlorien:nectar_bloom";
const NECTAR = "lothlorien:nectar";

system.beforeEvents.startup.subscribe(({ blockComponentRegistry }) => {
  blockComponentRegistry.registerCustomComponent("lothlorien:nectar_bloom", {
    onRandomTick({ block }) {
      const stage = block.permutation.getState(NECTAR);
      if (typeof stage !== "number" || stage >= MAX_NECTAR) return;
      const next = nectarAfterTick(stage, MALLORN_LEAVES.has(block.above()?.typeId), Math.random());
      if (next !== stage) block.setPermutation(block.permutation.withState(NECTAR, next));
    },
  });
});

// Hangs a bloom at `block` (air) when Mallorn leaves are above it; used for sapling-grown trees.
export function hangBloom(block, stage = 0) {
  if (!block?.isAir || !MALLORN_LEAVES.has(block.above()?.typeId)) return false;
  block.setType(BLOOM);
  block.setPermutation(block.permutation.withState(NECTAR, stage));
  return true;
}

world.beforeEvents.playerInteractWithBlock.subscribe((event) => {
  const { block, player, itemStack } = event;
  if (block.typeId !== BLOOM || itemStack?.typeId !== GLASS_BOTTLE) return;
  if (block.permutation.getState(NECTAR) !== MAX_NECTAR) return;
  event.cancel = true;
  if (repeatedUse(player, "nectar")) return;
  const { location, dimension } = block;
  system.run(() => {
    const b = dimension.getBlock(location);
    if (b?.typeId !== BLOOM || b.permutation.getState(NECTAR) !== MAX_NECTAR) return;
    b.setPermutation(b.permutation.withState(NECTAR, 0));
    swapHeldBottle(player, newItem("lothlorien:mallorn_nectar"));
    dimension.playSound("bucket.fill_water", b.center(), { pitch: 1.5 });
  });
});
