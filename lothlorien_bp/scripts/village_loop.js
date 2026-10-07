// Loop closer rules for the Elven village (round 4, P7). Pure JS (no fs, no Node or Bedrock imports): scripts/loop_marker.js runs it
// in game, tools/village_sim.mjs runs the very same functions on the simulated village, tests/run.mjs checks them with fixtures.
//
// A jigsaw village is a tree, so exits that found no room end in a `railing_end` piece (5 planks + 5 fences, carrying one invisible
// `lothlorien:loop_marker`). When two such exits face each other on the same deck height, the marker of the one with the smaller
// (x, z) builds an arched slab bridge between them (scripts/village_bridge.js) and the other stands down.
//
// P7b: an exit may also join the SIDE of any platform (node / tower deck at either level, central deck, braced balcony, lookout): a straight
// run of 5 rail cells perpendicular to the bridge, deck under them, and two rows of open deck behind (see sideTarget).
//
// World reader: at(x, y, z) -> block type id; undefined = not loaded. An "exit" is { x, y, z, dir: [dx, dz] }: x, z, y = the centre
// deck cell of the railing row, dir = the way out (away from the platform the railing closes).
import { bridgeShape } from "./village_bridge.js";

export const MARKER_ID = "lothlorien:loop_marker";
export const PLANKS = "lothlorien:mallorn_planks", SLAB = "lothlorien:mallorn_slab", FENCE = "lothlorien:mallorn_fence", LANTERN = "lothlorien:elven_lantern";
// minDist/maxDist: blocks between the two railing rows' centres (bridge length = dist + 1, i.e. 5..16 free cells between the rows);
// maxOffset: sideways shift (also <= length - 3, the most bridgeShape supports: one block sideways per block forward)
export const LOOP = { minDist: 6, maxDist: 17, maxOffset: 5, maxTries: 6, radius: 22, lightTarget: 8, lanternLight: 14 };

const AIRS = ["minecraft:air", "minecraft:cave_air", "minecraft:void_air"];
const isAir = (n) => AIRS.includes(n);
const isLeaves = (n) => typeof n === "string" && n.endsWith("_leaves");
const SIDE_OF = (v) => (v[1] < 0 ? "north" : v[1] > 0 ? "south" : v[0] < 0 ? "west" : "east");

// The railing_end signature around the centre deck cell (x, y, z): a row of exactly 5 planks with a fence on each, the open side without
// deck, and on the other side the platform's connector row (deck under a 3-wide air walk, fences at +-2).
export function exitAt(at, x, y, z) {
  if (at(x, y, z) !== PLANKS || at(x, y + 1, z) !== FENCE) return null;
  for (const a of [[1, 0], [0, 1]]) {
    let row = true;
    for (let o = -2; o <= 2 && row; o++) if (at(x + a[0] * o, y, z + a[1] * o) !== PLANKS || at(x + a[0] * o, y + 1, z + a[1] * o) !== FENCE) row = false;
    if (!row) continue;
    if ([-3, 3].some((o) => at(x + a[0] * o, y, z + a[1] * o) === PLANKS || at(x + a[0] * o, y + 1, z + a[1] * o) === FENCE)) continue; // railing_end is exactly 5 wide: a longer fence run is a platform rim
    for (const s of [[a[1], a[0]], [-a[1], -a[0]]]) { // s = towards the platform
      const px = x + s[0], pz = z + s[1];
      let ok = true;
      for (let o = -2; o <= 2 && ok; o++) {
        const bx = px + a[0] * o, bz = pz + a[1] * o;
        if (at(bx, y, bz) !== PLANKS) ok = false;
        else if (Math.abs(o) === 2) ok = at(bx, y + 1, bz) === FENCE;
        else ok = isAir(at(bx, y + 1, bz)) && isAir(at(bx, y + 2, bz));
      }
      const out = at(x - s[0], y, z - s[1]);
      if (ok && out !== PLANKS && out !== SLAB) return { x, y, z, dir: [-s[0], -s[1]] };
    }
  }
  return null;
}

