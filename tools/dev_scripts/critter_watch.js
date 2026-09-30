import { world, system } from "@minecraft/server";

// Phase 10 spike instrument: counts test critters so spawning, density and despawn can be
// judged by numbers instead of by eye. `/scriptevent lothlorien:critters` prints one report;
// `/scriptevent lothlorien:critters watch` toggles a report every WATCH_SECONDS (chat + log).
export const CRITTER_ID = "lothlorien:deer";
const WATCH_SECONDS = 15;
const NEAR_RADIUS = 64;
const WATCH_TAG = "lothlorien_critter_watch";

// Pure: one line for a player. `near` and `far` are counts inside / outside NEAR_RADIUS.
export function formatCritterReport(name, near, far, inBiomeNear) {
  return `[critters] ${name}: ${near} within ${NEAR_RADIUS} (${inBiomeNear} in Lórien), ${far} farther loaded, ${near + far} total`;
}

function report(player, isLorien) {
  const all = player.dimension.getEntities({ type: CRITTER_ID });
  let near = 0, inBiomeNear = 0;
  for (const e of all) {
    const dx = e.location.x - player.location.x;
    const dz = e.location.z - player.location.z;
    if (Math.hypot(dx, dz) > NEAR_RADIUS) continue;
    near++;
    if (isLorien(e.dimension, e.location)) inBiomeNear++;
  }
  const line = formatCritterReport(player.name, near, all.length - near, inBiomeNear);
  player.sendMessage(line);
  console.warn(line);
}

export function handleCritterEvent(event, player, isLorien) {
  if (event.id !== "lothlorien:critters") return false;
  if (event.message.trim() === "watch") {
    const on = !player.hasTag(WATCH_TAG);
    if (on) player.addTag(WATCH_TAG);
    else player.removeTag(WATCH_TAG);
    player.sendMessage(`[critters] watch ${on ? "on" : "off"}`);
  } else {
    report(player, isLorien);
  }
  return true;
}

export function startCritterWatch(isLorien) {
  system.runInterval(() => {
    for (const player of world.getPlayers({ tags: [WATCH_TAG] })) report(player, isLorien);
  }, WATCH_SECONDS * 20);
}
