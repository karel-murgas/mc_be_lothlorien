// Regression tests: node tests/run.mjs (run by `mods verify lothlorien`).
import assert from "node:assert/strict";
import { leafUndersideY } from "../lothlorien_bp/scripts/leaf_fall.js";
import { BONEMEAL_TABLE, SPREAD_TRIES, COVERS, pickWeighted } from "../lothlorien_bp/scripts/flora_table.js";
import { estimateDepth, probeCount, ringOffsets, DEPTH_RADII } from "../lothlorien_bp/scripts/depth.js";

const L = "lothlorien:lothlorien", RIVER = "minecraft:river", FOREST = "minecraft:forest";
const T = new Set([RIVER]);
const depth = (fn) => estimateDepth(fn, L, T);
let failed = 0;
function test(name, fn) {
  try { fn(); console.log(`ok   ${name}`); } catch (e) { failed++; console.log(`FAIL ${name}\n     ${e.message}`); }
}

// Half-plane world: Lothlorien for x < border, forest beyond.
const halfPlane = (border) => (dx) => (dx < border ? L : FOREST);

test("outside the biome", () => assert.equal(depth(() => FOREST).level, 0));
test("border 10 blocks away is edge", () => assert.equal(depth(halfPlane(10)).level, 1));
test("border 30 blocks away is inner", () => assert.equal(depth(halfPlane(30)).level, 2));
test("no border within the rings is heart", () => {
  const r = depth(() => L);
  assert.equal(r.level, 3);
  assert.equal(r.complete, true);
});
test("result does not depend on the side the border is on", () => {
  for (const b of [5, 20, 35, 60]) {
    const east = depth((dx) => (dx < b ? L : FOREST)).level;
    const west = depth((dx) => (dx > -b ? L : FOREST)).level;
    const north = depth((dx, dz) => (dz > -b ? L : FOREST)).level;
    assert.equal(east, west, `border ${b}`);
    assert.equal(east, north, `border ${b}`);
  }
});
// The in-game bug: chunks ahead of a flying player are not loaded yet. An unreadable probe
// must not be treated as inside, or a close border in that direction is ignored.
test("unloaded probes never raise the level", () => {
  const border = 20; // real answer: inner
  const unloadedBeyond = (dx) => (dx >= 12 ? undefined : dx < border ? L : FOREST);
  const r = depth(unloadedBeyond);
  assert.ok(r.level <= 2, `got level ${r.level}`);
  assert.equal(r.complete, false);
  assert.equal(depth((dx) => (dx >= 12 ? undefined : L)).level, 1); // only ring 8 is known
});
test("a river through the biome is not an edge", () => {
  const riverStripe = (dx) => (Math.abs(dx) <= 6 ? RIVER : L);
  assert.equal(depth(riverStripe).level, 3);
});
test("a river outside the biome is outside", () => {
  assert.equal(depth((dx) => (Math.abs(dx) <= 6 ? RIVER : FOREST)).level, 0);
});
test("standing in a river inside the biome counts", () => {
  assert.equal(depth((dx, dz) => (dx === 0 && dz === 0 ? RIVER : L)).level, 3);
});
test("outer rings are dense enough for a 12-block tongue", () => {
  const outer = DEPTH_RADII[DEPTH_RADII.length - 1];
  for (let deg = 0; deg < 360; deg += 7) {
    const a = (deg * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a);
    // Foreign strip 12 wide pointing at the player along angle `a`, reaching to outer - 1.
    const tongue = (dx, dz) => (dx * c + dz * s >= outer - 1 && Math.abs(-dx * s + dz * c) <= 6 ? FOREST : L);
    assert.equal(depth(tongue).level, 2, `angle ${deg}`);
  }
  assert.ok(ringOffsets(outer).length >= 24);
  assert.ok(probeCount() < 120, `probe count ${probeCount()}`);
});

const LEAF = "lothlorien:mallorn_leaves", AIR = "minecraft:air";
const isLeaf = (id) => id === LEAF;
test("leaf fall: single-layer canopy lets go at the top leaf", () =>
  assert.equal(leafUndersideY(20, (y) => (y >= 20 ? LEAF : AIR), isLeaf), 20));
test("leaf fall: thick canopy walks down to the open underside", () =>
  assert.equal(leafUndersideY(20, (y) => (y >= 17 ? LEAF : AIR), isLeaf), 17));
test("leaf fall: nothing when the column is not open below within reach", () =>
  assert.equal(leafUndersideY(20, () => LEAF, isLeaf), undefined));
test("leaf fall: unreadable block gives up", () =>
  assert.equal(leafUndersideY(20, (y) => (y >= 19 ? LEAF : undefined), isLeaf), undefined));

test("bone meal table: ends of the range and only known ids", () => {
  assert.equal(pickWeighted(BONEMEAL_TABLE, 0), "minecraft:short_grass");
  assert.equal(pickWeighted(BONEMEAL_TABLE, 0.999999), "lothlorien:athelas");
  for (const [id] of BONEMEAL_TABLE) assert.ok(["minecraft:short_grass", "minecraft:fern"].includes(id) || id.startsWith("lothlorien:"));
});
test("bone meal table: no vanilla flowers, athelas is the rarest", () => {
  assert.ok(!BONEMEAL_TABLE.some(([id]) => /dandelion|poppy/.test(id)));
  assert.equal(Math.min(...BONEMEAL_TABLE.map(([, w]) => w)), BONEMEAL_TABLE.find(([id]) => id.endsWith("athelas"))[1]);
});

test("bone meal spread: our plants grow more, Athelas the least", () => {
  for (const id of ["elanor", "niphredil", "golden_fern", "athelas"]) assert.ok(SPREAD_TRIES[`lothlorien:${id}`] > 0, id);
  assert.equal(Math.min(...Object.values(SPREAD_TRIES)), SPREAD_TRIES["lothlorien:athelas"]);
  assert.deepEqual(COVERS, ["lothlorien:mallorn_leaf_carpet", "lothlorien:mallorn_blossom"]);
});

if (failed) { console.log(`${failed} test(s) failed`); process.exit(1); }
console.log("all tests passed");