const before = (a, b) => a.x < b.x || (a.x === b.x && a.z < b.z);
const same = (a, b) => a.x === b.x && a.y === b.y && a.z === b.z;

// Best exit facing `A` (opposite direction, same deck height, dist minDist..maxDist ahead, sideways within the bridge's reach):
// nearest first, a sideways shift counts 3. -> { B, length, offset, score } or null. offset is the shift of B along
// ex = (dir.z, -dir.x), the "east" of a bridge drawn by bridgeShape heading south.
export function findPartner(at, A) {
  const d = A.dir, ex = [d[1], -d[0]];
  let best = null;
  for (let dist = LOOP.minDist; dist <= LOOP.maxDist; dist++) {
    const length = dist + 1, maxOff = Math.min(LOOP.maxOffset, length - 3);
    for (let lat = -maxOff; lat <= maxOff; lat++) {
      const x = A.x + d[0] * dist + ex[0] * lat, z = A.z + d[1] * dist + ex[1] * lat;
      if (at(x, A.y + 1, z) !== FENCE) continue;
      const B = exitAt(at, x, A.y, z);
      if (!B || B.dir[0] !== -d[0] || B.dir[1] !== -d[1]) continue;
      const score = dist + 3 * Math.abs(lat);
      if (!best || score < best.score) best = { B, length, offset: lat, score };
    }
  }
  return best;
}

// ---- the bridge in world coordinates ---------------------------------------------------------------------------------------------
// Local frame of bridgeShape: z runs from A (z = 0) to B (z = length - 1) along A's dir, local x (east) is ex = (dir.z, -dir.x).
// Rows 0 and length - 1 are the two railing rows themselves.
export function planBridge(A, B, length, offset, side = false) {
  const shape = bridgeShape(length, offset, length <= 7 ? 1 : 2);
  const d = A.dir, ex = [d[1], -d[0]], c0 = shape.connectors[0].x;
  const w = (lx, ly, lz) => ({ x: A.x + ex[0] * (lx - c0) + d[0] * lz, y: A.y + ly, z: A.z + ex[1] * (lx - c0) + d[1] * lz });
  const vec = { north: [-d[0], -d[1]], south: [d[0], d[1]], west: [-ex[0], -ex[1]], east: [ex[0], ex[1]] };
  // side target: the far end row is the platform's own rim row; its edge posts keep their place (no air above them: a lantern may sit there)
  const endC = shape.connectors[1].x;
  const isEdge = (c) => c.z === length - 1 && (Math.abs(c.x - endC) === 2);
  const cells = shape.cells.filter((c) => !(side && isEdge(c) && c.kind === "air")).map((c) => ({ ...w(c.x, c.y, c.z), kind: c.kind, row: c.z }));
  const rails = shape.rails.map((r) => {
    const states = { "minecraft:connection_north": false, "minecraft:connection_south": false, "minecraft:connection_west": false, "minecraft:connection_east": false };
    for (const s of r.sides) if (!(side && r.z === length - 1 && s === "south")) states[`minecraft:connection_${SIDE_OF(vec[s])}`] = true; // side: no link into the platform interior
    return { ...w(r.x, r.y, r.z), states, row: r.z };
  });
  const lanterns = planLanterns(shape).map(([x, y, z]) => ({ ...w(x, y, z), row: z }));
  const end = w(shape.connectors[1].x, 0, length - 1);
  if (end.x !== B.x || end.z !== B.z || end.y !== B.y) throw new Error(`planBridge: far end ${end.x},${end.z} is not the partner ${B.x},${B.z}`);
  return { A, B, length, offset, shape, cells, rails, lanterns, side };
}

