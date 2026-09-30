// Deer rules (Phase 11). Pure (no @minecraft/server) so tests/run.mjs can check them offline;
// deer.js wires them to the game.
//
// A deer's flight distance comes from its wariness state, which mirrors the Disharmony of the
// nearest player. The states are component groups in entities/deer.json (`lothlorien:state_<name>`)
// switched by the events `lothlorien:set_<name>`.

export const DEER_ID = "lothlorien:deer";
// Both deer share the wariness states and the alarm (entities/deer.json and entities/white_deer.json have the same
// state groups and events). The white deer is a loner, but it still bolts when a deer near it is hurt.
export const WHITE_DEER_ID = "lothlorien:white_deer";
export const DEER_TYPES = [DEER_ID, WHITE_DEER_ID];
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

// Flight distance of each state (must match entities/deer.json; a test compares them). A player
// only decides a deer's state while within this distance of it.
export const FLIGHT_RADIUS = { friend: 3, calm: 10, l1: 13, l2: 20, l3: 30 };
const SEVERITY = ["friend", "calm", "l1", "l2", "l3"];

// candidates: [{ distance, wariness }] one per player near a deer. The most severe state among
// players inside their own state's flight radius wins (a Disharmony III player 25 blocks away
// outweighs a calm player 5 blocks away); if nobody is that close, the nearest player decides.
export function pickWariness(candidates) {
  let worst, nearest;
  for (const c of candidates) {
    if (!nearest || c.distance < nearest.distance) nearest = c;
    if (c.distance <= FLIGHT_RADIUS[c.wariness] && (!worst || SEVERITY.indexOf(c.wariness) > SEVERITY.indexOf(worst.wariness))) worst = c;
  }
  return (worst ?? nearest)?.wariness;
}
