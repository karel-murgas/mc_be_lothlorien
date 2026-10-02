// Ground squirrel rules (Phase 15). Pure (no @minecraft/server) so tests/run.mjs can check them offline; squirrel.js wires
// them to the game.
//
// A Friend of Lothlorien offers a Mallorn acorn: the squirrel takes it, scampers off (the engine's own pathfinding follows
// the invisible guide beacon, as the white deer does), digs for a moment, comes back to the player and drops a small gift
// (loot_tables/gifts/squirrel.json, spawned with /loot). One errand per squirrel every COOLDOWN_TICKS.

export const SQUIRREL_ID = "lothlorien:squirrel";
export const GIFT_TABLE = "gifts/squirrel";

export const SQUIRREL_TICKS = 10; // a session is checked this often
export const AWAY_DISTS = [14, 12, 10]; // the beacon's away point, tried in this order (blocks from the squirrel)
export const AWAY_HEADINGS = 8;
export const AWAY_ARRIVE = 3; // horizontal distance to the away point that counts as "there"
export const AWAY_TIMEOUT = 400; // 20 s: dig wherever it got to
export const DIG_TICKS = { min: 60, max: 100 };
export const GIFT_DIST = 2.5; // horizontal distance to the player that counts as "back"
export const ABORT_DIST = 40; // the player this far away: the errand is dropped
export const MAX_TICKS = 2400; // an errand lasts 2 minutes at most (the beacon's own despawn timer is 330 s)
export const COOLDOWN_TICKS = 12000; // 10 minutes of world time before the same squirrel runs another errand

// Why an offer is refused: "restless" (Disharmony I+) | "untrusted" (calm, not yet Friend) | "full" (errand done lately)
// | undefined (go ahead). Gifts are for Friends of Lothlorien only (owner rule, 2026-10-02).
export function offerRefusal({ level, friend, cooldownLeft }) {
  if (level > 0) return "restless";
  if (!friend) return "untrusted";
  if (cooldownLeft > 0) return "full";
  return undefined;
}

export const cooldownLeft = (now, readyAt) => (typeof readyAt === "number" ? Math.max(0, readyAt - now) : 0);

export const horizontal = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

// First standable column on a ring around `from`: `start` is the first heading (radians, random in the game), then every
// 360/AWAY_HEADINGS degrees; stand(x, z, yHint) -> feet height or undefined. Returns { x, y, z } or undefined.
export function pickAway(from, stand, start = 0) {
  for (let k = 0; k < AWAY_HEADINGS; k++) {
    const a = start + (2 * Math.PI * k) / AWAY_HEADINGS;
    for (const d of AWAY_DISTS) {
      const x = from.x + Math.cos(a) * d, z = from.z + Math.sin(a) * d;
      const y = stand(x, z, from.y);
      if (y !== undefined) return { x, y, z };
    }
  }
  return undefined;
}

// What the errand does next: "away" | "dig" | "return" | "gift" | "abort". `phase` is the current one, `age` the ticks since
// the start, `phaseAge` the ticks in this phase, `toBeacon` the squirrel's distance to the away point, `toPlayer` to the
// player, `digFor` how long this dig lasts.
export function nextPhase({ phase, age, phaseAge, toBeacon, toPlayer, digFor }) {
  if (age > MAX_TICKS || toPlayer > ABORT_DIST) return "abort";
  if (phase === "away") return toBeacon <= AWAY_ARRIVE || phaseAge >= AWAY_TIMEOUT ? "dig" : "away";
  if (phase === "dig") return phaseAge >= digFor ? "return" : "dig";
  return toPlayer <= GIFT_DIST ? "gift" : "return";
}

// `roll` is uniform in [0, 1) (Math.random() in the game).
export const digTicks = (roll) => DIG_TICKS.min + Math.floor(roll * (DIG_TICKS.max - DIG_TICKS.min + 1));
