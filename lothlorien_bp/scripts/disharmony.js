// Disharmony rules (design KB section 10). Pure (no @minecraft/server) so tests/run.mjs can check
// them offline; disharmony_game.js wires them to players, deaths and persistence.
//
// State per player: { points, calm, friend }
//   points  Disharmony points (one per kill made inside the biome)
//   calm    seconds without a kill, counted towards the next point of decay
//   friend  seconds spent at 0 points inside the biome, paused outside (Friend at FRIEND_SECONDS)

// A point decays after this many peaceful seconds; slower outside, where the status is hidden.
export const DECAY_SECONDS_INSIDE = 180;
export const DECAY_SECONDS_OUTSIDE = 360;
export const FRIEND_SECONDS = 600;

export function newState() {
  return { points: 0, calm: 0, friend: 0 };
}

// 0 = none, I = 1 point, II = 2-3 points, III = 4+.
export function levelFor(points) {
  return points <= 0 ? 0 : points === 1 ? 1 : points <= 3 ? 2 : 3;
}

export function isFriend(state) {
  return state.friend >= FRIEND_SECONDS;
}

// A player kill inside the biome: one more point, and the peaceful streaks start over.
export function recordKill(state) {
  state.points++;
  state.calm = 0;
  state.friend = 0;
}

// The player died: a fresh start.
export function recordDeath(state) {
  state.points = 0;
  state.calm = 0;
  state.friend = 0;
}

// Advance by `dt` seconds. Returns nothing; callers compare levelFor/isFriend before and after.
export function tick(state, inside, dt) {
  if (state.points > 0) {
    state.calm += dt;
    const need = inside ? DECAY_SECONDS_INSIDE : DECAY_SECONDS_OUTSIDE;
    while (state.points > 0 && state.calm >= need) {
      state.points--;
      state.calm -= need;
    }
    if (state.points === 0) state.calm = 0;
  }
  // Friend progress only advances at 0 points inside the biome; outside it is paused (neither
  // gained nor lost), so Friend status lasts after leaving. Only points (kill/death) reset it.
  if (state.points > 0) state.friend = 0;
  else if (inside) state.friend += dt;
}

// Status text for the actionbar, or undefined when nothing is shown (outside, or at 0 points
// without Friend). The status is only ever visible inside the biome.
export function statusText(state, inside) {
  if (!inside) return undefined;
  if (isFriend(state)) return "Friend of Lothlórien";
  const level = levelFor(state.points);
  return level ? `Disharmony ${"I".repeat(level)}` : undefined;
}

export function serialize(state) {
  return JSON.stringify(state);
}

// Tolerates missing or damaged data: anything unreadable becomes a fresh state.
export function parse(text) {
  const state = newState();
  try {
    const raw = JSON.parse(text);
    for (const key of Object.keys(state)) {
      if (Number.isFinite(raw[key]) && raw[key] >= 0) state[key] = raw[key];
    }
  } catch {
    // no saved state
  }
  return state;
}
