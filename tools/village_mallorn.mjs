// Geometry for the Elven village jigsaw pieces (see temp/elven_village/PLAN.md, R3 spec and connector standard):
// platform decks with rim connectors, the one-and-only rail block, slab arches, the slab spiral stair, crown pieces.
// Pure: build_village.mjs writes the files.
//
// Tree-piece coordinates: trunk centre (0,0), y 0 = the first block above the nominal ground, roots down to -ROOTS.
// The box is (2*hx+1) x (2*hz+1), so toMcstructure offset = [hx, ROOTS, hz].
import { makeBuilder, makeRandom, DIRS8 } from "../lothlorien_bp/scripts/mallorn_tree.js";
import { B, trimFarLeaves } from "./flet_mallorn.mjs";

export const ROOTS = 18; // trunks and pillars reach this far below the nominal ground (levels up to +16 still reach the ground)
export const FLOOR_H = 16; // lower deck above the nominal ground
export const LEVEL_H = 8; // upper deck of a two-level node above its lower deck
export const CROWN_AT = 5; // the crown jigsaw sits CROWN_AT layers above the highest deck: crown box starts at deck + 6,
//                            above the headroom (3) and the top of the highest arch box (rise 2: deck + 5)
export const DECK_NAME = "lothlorien:village_deck";
export const DECK_HI_NAME = "lothlorien:village_deck_hi"; // upper-level connectors of two-level nodes: parent role only
export const CROWN_NAME = "lothlorien:village_crown";
export const ANCHOR_NAME = "lothlorien:village_anchor";
export const LANTERN = "lothlorien:elven_lantern";
export const SLAB = "lothlorien:mallorn_slab";
// THE rail block of every walkway, platform, balcony and plug. The engine drops some fence links when it places a
// structure (cause: engine, not the templates), so the owner may pick another rail block: change it here only.
// writeRails() stores `minecraft:connection_*` states, which only fence-like blocks have.
export const RAIL = B.fence;
// facing_direction ids: 0 down, 1 up, 2 north (-z), 3 south (+z), 4 west (-x), 5 east (+x)
export const FACING = { north: { d: [0, -1], id: 2 }, south: { d: [0, 1], id: 3 }, west: { d: [-1, 0], id: 4 }, east: { d: [1, 0], id: 5 } };
export const key = (x, y, z) => `${x},${y},${z}`;
export const AIR = { name: "minecraft:air", states: {} };
export const planks = () => ({ name: B.planks, states: {} });
export const slab = (half = "bottom") => ({ name: SLAB, states: { "minecraft:vertical_half": half } });
const logBlock = (face = "up") => ({ name: B.log, states: { "minecraft:block_face": face } });

export const deckJigsaw = (facing, pool, name = DECK_NAME) => ({
  name: "minecraft:jigsaw", states: { facing_direction: FACING[facing].id, rotation: 0 },
  jigsaw: name, jigsawTarget: DECK_NAME, jigsawPool: pool, joint: "aligned", finalState: B.planks,
});
// The trunk becomes a log where the two jigsaws meet. The plain id gives the default block_face (down), which is the
// vertical axis like `up` (the log's permutations treat both alike), so no state string is needed.
export const crownUpJigsaw = (pool) => ({
  name: "minecraft:jigsaw", states: { facing_direction: 1, rotation: 0 },
  jigsaw: CROWN_NAME, jigsawTarget: CROWN_NAME, jigsawPool: pool, joint: "rollable", finalState: B.log,
});
export const crownDownJigsaw = () => ({
  name: "minecraft:jigsaw", states: { facing_direction: 0, rotation: 0 },
  jigsaw: CROWN_NAME, jigsawTarget: CROWN_NAME, jigsawPool: "minecraft:empty", joint: "rollable", finalState: B.log,
});
export const anchorJigsaw = () => ({
  name: "minecraft:jigsaw", states: { facing_direction: 0, rotation: 0 }, jigsaw: ANCHOR_NAME, finalState: B.log,
});
export const lantern = () => ({ name: LANTERN, states: { "minecraft:block_face": "up" } });
export const lonelyRail = () => ({
  name: RAIL, states: { "minecraft:connection_north": false, "minecraft:connection_south": false, "minecraft:connection_west": false, "minecraft:connection_east": false },
});

