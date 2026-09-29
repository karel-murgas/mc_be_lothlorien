// Pure: what bone meal grows in Lothlorien (tests/run.mjs imports this).
// Grass stays (the design keeps plain grass); flowers are ours. Athelas is scarce on purpose.
export const BONEMEAL_TABLE = [
  ["minecraft:short_grass", 58],
  ["lothlorien:elanor", 14],
  ["lothlorien:niphredil", 12],
  ["minecraft:fern", 6],
  ["lothlorien:golden_fern", 8],
  ["lothlorien:athelas", 4],
];

// Bone meal on one of our plants grows more of the same, like vanilla flowers: this many placement tries
// around it (a try fails on anything but grass with air above). Athelas gets fewer on purpose.
export const SPREAD_TRIES = {
  "lothlorien:elanor": 4,
  "lothlorien:niphredil": 4,
  "lothlorien:golden_fern": 4,
  "lothlorien:athelas": 2,
};

// Segmented ground covers (state lothlorien:amount 1-4): bone meal adds a segment; when full it drops one item (vanilla leaf litter / petals).
export const COVERS = ["lothlorien:mallorn_leaf_carpet", "lothlorien:mallorn_blossom"];
export const MAX_AMOUNT = 4;

// r in [0, 1)
export function pickWeighted(table, r) {
  const total = table.reduce((sum, [, w]) => sum + w, 0);
  let x = r * total;
  for (const [id, w] of table) {
    if (x < w) return id;
    x -= w;
  }
  return table[table.length - 1][0];
}
