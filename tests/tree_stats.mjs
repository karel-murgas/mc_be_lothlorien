// Offline balance estimate: node tests/tree_stats.mjs [trees] [acornChance]
// Mirrors the leaf loot table; the in-game check is `/scriptevent lothlorien:treestats`.
import { makeRandom, buildSmallMallorn, buildBigMallorn } from "../lothlorien_bp/scripts/mallorn_tree.js";

const n = Number(process.argv[2] ?? 20);
const acorn = Number(process.argv[3] ?? 0.02);
for (const [name, build] of [["small", buildSmallMallorn], ["big", buildBigMallorn]]) {
  let logs = 0, leaves = 0, minL = 1e9, maxL = 0, minH = 99, maxH = 0;
  const shapes = new Set();
  for (let i = 0; i < n; i++) {
    const t = build(makeRandom(1000 + i * 7919));
    logs += t.logs.length; leaves += t.leaves.length;
    minL = Math.min(minL, t.leaves.length); maxL = Math.max(maxL, t.leaves.length);
    minH = Math.min(minH, t.height); maxH = Math.max(maxH, t.height);
    shapes.add(t.logs.length + ":" + t.leaves.length);
  }
  console.log(`${name} x${n}: height ${minH}-${maxH}, avg logs ${(logs / n).toFixed(1)} (${((logs / n) * 4).toFixed(0)} planks), ` +
    `avg leaves ${(leaves / n).toFixed(0)} (${minL}-${maxL}), distinct ${shapes.size}, ` +
    `acorns if all leaves drop ${((leaves / n) * acorn).toFixed(1)} (chance ${acorn})`);
}