// rails: Set of "x,y,z"; forced: Map "x,y,z" -> sides that link to a rail outside the piece
export function writeRails(blocks, rails, forced = new Map()) {
  for (const k of rails) {
    const [x, y, z] = k.split(",").map(Number);
    const states = {};
    for (const [side, { d }] of Object.entries(FACING)) {
      states[`minecraft:connection_${side}`] = rails.has(key(x + d[0], y, z + d[1])) || (forced.get(k) ?? []).includes(side);
    }
    blocks.set(k, { name: RAIL, states });
  }
}

// ---- platform shapes --------------------------------------------------------------------------------------------
// A shape is an array of half-widths: rows[|z|] = half-width in x at that |z|. Outlines are rectilinear (straight runs and
// square corners, runs of >= 2 cells), never a diagonal staircase of single cells.
export const SHAPES = {
  cutrect13: [6, 6, 6, 6, 4, 4], // 13 x 11, corners cut 2 x 2
  cutrect11: [5, 5, 5, 5, 3, 3], // 11 x 11
  cutrect17: [8, 8, 8, 8, 6, 6], // 17 x 11
  octagon15: [7, 7, 7, 7, 5, 5, 3, 3], // 15 x 15, two 2-cell steps per corner
  plus15: [7, 7, 7, 7, 3, 3, 3, 3], // 15 x 15, arms 7 wide
  oval17: [8, 8, 8, 6, 6, 4, 4], // 17 x 13, ends 5 wide
  octagon21: [10, 10, 10, 10, 10, 10, 8, 8, 6, 6, 6], // central, 21 x 21
  lookout9: [4, 4, 4, 2, 2], // 9 x 9
};
export const shapeCells = (rows) => {
  const s = new Set(), hz = rows.length - 1;
  for (let z = -hz; z <= hz; z++) for (let x = -rows[Math.abs(z)]; x <= rows[Math.abs(z)]; x++) s.add(`${x},${z}`);
  return s;
};
// the straight run on the outer face of a shape in direction `facing`: { a: distance of the face, lo, hi: offsets along the face }
export function faceRun(cells, facing) {
  const { d } = FACING[facing], p = [-d[1], d[0]];
  let a = -1e9, lo = 1e9, hi = -1e9;
  for (const c of cells) { const [x, z] = c.split(",").map(Number); a = Math.max(a, x * d[0] + z * d[1]); }
  for (const c of cells) {
    const [x, z] = c.split(",").map(Number);
    if (x * d[0] + z * d[1] !== a) continue;
    const o = x * p[0] + z * p[1]; lo = Math.min(lo, o); hi = Math.max(hi, o);
  }
  return { a, lo, hi };
}

const N8 = DIRS8;
// A deck layer at height y over a shape. Connectors sit on the rim cells of the box face (no stub walkways):
// deck under 5 cells, 3 walk cells (headroom air), rails at +-2.
export class Deck {
  constructor(blocks, y, rows, { box, inner = new Set(), holes = new Set(), noRail = new Set(), cells = null }) {
    Object.assign(this, { blocks, y, rows, box, inner, holes, noRail });
    this.cells = cells ?? shapeCells(rows);
    this.connectors = []; // { x, z, facing, pool, name }
  }
  connect(facing, off, pool, name = DECK_NAME) {
    const { d } = FACING[facing], p = [-d[1], d[0]];
    const run = faceRun(this.cells, facing), half = d[0] ? this.box.hx : this.box.hz;
    if (run.a !== half) throw new Error(`${facing} face of the deck is not on the box face (${run.a} vs ${half})`);
    if (off - 2 < run.lo || off + 2 > run.hi) throw new Error(`${facing} connector offset ${off} does not fit the face run ${run.lo}..${run.hi}`);
    this.connectors.push({ x: d[0] * half + p[0] * off, z: d[1] * half + p[1] * off, facing, off, pool, name, p, d });
  }
  // writes planks, headroom air and jigsaws; returns the rails { rails: Set "x,y,z", forced: Map }
  build() {
    const { blocks, y } = this;
    const floor = new Set([...this.cells].filter((c) => !this.inner.has(c) && !this.holes.has(c)));
    const occupied = (x, z) => floor.has(`${x},${z}`) || this.inner.has(`${x},${z}`);
    const rim = new Set();
    for (const c of floor) {
      const [x, z] = c.split(",").map(Number);
      if (N8.some(([dx, dz]) => !occupied(x + dx, z + dz))) rim.add(c);
    }
    const forced = new Map();
    for (const c of this.connectors) {
      for (let o = -1; o <= 1; o++) rim.delete(`${c.x + c.p[0] * o},${c.z + c.p[1] * o}`);
      for (const o of [-2, 2]) {
        const k = `${c.x + c.p[0] * o},${c.z + c.p[1] * o}`;
        if (!floor.has(k)) throw new Error(`connector ${c.facing} rail cell ${k} is not deck`);
        rim.add(k);
        const [fx, fz] = k.split(",").map(Number);
        forced.set(key(fx, y + 1, fz), [c.facing]);
      }
    }
    for (const k of this.noRail) rim.delete(k);
    for (const k of floor) {
      const [x, z] = k.split(",").map(Number);
      for (let h = 1; h <= 3; h++) blocks.set(key(x, y + h, z), AIR);
      blocks.set(key(x, y, z), planks());
    }
    const rails = new Set();
    for (const k of rim) { const [x, z] = k.split(",").map(Number); rails.add(key(x, y + 1, z)); }
    for (const c of this.connectors) blocks.set(key(c.x, y, c.z), deckJigsaw(c.facing, c.pool, c.name));
    this.floor = floor; this.rim = rim;
    return { rails, forced };
  }
}

