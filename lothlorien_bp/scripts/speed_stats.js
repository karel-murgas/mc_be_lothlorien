// Statistics for the `/scriptevent lothlorien:speed` probe. Pure (no @minecraft/server), so it is tested offline.
// Feed one sample per entity per tick-stamp: addSample(stats, { key, type, x, z, tick, flag }); the speed of an entity is
// the horizontal distance to ITS previous sample divided by the elapsed time (20 ticks = 1 s), in blocks per second.
// `flag` marks a sample taken under a condition (the warden: a monster nearby) so calm and flagged speeds are split.

export const TICKS_PER_SECOND = 20;
export const MOVING_BPS = 0.3; // a sample counts as "moving" above this speed (idle jitter and knockback drift are below)
export const MAX_PLAUSIBLE_BPS = 40; // above this the entity was teleported or respawned: the sample is dropped

export function createStats() {
  return { last: new Map(), types: new Map() };
}

function typeEntry(stats, type) {
  let entry = stats.types.get(type);
  if (!entry) {
    entry = { type, keys: new Set(), speeds: [], flagged: [], dropped: 0 };
    stats.types.set(type, entry);
  }
  return entry;
}

// Returns the speed in blocks/s that this sample produced, or undefined (first sample of the entity, no time elapsed, teleport).
export function addSample(stats, { key, type, x, z, tick, flag = false }) {
  const entry = typeEntry(stats, type);
  entry.keys.add(key);
  const prev = stats.last.get(key);
  stats.last.set(key, { x, z, tick });
  if (!prev || tick <= prev.tick) return undefined;
  const bps = (Math.hypot(x - prev.x, z - prev.z) * TICKS_PER_SECOND) / (tick - prev.tick);
  if (!Number.isFinite(bps) || bps > MAX_PLAUSIBLE_BPS) {
    entry.dropped++;
    return undefined;
  }
  (flag ? entry.flagged : entry.speeds).push(bps);
  return bps;
}

function describe(values) {
  if (values.length === 0) return { samples: 0, min: 0, avg: 0, max: 0, moving: 0 };
  let sum = 0;
  let min = Infinity;
  let max = -Infinity;
  let moving = 0;
  for (const v of values) {
    sum += v;
    if (v < min) min = v;
    if (v > max) max = v;
    if (v > MOVING_BPS) moving++;
  }
  return { samples: values.length, min, avg: sum / values.length, max, moving: moving / values.length };
}

// One row per entity type, sorted by type id: all samples together (`all`), and the calm and flagged parts separately.
export function summarize(stats) {
  const rows = [];
  for (const entry of stats.types.values()) {
    const all = describe([...entry.speeds, ...entry.flagged]);
    rows.push({
      type: entry.type,
      count: entry.keys.size,
      dropped: entry.dropped,
      ...all,
      calm: describe(entry.speeds),
      flagged: describe(entry.flagged),
    });
  }
  return rows.sort((a, b) => (a.type < b.type ? -1 : a.type > b.type ? 1 : 0));
}

export const fmt1 = (n) => n.toFixed(2);
export const percent = (share) => String(Math.round(share * 100));

// ---- Dash detector (`/scriptevent lothlorien:speed dash [radius] [seconds]`, see speed_probe.js) ----
// Samples are taken every DASH_SAMPLE_TICKS. A spike is a stretch of samples whose speed exceeds DASH_RATIO x the entity's own
// median moving speed of the window (needs DASH_MIN_MOVING moving samples), or DASH_ABS_BPS in any case. Spikes are found after the
// window ends (the median is only known then); the context (block below, in front...) is captured per moving sample as it is taken.

export const DASH_RATIO = 1.8;
export const DASH_ABS_BPS = 6;
export const DASH_MIN_MOVING = 6;
export const DASH_MERGE_TICKS = 4; // spike samples closer than this belong to one spike
export const DASH_DEFAULT_RADIUS = 16;
export const DASH_DEFAULT_SECONDS = 20;
export const DASH_MAX_RADIUS = 64;
export const DASH_MAX_SECONDS = 120;
export const DASH_KEY_STATES = /vertical_half|connection_|block_face|facing|open|half|upside_down|height|stair|weirdo/;

export function median(values) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

// Argument text of the scriptevent -> { radius, seconds }, or undefined when it is not a dash request.
export function parseDashArgs(text) {
  const parts = String(text ?? "").trim().split(/\s+/);
  if (parts[0].toLowerCase() !== "dash") return undefined;
  const num = (s, def, max) => {
    const n = Number.parseFloat(s);
    return Number.isFinite(n) && n > 0 ? Math.min(n, max) : def;
  };
  return { radius: num(parts[1], DASH_DEFAULT_RADIUS, DASH_MAX_RADIUS), seconds: num(parts[2], DASH_DEFAULT_SECONDS, DASH_MAX_SECONDS) };
}

