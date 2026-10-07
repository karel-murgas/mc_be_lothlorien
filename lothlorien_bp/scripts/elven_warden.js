// Elven Warden in the running game (rules in elven_warden_rules.js, design docs/mobs/elven_warden.md). Event-driven only,
// no polling:
//  - entitySpawn (one subscriber): natural spawns are judged once (kept or removed by depth / deck), and a warden whose
//    hand is empty gets its bow (structure-placed village wardens may not run the equipment table).
//  - beforeEvents.entityHurt: cancels friendly fire from a warden's arrows (read-only decision, restricted privilege).
//  - afterEvents.entityHurt: remembers which player hurt a warden, so that player's retaliation target is not shielded.
import { EntityInitializationCause, EquipmentSlot, ItemStack, system, world } from "@minecraft/server";
import { BOW_ID, DECK_BLOCKS, WARDEN_ID, isFriendlyFire, keepNaturalSpawn, PLAYER_ID } from "./elven_warden_rules.js";

const provoked = new Map(); // player id -> Date.now() of the last hit on a warden (Date: readable in restricted mode)

function families(entity) {
  try {
    return entity.getComponent("minecraft:type_family")?.getTypeFamilies?.() ?? [];
  } catch {
    return [];
  }
}

function standsOnDeck(dimension, location) {
  try {
    const below = dimension.getBlock({ x: Math.floor(location.x), y: Math.floor(location.y - 0.5), z: Math.floor(location.z) });
    return !!below && DECK_BLOCKS.has(below.typeId);
  } catch {
    return false; // unloaded chunk
  }
}

// Natural spawns only (the spawn rule's herd event sets lothlorien:natural; /summon, eggs and structures do not).
// The flag is cleared after the roll, so a warden is judged once, not again on every chunk load.
function judgeNaturalSpawn(warden, depthAt) {
  try {
    if (!warden.isValid || !warden.getProperty("lothlorien:natural")) return;
    warden.setProperty("lothlorien:natural", false);
    const level = depthAt(warden.dimension, warden.location).level;
    if (!keepNaturalSpawn(level, standsOnDeck(warden.dimension, warden.location), Math.random())) warden.remove();
  } catch {
    // unloaded meanwhile
  }
}

function ensureBow(warden) {
  try {
    if (!warden.isValid) return;
    const hand = warden.getComponent("minecraft:equippable")?.getEquipmentSlot(EquipmentSlot.Mainhand);
    if (hand && !hand.hasItem()) hand.setItem(new ItemStack(BOW_ID, 1));
  } catch {
    // unloaded meanwhile
  }
}

// depth(dimension, location) -> { level } from scripts/depth.js (main.js supplies it).
export function startElvenWardens(depthAt) {
  world.afterEvents.entitySpawn.subscribe(({ entity, cause }) => {
    try {
      if (entity.typeId !== WARDEN_ID) return;
      // one tick later: the spawn event's property and the equipment table are surely applied by then
      system.runTimeout(() => {
        ensureBow(entity);
        if (cause !== EntityInitializationCause.Loaded) judgeNaturalSpawn(entity, depthAt);
      }, 1);
    } catch {
      // entity gone
    }
  });
  world.afterEvents.entityHurt.subscribe(({ hurtEntity, damageSource }) => {
    try {
      const hitter = damageSource.damagingEntity;
      if (hurtEntity.typeId === WARDEN_ID && hitter?.typeId === PLAYER_ID) provoked.set(hitter.id, Date.now());
    } catch {
      // entity gone
    }
  });
  world.afterEvents.playerLeave.subscribe(({ playerId }) => provoked.delete(playerId));
  world.beforeEvents.entityHurt.subscribe((event) => {
    try {
      const shooter = event.damageSource.damagingEntity;
      if (shooter?.typeId !== WARDEN_ID) return;
      const victim = event.hurtEntity;
      const at = provoked.get(victim.id);
      if (isFriendlyFire({ shooterId: shooter.typeId, victim: { typeId: victim.typeId, families: families(victim) }, sinceProvokedMs: at === undefined ? undefined : Date.now() - at })) {
        event.cancel = true;
      }
    } catch {
      // entity gone
    }
  });
}
