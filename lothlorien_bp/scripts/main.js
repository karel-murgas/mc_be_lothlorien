import { world, system } from "@minecraft/server";

const BIOME_ID = "lothlorien:lothlorien";

// Phase 1 spike instrument. `/scriptevent lothlorien:debug` toggles, per player, an
// actionbar readout of the biome underfoot and of hostile mobs standing inside the biome
// nearby -- the two things the spike has to prove (the biome exists, nothing spawns in it).
const DEBUG_TAG = "lothlorien_debug";
const DEBUG_INTERVAL_TICKS = 20;
const HOSTILE_SCAN_RADIUS = 64;

function biomeAt(dimension, location) {
  try {
    return dimension.getBiome(location).id;
  } catch {
    return undefined; // unloaded chunk or outside world bounds
  }
}

function hostilesInBiome(player) {
  const dimension = player.dimension;
  let inside = 0;
  let total = 0;
  for (const mob of dimension.getEntities({
    families: ["monster"],
    location: player.location,
    maxDistance: HOSTILE_SCAN_RADIUS,
  })) {
    total++;
    if (biomeAt(dimension, mob.location) === BIOME_ID) inside++;
  }
  return { inside, total };
}

function showDebug() {
  for (const player of world.getPlayers({ tags: [DEBUG_TAG] })) {
    const biome = biomeAt(player.dimension, player.location) ?? "?";
    const { inside, total } = hostilesInBiome(player);
    const marker = biome === BIOME_ID ? "§a" : "§7";
    player.onScreenDisplay.setActionBar(
      `${marker}${biome}§r  hostiles r${HOSTILE_SCAN_RADIUS}: ${inside} in Lórien / ${total}`
    );
  }
}

function onScriptEvent(event) {
  if (event.id !== "lothlorien:debug") return;
  const player = event.sourceEntity;
  if (!player || player.typeId !== "minecraft:player") return;
  const on = !player.hasTag(DEBUG_TAG);
  if (on) player.addTag(DEBUG_TAG);
  else player.removeTag(DEBUG_TAG);
  player.sendMessage(`[lothlorien] debug readout ${on ? "on" : "off"}`);
}

// Scripting V2 runs before the world exists: touch `world` only from events.
world.afterEvents.worldLoad.subscribe(() => {
  system.afterEvents.scriptEventReceive.subscribe(onScriptEvent);
  system.runInterval(showDebug, DEBUG_INTERVAL_TICKS);
  console.log("[lothlorien] loaded");
});
