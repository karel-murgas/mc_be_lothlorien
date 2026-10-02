import { EquipmentSlot, GameMode, ItemStack } from "@minecraft/server";

// Glass-bottle helpers shared by the nectar bloom and the morning dew (Phase 14b).
export const GLASS_BOTTLE = "minecraft:glass_bottle";

export function mainhandSlot(player) {
  return player.getComponent("equippable")?.getEquipmentSlot(EquipmentSlot.Mainhand);
}

// Hands over `item`: it replaces a single held bottle, otherwise it goes into the inventory (dropped at the player's
// feet when full) and one bottle is used up. Creative players keep their bottle.
export function swapHeldBottle(player, item) {
  const slot = mainhandSlot(player);
  const creative = player.getGameMode() === GameMode.Creative;
  if (!creative && slot?.hasItem() && slot.amount === 1) {
    slot.setItem(item);
    return;
  }
  if (!creative && slot?.hasItem()) slot.amount -= 1;
  const left = player.getComponent("inventory")?.container?.addItem(item);
  if (left) player.dimension.spawnItem(left, player.location);
}

export function newItem(typeId) {
  return new ItemStack(typeId, 1);
}
