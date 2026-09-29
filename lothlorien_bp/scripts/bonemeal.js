import { world, system, EquipmentSlot, GameMode, ItemStack } from "@minecraft/server";
import { BONEMEAL_TABLE, COVERS, MAX_AMOUNT, SPREAD_TRIES, pickWeighted } from "./flora_table.js";

// Bone meal in Lothlorien (the vanilla action is cancelled and replaced):
//  - on a grass block inside the biome: a scatter of ~12 tries within 3 blocks (grass, our flora), not vanilla flowers;
//  - on one of our plants (anywhere): more of the same nearby, like vanilla flowers; Athelas grows fewer;
//  - on a leaf carpet / blossoms block: one more segment; when it is full, one item drops (vanilla leaf litter / petals).
const BIOME_ID = "lothlorien:lothlorien";
const GRASS_TRIES = 12;
const RADIUS = 3;
const AMOUNT = "lothlorien:amount";

function inBiome(block) {
  try {
    return block.dimension.getBiome(block.location).id === BIOME_ID;
  } catch {
    return false;
  }
}

// Try to put `typeId` on grass with air above near `center`; `variant` may adjust the block afterwards.
function scatter(center, tries, pick, after) {
  const { dimension } = center;
  const rnd = () => Math.round((Math.random() + Math.random() - 1) * RADIUS);
  for (let i = 0; i < tries; i++) {
    const x = center.x + rnd(), z = center.z + rnd();
    for (const dy of [0, 1, -1]) {
      const soil = dimension.getBlock({ x, y: center.y + dy, z });
      const above = dimension.getBlock({ x, y: center.y + dy + 1, z });
      if (soil?.typeId !== "minecraft:grass_block" || above?.typeId !== "minecraft:air") continue;
      above.setType(pick());
      after?.(above);
      break;
    }
  }
}

function effects(block) {
  block.dimension.playSound("item.bone_meal.use", block.center());
  try {
    block.dimension.spawnParticle("minecraft:crop_growth_emitter", { x: block.x + 0.5, y: block.y + 0.5, z: block.z + 0.5 });
  } catch {
    // particle name unverified; the growth itself is what matters
  }
}

function growCover(block) {
  const amount = block.permutation.getState(AMOUNT);
  if (typeof amount === "number" && amount < MAX_AMOUNT) {
    block.setPermutation(block.permutation.withState(AMOUNT, amount + 1));
    return;
  }
  // Full: like vanilla leaf litter / pink petals, bone meal drops one more item instead.
  block.dimension.spawnItem(new ItemStack(block.typeId, 1), block.center());
}

// The interact event can fire several times for one use (held button, both hands). One bone meal must act once.
const DEBOUNCE_TICKS = 10;
const lastUse = new Map();
function repeated(player) {
  const now = system.currentTick;
  const last = lastUse.get(player.id);
  if (last !== undefined && now - last < DEBOUNCE_TICKS) return true;
  lastUse.set(player.id, now);
  return false;
}

world.beforeEvents.playerInteractWithBlock.subscribe((event) => {
  const { block, player, itemStack } = event;
  if (itemStack?.typeId !== "minecraft:bone_meal") return;
  const id = block.typeId;
  let act;
  if (id === "minecraft:grass_block" && inBiome(block)) {
    act = () => scatter(block, GRASS_TRIES, () => pickWeighted(BONEMEAL_TABLE, Math.random()));
  } else if (SPREAD_TRIES[id]) {
    act = () => scatter(block.below() ?? block, SPREAD_TRIES[id], () => id);
  } else if (COVERS.includes(id)) {
    act = () => growCover(block);
  } else {
    return;
  }
  event.cancel = true;
  if (repeated(player)) return;
  system.run(() => {
    act();
    effects(block);
    if (player.getGameMode() === GameMode.Creative) return;
    const slot = player.getComponent("equippable")?.getEquipmentSlot(EquipmentSlot.Mainhand);
    if (!slot?.hasItem()) return;
    if (slot.amount > 1) slot.amount -= 1;
    else slot.setItem(undefined);
  });
});
