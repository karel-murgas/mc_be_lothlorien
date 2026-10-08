// `/scriptevent lothlorien:speed [radius]`: one-shot measurement of how fast mobs really move (statistics in speed_stats.js).
// Samples every mob within the radius (default 32, vanilla mobs included as references) every SAMPLE_TICKS for
// DURATION_TICKS, then prints one line per entity type. Runs only when called; nothing is polled otherwise.
// The d.ts (2.8.0) has no read access to a mob's attack target, so "the warden is in a fight" is approximated by
// "a monster stands within THREAT_RADIUS blocks of it".
import { system } from "@minecraft/server";
import { message } from "./messages.js";
import {
  addDashSample, addSample, createDashTracker, createStats, findSpikes, fmt1, fmtBlock, formatSpikeLine, parseDashArgs, percent,
  summarize, summarizeSpikes,
} from "./speed_stats.js";

export const DEFAULT_RADIUS = 32;
export const MAX_RADIUS = 128;
const SAMPLE_TICKS = 5;
const DURATION_TICKS = 100; // 5 s
const THREAT_RADIUS = 10;
const THREAT_TYPES = new Set(["lothlorien:elven_warden"]);
const SKIP_TYPES = [
  "minecraft:player", "minecraft:item", "minecraft:xp_orb", "minecraft:arrow", "minecraft:armor_stand",
  "lothlorien:guide_beacon", "lothlorien:loop_marker", "lothlorien:rail_mender",
];

let running = false;

export function parseRadius(text) {
  const n = Number.parseFloat(text);
  return Number.isFinite(n) && n > 0 ? Math.min(n, MAX_RADIUS) : DEFAULT_RADIUS;
}

function threatNearby(entity) {
  try {
    return entity.dimension.getEntities({ families: ["monster"], location: entity.location, maxDistance: THREAT_RADIUS, excludeTypes: [entity.typeId] }).length > 0;
  } catch {
    return false;
  }
}

function sampleAll(player, center, radius, stats, tick) {
  let entities;
  try {
    entities = player.dimension.getEntities({ location: center, maxDistance: radius, excludeTypes: SKIP_TYPES });
  } catch {
    return;
  }
  for (const entity of entities) {
    try {
      const { x, z } = entity.location;
      addSample(stats, { key: entity.id, type: entity.typeId, x, z, tick, flag: THREAT_TYPES.has(entity.typeId) && threatNearby(entity) });
    } catch {
      // unloaded or removed meanwhile
    }
  }
}

function report(player, stats) {
  const rows = summarize(stats);
  if (rows.length === 0) {
    player.sendMessage(message("speed.none"));
    return;
  }
  for (const r of rows) {
    player.sendMessage(message("speed.row", r.type, r.count, fmt1(r.min), fmt1(r.avg), fmt1(r.max), percent(r.moving), r.samples));
    if (r.flagged.samples > 0) {
      player.sendMessage(message("speed.threat", r.type, THREAT_RADIUS, fmt1(r.flagged.avg), r.flagged.samples, fmt1(r.calm.avg), r.calm.samples));
    }
  }
}

export function startSpeedProbe(player, radiusText) {
  const dash = parseDashArgs(radiusText);
  if (dash) {
    startDashDetector(player, dash.radius, dash.seconds);
    return;
  }
  if (running) {
    player.sendMessage(message("speed.busy"));
    return;
  }
  running = true;
  const radius = parseRadius(radiusText);
  const center = { ...player.location };
  const stats = createStats();
  player.sendMessage(message("speed.started", radius, DURATION_TICKS / 20));
  let elapsed = 0;
  sampleAll(player, center, radius, stats, system.currentTick);
  const handle = system.runInterval(() => {
    elapsed += SAMPLE_TICKS;
    try {
      sampleAll(player, center, radius, stats, system.currentTick);
      if (elapsed < DURATION_TICKS) return;
      report(player, stats);
    } catch {
      // player left
    }
    system.clearRun(handle);
    running = false;
  }, SAMPLE_TICKS);
}

// ---- `/scriptevent lothlorien:speed dash [radius] [seconds]` (default 16 blocks, 20 s): finds sudden speed spikes ----
// One-shot: samples every DASH_SAMPLE_TICKS inside the window only, then logs one line per spike (console.warn, content log) and
// sends a short per-type summary. Detection rules and the line format live in speed_stats.js.
const DASH_SAMPLE_TICKS = 2;

function blockText(dimension, x, y, z) {
  try {
    const block = dimension.getBlock({ x: Math.floor(x), y: Math.floor(y), z: Math.floor(z) });
    if (!block) return "unloaded";
    return fmtBlock(block.typeId, block.permutation.getAllStates());
  } catch {
    return "unloaded";
  }
}

function dashContext(entity, { dx, dz }) {
  const { x, y, z } = entity.location;
  const len = Math.hypot(dx, dz) || 1;
  const fx = x + (dx / len) * 0.9; // the cell the mob is about to enter
  const fz = z + (dz / len) * 0.9;
  const dim = entity.dimension;
  return {
    vy: entity.getVelocity().y,
    onGround: entity.isOnGround,
    falling: entity.isFalling,
    water: entity.isInWater,
    below: blockText(dim, x, y - 0.01, z),
    frontFeet: blockText(dim, fx, y + 0.05, fz),
    frontHead: blockText(dim, fx, y + 1.5, fz),
  };
}

function dashSampleAll(player, center, radius, tracker, tick) {
  let entities;
  try {
    entities = player.dimension.getEntities({ location: center, maxDistance: radius, excludeTypes: SKIP_TYPES });
  } catch {
    return;
  }
  for (const entity of entities) {
    try {
      const { x, y, z } = entity.location;
      addDashSample(tracker, { key: entity.id, type: entity.typeId, x, y, z, tick, ctxFn: (info) => dashContext(entity, info) });
    } catch {
      // unloaded or removed meanwhile
    }
  }
}

function dashReport(player, tracker) {
  const spikes = findSpikes(tracker);
  for (const s of spikes) console.warn(formatSpikeLine(s));
  try {
    const rows = summarizeSpikes(tracker, spikes);
    if (rows.length === 0) {
      player.sendMessage(message("dash.none"));
      return;
    }
    for (const r of rows) player.sendMessage(message("dash.row", r.type, r.mobs, r.spikes, fmt1(r.peak)));
  } catch {
    // player left
  }
}

export function startDashDetector(player, radius, seconds) {
  if (running) {
    player.sendMessage(message("speed.busy"));
    return;
  }
  running = true;
  const center = { ...player.location };
  const tracker = createDashTracker();
  const total = Math.round(seconds * 20);
  player.sendMessage(message("dash.started", radius, seconds));
  let elapsed = 0;
  dashSampleAll(player, center, radius, tracker, system.currentTick);
  const handle = system.runInterval(() => {
    elapsed += DASH_SAMPLE_TICKS;
    try {
      dashSampleAll(player, center, radius, tracker, system.currentTick);
    } catch {
      elapsed = total; // player left: finish
    }
    if (elapsed < total) return;
    system.clearRun(handle);
    running = false;
    dashReport(player, tracker);
  }, DASH_SAMPLE_TICKS);
}
