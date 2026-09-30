import { world, system } from "@minecraft/server";
import "./blocks.js";
import "./ground_cover.js";
import "./bonemeal.js";
import "./crop.js";
import "./lembas.js";
import { startAntlerSupport } from "./antler.js";
import "./athelas.js";
import "./trees.js";
import { leafUndersideY } from "./leaf_fall.js";
import { handleDisharmonyEvent, startDisharmony } from "./disharmony_game.js";
import { startDeer } from "./deer.js";
import { startWhiteDeer } from "./white_deer.js";
import { DEPTH_NAMES, estimateDepth, probeCount } from "./depth.js";

const BIOME_ID = "lothlorien:lothlorien";

// `/scriptevent lothlorien:debug` toggles, per player, an actionbar readout of the biome underfoot,
// the depth level (see below) and hostile mobs standing inside the biome nearby.
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

const inBiome = (dimension, location) => biomeAt(dimension, location) === BIOME_ID;

function showDebug() {
  for (const player of world.getPlayers({ tags: [DEBUG_TAG] })) {
    const biome = biomeAt(player.dimension, player.location) ?? "?";
    const { inside, total } = hostilesInBiome(player);
    const marker = biome === BIOME_ID ? "§a" : "§7";
    const last = lastDepth.get(player.id);
    const depth = last ? depthLabel(last) : DEPTH_NAMES[0];
    player.onScreenDisplay.setActionBar(
      `${marker}${biome}§r [${depth}]  hostiles r${HOSTILE_SCAN_RADIUS}: ${inside} in Lórien / ${total}`
    );
  }
}

// Phase 2 prototype A: runtime depth estimate (the rings and levels are in depth.js). Cheap:
// two API calls per probe, every few seconds, never per tick.
const DEPTH_INTERVAL_TICKS = 60;
// Rivers cut through the biome, so crossing one is not reaching the edge.
const DEPTH_TRANSPARENT = new Set(["minecraft:river"]);

// Biome at the surface (not at the player's height: biomes are 3D, and flying high would
// sample the air). undefined = unloaded chunk.
function surfaceSampler(dim, location) {
  const px = Math.floor(location.x);
  const pz = Math.floor(location.z);
  return (dx, dz) => {
    try {
      const top = dim.getTopmostBlock({ x: px + dx, z: pz + dz });
      if (!top) return undefined;
      return dim.getBiome(top.location).id;
    } catch {
      return undefined;
    }
  };
}

// Depth at any spot (the white deer's natural spawns are thinned by it, see white_deer_rules.js).
const depthAt = (dimension, location) => estimateDepth(surfaceSampler(dimension, location), BIOME_ID, DEPTH_TRANSPARENT);

function playerDepth(player) {
  return depthAt(player.dimension, player.location);
}

function depthLabel(result) {
  return DEPTH_NAMES[result.level] + (result.complete ? "" : "?");
}

const lastDepth = new Map();

function updateDepth() {
  for (const player of world.getPlayers()) {
    const result = playerDepth(player);
    const prev = lastDepth.get(player.id);
    lastDepth.set(player.id, result);
    if (prev !== undefined && prev.level !== result.level && player.hasTag(DEBUG_TAG)) {
      player.sendMessage(`[lothlorien] depth: ${depthLabel(prev)} -> ${depthLabel(result)}`);
    }
  }
}

// `/scriptevent lothlorien:depth` reports the estimate and times it, so the cost of the
// probing can be judged: the same estimate is repeated BENCH_RUNS times.
const BENCH_RUNS = 200;

function reportDepth(player) {
  const result = playerDepth(player);
  const probes = probeCount();
  const t0 = Date.now();
  for (let i = 0; i < BENCH_RUNS; i++) playerDepth(player);
  const ms = (Date.now() - t0) / BENCH_RUNS;
  const dist = result.distance === Infinity ? `>${result.beyond}` : result.distance;
  player.sendMessage(
    `[lothlorien] depth ${depthLabel(result)} (nearest border ~${dist} blocks); ` +
      `worst case ${probes} probes, ${ms.toFixed(3)} ms per estimate (avg of ${BENCH_RUNS})`
  );
}

function onScriptEvent(event) {
  const player = event.sourceEntity;
  if (!player || player.typeId !== "minecraft:player") return;
  if (handleDisharmonyEvent(event, player)) return;
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

// Phase 6: golden leaves let go of the canopy near each player standing in the biome. A random
// column within LEAF_RADIUS is checked (cheap: one topmost-block lookup plus a short walk down).
const LEAF_INTERVAL_TICKS = 12;
const LEAF_RADIUS = 14;
const LEAVES_ID = "lothlorien:mallorn_leaves";

function fallLeaves() {
  for (const player of world.getPlayers()) {
    const dimension = player.dimension;
    if (biomeAt(dimension, player.location) !== BIOME_ID) continue;
    const x = Math.floor(player.location.x + (Math.random() * 2 - 1) * LEAF_RADIUS);
    const z = Math.floor(player.location.z + (Math.random() * 2 - 1) * LEAF_RADIUS);
    try {
      const top = dimension.getTopmostBlock({ x, z });
      if (!top || top.typeId !== LEAVES_ID) continue;
      const y = leafUndersideY(
        top.y,
        (yy) => (yy === top.y ? top.typeId : dimension.getBlock({ x, y: yy, z })?.typeId),
        (id) => id === LEAVES_ID
      );
      if (y !== undefined) dimension.spawnParticle("lothlorien:falling_leaf", { x: x + 0.5, y: y - 0.1, z: z + 0.5 });
    } catch {
      // unloaded chunk
    }
  }
}

// Scripting V2 runs before the world exists: touch `world` only from events.
world.afterEvents.worldLoad.subscribe(() => {
  system.afterEvents.scriptEventReceive.subscribe(onScriptEvent);
  system.runInterval(showDebug, DEBUG_INTERVAL_TICKS);
  system.runInterval(updateDepth, DEPTH_INTERVAL_TICKS);
  system.runInterval(fallLeaves, LEAF_INTERVAL_TICKS);
  startDisharmony(inBiome, DEBUG_TAG);
  startDeer();
  startWhiteDeer(depthAt);
  startAntlerSupport();
});
