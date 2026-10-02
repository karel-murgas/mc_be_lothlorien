// Unicorn rules (Phase 15). Pure (no @minecraft/server) so tests/run.mjs can check them offline; unicorn.js wires them to
// the game.
//
// Taming is a bond earned in three offers: a Friend of Lothlorien offers Elanor (the flower) to a unicorn three times,
// at least OFFER_GAP_TICKS apart. The third offer bonds it to that player: it can then be ridden by them, without a saddle.

export const UNICORN_ID = "lothlorien:unicorn";
export const ELANOR_ID = "lothlorien:elanor";
export const TRUST_OFFERS = 3; // offers until the bond
export const OFFER_GAP_TICKS = 200; // 10 s between two offers: the unicorn takes its time

// Why an offer is refused: "tame" | "alarmed" | "restless" (Disharmony I+) | "untrusted" (calm, not yet Friend) |
// "wait" (the last offer was less than OFFER_GAP_TICKS ago) | undefined (go ahead).
export function offerRefusal({ level, friend, tame, alarmed, sinceLast }) {
  if (tame) return "tame";
  if (alarmed) return "alarmed";
  if (level > 0) return "restless";
  if (!friend) return "untrusted";
  if (sinceLast !== undefined && sinceLast < OFFER_GAP_TICKS) return "wait";
  return undefined;
}

// Trust after one more accepted offer, and whether that completes the bond.
export function nextTrust(trust) {
  const next = Math.min(TRUST_OFFERS, trust + 1);
  return { trust: next, bonded: next >= TRUST_OFFERS };
}

// Ticks since the last accepted offer (world time), or undefined if there was none or the clock went backwards.
export function ticksSince(now, last) {
  return typeof last === "number" && now >= last ? now - last : undefined;
}

// Only the owner rides a bonded unicorn. A bonded unicorn without a recorded owner (a /summon with the tame event, say)
// is anyone's.
export const mayRide = (ownerId, playerId) => !ownerId || ownerId === playerId;
