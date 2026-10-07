// Deer rules (Phase 11). Pure (no @minecraft/server) so tests/run.mjs can check them offline;
// deer.js wires them to the game.
//
// A deer's flight distance comes from its wariness state, which mirrors the Harmony band of the
// nearest player. The states are component groups in entities/deer.json (`lothlorien:state_<name>`)
// switched by the events `lothlorien:set_<name>`.

export const DEER_ID = "lothlorien:deer";
// Both deer share the wariness states and the alarm (entities/deer.json and entities/white_deer.json have the same
// state groups and events). The white deer is a loner, but it still bolts when a deer near it is hurt.
export const WHITE_DEER_ID = "lothlorien:white_deer";
export const DEER_TYPES = [DEER_ID, WHITE_DEER_ID];
// The swan and the ground squirrel share the wariness states, flight distances and alarm too (entities/swan.json and
// entities/squirrel.json carry the same groups and events), so the whole forest's fauna reads the player's Harmony band.
export const SWAN_ID = "lothlorien:swan";
export const SQUIRREL_ID = "lothlorien:squirrel";
export const UNICORN_ID = "lothlorien:unicorn"; // also carries the groups and events; its calm state is as timid as l1 (entities/unicorn.json)
export const WARY_TYPES = [...DEER_TYPES, SWAN_ID, SQUIRREL_ID, UNICORN_ID];
export const WARINESS = ["calm", "l1", "l2", "l3", "friend"];
// Deer farther than this from every player keep their last state; it must exceed the largest
// flight distance in the entity file (alarmed/l3: 36/30 blocks).
export const WATCH_RADIUS = 40;
// A player hurting a deer alarms every deer this close to it.
export const ALARM_RADIUS = 20;
// Holding the lure stops a calm or Friend deer fleeing from that player (entity filter has_equipment), so a lured deer
// walks all the way up. Feeding it sets lothlorien:tame: while calm or Friend it then takes the state_tame group
// (lure, no flight from players). A player hurting it clears tame. The Uneasy, Shunned and Hated bands and the alarm still make it flee.
export const CORN_ID = "lothlorien:western_corn_grain";

// Harmony band (harmony.js bandOf) -> wariness. An unknown band is treated as calm.
export const WARINESS_OF_BAND = { friend: "friend", guest: "calm", uneasy: "l1", shunned: "l2", hated: "l3" };
export const warinessFor = (band) => WARINESS_OF_BAND[band] ?? "calm";

export const setEventFor = (wariness) => `lothlorien:set_${wariness}`;

// Flight distance of each state (must match entities/deer.json; a test compares them). A player
// only decides a deer's state while within this distance of it.
export const FLIGHT_RADIUS = { friend: 3, calm: 10, l1: 13, l2: 20, l3: 30 };
const SEVERITY = ["friend", "calm", "l1", "l2", "l3"];

// candidates: [{ distance, wariness }] one per player near a deer. The most severe state among
// players inside their own state's flight radius wins (a Hated player 25 blocks away
// outweighs a calm player 5 blocks away); if nobody is that close, the nearest player decides.
export function pickWariness(candidates) {
  let worst, nearest;
  for (const c of candidates) {
    if (!nearest || c.distance < nearest.distance) nearest = c;
    if (c.distance <= FLIGHT_RADIUS[c.wariness] && (!worst || SEVERITY.indexOf(c.wariness) > SEVERITY.indexOf(worst.wariness))) worst = c;
  }
  return (worst ?? nearest)?.wariness;
}
