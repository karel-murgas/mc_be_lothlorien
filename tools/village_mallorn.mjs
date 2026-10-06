// Geometry for the Elven village jigsaw pieces (see temp/elven_village/PLAN.md, connector standard):
// the deck helper (plank deck, fence rails, headroom air, jigsaw connectors) and the village Mallorn
// (round trunk, plank platform at FLOOR_H, crown above the deck). Pure: build_village.mjs writes the files.
//
// Tree-piece coordinates: trunk centre (0,0), y 0 = the first block above nominal ground, roots down to -ROOTS.
// The box is (2*half+1) wide, so toMcstructure offset = [half, ROOTS, half].
import { makeBuilder, makeRandom, DIRS8 } from "../lothlorien_bp/scripts/mallorn_tree.js";
import { B, trimFarLeaves } from "./flet_mallorn.mjs";

export const ROOTS = 10;
export const FLOOR_H = 16;
export const DECK_NAME = "lothlorien:village_deck";
export const ANCHOR_NAME = "lothlorien:village_anchor";
export const LANTERN = "lothlorien:elven_lantern";
// facing_direction ids: 0 down, 1 up, 2 north (-z), 3 south (+z), 4 west (-x), 5 east (+x)
export const FACING = { north: { d: [0, -1], id: 2 }, south: { d: [0, 1], id: 3 }, west: { d: [-1, 0], id: 4 }, east: { d: [1, 0], id: 5 } };
export const key = (x, y, z) => `${x},${y},${z}`;
const AIR = { name: "minecraft:air", states: {} };
const planks = () => ({ name: B.planks, states: {} });

export const deckJigsaw = (facing, pool) => ({
  name: "minecraft:jigsaw", states: { facing_direction: FACING[facing].id, rotation: 0 },
  jigsaw: DECK_NAME, jigsawTarget: DECK_NAME, jigsawPool: pool, joint: "aligned", finalState: B.planks,
});
export const anchorJigsaw = () => ({
  name: "minecraft:jigsaw", states: { facing_direction: 0, rotation: 0 }, jigsaw: ANCHOR_NAME, finalState: B.log,
});
export const lantern = () => ({ name: LANTERN, states: { "minecraft:block_face": "up" } });

// A deck layer at height y over a footprint, with its connectors. Cells are "x,z" strings in piece coordinates.
export class Deck {
  constructor(blocks, y, { half, R = 0, inner = new Set() }) {
    Object.assign(this, { blocks, y, half, R, inner });
    this.floor = new Set(); // round platform cells (without the inner cells: trunk, rope hole)
    this.rim = new Set();
    this.fences = new Set(); // fence cells of the rail layer (y + 1)
    this.forced = new Map(); // fence cell -> sides that connect to something outside the piece
    this.connectors = []; // { x, z, facing }
    this.air = new Set();
  }
  // round platform of radius R around (0,0)
  platform() {
    const span = Math.ceil(this.R) + 1;
    for (let x = -span; x <= span; x++) for (let z = -span; z <= span; z++) {
      if (Math.hypot(x, z) <= this.R && !this.inner.has(`${x},${z}`)) this.floor.add(`${x},${z}`);
    }
    for (const c of this.floor) {
      const [x, z] = c.split(",").map(Number);
      if (FACING_ALL8.some(([dx, dz]) => !this.floor.has(`${x + dx},${z + dz}`) && !this.inner.has(`${x + dx},${z + dz}`))) this.rim.add(c);
    }
  }
  // 5-wide walkway (3 walk cells, rails at +-2) from the platform to the box face, connector in the middle of the face
  walkway(facing, pool) {
    const { d } = FACING[facing];
    const p = [-d[1], d[0]];
    const aMin = Math.max(0, Math.ceil(this.R) - 2);
    for (let a = this.half; a >= aMin; a--) {
      for (let c = -2; c <= 2; c++) {
        const x = d[0] * a + p[0] * c, z = d[1] * a + p[1] * c;
        const k = `${x},${z}`;
        if (this.inner.has(k)) continue;
        this.floor.add(k);
        if (Math.abs(c) <= 1) { this.rim.delete(k); this.air.add(k); }
        else if (!this.isDisk(x, z)) {
          this.fences.add(k);
          if (a === this.half) this.forced.set(k, [facing]);
        }
      }
    }
    this.connectors.push({ x: d[0] * this.half, z: d[1] * this.half, facing, pool });
  }
  isDisk(x, z) { return Math.hypot(x, z) <= this.R; }
  // writes planks, headroom, fences and jigsaws (call after the tree is in blocks)
  finish() {
    const { blocks, y } = this;
    for (const k of this.floor) {
      const [x, z] = k.split(",").map(Number);
      for (let h = 1; h <= 3; h++) blocks.set(key(x, y + h, z), AIR);
      blocks.set(key(x, y, z), planks());
    }
    for (const k of this.rim) this.fences.add(k);
    for (const k of this.rim) { const [x, z] = k.split(",").map(Number); blocks.set(key(x, y + 1, z), AIR); }
    writeFences(blocks, y + 1, this.fences, this.forced);
    for (const c of this.connectors) blocks.set(key(c.x, y, c.z), deckJigsaw(c.facing, c.pool));
  }
}

