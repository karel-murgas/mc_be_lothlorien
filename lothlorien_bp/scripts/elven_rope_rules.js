// Elven rope (Phase 17b) rules. Pure, so tests/run.mjs can check them offline; elven_rope.js wires them up.
//
// A rope is a vertical column of pieces hung flat on one wall. State `lothlorien:face` is the direction the rope
// faces (the face of the wall block that was clicked), so the wall lies on the opposite side of the piece.
export const FACES = ["north", "south", "east", "west"];
const DIRS = { north: [0, -1], south: [0, 1], east: [1, 0], west: [-1, 0] };

// Horizontal offset from a piece to the block it hangs on, or undefined for a face that cannot carry a rope.
export function wallOffset(face) {
  const d = DIRS[face];
  return d && { x: -d[0] || 0, z: -d[1] || 0 }; // || 0: no -0
}

// Horizontal offset from the wall block to the piece (the clicked face's direction).
export function pieceOffset(face) {
  const d = DIRS[face];
  return d && { x: d[0], z: d[1] };
}

// Which rows get a new piece. `free(y)` says a piece can hang at row y (air there and a wall behind it). Rows are filled
// downwards from `downFrom` until one is not free, then upwards from `upFrom`, until `count` pieces are placed.
//   new rope:   downFrom = clicked row, upFrom = clicked row + 1 (the clicked row must be free)
//   extension:  downFrom = bottom piece - 1, upFrom = top piece + 1
export function planRope({ downFrom, upFrom, count, free, minY = -64, maxY = 319 }) {
  const rows = [];
  for (let y = downFrom; y >= minY && rows.length < count && free(y); y--) rows.push(y);
  for (let y = upFrom; y <= maxY && rows.length < count && free(y); y++) rows.push(y);
  return rows;
}

// The connected run of pieces around row y: `isPiece(y)` is true for a piece of this rope.
export function columnBounds(isPiece, y, minY = -64, maxY = 319) {
  let bottom = y;
  let top = y;
  while (bottom - 1 >= minY && isPiece(bottom - 1)) bottom--;
  while (top + 1 <= maxY && isPiece(top + 1)) top++;
  return { bottom, top };
}

// Item stacks for a dropped rope: a stack holds at most 64.
export function dropStacks(total, stackSize = 64) {
  const out = [];
  for (let left = total; left > 0; left -= stackSize) out.push(Math.min(stackSize, left));
  return out;
}

// A piece loses its wall when that block is air or liquid. `wall` is { isAir, isLiquid } or undefined for an unloaded
// chunk (keep the piece).
export function isUnsupported(wall) {
  if (!wall) return false;
  return wall.isAir || wall.isLiquid;
}

// Levitation physics (blocks per tick): each tick the vertical speed v becomes drag * (v + pull * (level * perLevel - v)).
// So level n does not reach n blocks/s but about 0.91 n (measured in game: 2.1 for a nominal 2.35), and it takes ~5 ticks
// to get there. levitationStep() picks each tick the whole level that brings the modelled speed `v` closest to `target`:
// a high level for the first tick (no slow start), then alternating neighbours around the steady value (~3.5 for
// 3.2 blocks/s). The rounding error stays in the model, so the next tick corrects it. Returns the effect amplifier
// (level - 1) and the modelled speed after this tick.
export const LEVITATION = { perLevel: 0.05, pull: 0.2, drag: 0.98, maxLevel: 64 };
export function levitationStep(v, target, { perLevel, pull, drag, maxLevel } = LEVITATION) {
  const exact = (target / drag - v * (1 - pull)) / (pull * perLevel);
  const level = Math.min(Math.max(Math.round(exact), 1), maxLevel);
  return { amplifier: level - 1, v: drag * (v + pull * (level * perLevel - v)) };
}

// Sliding down: slow falling keeps speeding up (5 blocks/s on a long rope). When the player moved down faster than
// `downSpeed` (blocks per tick) last tick, one tick of levitation I brakes (it replaces gravity: about -0.05 per tick).
export function brakes(dy, downSpeed) {
  return dy < -downSpeed;
}

// Climbing, by script: vanilla makes only ladders, vines and scaffolding climbable and a custom block cannot be
// (no component, checked 2026-10-02). While a player stands in a rope cell, Jump or walking forward climbs (levitation)
// and otherwise the player sinks slowly (slow falling). This is the version that worked in game (owner). Two others
// failed: teleporting a small step every tick (jumpy, no way down) and steering the velocity with applyKnockback
// (not worked out). The effects' HUD icons show whatever showParticles says: see the Phase 17b notes for what to do.
export const CLIMB = {
  effectTicks: 4, // short, re-applied every tick and removed on leaving
  // blocks per second; a vanilla ladder speeds up to about 4 both up and down (owner, tools/dev_scripts/ladder_speed.js)
  jumpSpeed: 4,
  forwardSpeed: 4,
  downSpeed: 4, // slow falling alone keeps speeding up (7+ on a long rope); brakes() holds it here
  forwardThreshold: 0.3, // walking forward (movement vector y, -1..1) climbs like Jump
};
