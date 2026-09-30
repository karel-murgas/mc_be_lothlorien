// White deer guidance rules (Phase 12). Pure (no @minecraft/server) so tests/run.mjs can check them offline;
// white_deer.js wires them to the game.
//
// Offer a Mallorn acorn to a white deer (entity lothlorien:white_deer) while your Disharmony is 0 (Friend included):
// once in its life it leads the player to its gift, a Great Mallorn nut (great_mallorn_rules.js) at a spot inside
// Lothlorien 36-56 blocks away (giftCandidates), and lays it there on arrival. The walking is the engine's own pathfinding: the deer follows an invisible
// helper entity (lothlorien:guide_beacon, goal in the `state_guiding` group of entities/white_deer.json) that the script
// moves ahead in hops of HOP..MIN_HOP blocks (pickWaypoint), checking each hop with hopStatus.

export const WHITE_DEER_ID = "lothlorien:white_deer";
export const BEACON_ID = "lothlorien:guide_beacon";
export const ACORN_ID = "lothlorien:mallorn_acorn";
export const MARKER_ID = "lothlorien:structure_marker";

// The hidden structure markers in the flet giants (tools/build_structures.mjs) are no longer searched: leading to them
// was dropped on 2026-09-30 (owner: an 80-block search only finds trees already in sight). The block stays in the trees.

export const GUIDE_TICKS = 5; // the session is checked this often
export const WAIT_DIST = 12; // the deer waits while the player is farther than this
export const ABORT_DIST = 48; // and gives up when the player is farther than this
export const ARRIVE_DIST = 3; // horizontal distance to the gift spot that counts as "here"
export const STUCK_ARRIVE_DIST = 14; // stuck this close to the spot also counts as arrived (the gift is laid at the spot anyway)
export const STUCK_TICKS = 600; // 30 s of walking without getting a block closer to the spot
export const MAX_TICKS = 6000; // one guidance lasts 5 minutes at most (the beacon's own despawn timer is 330 s)

// Waypoints (hops) for the beacon.
export const HOP = 14; // preferred distance of the next waypoint (blocks)
export const MIN_HOP = 8; // shorter hops only down to this
export const HOP_STEP = 2; // distances tried: HOP, HOP-2, ... MIN_HOP
export const REACHED = 3; // deer this close (horizontal) to the waypoint: pick the next one
export const FINAL_RING = 5; // last waypoint: a standable column within this ring around the target
export const HOP_STUCK_TICKS = 100; // 5 s without getting a block closer to the current waypoint: try another heading

// Only a calm player (Disharmony 0, Friend or not) is guided.
export const canBeGuided = (level) => level <= 0;

// Leash rule: a lead always wins over guidance. A leashed white deer refuses the acorn (kept), and a guidance ends the
// moment the deer is leashed (beacon removed, deer back to its wariness state). One rule, no tug of war between the
// lead and the follow goal.
// Why the offer is refused: "leashed" | "restless" (Disharmony I+) | undefined (go ahead).
export function offerRefusal({ level, leashed }) {
  if (leashed) return "leashed";
  if (!canBeGuided(level)) return "restless";
  return undefined;
}

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// ---- Natural spawns by depth: THE place to tune how often the white deer is met. ----
// spawn_rules/white_deer.json spawns single white deer everywhere in the biome at weight SPAWN_WEIGHT (a test keeps the
// two equal; the deer has 10, herds of 2-4) with density_limit 1. Natural spawns fire the herd event
// lothlorien:spawn_natural, which sets the property lothlorien:natural; white_deer.js then keeps each one with the chance
// below for the depth level at its spot (scripts/depth.js: 0 outside, 1 edge, 2 inner, 3 heart) and removes the rest.
// /summon and spawn eggs never set the flag, so they always work. Expected share of white deer among deer spawns, before
// the density limit: weight 3 / (10 x 3 deer per herd) = 1 per 10 deer in the heart, 1 per 20 inner, 1 per ~67 at the edge.
export const SPAWN_WEIGHT = 3;
export const SPAWN_KEEP_BY_DEPTH = [0, 0.15, 0.5, 1];
export const spawnKeepChance = (level) => SPAWN_KEEP_BY_DEPTH[clamp(Math.floor(level) || 0, 0, SPAWN_KEEP_BY_DEPTH.length - 1)];
// `roll` is uniform in [0, 1) (Math.random() in the game).
export const keepNaturalSpawn = (level, roll) => roll < spawnKeepChance(level);
export const horizontal = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

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
    // Final hop: the nearest standable column on rings around the target (the spot itself when it is free), preferring
    // the side facing the deer.
    const toward = Math.atan2(from.z - target.z, from.x - target.x);
    for (let r = 0; r <= FINAL_RING; r++) {
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

// Progress towards the target: `session` = { bestDist, stuck } (ticks walking without progress). A block closer than
// the best so far is progress.
export function trackProgress(session, dist, walking, ticks) {
  if (dist < session.bestDist - 1) {
    session.bestDist = dist;
    session.stuck = 0;
  } else if (walking) session.stuck += ticks;
  return session;
}

// What a guidance session does now: "leashed" | "arrived" | "abort" | "wait" | "walk". A lead ends it first.
export function phase({ toTarget, toPlayer, stuck, age, playerCalm, leashed = false }) {
  if (leashed) return "leashed";
  if (toTarget <= ARRIVE_DIST) return "arrived";
  if (!playerCalm || toPlayer > ABORT_DIST || age > MAX_TICKS) return "abort";
  if (stuck >= STUCK_TICKS) return toTarget <= STUCK_ARRIVE_DIST ? "arrived" : "abort";
  return toPlayer > WAIT_DIST ? "wait" : "walk";
}
