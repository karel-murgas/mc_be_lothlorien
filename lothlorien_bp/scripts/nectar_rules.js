// Pure: Phase 14b nectar bloom rules (tests/run.mjs imports this).
export const MAX_NECTAR = 3;
export const MALLORN_LEAVES = new Set(["lothlorien:mallorn_leaves", "lothlorien:mallorn_golden_leaves"]);

// Chance that one random tick fills the bloom one stage. Random ticks hit a block about once a minute, so
// three stages at 1/7 take about 21 minutes on average: one in-game day from dry to full.
export const FILL_CHANCE = 1 / 7;

// The stage after one random tick. The bloom fills only while Mallorn leaves hang directly above it; elsewhere it
// stays as it is. r in [0, 1).
export function nectarAfterTick(stage, leavesAbove, r) {
  if (stage >= MAX_NECTAR || !leavesAbove || r >= FILL_CHANCE) return stage;
  return stage + 1;
}

// A sapling-grown Mallorn sometimes gets blooms (natural trees get full ones from worldgen); r in [0, 1).
export function treeBloomCount(r) {
  if (r < 0.4) return 0;
  return r < 0.85 ? 1 : 2;
}