// "lothlorien:mallorn_slab[vertical_half=top]"; the minecraft: namespace is dropped, only placement-relevant states are kept.
export function fmtBlock(typeId, states) {
  if (!typeId) return "unloaded";
  const id = typeId.replace(/^minecraft:/, "");
  const parts = Object.entries(states ?? {})
    .map(([k, v]) => [k.replace(/^minecraft:/, ""), v])
    .filter(([k]) => DASH_KEY_STATES.test(k))
    .map(([k, v]) => `${k}=${v}`);
  return parts.length ? `${id}[${parts.join(",")}]` : id;
}

export function createDashTracker() {
  return { last: new Map(), tracks: new Map() };
}

// ctxFn({ bps, dx, dz }) is called only for moving samples and returns the context object stored with the sample.
// Returns the speed in blocks/s, or undefined (first sample, no time elapsed, teleport).
export function addDashSample(tracker, { key, type, x, y, z, tick, ctxFn }) {
  let track = tracker.tracks.get(key);
  if (!track) {
    track = { key, type, speeds: [], events: [] };
    tracker.tracks.set(key, track);
  }
  const prev = tracker.last.get(key);
  tracker.last.set(key, { x, z, tick });
  if (!prev || tick <= prev.tick) return undefined;
  const dx = x - prev.x;
  const dz = z - prev.z;
  const bps = (Math.hypot(dx, dz) * TICKS_PER_SECOND) / (tick - prev.tick);
  if (!Number.isFinite(bps) || bps > MAX_PLAUSIBLE_BPS) return undefined;
  if (bps > MOVING_BPS) {
    track.speeds.push(bps);
    track.events.push({ tick, bps, x, y, z, ctx: ctxFn ? ctxFn({ bps, dx, dz }) : undefined });
  }
  return bps;
}

// Spikes of the finished window, ordered by start tick: { key, type, start, end, samples, peak (event), median, sinceLast (ticks or null) }.
export function findSpikes(tracker) {
  const spikes = [];
  for (const track of tracker.tracks.values()) {
    const m = track.speeds.length >= DASH_MIN_MOVING ? median(track.speeds) : 0;
    const limit = m > 0 ? Math.min(DASH_RATIO * m, DASH_ABS_BPS) : DASH_ABS_BPS;
    let cur;
    let lastStart;
    for (const ev of track.events) {
      if (ev.bps <= limit) continue;
      if (cur && ev.tick - cur.end < DASH_MERGE_TICKS) {
        cur.end = ev.tick;
        cur.samples++;
        if (ev.bps > cur.peak.bps) cur.peak = ev;
        continue;
      }
      cur = { key: track.key, type: track.type, start: ev.tick, end: ev.tick, samples: 1, peak: ev, median: m, sinceLast: lastStart === undefined ? null : ev.tick - lastStart };
      lastStart = ev.tick;
      spikes.push(cur);
    }
  }
  return spikes.sort((a, b) => a.start - b.start);
}

const flag = (v) => (v ? 1 : 0);
// One compact developer line (content log, English).
export function formatSpikeLine(s) {
  const p = s.peak;
  const c = p.ctx ?? {};
  const ratio = s.median > 0 ? ` x${(p.bps / s.median).toFixed(1)}` : "";
  const f = (n) => (Number.isFinite(n) ? n.toFixed(2) : "?");
  return `[lothlorien] DASH ${s.type}#${String(s.key).slice(-4)} t=${s.start} pos=${p.x.toFixed(1)},${p.y.toFixed(1)},${p.z.toFixed(1)} `
    + `speed=${p.bps.toFixed(2)}b/s (median ${s.median.toFixed(2)}${ratio}) dur=${s.end - s.start + 1}t samples=${s.samples} vy=${f(c.vy)} `
    + `ground=${flag(c.onGround)} falling=${flag(c.falling)} water=${flag(c.water)} since=${s.sinceLast === null ? "-" : s.sinceLast + "t"} `
    + `below=${c.below ?? "?"} front_feet=${c.frontFeet ?? "?"} front_head=${c.frontHead ?? "?"}`;
}

// One row per entity type: { type, mobs, spikes, peak }, sorted by type id. `mobs` counts every tracked mob of the type.
export function summarizeSpikes(tracker, spikes) {
  const rows = new Map();
  for (const track of tracker.tracks.values()) {
    const row = rows.get(track.type) ?? { type: track.type, mobs: 0, spikes: 0, peak: 0 };
    row.mobs++;
    rows.set(track.type, row);
  }
  for (const s of spikes) {
    const row = rows.get(s.type);
    row.spikes++;
    row.peak = Math.max(row.peak, s.peak.bps);
  }
  return [...rows.values()].sort((a, b) => (a.type < b.type ? -1 : a.type > b.type ? 1 : 0));
}
