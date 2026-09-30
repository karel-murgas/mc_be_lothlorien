// White deer guidance rules (Phase 12). Pure (no @minecraft/server) so tests/run.mjs can check them offline;
// white_deer.js wires them to the game.
//
// Offer a Mallorn acorn to a white deer (entity lothlorien:white_deer) while your Disharmony is 0 (Friend included):
// it looks for the nearest `lothlorien:structure_marker` block in the loaded chunks around it and, if it finds one,
// walks there while the player follows. The walking is the engine's own pathfinding: the deer follows an invisible
// helper entity (lothlorien:guide_beacon, goal in the `state_guiding` group of entities/white_deer.json) that the script
// moves ahead in hops of HOP..MIN_HOP blocks (pickWaypoint), checking each hop with hopStatus.

export const WHITE_DEER_ID = "lothlorien:white_deer";
export const BEACON_ID = "lothlorien:guide_beacon";
export const ACORN_ID = "lothlorien:mallorn_acorn";
export const MARKER_ID = "lothlorien:structure_marker";

// The marker search reaches this far (blocks, horizontally) from the deer, but only through loaded chunks.
export const SEARCH_RADIUS = 80;
// Vertical window around the deer. The marker sits in the buried part of a giant Mallorn trunk (a few blocks
// under the ground), so the window reaches far below the deer and only a little above it.
export const SEARCH_DOWN = 40;
export const SEARCH_UP = 16;

export const GUIDE_TICKS = 5; // the session is checked this often
export const WAIT_DIST = 12; // the deer waits while the player is farther than this
export const ABORT_DIST = 48; // and gives up when the player is farther than this
export const ARRIVE_DIST = 7; // horizontal distance to the marker that counts as "here"
export const STUCK_ARRIVE_DIST = 14; // stuck this close to the marker also counts as arrived (roots and trunk block the way)
export const STUCK_TICKS = 600; // 30 s of walking without getting a block closer to the marker
export const MAX_TICKS = 6000; // one guidance lasts 5 minutes at most (the beacon's own despawn timer is 330 s)

// Waypoints (hops) for the beacon.
export const HOP = 14; // preferred distance of the next waypoint (blocks)
export const MIN_HOP = 8; // shorter hops only down to this
export const HOP_STEP = 2; // distances tried: HOP, HOP-2, ... MIN_HOP
export const REACHED = 3; // deer this close (horizontal) to the waypoint: pick the next one
export const FINAL_RING = 5; // last waypoint: a standable column within this ring around the marker
export const HOP_STUCK_TICKS = 100; // 5 s without getting a block closer to the current waypoint: try another heading

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

// Headings relative to the straight line to the target, tried in this order. `bias` = side of the last successful turn,
// so the deer keeps going round an obstacle instead of flipping sides.
export function hopHeadings(bias = 1) {
  const s = bias >= 0 ? 1 : -1;
  return [0, 30 * s, -30 * s, 60 * s, -60 * s, 90 * s, -90 * s].map((d) => (d * Math.PI) / 180);
}

// Next waypoint from `from` ({x, y, z}) towards `target` ({x, z}). `stand(x, z, yHint)` returns the feet height of a
// standable column (ground, no liquid, 2 blocks headroom) or undefined. `skip` is a Set of heading offsets (whole
// degrees) that already failed for this hop. Returns { x, y, z, turn, deg, final } or undefined.
export function pickWaypoint(from, target, stand, { bias = 1, skip = new Set() } = {}) {
  const dist = horizontal(from, target);
  if (dist <= HOP) {
    // Final hop: the target itself is usually not standable (the marker is buried in a trunk), so look for the
    // nearest standable column on rings around it, preferring the side facing the deer.
    const toward = Math.atan2(from.z - target.z, from.x - target.x);
    for (let r = 1; r <= FINAL_RING; r++) {
      for (const off of [0, 45, -45, 90, -90, 135, -135, 180]) {
        const a = toward + (off * Math.PI) / 180;
        const x = target.x + Math.cos(a) * r, z = target.z + Math.sin(a) * r;
        const y = stand(x, z, from.y);
        if (y !== undefined) return { x, y, z, turn: 0, deg: 0, final: true };
      }
    }
    // Fall through: no ground near the target, walk as far as the normal rule allows.
  }
  const base = Math.atan2(target.z - from.z, target.x - from.x);
  for (const turn of hopHeadings(bias)) {
    const deg = Math.round((turn * 180) / Math.PI);
    if (skip.has(deg)) continue;
    const a = base + turn;
    for (let d = Math.min(HOP, dist); d >= Math.min(MIN_HOP, dist); d -= HOP_STEP) {
      const x = from.x + Math.cos(a) * d, z = from.z + Math.sin(a) * d;
      const y = stand(x, z, from.y);
      if (y !== undefined) return { x, y, z, turn: turn === 0 ? 0 : Math.sign(turn), deg, final: false };
    }
  }
  return undefined;
}

// Bookkeeping of one hop, called every `ticks`. `hop` = { wp, best, stuck } where wp is the current waypoint.
// Returns "next" (reached: pick a new waypoint), "retry" (stuck: skip this heading and re-pick) or "go" (keep following).
export function hopStatus(hop, deerPos, ticks) {
  const d = horizontal(deerPos, hop.wp);
  if (d <= REACHED) return "next";
  if (d < hop.best - 1) {
    hop.best = d;
    hop.stuck = 0;
  } else hop.stuck += ticks;
  return hop.stuck >= HOP_STUCK_TICKS ? "retry" : "go";
}

// A fresh hop towards waypoint `wp` from `deerPos`.
export const newHop = (wp, deerPos) => ({ wp, best: horizontal(deerPos, wp), stuck: 0 });

// Progress towards the marker: `session` = { bestDist, stuck } (ticks walking without progress). A block closer than
// the best so far is progress.
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