// ---- trees --------------------------------------------------------------------------------------------------------
const PLUS = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]];
const ROUND5 = (() => { const c = []; for (let x = -2; x <= 2; x++) for (let z = -2; z <= 2; z++) if (!(Math.abs(x) === 2 && Math.abs(z) === 2)) c.push([x, z]); return c; })();
const SQUARE3 = (() => { const c = []; for (let x = -1; x <= 1; x++) for (let z = -1; z <= 1; z++) c.push([x, z]); return c; })();
const TRUNKS = { plus: { cells: PLUS, r: 1 }, square3: { cells: SQUARE3, r: 1 }, round5: { cells: ROUND5, r: 2 } };
const leafBlock = () => ({ name: B.leaves, states: { "lothlorien:persistent": false } });
export const RING = (() => { // the 16 cells around the 3x3 trunk, clockwise from the NW corner
  const r = [];
  for (let x = -2; x <= 2; x++) r.push([x, -2]);
  for (let z = -1; z <= 2; z++) r.push([2, z]);
  for (let x = 1; x >= -2; x--) r.push([x, 2]);
  for (let z = 1; z >= -1; z--) r.push([-2, z]);
  return r;
})();
// stair cell i: walking surface 3 + i half-blocks above the lower deck's block bottom (deck surface = 2): planks on even
// surfaces, a bottom slab on odd ones; one half-step (0.5 block, steppable without jumping) per cell
export const stairLayer = (i) => { const s = 3 + i; return s % 2 === 0 ? (s - 2) / 2 : (s - 1) / 2; };
export const STAIR_CUT = [9, 10, 11, 12, 13]; // ring cells whose headroom would reach the upper deck: the deck is cut there

