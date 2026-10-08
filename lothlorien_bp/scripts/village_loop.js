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
// maxOffset: sideways shift (also <= length - 3, the most bridgeShape supports: one block sideways per block forward).
// Longer spans (maxDist < dist <= maxSpan) are two bridges with a supported 5 x 5 landing in the middle (planSpan): the landing stands on a
// log pier down to the ground (planPier, at most pierMaxDepth blocks, through water to the bottom); maxSpanOffset = sideways shift of the whole span.
export const LOOP = { minDist: 6, maxDist: 17, maxSpan: 30, maxOffset: 5, maxSpanOffset: 8, landing: 5, pierMaxDepth: 48, maxTries: 6, radius: 36, lightTarget: 8, lanternLight: 14 };
export const LOG = "lothlorien:mallorn_log";

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

// Reach of a span of `dist` blocks: sideways shift allowed (a direct bridge: <= length - 3; a span with a landing: maxSpanOffset)
const reach = (dist) => (dist > LOOP.maxDist ? LOOP.maxSpanOffset : Math.min(LOOP.maxOffset, dist + 1 - 3));
// Every cell ahead of A within reach that `accept(x, z)` takes, nearest first (a sideways shift counts 3). offset is the shift along
// ex = (dir.z, -dir.x), the "east" of a bridge drawn by bridgeShape heading south. -> [{ x, z, dist, length, offset, score }]
function scanAhead(A, accept) {
  const d = A.dir, ex = [d[1], -d[0]], out = [];
  for (let dist = LOOP.minDist; dist <= LOOP.maxSpan; dist++) {
    const maxOff = reach(dist);
    for (let lat = -maxOff; lat <= maxOff; lat++) {
      const x = A.x + d[0] * dist + ex[0] * lat, z = A.z + d[1] * dist + ex[1] * lat;
      if (accept(x, z)) out.push({ x, z, dist, length: dist + 1, offset: lat, score: dist + 3 * Math.abs(lat) });
    }
  }
  return out.sort((a, b) => a.score - b.score || a.dist - b.dist);
}

