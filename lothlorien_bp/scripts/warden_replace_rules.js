// Village wardens come out of .mcstructure template entities, which load with the ENGINE DEFAULT attributes (movement 0.7,
// health 20, follow_range 16) instead of the values in entities/elven_warden.json (movement 0.25, health 26, follow_range 28);
// verified 2026-10-08 by reading the saved world. warden_replace.js swaps such a warden for a fresh spawn. Pure rules here.
export const JSON_MOVEMENT = 0.25; // entities/elven_warden.json minecraft:movement
export const ENGINE_MOVEMENT = 0.7; // what a template entity gets
// Midway between the two with room for speed/slowness effects (x0.8..x1.2 of 0.25 stays far below). The movement attribute is
// the test because it is the one the owner feels (about 2.8x too fast) and it never changes at runtime on a warden.
export const WRONG_MOVEMENT_ABOVE = 0.5;

export function needsReplacement(movementCurrent) {
  return Number.isFinite(movementCurrent) && movementCurrent > WRONG_MOVEMENT_ABOVE;
}
