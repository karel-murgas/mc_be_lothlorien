// Proof of concept (NOT shipped, NOT run in game): waypoint selection for white deer guidance with the engine's own
// pathfinding. Script no longer moves the deer; it only picks the next waypoint 8-14 blocks ahead on standable ground
// and moves an invisible "guide beacon" entity there. A goal in the deer's `state_guiding` group
// (`minecraft:behavior.follow_target_leader` with a beacon filter, see
// .claude/skills/bedrock-mobs/references/pathfinding.md) makes the navigator walk it, so walk animation, jumping
// and obstacle avoidance come from the engine.
//
// Pure (no @minecraft/server): tested by `node tools/dev_scripts/guide_waypoints.test.mjs`. When the design is
// accepted, move these functions into lothlorien_bp/scripts/white_deer_rules.js and the tests into tests/run.mjs.

export const HOP = 14; // preferred distance of the next waypoint (blocks)
export const MIN_HOP = 6; // shorter hops only when nothing farther is standable
export const HOP_STEP = 2; // distances tried: HOP, HOP-2, ... MIN_HOP
export const REACHED = 3; // deer this close (horizontal) to the waypoint: pick the next one
export const FINAL_RING = 5; // last waypoint: a standable column within this ring around the target
export const HOP_STUCK_TICKS = 100; // 5 s without getting a block closer to the current waypoint: try another heading

const horiz = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

// Headings relative to the straight line, tried in this order. `bias` = side of the last successful turn.
export function hopHeadings(bias = 1) {
  const s = bias >= 0 ? 1 : -1;
  return [0, 30 * s, -30 * s, 60 * s, -60 * s, 90 * s, -90 * s].map((d) => (d * Math.PI) / 180);
}

// Next waypoint from `from` ({x, y, z}) towards `target` ({x, z}). `stand(x, z, yHint)` returns the feet height of a
// standable column (ground, no liquid, 2 blocks headroom) or undefined. `skip` is a Set of heading offsets (radians,
// rounded to integers of degrees) that already failed for this hop. Returns { x, y, z, turn, deg, final } or undefined.
export function pickWaypoint(from, target, stand, { bias = 1, skip = new Set() } = {}) {
  const dist = horiz(from, target);
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
    for (let d = Math.min(HOP, dist); d >= MIN_HOP; d -= HOP_STEP) {
      const x = from.x + Math.cos(a) * d, z = from.z + Math.sin(a) * d;
      const y = stand(x, z, from.y);
      if (y !== undefined) return { x, y, z, turn: turn === 0 ? 0 : Math.sign(turn), deg, final: false };
    }
  }
  return undefined;
}

// Per-tick bookkeeping of one hop. `hop` = { wp, best, stuck, skip } where wp is the current waypoint.
// Returns "next" (reached: pick a new waypoint, clear skip), "retry" (stuck: add wp.deg to skip and re-pick),
// or "go" (keep following).
export function hopStatus(hop, deerPos, ticks) {
  const d = horiz(deerPos, hop.wp);
  if (d <= REACHED) return "next";
  if (d < hop.best - 1) {
    hop.best = d;
    hop.stuck = 0;
  } else hop.stuck += ticks;
  return hop.stuck >= HOP_STUCK_TICKS ? "retry" : "go";
}