// Best exit facing `A` (opposite direction, same deck height, dist minDist..maxSpan ahead, sideways within reach): nearest first.
// -> { B, length, dist, offset, score } or null.
export function findPartner(at, A) {
  const d = A.dir;
  for (const c of scanAhead(A, (x, z) => at(x, A.y + 1, z) === FENCE)) {
    const B = exitAt(at, c.x, A.y, c.z);
    if (B && B.dir[0] === -d[0] && B.dir[1] === -d[1]) return { B, length: c.length, dist: c.dist, offset: c.offset, score: c.score };
  }
  return null;
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

// A span of `dist` blocks (A -> B, B laterally `lat` off): one arched bridge when dist <= maxDist, otherwise two bridges with a supported
// 5 x 5 landing between them (deck, rim rail, two lanterns; the openings are the bridges' own end rows). Same plan format as planBridge;
// `landing` = { x, y, z (centre deck cell), dir, d1, d2 } and the pier (plan.pier, see planPier) is added by decide().
export function planSpan(A, B, dist, lat, side = false) {
  if (dist <= LOOP.maxDist) return planBridge(A, B, dist + 1, lat, side);
  const d = A.dir, ex = [d[1], -d[0]], N = LOOP.landing, span = N - 1;
  const d1 = Math.floor((dist - span) / 2), d2 = dist - span - d1, l = Math.trunc(lat / 2);
  const cell = (k, o) => ({ x: A.x + d[0] * k + ex[0] * o, y: A.y, z: A.z + d[1] * k + ex[1] * o });
  const p1 = planBridge(A, cell(d1, l), d1 + 1, l, true);
  const p2 = planBridge({ ...cell(d1 + span, l), dir: d }, B, d2 + 1, lat - l, side);
  const cells = [], rails = new Map(), lanterns = [], h = (N - 1) / 2;
  const ring = new Set(), opening = (k, o) => (k === 0 || k === N - 1) && Math.abs(o) <= 1;
  for (let k = 0; k < N; k++) for (let o = -h; o <= h; o++) {
    const c = cell(d1 + k, l + o);
    cells.push({ ...c, kind: "plank", row: d1 + k });
    if (Math.abs(o) <= 1) for (let up = 1; up <= 3; up++) cells.push({ ...c, y: c.y + up, kind: "air", row: d1 + k });
    if ((k === 0 || k === N - 1 || Math.abs(o) === h) && !opening(k, o)) ring.add(`${k},${o}`);
  }
  const addRail = (r) => {
    const key = `${r.x},${r.y},${r.z}`, cur = rails.get(key);
    if (!cur) rails.set(key, { ...r, states: { ...r.states } });
    else for (const [st, v] of Object.entries(r.states)) if (v) cur.states[st] = true;
  };
  for (const key of ring) {
    const [k, o] = key.split(",").map(Number), c = cell(d1 + k, l + o), states = {};
    for (const s4 of ["north", "south", "west", "east"]) states[`minecraft:connection_${s4}`] = false;
    for (const v of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nk = k + v[0] * d[0] + v[1] * d[1], no = o + v[0] * ex[0] + v[1] * ex[1];
      if (ring.has(`${nk},${no}`)) states[`minecraft:connection_${SIDE_OF(v)}`] = true;
    }
    addRail({ ...c, y: c.y + 1, states, row: d1 + k });
  }
  for (const o of [-h, h]) lanterns.push({ ...cell(d1 + Math.floor(N / 2), l + o), y: A.y + 2, row: d1 + Math.floor(N / 2) });
  const shift = (r, n) => ({ ...r, row: r.row + n });
  for (const c of p1.cells) cells.push(c);
  for (const r of p1.rails) addRail(r);
  for (const l1 of p1.lanterns) lanterns.push(l1);
  for (const c of p2.cells) cells.push(shift(c, d1 + span));
  for (const r of p2.rails) addRail(shift(r, d1 + span));
  for (const l2 of p2.lanterns) lanterns.push(shift(l2, d1 + span));
  const c0 = cell(d1 + Math.floor(N / 2), l);
  return { A, B, length: dist + 1, offset: lat, shape: null, cells, rails: [...rails.values()], lanterns, side, landing: { x: c0.x, y: c0.y, z: c0.z, dir: d, d1, d2 }, pier: [] };
}

// The landing's pier: a plus of log columns (centre + 4 arms) from under the deck down to the ground, and four braces (a log laid out under
// the deck, two standing up to its rim) like balcony_braced. Columns pass through air, leaves and water (the pier may stand in a lake: logs
// are fine under water, the same as the balcony's pillar) and stop on the first other block; no ground within pierMaxDepth, lava or an unloaded
// column = { error }. -> { blocks: [{ x, y, z, id, states }] } | { error }
const WET = (n) => n === "minecraft:water" || n === "minecraft:flowing_water" || /seagrass|kelp|bubble_column/.test(n ?? "");
export function planPier(at, L) {
  const free = (n) => isAir(n) || isLeaves(n) || WET(n), logAt = (face) => ({ id: LOG, states: { "minecraft:block_face": face } });
  const blocks = [];
  for (const [dx, dz] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) {
    let y = L.y - 1, depth = 0;
    for (; ; y--, depth++) {
      const n = at(L.x + dx, y, L.z + dz);
      if (n === undefined) return { error: "pier column not loaded" };
      if (n === "minecraft:lava" || n === "minecraft:flowing_lava") return { error: "pier over lava" };
      if (!free(n)) break;
      if (depth >= LOOP.pierMaxDepth) return { error: `no ground within ${LOOP.pierMaxDepth} blocks below the landing` };
      blocks.push({ x: L.x + dx, y, z: L.z + dz, ...logAt("up") });
    }
  }
  for (const s of [1, -1]) {
    const brace = [[s * 2, -3, 0, "east"], [s * 2, -2, 0, "up"], [s * 2, -1, 0, "up"], [0, -3, s * 2, "south"], [0, -2, s * 2, "up"], [0, -1, s * 2, "up"]];
    for (const [dx, dy, dz, face] of brace) if (free(at(L.x + dx, L.y + dy, L.z + dz))) blocks.push({ x: L.x + dx, y: L.y + dy, z: L.z + dz, ...logAt(face) });
  }
  return { blocks };
}

// Everything the bridge writes: Map "x,y,z" -> { id, states? }. Later entries win (rails and lanterns replace headroom air).
export function finalBlocks(plan) {
  const out = new Map(), k = (c) => `${c.x},${c.y},${c.z}`;
  const KIND = { plank: { id: PLANKS }, slab_bottom: { id: SLAB, states: { "minecraft:vertical_half": "bottom" } }, slab_top: { id: SLAB, states: { "minecraft:vertical_half": "top" } }, air: { id: "minecraft:air" } };
  for (const c of plan.cells) out.set(k(c), KIND[c.kind]);
  for (const b of plan.pier ?? []) out.set(k(b), { id: b.id, states: b.states });
  for (const r of plan.rails) out.set(k(r), { id: FENCE, states: r.states });
  for (const l of plan.lanterns) out.set(k(l), { id: LANTERN, states: { "minecraft:block_face": "up" } });
  return out;
}

// Cells of the bridge that cannot be built over: anything but air or leaves (the end rows may hold the railing's own planks and fences).
export function blockedCells(at, plan) {
  const bad = [], last = plan.length - 1;
  for (const c of [...plan.cells, ...plan.rails]) {
    const n = at(c.x, c.y, c.z);
    const own = (c.row === 0 || c.row === last) && (n === PLANKS || n === FENCE || n === LANTERN); // an end row's own railing (a rim post may carry a lantern)
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
// Platform sides ahead of A (same reach as findPartner), skipping railing exits, nearest first.
// -> [{ B: {x,y,z}, length, dist, offset, score }]; findSide = the first
export function findSides(at, A) {
  const d = A.dir;
  return scanAhead(A, (x, z) => at(x, A.y + 1, z) === FENCE && !exitAt(at, x, A.y, z) && sideTarget(at, x, A.y, z, d))
    .map((c) => ({ B: { x: c.x, y: A.y, z: c.z }, length: c.length, dist: c.dist, offset: c.offset, score: c.score }));
}
export const findSide = (at, A) => findSides(at, A)[0] ?? null;

// What a marker at exit A does: build / standDown / none (+ reason). Exit-exit first: both exits must pick each other, the smaller
// (x, z) builds (opts.hasMarker(B) = false: the partner has no marker, e.g. a balcony of an older world, so A builds). Otherwise
// (no partner, not mutual, blocked) A joins the nearest buildable platform side by itself (kind "side"). A span with a landing also needs a
// pier down to the ground (planPier); a corridor or pier that cannot be built moves on to the next target.
export function decide(at, A, opts = {}) {
  const hasMarker = opts.hasMarker ?? (() => true);
  const p = findPartner(at, A);
  let why = "no partner", blockedList = null, partner = null;
  const tryPlan = (B, dist, offset, side) => {
    const plan = planSpan(A, B, dist, offset, side), blocked = blockedCells(at, plan);
    if (blocked.length) return { blocked };
    if (plan.landing) {
      const pier = planPier(at, plan.landing);
      if (pier.error) return { error: pier.error };
      plan.pier = pier.blocks;
    }
    return { plan };
  };
  if (p) {
    const q = findPartner(at, p.B);
    if (!q || !same(q.B, A)) why = "not mutual";
    else if (!before(A, p.B) && hasMarker(p.B)) return { action: "standDown", partner: p.B };
    else {
      const r = tryPlan(p.B, p.dist, p.offset, false);
      if (r.plan) return { action: "build", kind: "exit", partner: p.B, plan: r.plan };
      why = r.error ?? "blocked"; blockedList = r.blocked ?? null; partner = p.B;
    }
  }
  let sideFail = null;
  for (const sd of findSides(at, A)) {
    const r = tryPlan(sd.B, sd.dist, sd.offset, true);
    if (r.plan) return { action: "build", kind: "side", partner: sd.B, plan: r.plan };
    sideFail ??= { ...r, partner: sd.B };
  }
  const f = sideFail ?? (blockedList ? { blocked: blockedList, partner } : why !== "no partner" && why !== "not mutual" ? { error: why, partner } : null);
  if (f?.blocked) return { action: "none", reason: "blocked", blocked: f.blocked, partner: f.partner };
  if (f?.error) return { action: "none", reason: f.error, partner: f.partner };
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
