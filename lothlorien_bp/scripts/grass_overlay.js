import { world, system } from "@minecraft/server";

// WORKAROUND for MCPE-184249 (https://bugs-legacy.mojang.com/browse/MCPE-184249): in low light the
// engine turns grass under our plants and covers into dirt, whatever their light_dampening (vanilla
// plants are exempt). Blocks patched by .claude/skills/bedrock-block-families/scripts/add_grass_overlay.py
// draw a grass top over that dirt while state `on_grass` is set. Only place and break events run here,
// nothing on a timer. Remove this file and the patch once Mojang fixes the bug.
export const ON_GRASS = "lothlorien:on_grass";
const GRASS = "minecraft:grass_block";
const DIRT = "minecraft:dirt";

// For script placement (bone meal): set the state when the block below is grass.
export function markOnGrass(block) {
  if (!(ON_GRASS in block.permutation.getAllStates())) return;
  if (block.below()?.typeId !== GRASS) return;
  block.setPermutation(block.permutation.withState(ON_GRASS, true));
}

system.beforeEvents.startup.subscribe(({ blockComponentRegistry }) => {
  blockComponentRegistry.registerCustomComponent("lothlorien:grass_overlay", {
    beforeOnPlayerPlace(event) {
      if (event.block.below()?.typeId !== GRASS) return;
      event.permutationToPlace = event.permutationToPlace.withState(ON_GRASS, true);
    },
  });
});

// Picking the plant up shows the ground: give back the grass the engine took.
world.afterEvents.playerBreakBlock.subscribe(({ block, brokenBlockPermutation }) => {
  if (brokenBlockPermutation.getAllStates()[ON_GRASS] !== true) return;
  const below = block.below();
  if (below?.typeId === DIRT) below.setType(GRASS);
});