// Everything the bridge writes: Map "x,y,z" -> { id, states? }. Later entries win (rails and lanterns replace headroom air).
export function finalBlocks(plan) {
  const out = new Map(), k = (c) => `${c.x},${c.y},${c.z}`;
  const KIND = { plank: { id: PLANKS }, slab_bottom: { id: SLAB, states: { "minecraft:vertical_half": "bottom" } }, slab_top: { id: SLAB, states: { "minecraft:vertical_half": "top" } }, air: { id: "minecraft:air" } };
  for (const c of plan.cells) out.set(k(c), KIND[c.kind]);
  for (const r of plan.rails) out.set(k(r), { id: FENCE, states: r.states });
  for (const l of plan.lanterns) out.set(k(l), { id: LANTERN, states: { "minecraft:block_face": "up" } });
  return out;
}

// Cells of the bridge that cannot be built over: anything but air or leaves (the end rows may hold the railing's own planks and fences).
export function blockedCells(at, plan) {
  const bad = [], last = plan.length - 1;
  for (const c of [...plan.cells, ...plan.rails]) {
    const n = at(c.x, c.y, c.z);
    const own = (c.row === 0 || c.row === last) && (n === PLANKS || n === FENCE);
    if (!(isAir(n) || isLeaves(n) || own)) bad.push({ x: c.x, y: c.y, z: c.z, block: n });
  }
  return bad;
}

// Platform side the exit can join: (x, y, z) is the rim deck cell the bridge's far end row is centred on, d = the bridge heading.
// Needs: a straight run of 5 rail cells on 5 plank cells across the heading; in front (toward the exit) nothing walkable; behind it two
// rows of plain planks (-2..2) with open air above their centre 3 cells (so no stair opening, slab, trunk or connector corridor).
export function sideTarget(at, x, y, z, d) {
  const a = [d[1], -d[0]];
  if (at(x, y + 1, z) !== FENCE) return false;
  for (let o = -2; o <= 2; o++) {
    if (at(x + a[0] * o, y, z + a[1] * o) !== PLANKS || at(x + a[0] * o, y + 1, z + a[1] * o) !== FENCE) return false;
    const fx = x - d[0] + a[0] * o, fz = z - d[1] + a[1] * o;
    if (at(fx, y, fz) === PLANKS || at(fx, y, fz) === SLAB) return false; // a rail inside a deck, not on its rim
  }
  for (const k of [1, 2]) {
    for (let o = -2; o <= 2; o++) {
      const bx = x + d[0] * k + a[0] * o, bz = z + d[1] * k + a[1] * o;
      if (at(bx, y, bz) !== PLANKS) return false;
      if (Math.abs(o) <= 1 && !(isAir(at(bx, y + 1, bz)) && isAir(at(bx, y + 2, bz)))) return false;
    }
  }
  return true;
}
// Nearest platform side ahead of A (same reach as findPartner), skipping railing exits. -> { B: {x,y,z}, length, offset, score } or null
export function findSide(at, A) {
  const d = A.dir, ex = [d[1], -d[0]];
  let best = null;
  for (let dist = LOOP.minDist; dist <= LOOP.maxDist; dist++) {
    const length = dist + 1, maxOff = Math.min(LOOP.maxOffset, length - 3);
    for (let lat = -maxOff; lat <= maxOff; lat++) {
      const x = A.x + d[0] * dist + ex[0] * lat, z = A.z + d[1] * dist + ex[1] * lat;
      if (at(x, A.y + 1, z) !== FENCE || exitAt(at, x, A.y, z) || !sideTarget(at, x, A.y, z, d)) continue;
      const score = dist + 3 * Math.abs(lat);
      if (!best || score < best.score) best = { B: { x, y: A.y, z }, length, offset: lat, score };
    }
  }
  return best;
}

