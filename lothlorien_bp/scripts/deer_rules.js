// Deer rules (Phase 11). Pure (no @minecraft/server) so tests/run.mjs can check them offline;
// deer.js wires them to the game.
//
// A deer's flight distance comes from its wariness state, which mirrors the Disharmony of the
// nearest player. The states are component groups in entities/deer.json (`lothlorien:state_<name>`)
// switched by the events `lothlorien:set_<name>`.

export const DEER_ID = "lothlorien:deer";
export const WARINESS = ["calm", "l1", "l2", "l3", "friend"];
// Deer farther than this from every player keep their last state; it must exceed the largest
// flight distance in the entity file (alarmed/l3: 36/30 blocks).
export const WATCH_RADIUS = 40;
// A player hurting a deer alarms every deer this close to it.
export const ALARM_RADIUS = 20;

// Disharmony level 0-3 and Friend status -> wariness. Friend only counts at level 0 (a kill
// already resets Friend in disharmony.js; this keeps the rule safe on its own).
export function warinessFor(level, friend) {
  if (level <= 0) return friend ? "friend" : "calm";
  return WARINESS[Math.min(level, 3)];
}

export const setEventFor = (wariness) => `lothlorien:set_${wariness}`;

// candidates: [{ distance, wariness }] one per player near a deer. The nearest player decides
// (one player's Disharmony must not make a deer react to another player's record).
export function pickWariness(candidates) {
  let best;
  for (const c of candidates) if (!best || c.distance < best.distance) best = c;
  return best?.wariness;
}
