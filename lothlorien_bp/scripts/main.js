import { world, system, BiomeTypes } from "@minecraft/server";
import "./blocks.js";
import { handleTreeScriptEvent } from "./trees.js";

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
    const depth = DEPTH_NAMES[lastDepth.get(player.id) ?? 0];
    player.onScreenDisplay.setActionBar(
      `${marker}${biome}§r [${depth}]  hostiles r${HOSTILE_SCAN_RADIUS}: ${inside} in Lórien / ${total}`
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


// Phase 2 prototype A: runtime depth estimate. Biome data cannot say "how deep inside am I",
// so probe rings of points around the player and take the distance to the nearest non-
// Lothlorien sample. Cheap (one getBiome per probe, a few seconds apart, never per tick).
const DEPTH_DIRECTIONS = 12;
const DEPTH_RADII = [12, 24, 40, 60, 80];
const DEPTH_INTERVAL_TICKS = 60;
// Nearest-border distance up to which the player counts as edge / inner; farther (or no
// border within the last radius) counts as heart.
const EDGE_LIMIT = 24;
const INNER_LIMIT = 60;
const DEPTH_NAMES = ["outside", "edge", "inner", "heart"];

function biomeIdAt(dimension, x, y, z) {
  try {
    return dimension.getBiome({ x, y, z }).id;
  } catch {
    return undefined; // unloaded chunk
  }
}

// Rivers cut through the biome (vanilla carves them after biome selection), so for depth a
// river counts as Lothlorien: crossing one is not reaching the edge.
const DEPTH_TRANSPARENT = new Set(["minecraft:river"]);

// Returns { level: 0-3, distance } where distance is the radius of the first ring that
// contains a non-Lothlorien point (Infinity if all rings are inside the biome).
function estimateDepth(player) {
  const dim = player.dimension;
  const { x, y, z } = player.location;
  const here = biomeIdAt(dim, x, y, z);
  const inRiver = DEPTH_TRANSPARENT.has(here);
  if (here !== BIOME_ID && !inRiver) return { level: 0, distance: 0 };
  // Standing in a river counts only if Lothlorien is seen before the first foreign point.
  let sawBiome = here === BIOME_ID;
  for (const r of DEPTH_RADII) {
    let foreign = false;
    for (let i = 0; i < DEPTH_DIRECTIONS; i++) {
      const a = (2 * Math.PI * i) / DEPTH_DIRECTIONS;
      const id = biomeIdAt(dim, x + r * Math.cos(a), y, z + r * Math.sin(a));
      if (id === BIOME_ID) sawBiome = true;
      else if (id !== undefined && !DEPTH_TRANSPARENT.has(id)) foreign = true;
    }
    if (!foreign) continue;
    if (!sawBiome) return { level: 0, distance: 0 };
    return { level: r <= EDGE_LIMIT ? 1 : r <= INNER_LIMIT ? 2 : 3, distance: r };
  }
  return sawBiome ? { level: 3, distance: Infinity } : { level: 0, distance: 0 };
}

const lastDepth = new Map();

function updateDepth() {
  for (const player of world.getPlayers()) {
    const { level } = estimateDepth(player);
    const prev = lastDepth.get(player.id);
    lastDepth.set(player.id, level);
    if (prev !== undefined && prev !== level && player.hasTag(DEBUG_TAG)) {
      player.sendMessage(`[lothlorien] depth: ${DEPTH_NAMES[prev]} -> ${DEPTH_NAMES[level]}`);
    }
  }
}

// `/scriptevent lothlorien:depth` reports the estimate and times it, so the cost of the
// probing can be judged: the same estimate is repeated BENCH_RUNS times.
const BENCH_RUNS = 200;

function reportDepth(player) {
  const result = estimateDepth(player);
  const probes = DEPTH_RADII.length * DEPTH_DIRECTIONS + 1;
  const t0 = Date.now();
  for (let i = 0; i < BENCH_RUNS; i++) estimateDepth(player);
  const ms = (Date.now() - t0) / BENCH_RUNS;
  const dist = result.distance === Infinity ? `>${DEPTH_RADII[DEPTH_RADII.length - 1]}` : result.distance;
  player.sendMessage(
    `[lothlorien] depth ${DEPTH_NAMES[result.level]} (nearest border ~${dist} blocks); ` +
      `worst case ${probes} probes, ${ms.toFixed(3)} ms per estimate (avg of ${BENCH_RUNS})`
  );
}

function onScriptEvent(event) {
  const player = event.sourceEntity;
  if (!player || player.typeId !== "minecraft:player") return;
  if (handleTreeScriptEvent(event, player)) return;
  if (event.id === "lothlorien:survey") {
    survey(player);
    return;
  }
  if (event.id === "lothlorien:depth") {
    reportDepth(player);
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
  system.runInterval(updateDepth, DEPTH_INTERVAL_TICKS);
  reportBiomeRegistration();
});