// opts: name-free tree builder.
//   levels: [{ rows, conn: [{ facing, off, hi? }], clip?: (x, z) => remove this cell }] one entry (single level) or two (lower, upper at +LEVEL_H, slab stair)
//   trunk: "plus" | "square3" | "round5"; seed; upPool (pool of the crown jigsaw); rope; anchor; lamps (rim lanterns)
export function buildTree({ levels, trunk = "plus", seed, pool, upPool, rope = false, anchor = false, lamps = 0, diagLamps = true }) {
  const random = makeRandom(seed), b = makeBuilder(random);
  const tk = TRUNKS[trunk], rT = tk.r, two = levels.length === 2;
  const D = FLOOR_H, topY = two ? D + LEVEL_H : D; // y of the highest deck
  const hx = Math.max(...levels.flatMap((l) => l.rows)), hz = Math.max(...levels.map((l) => l.rows.length - 1));
  const box = { hx, hz };
  const inner = new Set(tk.cells.map(([x, z]) => `${x},${z}`));
  const ropeAt = rope ? { x: 0, z: -(rT + 1) } : null;
  if (ropeAt) inner.add(`${ropeAt.x},${ropeAt.z}`);
  const isTrunk = (x, z) => tk.cells.some(([a, c]) => a === x && c === z);

  // trunk sunk ROOTS into the ground; a round 5x5 trunk narrows right under the crown jigsaw
  for (let y = -ROOTS; y <= topY + 3; y++) {
    const cells = trunk === "round5" && y > D + 1 ? PLUS : tk.cells;
    for (const [x, z] of cells) b.addLog(x, y, z, "up");
  }
  b.addLog(0, topY + 4, 0, "up");

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
  // under each deck: woven struts one layer below it (diagonals, never on the walkway axes) with hanging leaves; low branches
  const decks = two ? [D, D + LEVEL_H] : [D];
  const lenW = Math.round(Math.min(hx, hz) * 0.9);
  for (const Y of decks) for (const [dx, dz] of DIRS8.slice(4)) {
    let x = dx * rT, z = 0;
    for (let i = 1; i <= lenW; i++) {
      if (i % 2 === 1) x += dx; else z += dz;
      b.addLog(x, Y - 1, z, i % 2 === 1 ? "east" : "south");
    }
    b.blob(x, Y - 2, z, 2.4 + random() * 0.6, 1.8, Y - 6, 0.7);
  }
  for (let i = 0, n = 3 + Math.floor(random() * 2); i < n; i++) {
    const [dx, dz] = DIRS8[Math.floor(random() * 8)];
    const sx = dx !== 0 ? dx * rT : 0, sz = dx !== 0 ? 0 : dz * rT;
    b.branch(sx, sz, dx, dz, b.between([5, D - 6]), b.between([3, Math.max(3, Math.min(hx, hz) - 3)]), 0, 2.0 + random() * 0.6);
  }
  const tree = b.result(topY + 4);
  const blocks = new Map();
  for (const c of tree.leaves) blocks.set(key(c.x, c.y, c.z), leafBlock());
  for (const c of tree.logs) blocks.set(key(c.x, c.y, c.z), c.face === "wood" ? { name: B.wood, states: {} } : logBlock(c.face));
  // leaves: inside the box, under the highest deck
  for (const [k, v] of [...blocks]) {
    if (v.name !== B.leaves) continue;
    const [x, y, z] = k.split(",").map(Number);
    if (Math.abs(x) > hx || Math.abs(z) > hz || y >= topY) blocks.delete(k);
  }
  for (const [k, v] of [...blocks]) { // logs inside the box too
    const [x, , z] = k.split(",").map(Number);
    if (v.name !== B.leaves && (Math.abs(x) > hx || Math.abs(z) > hz)) blocks.delete(k);
  }

  // decks
  const stairHoles = new Set(), noRail = new Set();
  if (two) {
    for (const i of STAIR_CUT) stairHoles.add(RING[i].join(","));
    for (const i of [14, 15]) noRail.add(RING[i].join(","));
    noRail.add("-3,-1"); noRail.add("-3,0"); // the exit onto the upper deck stays open
  }
  const deckObjs = levels.map((lv, i) => new Deck(blocks, i === 0 ? D : D + LEVEL_H, lv.rows, {
    box, inner, holes: i === 1 ? stairHoles : new Set(), noRail: i === 1 ? noRail : new Set(),
    cells: lv.clip ? new Set([...shapeCells(lv.rows)].filter((c) => !lv.clip(...c.split(",").map(Number)))) : null,
  }));
  levels.forEach((lv, i) => lv.conn.forEach((c) => deckObjs[i].connect(c.facing, c.off, pool, c.hi ? DECK_HI_NAME : DECK_NAME)));
  if (ropeAt) for (let y = 0; y <= D + 3; y++) for (const z of [ropeAt.z, ropeAt.z - 1]) blocks.delete(key(ropeAt.x, y, z));
  const rails = new Set(), forced = new Map();
  for (const dk of deckObjs) { const r = dk.build(); r.rails.forEach((k) => rails.add(k)); r.forced.forEach((v, k) => forced.set(k, v)); }

  // slab spiral stair in the ring round the trunk
  if (two) {
    RING.forEach(([x, z], i) => {
      const L = stairLayer(i), s = 3 + i;
      blocks.set(key(x, D + L, z), s % 2 === 0 ? planks() : slab("bottom"));
      for (let h = 1; h <= 3; h++) blocks.set(key(x, D + L + h, z), AIR);
    });
    const ringSet = new Set(RING.map((c) => c.join(",")));
    const addRail = (x, z, L) => {
      let y = D + L + 1;
      if (blocks.has(key(x, y, z)) && blocks.get(key(x, y, z)).name !== "minecraft:air") y -= 1; // the upper deck is in the way
      rails.add(key(x, y, z));
    };
    for (let i = 3; i <= 13; i++) {
      const [x, z] = RING[i], L = stairLayer(i);
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, nz = z + dz;
        if (ringSet.has(`${nx},${nz}`) || (Math.abs(nx) <= 1 && Math.abs(nz) <= 1)) continue;
        addRail(nx, nz, L);
      }
      if (Math.abs(x) === 2 && Math.abs(z) === 2) addRail(x * 1.5, z * 1.5, L); // outer corner post (3,3)
    }
  }
  writeRails(blocks, rails, forced);

  if (ropeAt) {
    for (let y = 0; y <= D; y++) blocks.set(key(ropeAt.x, y, ropeAt.z), { name: B.ropeHanging, states: { "minecraft:cardinal_direction": "north" } });
    for (let h = 1; h <= 3; h++) blocks.set(key(ropeAt.x, D + h, ropeAt.z), AIR);
  }
  // LAST clearing step done: now drop every leaf that has no path <= 8 to a log (leaf decay in game breaks the rest)
  trimFarLeaves(blocks);
  // lanterns: on the deck beside the trunk (diagonals), and on rim posts away from the connectors
  if (diagLamps && !two) for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) blocks.set(key(sx * (rT + 1), D + 1, sz * (rT + 1)), lantern());
  if (lamps) {
    const rim = [...deckObjs[0].rim].map((k) => k.split(",").map(Number)).filter(([x, z]) =>
      deckObjs[0].connectors.every((c) => Math.max(Math.abs(c.x - x), Math.abs(c.z - z)) > 4));
    for (let i = 0; i < lamps && rim.length; i++) {
      const ang = ((i + 0.5) * 2 * Math.PI) / lamps + 0.3;
      let best = null, bd = 9;
      for (const [x, z] of rim) {
        const da = Math.abs(Math.atan2(Math.sin(Math.atan2(z, x) - ang), Math.cos(Math.atan2(z, x) - ang)));
        if (da < bd) { bd = da; best = [x, z]; }
      }
      if (best) blocks.set(key(best[0], D + 2, best[1]), lantern());
    }
  }
  if (anchor) blocks.set(key(0, -ROOTS, 0), anchorJigsaw());
  blocks.set(key(0, topY + CROWN_AT, 0), crownUpJigsaw(upPool));
  const connectors = deckObjs.flatMap((dk) => dk.connectors.map((c) => ({ ...c, y: dk.y })));
  return { blocks, connectors, box, topY, size: [2 * hx + 1, ROOTS + topY + CROWN_AT + 1, 2 * hz + 1], origin: [hx, ROOTS, hz] };
}

