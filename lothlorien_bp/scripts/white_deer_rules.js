// White deer guidance rules (Phase 12). Pure (no @minecraft/server) so tests/run.mjs can check them offline;
// white_deer.js wires them to the game.
//
// Offer Western Corn grain to a white deer while your Disharmony is 0 (Friend included): it looks for the nearest
// `lothlorien:structure_marker` block in the loaded chunks around it and, if it finds one, walks towards it while the
// player follows.

export const DEER_ID = "lothlorien:deer";
export const CORN_ID = "lothlorien:western_corn_grain";
export const MARKER_ID = "lothlorien:structure_marker";

// The marker search reaches this far (blocks, horizontally) from the deer, but only through loaded chunks.
export const SEARCH_RADIUS = 80;
// Vertical window around the deer. The marker sits in the buried part of a giant Mallorn trunk (a few blocks
// under the ground), so the window reaches far below the deer and only a little above it.
export const SEARCH_DOWN = 40;
export const SEARCH_UP = 16;

export const STEP = 0.25; // blocks per move, one move every MOVE_TICKS
export const MOVE_TICKS = 2;
export const WAIT_DIST = 12; // the deer waits while the player is farther than this
export const ABORT_DIST = 48; // and gives up when the player is farther than this
export const ARRIVE_DIST = 7; // horizontal distance to the marker that counts as "here"
export const STUCK_ARRIVE_DIST = 14; // stuck this close to the marker also counts as arrived (roots and trunk block the way)
export const STUCK_TICKS = 600; // 30 s of walking without getting a block closer
export const MAX_TICKS = 6000; // one guidance lasts 5 minutes at most

// Only a calm player (Disharmony 0, Friend or not) is guided.
export const canBeGuided = (level) => level <= 0;

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export const horizontal = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

// Chunk-aligned columns (16 x 16) covering the search circle around (x, z), nearest first; `dist` is the
// horizontal distance from (x, z) to the nearest point of the column. Columns beyond `radius` are left out.
export function sliceOrigins(x, z, radius = SEARCH_RADIUS) {
  const out = [];
  const c0x = Math.floor((x - radius) / 16), c1x = Math.floor((x + radius) / 16);
  const c0z = Math.floor((z - radius) / 16), c1z = Math.floor((z + radius) / 16);
  for (let cx = c0x; cx <= c1x; cx++) {
    for (let cz = c0z; cz <= c1z; cz++) {
      const ox = cx * 16, oz = cz * 16;
      const dx = x < ox ? ox - x : x > ox + 16 ? x - ox - 16 : 0;
      const dz = z < oz ? oz - z : z > oz + 16 ? z - oz - 16 : 0;
      const dist = Math.hypot(dx, dz);
      if (dist <= radius) out.push({ x: ox, z: oz, dist });
    }
  }
  return out.sort((a, b) => a.dist - b.dist);
}

// Vertical span of the search volume for a deer at height y, clamped to the dimension's [min, max).
export function searchSpan(y, min, max) {
  return { from: clamp(Math.floor(y) - SEARCH_DOWN, min, max - 1), to: clamp(Math.floor(y) + SEARCH_UP, min, max - 1) };
}

// Candidate headings relative to the straight line to the target, in the order they are tried. `bias` (+1 or -1)
// is the side the deer turned last time, so it keeps going round an obstacle instead of flipping sides.
export function headings(bias = 1) {
  const s = bias >= 0 ? 1 : -1;
  return [0, 35 * s, -35 * s, 70 * s, -70 * s, 100 * s, -100 * s].map((d) => (d * Math.PI) / 180);
}

// One move of STEP blocks towards `target` ({x, z}) from `from` ({x, y, z}). `probe(x, z, y)` returns the standing
// height at that column (or undefined when the deer cannot stand there). Returns { x, y, z, turn } or undefined
// when every heading is blocked.
export function pickStep(from, target, probe, bias = 1, step = STEP) {
  const base = Math.atan2(target.z - from.z, target.x - from.x);
  for (const turn of headings(bias)) {
    const a = base + turn;
    const x = from.x + Math.cos(a) * step, z = from.z + Math.sin(a) * step;
    const y = probe(x, z, from.y);
    if (y !== undefined) return { x, y, z, turn: turn === 0 ? 0 : Math.sign(turn) };
  }
  return undefined;
}

// Progress bookkeeping: `session` = { bestDist, stuck } (ticks walking without progress). A block closer than the
// best so far is progress.
export function trackProgress(session, dist, walking, ticks) {
  if (dist < session.bestDist - 1) {
    session.bestDist = dist;
    session.stuck = 0;
  } else if (walking) session.stuck += ticks;
  return session;
}

// What a guidance session does now: "arrived" | "abort" | "wait" | "walk".
export function phase({ toTarget, toPlayer, stuck, age, playerCalm }) {
  if (toTarget <= ARRIVE_DIST) return "arrived";
  if (!playerCalm || toPlayer > ABORT_DIST || age > MAX_TICKS) return "abort";
  if (stuck >= STUCK_TICKS) return toTarget <= STUCK_ARRIVE_DIST ? "arrived" : "abort";
  return toPlayer > WAIT_DIST ? "wait" : "walk";
}
