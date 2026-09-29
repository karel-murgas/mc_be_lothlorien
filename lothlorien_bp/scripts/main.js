import { world, system, BiomeTypes } from "@minecraft/server";

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

// `/scriptevent lothlorien:survey` samples the surface of the loaded area on a grid and
// reports how much of it is Lothlórien, how much of that is water, and where its centre
// lies -- enough to judge region size and to walk from a /locate hit into the biome.
const SURVEY_RADIUS = 160;
const SURVEY_STEP = 8;
const COMPASS = ["S", "SW", "W", "NW", "N", "NE", "E", "SE"];

function survey(player) {
  const dimension = player.dimension;
  const px = Math.floor(player.location.x);
  const pz = Math.floor(player.location.z);
  let sampled = 0, lorien = 0, water = 0, sumX = 0, sumZ = 0;
  for (let dx = -SURVEY_RADIUS; dx <= SURVEY_RADIUS; dx += SURVEY_STEP) {
    for (let dz = -SURVEY_RADIUS; dz <= SURVEY_RADIUS; dz += SURVEY_STEP) {
      const x = px + dx, z = pz + dz;
      let top;
      try {
        top = dimension.getTopmostBlock({ x, z });
      } catch {
        continue; // unloaded
      }
      if (!top) continue;
      sampled++;
      if (biomeAt(dimension, top.location) !== BIOME_ID) continue;
      lorien++;
      sumX += dx;
      sumZ += dz;
      if (top.typeId === "minecraft:water") water++;
    }
  }
  if (lorien === 0) {
    player.sendMessage(`[lothlorien] survey r${SURVEY_RADIUS}: 0/${sampled} surface samples are Lothlórien`);
    return;
  }
  const cx = sumX / lorien, cz = sumZ / lorien;
  // Minecraft yaw convention: 0 = south (+z), 90 = west (-x).
  const yaw = (Math.atan2(-cx, cz) * 180) / Math.PI;
  const dir = COMPASS[Math.round(((yaw + 360) % 360) / 45) % 8];
  const pct = (n, d) => Math.round((100 * n) / d);
  player.sendMessage(
    `[lothlorien] survey r${SURVEY_RADIUS}: ${pct(lorien, sampled)}% of ${sampled} samples are Lothlórien ` +
      `(${pct(water, lorien)}% of it water); centre ~${Math.round(Math.hypot(cx, cz))} blocks ${dir} ` +
      `at ${px + Math.round(cx)} ${pz + Math.round(cz)}`
  );
}

function onScriptEvent(event) {
  const player = event.sourceEntity;
  if (!player || player.typeId !== "minecraft:player") return;
  if (event.id === "lothlorien:survey") {
    survey(player);
    return;
  }
  if (event.id !== "lothlorien:debug") return;
  const on = !player.hasTag(DEBUG_TAG);
  if (on) player.addTag(DEBUG_TAG);
  else player.removeTag(DEBUG_TAG);
  player.sendMessage(`[lothlorien] debug readout ${on ? "on" : "off"}`);
}

// Spike check: did the engine accept the biome JSON? A rejected definition is silent
// apart from the Content Log, so say it in chat.
function reportBiomeRegistration() {
  const custom = BiomeTypes.getAll()
    .map((b) => b.id)
    .filter((id) => !id.startsWith("minecraft:"));
  const ok = BiomeTypes.get(BIOME_ID) !== undefined;
  const msg = `[lothlorien] biome ${BIOME_ID} ${ok ? "REGISTERED" : "MISSING"}; non-vanilla biomes: ${custom.join(", ") || "none"}`;
  console.warn(msg);
  system.runTimeout(() => world.sendMessage(msg), 100);
}

// Scripting V2 runs before the world exists: touch `world` only from events.
world.afterEvents.worldLoad.subscribe(() => {
  system.afterEvents.scriptEventReceive.subscribe(onScriptEvent);
  system.runInterval(showDebug, DEBUG_INTERVAL_TICKS);
  reportBiomeRegistration();
});
