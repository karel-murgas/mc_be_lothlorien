import { system } from "@minecraft/server";

// The playerInteractWithBlock event can fire several times for one use of an item (held button, both hands, retries).
// Anything that consumes an item or changes the world from that event must act once: call repeatedUse(player, "<action name>") and
// return early when it says true. Convention checked by the shared verifier: the guard's name contains "repeat" or "debounce".
const DEBOUNCE_TICKS = 10;
const lastUse = new Map();

export function repeatedUse(player, action = "") {
  const now = system.currentTick;
  const key = `${player.id}:${action}`;
  const last = lastUse.get(key);
  if (last !== undefined && now - last < DEBOUNCE_TICKS) return true;
  lastUse.set(key, now);
  return false;
}
