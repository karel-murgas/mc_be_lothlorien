// Deer in the running game: wariness follows the nearest player's Disharmony, and a player
// hurting a deer alarms the herd. The flight behaviour itself is JSON (entities/deer.json).
import { world, system } from "@minecraft/server";
import { disharmonyOf } from "./disharmony_game.js";
import { isFriend, levelFor } from "./disharmony.js";
import { ALARM_RADIUS, DEER_ID, WATCH_RADIUS, pickWariness, setEventFor, warinessFor } from "./deer_rules.js";

const INTERVAL_TICKS = 40;
const PLAYER_ID = "minecraft:player";

function updateWariness() {
  const seen = new Map(); // deer id -> { deer, candidates }
  for (const player of world.getPlayers()) {
    const state = disharmonyOf(player);
    const wariness = warinessFor(levelFor(state.points), isFriend(state));
    for (const deer of player.dimension.getEntities({ type: DEER_ID, location: player.location, maxDistance: WATCH_RADIUS })) {
      const entry = seen.get(deer.id) ?? { deer, candidates: [] };
      const dx = deer.location.x - player.location.x, dz = deer.location.z - player.location.z;
      entry.candidates.push({ distance: Math.hypot(dx, dz), wariness });
      seen.set(deer.id, entry);
    }
  }
  for (const { deer, candidates } of seen.values()) {
    try {
      if (deer.getProperty("lothlorien:alarmed")) continue; // the alarm timer hands back to the state
      const wariness = pickWariness(candidates);
      if (wariness && deer.getProperty("lothlorien:wariness") !== wariness) deer.triggerEvent(setEventFor(wariness));
    } catch {
      // deer unloaded meanwhile
    }
  }
}

function alarmAround(dimension, location) {
  for (const deer of dimension.getEntities({ type: DEER_ID, location, maxDistance: ALARM_RADIUS })) {
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
    if (hurtEntity.typeId !== DEER_ID || damageSource.damagingEntity?.typeId !== PLAYER_ID) return;
    alarmAround(hurtEntity.dimension, hurtEntity.location);
  });
  world.afterEvents.entityDie.subscribe(({ deadEntity, damageSource }) => {
    try {
      if (deadEntity.typeId !== DEER_ID || damageSource.damagingEntity?.typeId !== PLAYER_ID) return;
      alarmAround(deadEntity.dimension, deadEntity.location);
    } catch {
      // entity already gone
    }
  });
}