// ---- crown piece: trunk continues from the jigsaw upward, branches, leaves, all inside the box ------------------------
// local coords: jigsaw at (0,0,0) = box layer 0 centre. opts: h (half width), H (height), seed, branches, blob
export function buildCrown({ h, H, seed, branches, blob }) {
  const random = makeRandom(seed), b = makeBuilder(random);
  for (let y = 1; y <= H - 4; y++) b.addLog(0, y, 0, "up");
  const dirs = b.shuffled();
  for (let i = 0; i < branches; i++) {
    const [dx, dz] = dirs[i % 8];
    b.branch(0, 0, dx, dz, b.between([3, Math.max(4, H - 12)]), b.between([Math.max(2, h - 6), Math.max(3, h - 4)]), 0.45, blob + random() * 0.5);
  }
  b.blob(0, H - 6, 0, Math.min(h - 0.5, blob + 2.6), Math.min(4, H / 4), 3, 1.0);
  b.blob(0, H - 3, 0, Math.min(h - 2, blob + 1.4), 2.6, H - 5, 0.8);
  const tree = b.result(H);
  const blocks = new Map();
  for (const c of tree.leaves) blocks.set(key(c.x, c.y, c.z), leafBlock());
  for (const c of tree.logs) blocks.set(key(c.x, c.y, c.z), logBlock(c.face));
  for (const [k, v] of [...blocks]) {
    const [x, y, z] = k.split(",").map(Number);
    if (Math.abs(x) > h || Math.abs(z) > h || y < 1 || y > H - 1) blocks.delete(k);
  }
  trimFarLeaves(blocks);
  blocks.set(key(0, 0, 0), crownDownJigsaw());
  return { blocks, size: [2 * h + 1, H, 2 * h + 1], origin: [h, 0, h] };
}
