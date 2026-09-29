// Offline balance estimate for the small Mallorn: node tests/tree_stats.mjs [trees] [acornChance]
// Mirrors the leaf loot table; the in-game check is `/scriptevent lothlorien:treestats`.
import { makeRandom, buildSmallMallorn } from "../lothlorien_bp/scripts/mallorn_tree.js";

const n = Number(process.argv[2] ?? 20);
const acorn = Number(process.argv[3] ?? 0.02);
let logs = 0, leaves = 0, minL = 1e9, maxL = 0;
const shapes = new Set();
for (let i = 0; i < n; i++) {
  const t = buildSmallMallorn(makeRandom(1000 + i * 7919));
  logs += t.logs.length; leaves += t.leaves.length;
  minL = Math.min(minL, t.leaves.length); maxL = Math.max(maxL, t.leaves.length);
  shapes.add(t.logs.length + ":" + t.leaves.length);
}
console.log(`trees ${n}: avg logs ${(logs / n).toFixed(1)}, avg leaves ${(leaves / n).toFixed(1)} (${minL}-${maxL}), distinct shapes ${shapes.size}`);
console.log(`expected acorns per tree if every leaf is broken/decays: ${((leaves / n) * acorn).toFixed(2)} (chance ${acorn})`);
console.log(`expected planks per tree: ${((logs / n) * 4).toFixed(1)}`);
const hs = [];
for (let i = 0; i < n; i++) hs.push(buildSmallMallorn(makeRandom(1000 + i * 7919)).height);
console.log(`trunk height min ${Math.min(...hs)}, max ${Math.max(...hs)}`);
