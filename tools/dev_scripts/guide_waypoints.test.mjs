// node tools/dev_scripts/guide_waypoints.test.mjs  (proof of concept tests; not part of tests/run.mjs yet)
import assert from "node:assert/strict";
import { HOP, MIN_HOP, REACHED, HOP_STUCK_TICKS, pickWaypoint, hopStatus } from "./guide_waypoints.mjs";

let failed = 0;
function test(name, fn) {
  try { fn(); console.log(`ok   ${name}`); } catch (e) { failed++; console.log(`FAIL ${name}\n     ${e.message}`); }
}
const flat = () => 64; // every column standable at y 64
const from = { x: 0, y: 64, z: 0 };
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

test("open ground: waypoint HOP blocks straight at the target", () => {
  const w = pickWaypoint(from, { x: 80, z: 0 }, flat);
  assert.equal(w.final, false);
  assert.ok(Math.abs(w.x - HOP) < 1e-9 && Math.abs(w.z) < 1e-9);
});

test("lake straight ahead: a turned heading is chosen, on the bias side first", () => {
  const lake = (x, z) => (x > 4 && Math.abs(z) < 20 ? undefined : 64);
  const w = pickWaypoint(from, { x: 80, z: 0 }, lake, { bias: -1 });
  assert.ok(w, "found a waypoint");
  assert.equal(w.turn, -1);
  assert.ok(Math.abs(w.z) >= 20 || w.x <= 4);
});

test("near obstacle only: shorter hop down to MIN_HOP", () => {
  const wall = (x) => (x > 10 ? undefined : 64);
  const w = pickWaypoint(from, { x: 80, z: 0 }, wall);
  assert.equal(w.turn, 0);
  assert.ok(w.x <= 10 && w.x >= MIN_HOP);
});

test("skipped heading is not reused", () => {
  const w = pickWaypoint(from, { x: 80, z: 0 }, flat, { skip: new Set([0]) });
  assert.notEqual(w.deg, 0);
});

test("final hop lands next to a buried target, on the deer's side", () => {
  const trunk = (x, z) => (dist({ x, z }, { x: 10, z: 0 }) < 2 ? undefined : 64);
  const w = pickWaypoint(from, { x: 10, z: 0 }, trunk);
  assert.equal(w.final, true);
  assert.ok(w.x < 10 && dist(w, { x: 10, z: 0 }) <= 5);
});

test("boxed in: undefined", () => assert.equal(pickWaypoint(from, { x: 80, z: 0 }, () => undefined), undefined));

test("hopStatus: reached, progress, stuck", () => {
  const hop = { wp: { x: 14, z: 0 }, best: 14, stuck: 0 };
  assert.equal(hopStatus(hop, { x: 14 - REACHED, z: 0 }, 2), "next");
  assert.equal(hopStatus(hop, { x: 5, z: 0 }, 2), "go");
  assert.equal(hop.stuck, 0);
  let s;
  for (let t = 0; t < HOP_STUCK_TICKS; t += 2) s = hopStatus(hop, { x: 5, z: 0 }, 2);
  assert.equal(s, "retry");
});

test("80 blocks of open ground is 6 hops", () => {
  let p = { ...from }, n = 0;
  const target = { x: 80, z: 0 };
  while (n < 20) {
    const w = pickWaypoint(p, target, flat);
    n++;
    if (w.final) break;
    p = { x: w.x, y: w.y, z: w.z };
  }
  assert.equal(n, 6);
});

if (failed) { console.log(`${failed} failed`); process.exit(1); } else console.log("all passed");
