import { system } from "@minecraft/server";
import { MAX_GROWTH, advanceGrowth, bonemealSteps, growChance } from "./crop_rules.js";

// Phase 7: Western Corn. `lothlorien:crop` (random tick) advances the state lothlorien:growth 0-7 on farmland;
// wild corn from worldgen stands on grass at growth 7 and never needs to grow. Seeds only place on farmland
// (`block_placer.use_on`). Harvest drops come from the loot tables (the mature one is set by a permutation).
export const CROP = "lothlorien:western_corn";
const GROWTH = "lothlorien:growth";
const FARMLAND = "minecraft:farmland";

function lightAt(block) {
  try {
    return block.getLightLevel();
  } catch {
    return 15; // do not block growth on an API failure
  }
}

export function growthOf(block) {
  const g = block.permutation.getState(GROWTH);
  return typeof g === "number" ? g : MAX_GROWTH;
}

export function isMature(block) {
  return growthOf(block) >= MAX_GROWTH;
}

// Bone meal: 2-5 stages, like vanilla wheat.
export function growCrop(block) {
  const g = growthOf(block);
  if (g >= MAX_GROWTH) return;
  block.setPermutation(block.permutation.withState(GROWTH, advanceGrowth(g, bonemealSteps(Math.random()))));
}

system.beforeEvents.startup.subscribe(({ blockComponentRegistry }) => {
  blockComponentRegistry.registerCustomComponent("lothlorien:crop", {
    onRandomTick({ block }) {
      const g = growthOf(block);
      if (g >= MAX_GROWTH) return;
      const soil = block.below();
      if (soil?.typeId !== FARMLAND) return; // grows only when farmed
      const moisture = soil.permutation.getState("moisturized_amount");
      const chance = growChance(lightAt(block), typeof moisture === "number" ? moisture : 0);
      if (Math.random() >= chance) return;
      block.setPermutation(block.permutation.withState(GROWTH, g + 1));
    },
  });
});
