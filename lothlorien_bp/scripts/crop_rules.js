// Pure: Western Corn growth rules (tests/run.mjs imports this).
export const MAX_GROWTH = 7;

// Chance that one random tick advances the crop one stage. Random ticks hit a given block about once a
// minute, so 7 stages take roughly 20-35 minutes: a little quicker than wheat, which is meant to make the
// crop worth carrying home. Wet farmland is faster. Light is the "tolerates shade" part: wheat stops below
// light 9, Western Corn keeps growing (slowly) down to light 4, i.e. also at night under open sky and in
// a dim glade; below 4 it stalls.
export function growChance(light, moisture) {
  let base = moisture > 0 ? 1 / 3 : 1 / 5;
  if (light >= 9) return base;
  if (light >= 6) return base * 0.6;
  if (light >= 4) return base * 0.3;
  return 0;
}

// Bone meal advances 2 to 5 stages (vanilla wheat); r in [0, 1).
export function bonemealSteps(r) {
  return 2 + Math.floor(r * 4);
}

export function advanceGrowth(growth, steps) {
  return Math.min(MAX_GROWTH, growth + steps);
}