// What a marker at exit A does: build / standDown / none (+ reason). Exit-exit first: both exits must pick each other, the smaller
// (x, z) builds. Otherwise (no partner, not mutual, blocked) A joins the nearest platform side by itself (kind "side").
export function decide(at, A) {
  const p = findPartner(at, A);
  let why = "no partner", blockedList = null;
  if (p) {
    const q = findPartner(at, p.B);
    if (!q || !same(q.B, A)) why = "not mutual";
    else if (!before(A, p.B)) return { action: "standDown", partner: p.B };
    else {
      const plan = planBridge(A, p.B, p.length, p.offset);
      const blocked = blockedCells(at, plan);
      if (!blocked.length) return { action: "build", kind: "exit", partner: p.B, plan };
      why = "blocked"; blockedList = blocked;
    }
  }
  const sd = findSide(at, A);
  if (sd) {
    const plan = planBridge(A, sd.B, sd.length, sd.offset, true), blocked = blockedCells(at, plan);
    if (!blocked.length) return { action: "build", kind: "side", partner: sd.B, plan };
    return { action: "none", reason: "blocked", blocked, partner: sd.B };
  }
  if (blockedList) return { action: "none", reason: "blocked", blocked: blockedList, partner: p.B };
  return { action: "none", reason: why };
}

// ---- lanterns: the generator's greedy (tools/village_mallorn.mjs addLanterns) on the bridge alone ---------------------------------
// Light model as in skill 11-structure-lighting: lantern 14, passes through air, void, fences and lanterns, loses 1 per step,
// everything else stops it. Lanterns go on top of rail posts (never in the two end rows) until every walk cell has >= lightTarget.
// -> [[x, y, z]] in shape coordinates.
export function planLanterns(shape) {
  const [W, H, L] = shape.size, k = (x, y, z) => `${x},${y},${z}`;
  const g = new Map();
  for (const c of shape.cells) g.set(k(c.x, c.y, c.z), c.kind === "air" ? "a" : "s");
  for (const r of shape.rails) g.set(k(r.x, r.y, r.z), "f");
  const passes = (x, y, z) => x >= 0 && y >= 0 && z >= 0 && x < W && y < H && z < L && ["a", "f", "l", undefined].includes(g.get(k(x, y, z)));
  const N6 = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
  const lit = (lamps) => {
    const Lv = new Map(), q = [];
    for (const l of lamps) { Lv.set(k(...l), LOOP.lanternLight); q.push(l); }
    for (let i = 0; i < q.length; i++) {
      const [x, y, z] = q[i], v = Lv.get(k(x, y, z));
      if (v <= 1) continue;
      for (const [dx, dy, dz] of N6) {
        const n = [x + dx, y + dy, z + dz];
        if ((Lv.get(k(...n)) ?? 0) >= v - 1 || !passes(...n)) continue;
        Lv.set(k(...n), v - 1); q.push(n);
      }
    }
    return Lv;
  };
  const lamps = [];
  for (let guard = 0; guard < 60; guard++) {
    const Lv = lit(lamps), dark = new Set(shape.walk.filter((c) => (Lv.get(k(...c)) ?? 0) < LOOP.lightTarget).map((c) => k(...c)));
    if (!dark.size) return lamps;
    let best = null, bg = 0;
    for (const r of shape.rails) {
      const p = [r.x, r.y + 1, r.z];
      if (r.z === 0 || r.z === L - 1 || g.get(k(...p)) !== "a") continue;
      const seen = new Map([[k(...p), 0]]), q = [p];
      let n = 0;
      for (let i = 0; i < q.length; i++) {
        const [x, y, z] = q[i], dd = seen.get(k(x, y, z));
        if (dark.has(k(x, y, z))) n++;
        if (dd >= LOOP.lanternLight - LOOP.lightTarget) continue;
        for (const [dx, dy, dz] of N6) { const m = [x + dx, y + dy, z + dz]; if (!seen.has(k(...m)) && passes(...m)) { seen.set(k(...m), dd + 1); q.push(m); } }
      }
      if (n > bg) { bg = n; best = p; }
    }
    if (!best) throw new Error(`planLanterns: cannot light ${dark.size} walk cells`);
    g.set(k(...best), "l"); lamps.push(best);
  }
  throw new Error("planLanterns: no convergence");
}
