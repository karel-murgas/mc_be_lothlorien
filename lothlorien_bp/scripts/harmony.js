import { message } from "./messages.js";
// Harmony rules (plan docs/design/harmony_rework_plan.md). Pure (no @minecraft/server) so tests/run.mjs can check
// them offline; harmony_game.js wires them to players, deaths and persistence.
//
// One integer per player, MIN_HARMONY..MAX_HARMONY; one point is about one minute of peaceful time in the forest.
// State per player: { harmony, timer }
//   harmony  the number (start 0)
//   timer    seconds since the last deed or recovered point, counted towards the next point

export const MIN_HARMONY = -60;
export const MAX_HARMONY = 10;

// Band boundaries: each constant is the lowest harmony of its band (Hated is everything below SHUNNED_FROM).
export const FRIEND_FROM = 10; // Friend is exactly +10: any deed loses it
export const GUEST_FROM = 0; // Guest 0..+9
export const UNEASY_FROM = -14; // Uneasy -1..-14
export const SHUNNED_FROM = -29; // Shunned -15..-29; Hated -30..-60
export const BANDS = ["hated", "shunned", "uneasy", "guest", "friend"]; // worst first: the index is the rank

// Recovery: +1 per this many seconds without a deed; outside the forest slower and only up to 0.
export const RECOVER_SECONDS_INSIDE = 60;
export const RECOVER_SECONDS_OUTSIDE = 120;
// Dying inside the forest while Hated puts harmony here (no "die to reset", no warden spawn-camping at a bed).
export const HATED_DEATH_HARMONY = SHUNNED_FROM;

// Deed kinds -> penalty points. Single table: plundering costs or care rewards later are one more entry.
export const DEED_COSTS = {
  animal: 3, // any non-monster mob (deer, swan, squirrel, vanilla animals, villagers...)
  monster: 1, // deliberate: lead monsters to the wardens, who kill for free
  white_deer: 6,
  unicorn: 10, // the forest's most sacred creature
  warden_fight: 1, // per fight (first hit after PROVOKE_MS without one), see elven_warden.js
  warden_kill: 6, // on top of the fight cost
  player: 3,
};
export const deedCost = (kind) => DEED_COSTS[kind] ?? 0;

const WHITE_DEER = "lothlorien:white_deer";
const UNICORN = "lothlorien:unicorn";
const WARDEN = "lothlorien:elven_warden";
const PLAYER = "minecraft:player";

// Deed kind of a victim, or undefined when it counts nothing (armor stands and the like: family `inanimate`).
// `families` = the victim's type families.
export function deedKindOf(typeId, families = []) {
  if (families.includes("inanimate")) return undefined;
  if (typeId === WHITE_DEER) return "white_deer";
  if (typeId === UNICORN) return "unicorn";
  if (typeId === WARDEN) return "warden_kill";
  if (typeId === PLAYER) return "player";
  return families.includes("monster") ? "monster" : "animal";
}

const clamp = (v) => Math.max(MIN_HARMONY, Math.min(MAX_HARMONY, v));

export function newState() {
  return { harmony: 0, timer: 0 };
}

export function bandOf(harmony) {
  if (harmony >= FRIEND_FROM) return "friend";
  if (harmony >= GUEST_FROM) return "guest";
  if (harmony >= UNEASY_FROM) return "uneasy";
  if (harmony >= SHUNNED_FROM) return "shunned";
  return "hated";
}

export const bandRank = (band) => BANDS.indexOf(band);
export const isFriend = (state) => bandOf(state.harmony) === "friend";
export const isHated = (state) => bandOf(state.harmony) === "hated";

// Take `points` of penalty point by point: while harmony is above 0 a point costs 2, from 0 down it costs 1.
// Odd harmony simply steps over zero: h = 5, p = 3 -> 3, 1, -1; h = 1, p = 1 -> -1; h = 4, p = 3 -> 2, 0, -1.
export function applyPenalty(state, points) {
  let h = state.harmony;
  for (let i = 0; i < points; i++) h -= h > 0 ? 2 : 1;
  state.harmony = Math.max(MIN_HARMONY, h);
}

// A deed (kind from DEED_COSTS): the penalty, and the minute timer starts over. Unknown kinds count nothing.
export function recordDeed(state, kind) {
  const cost = deedCost(kind);
  if (cost <= 0) return;
  applyPenalty(state, cost);
  state.timer = 0;
}

// The player died. Nothing changes, except dying inside the forest while Hated.
export function recordDeath(state, insideForest) {
  if (insideForest && bandOf(state.harmony) === "hated") {
    state.harmony = HATED_DEATH_HARMONY;
    state.timer = 0;
  }
}

// Advance by `dt` seconds. Returns nothing; callers compare harmony before and after.
// Inside: +1 per minute up to MAX; outside: +1 per two minutes, never above 0 (a positive value is kept as it is).
export function tick(state, inside, dt) {
  const limit = inside ? MAX_HARMONY : GUEST_FROM;
  const need = inside ? RECOVER_SECONDS_INSIDE : RECOVER_SECONDS_OUTSIDE;
  state.timer += dt;
  while (state.timer >= need && state.harmony < limit) {
    state.harmony++;
    state.timer -= need;
  }
  if (state.harmony >= limit) state.timer = 0; // nothing to recover: no credit piles up
}

// Chat keys (without the "lothlorien.message." prefix) for a harmony change, in the order they are sent.
// Friend gained / lost are their own lines; every other band change has one line per direction.
export function changeMessages(from, to) {
  const a = bandOf(from), b = bandOf(to);
  if (a === b) return [];
  if (b === "friend") return ["friend.gained"];
  const keys = a === "friend" ? ["friend.lost"] : [];
  if (a === "friend" && b === "guest") return keys; // losing Friend is the whole news
  keys.push(`harmony.${bandRank(b) > bandRank(a) ? "better" : "worse"}.${b}`);
  return keys;
}

// The deed hint ("The trees grow quiet around you.") is sent at most once per this many ms per player.
export const HINT_GAP_MS = 30000;
export const hintDue = (lastMs, nowMs) => lastMs === undefined || nowMs - lastMs >= HINT_GAP_MS;

// Per-band prefix of the action bar (icon glyphs later: a character such as " "). Empty for now.
export const BAND_ICONS = { friend: "", guest: "", uneasy: "", shunned: "", hated: "" };

// Status text for the action bar, or undefined outside the forest. Shown for every band; the status is only ever
// visible inside the biome.
export function statusText(state, inside) {
  if (!inside) return undefined;
  const band = bandOf(state.harmony);
  const label = message(`status.${band}`);
  const icon = BAND_ICONS[band];
  return icon ? { rawtext: [{ text: icon }, label] } : label;
}

export function serialize(state) {
  return JSON.stringify(state);
}

// Tolerates missing or damaged data: anything unreadable becomes a fresh state; harmony is clamped to its range.
export function parse(text) {
  const state = newState();
  try {
    const raw = JSON.parse(text);
    if (Number.isFinite(raw.harmony)) state.harmony = clamp(Math.trunc(raw.harmony));
    if (Number.isFinite(raw.timer) && raw.timer >= 0) state.timer = raw.timer;
  } catch {
    // no saved state
  }
  return state;
}