const FACING_ALL8 = DIRS8;

// fence blocks (state minecraft:connection_<side>: true when the neighbour cell holds a fence or forced)
export function writeFences(blocks, y, fences, forced = new Map()) {
  for (const k of fences) {
    const [x, z] = k.split(",").map(Number);
    const states = {};
    for (const [side, { d }] of Object.entries(FACING)) {
      states[`minecraft:connection_${side}`] = fences.has(`${x + d[0]},${z + d[1]}`) || (forced.get(k) ?? []).includes(side);
    }
    blocks.set(key(x, y, z), { name: B.fence, states });
  }
}
export const lonelyFence = () => ({
  name: B.fence, states: { "minecraft:connection_north": false, "minecraft:connection_south": false, "minecraft:connection_west": false, "minecraft:connection_east": false },
});

const PLUS = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]];
const ROUND5 = (() => { const c = []; for (let x = -2; x <= 2; x++) for (let z = -2; z <= 2; z++) if (!(Math.abs(x) === 2 && Math.abs(z) === 2)) c.push([x, z]); return c; })();
const leafBlock = () => ({ name: B.leaves, states: { "lothlorien:persistent": false } });

// Village Mallorn piece: trunk, crown above the deck, platform at FLOOR_H, walkways to the connectors.
// opts: half, R (platform radius), big (5x5 round trunk, else 3x3 round), topY (trunk top, tree coords), seed,
// connectors [facing...], pool (connector target pool), rope (Elven rope column), anchor (start jigsaw), rimLamps
export function buildVillageTree({ half, R, big, topY, seed, connectors, pool, rope = false, anchor = false, rimLamps = 0, crown = 8 }) {
  const random = makeRandom(seed);
  const b = makeBuilder(random);
  const deckY = FLOOR_H;
  const shape = big ? ROUND5 : PLUS;
  const rT = big ? 2 : 1;
  const isTrunk = (x, z) => shape.some(([a, c]) => a === x && c === z);
  const ropeAt = rope ? { x: 0, z: -(rT + 1) } : null;
  const inner = new Set(shape.map(([x, z]) => `${x},${z}`));
  if (ropeAt) inner.add(`${ropeAt.x},${ropeAt.z}`);

  // trunk (narrows near the top) sunk ROOTS into the ground
  for (let y = -ROOTS; y < topY; y++) {
    const cells = big ? (y < topY - 8 ? ROUND5 : y < topY - 4 ? PLUS : [[0, 0]]) : (y < topY - 4 ? PLUS : [[0, 0]]);
    for (const [x, z] of cells) b.addLog(x, y, z, "up");
  }
  for (let y = topY; y < topY + 3; y++) b.addLog(0, y, 0, "up");

  // foot: bark flare round the trunk (not at the rope), logs down to the roots
  const frng = makeRandom(seed ^ 0x51ed);
  for (let x = -rT - 2; x <= rT + 2; x++) for (let z = -rT - 2; z <= rT + 2; z++) {
    if (isTrunk(x, z) || Math.hypot(x, z) > rT + 1.3) continue;
    if (ropeAt && Math.abs(x - ropeAt.x) <= 1 && z <= ropeAt.z + 0 && z >= ropeAt.z - 1) continue;
    if (frng() < 0.75) {
      const high = frng() < 0.45 ? 2 : 1;
      for (let y = -ROOTS; y < 0; y++) b.addLog(x, y, z, "up");
      for (let y = 0; y < high; y++) b.addLog(x, y, z, "wood");
    }
  }

  // under the deck: woven support branches (diagonals, never on the walkway axes) with hanging leaves; low branches
  const platformR = R;
  const lenW = Math.round(platformR * 1.2);
  for (const [dx, dz] of DIRS8.slice(4)) {
    let x = dx * rT, z = 0;
    for (let i = 1; i <= lenW; i++) {
      if (i % 2 === 1) x += dx; else z += dz;
      b.addLog(x, deckY, z, i % 2 === 1 ? "east" : "south");
    }
    b.blob(x, deckY - 1, z, 2.4 + random() * 0.6, 1.8, deckY - 5, 0.7);
  }
  for (let i = 0, n = 3 + Math.floor(random() * 2); i < n; i++) {
    const [dx, dz] = DIRS8[Math.floor(random() * 8)];
    const sx = dx !== 0 ? dx * rT : 0, sz = dx !== 0 ? 0 : dz * rT;
    b.branch(sx, sz, dx, dz, b.between([5, deckY - 6]), b.between([3, 6]), 0, 2.0 + random() * 0.6);
  }

  // crown above the deck: rising branches inside the box, blobs, cap
  const lenMax = half - 6;
  const dirs = b.shuffled();
  for (let i = 0; i < crown; i++) {
    const [dx, dz] = dirs[i % 8];
    const sx = dx !== 0 ? dx * rT : 0, sz = dx !== 0 ? 0 : dz * rT;
    b.branch(sx, sz, dx, dz, b.between([deckY + 4, topY - 4]), b.between([4, lenMax]), 0.45, 2.4 + random() * (big ? 1.2 : 0.6));
  }
  b.blob(0, topY - 1, 0, big ? 7 : 5.2, 3.5, deckY + 5, 1.0);
  b.blob(0, topY + 3, 0, big ? 5.5 : 4.2, 3.5, topY, 0.8);

  const tree = b.result(topY + 3);
  const blocks = new Map();
  for (const c of tree.leaves) blocks.set(key(c.x, c.y, c.z), leafBlock());
  for (const c of tree.logs) {
    blocks.set(key(c.x, c.y, c.z), c.face === "wood" ? { name: B.wood, states: {} } : { name: B.log, states: { "minecraft:block_face": c.face } });
  }

  // deck layout (platform, walkways) first, so the leaf clearance knows the corridors
  const deck = new Deck(blocks, deckY, { half, R, inner });
  deck.platform();
  for (const f of connectors) deck.walkway(f, pool);

  // leaves: inside the box, off the deck, out of the headroom, the corridors and the rope column
  for (const [k, v] of [...blocks]) {
    if (v.name !== B.leaves) continue;
    const [x, y, z] = k.split(",").map(Number);
    let drop = Math.abs(x) > half - 1 || Math.abs(z) > half - 1;
    if (y >= deckY && y <= deckY + 3) {
      if (Math.hypot(x, z) <= R + 1.5) drop = true;
      for (const f of connectors) {
        const { d } = FACING[f], p = [-d[1], d[0]];
        const a = x * d[0] + z * d[1], c = x * p[0] + z * p[1];
        if (a >= R - 3 && Math.abs(c) <= 3) drop = true;
      }
    }
    if (drop) blocks.delete(k);
  }
  if (ropeAt) {
    for (let y = 0; y <= deckY + 3; y++) for (const z of [ropeAt.z, ropeAt.z - 1]) blocks.delete(key(ropeAt.x, y, z));
  }
  trimFarLeaves(blocks);

  deck.finish();
  if (ropeAt) {
    for (let y = 0; y <= deckY; y++) blocks.set(key(ropeAt.x, y, ropeAt.z), { name: B.rope, states: { "lothlorien:face": "north" } });
    for (let h = 1; h <= 3; h++) blocks.set(key(ropeAt.x, deckY + h, ropeAt.z), AIR);
  }
  // lanterns standing on the deck beside the trunk (diagonals, off the walkways), and on rim posts
  for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    const o = rT + 1;
    blocks.set(key(sx * o, deckY + 1, sz * o), lantern());
  }
  if (rimLamps) {
    const rim = [...deck.rim].map((k) => k.split(",").map(Number));
    for (let i = 0; i < rimLamps; i++) {
      const ang = ((i + 0.5) * 2 * Math.PI) / rimLamps;
      let best = null, bd = 9;
      for (const [x, z] of rim) {
        const da = Math.abs(Math.atan2(Math.sin(Math.atan2(z, x) - ang), Math.cos(Math.atan2(z, x) - ang)));
        if (da < bd) { bd = da; best = [x, z]; }
      }
      if (best) blocks.set(key(best[0], deckY + 2, best[1]), lantern());
    }
  }
  if (anchor) blocks.set(key(0, -ROOTS, 0), anchorJigsaw());
  return { blocks, deck, topY: topY + 3 };
}
