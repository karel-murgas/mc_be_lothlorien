// Deer in the running game: wariness follows the nearest player's Disharmony, and a player
// hurting a deer alarms the herd. The flight behaviour itself is JSON (entities/deer.json, entities/white_deer.json).
import { world, system } from "@minecraft/server";
import { disharmonyOf } from "./disharmony_game.js";
import { isFriend, levelFor } from "./disharmony.js";
import { isGuiding } from "./white_deer.js";
import { ALARM_RADIUS, CORN_ID, DEER_ID, DEER_TYPES, WATCH_RADIUS, pickWariness, setEventFor, warinessFor } from "./deer_rules.js";

const INTERVAL_TICKS = 40;
const PLAYER_ID = "minecraft:player";

const nearDeer = (dimension, location, maxDistance) =>
  DEER_TYPES.flatMap((type) => dimension.getEntities({ type, location, maxDistance }));

function updateWariness() {
  const seen = new Map(); // deer id -> { deer, candidates }
  for (const player of world.getPlayers()) {
    const state = disharmonyOf(player);
    const wariness = warinessFor(levelFor(state.points), isFriend(state));
    for (const deer of nearDeer(player.dimension, player.location, WATCH_RADIUS)) {
      const entry = seen.get(deer.id) ?? { deer, candidates: [] };
      const dx = deer.location.x - player.location.x, dz = deer.location.z - player.location.z;
      entry.candidates.push({ distance: Math.hypot(dx, dz), wariness });
      seen.set(deer.id, entry);
    }
  }
  for (const { deer, candidates } of seen.values()) {
    try {
      if (deer.getProperty("lothlorien:alarmed")) continue; // the alarm timer hands back to the state
      if (deer.getProperty("lothlorien:guiding")) {
        // a guiding white deer keeps its guiding state; one with no session (world reloaded mid-guidance) is released
        if (!isGuiding(deer.id)) deer.triggerEvent("lothlorien:guide_end");
        continue;
      }
      const wariness = pickWariness(candidates);
      if (wariness && deer.getProperty("lothlorien:wariness") !== wariness) deer.triggerEvent(setEventFor(wariness));
    } catch {
      // deer unloaded meanwhile
    }
  }
}

// Fed = tame. Re-applying the current state event swaps state_calm/state_friend for state_tame at once.
export function tame(deer) {
  if (deer.getProperty("lothlorien:tame")) return;
  deer.setProperty("lothlorien:tame", true);
  if (!deer.getProperty("lothlorien:alarmed") && !deer.getProperty("lothlorien:guiding")) {
    deer.triggerEvent(setEventFor(deer.getProperty("lothlorien:wariness")));
  }
}

function alarmAround(dimension, location) {
  for (const deer of nearDeer(dimension, location, ALARM_RADIUS)) {
    try {
      deer.triggerEvent("lothlorien:alarm");
    } catch {
      // deer unloaded meanwhile
    }
  }
}

export function startDeer() {
  system.runInterval(updateWariness, INTERVAL_TICKS);
  world.afterEvents.entityHurt.subscribe(({ hurtEntity, damageSource }) => {
    if (!DEER_TYPES.includes(hurtEntity.typeId) || damageSource.damagingEntity?.typeId !== PLAYER_ID) return;
    try {
      hurtEntity.setProperty("lothlorien:tame", false); // the alarm below rebuilds its state without state_tame
    } catch {
      // deer died of the hit
    }
    alarmAround(hurtEntity.dimension, hurtEntity.location);
  });
  // Feeding corn (breeding or a fawn) tames a deer. The white deer is tamed by the acorn in white_deer.js.
  world.afterEvents.playerInteractWithEntity.subscribe(({ target, beforeItemStack, itemStack }) => {
    try {
      if (target.typeId === DEER_ID && (beforeItemStack ?? itemStack)?.typeId === CORN_ID) tame(target);
    } catch {
      // deer gone
    }
  });
  world.afterEvents.entityDie.subscribe(({ deadEntity, damageSource }) => {
    try {
      if (!DEER_TYPES.includes(deadEntity.typeId) || damageSource.damagingEntity?.typeId !== PLAYER_ID) return;
      alarmAround(deadEntity.dimension, deadEntity.location);
    } catch {
      // entity already gone
    }
  });
}
