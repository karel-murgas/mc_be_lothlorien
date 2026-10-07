// Combo pieces and the braced balcony of the Elven village (round 4, P6). Pure: build_village.mjs writes the files.
//
// A bridge never exists on its own. A combo piece is ONE jigsaw piece = a slab-arched bridge + the platform tree it leads to:
// the bridge's far end meets the node's rim connector inside the piece, the node's other connectors stay exits (name
// village_deck_hi, so they only act as parents) and its upward crown jigsaw stays. Platform exits therefore either get a
// bridge WITH its destination tree, or a railing / braced balcony (pool `exits`); a bridge ending in the air cannot occur.
import { bridgeShape } from "../lothlorien_bp/scripts/village_bridge.js";
import { B } from "./flet_mallorn.mjs";
import { rotateStates } from "./village_sim.mjs";
import {
  ROOTS, FLOOR_H, FACING, SHAPES, key, AIR, planks, slab, Deck, deckJigsaw, lantern, lonelyRail, writeRails, RAIL, addLanterns,
  DECK_HI_NAME, DECK_NAME,
} from "./village_mallorn.mjs";

const ORDER = ["north", "east", "south", "west"]; // clockwise seen from above
const ROT_ID = { 2: 5, 5: 3, 3: 4, 4: 2 }; // facing_direction after one clockwise quarter turn (N->E->S->W)
const turn = (facing, k) => ORDER[(ORDER.indexOf(facing) + k) % 4];

// One clockwise quarter turn k times about the trunk axis: (x, z) -> (-z, x). Vanilla-namespace states turn with the piece.
export function rotateCell(x, z, k) {
  for (let i = 0; i < k; i++) [x, z] = [-z, x];
  return [x, z];
}
export function rotateBlocks(blocks, k) {
  const out = new Map();
  for (const [kk, v] of blocks) {
    const [x, y, z] = kk.split(",").map(Number), [nx, nz] = rotateCell(x, z, k);
    let nv = v;
    if (k) {
      const states = { ...v.states };
      let st = states;
      for (let i = 0; i < k; i++) st = rotateStates(v.name, st);
      nv = { ...v, states: st };
      if (v.name === "minecraft:jigsaw" && ROT_ID[states.facing_direction]) {
        let id = states.facing_direction;
        for (let i = 0; i < k; i++) id = ROT_ID[id] ?? id;
        nv = { ...v, states: { ...st, facing_direction: id } };
      }
    }
    out.set(key(nx, y, nz), nv);
  }
  return out;
}

// ---- bridge: the slab arch of scripts/village_bridge.js as a block map (deck layer y 0, z 0 = north end) ------------------
export function buildBridge(length, { shift = 0, mirror = false, lanterns = false } = {}) {
  const shape = bridgeShape(length, mirror ? -shift : shift, length <= 7 ? 1 : 2);
  const blocks = new Map(), [W, sy] = shape.size;
  const KIND = { plank: planks, slab_bottom: () => slab("bottom"), slab_top: () => slab("top"), air: () => AIR };
  for (const c of shape.cells) blocks.set(key(c.x, c.y, c.z), KIND[c.kind]());
  for (const r of shape.rails) { // fences over the cleared air; a rail may sit outside the deck cells (diagonal corners)
    const states = {};
    for (const side of Object.keys(FACING)) states[`minecraft:connection_${side}`] = r.sides.includes(side);
    blocks.set(key(r.x, r.y, r.z), { name: RAIL, states });
  }
  if (lanterns) {
    const z = Math.floor(length / 2), k = Math.min(z, length - 1 - z, 4), top = k % 2 ? (k + 1) / 2 : k / 2;
    for (const x of [0, 4]) { blocks.set(key(x, top + 2, z), lonelyRail()); blocks.set(key(x, top + 3, z), lantern()); }
  }
  addLanterns(blocks, { x0: 0, x1: W - 1, y0: 0, y1: sy - 1, z0: 0, z1: length - 1 }, (x, y, z) => z === 0 || z === length - 1); // not on the connector rows
  return { blocks, shape, W, sy, length };
}

export const STRAIGHT = [7, 9, 11, 13, 15].map((L) => ({ name: `bridge_${L}`, length: L, lanterns: L >= 9 }));
export const DOGS = [["bridge_dog_11_l", 11, 2, false], ["bridge_dog_11_r", 11, 2, true], ["bridge_dog_13_l", 13, 3, false], ["bridge_dog_13_r", 13, 3, true]]
  .map(([name, length, shift, mirror]) => ({ name, length, shift, mirror }));

// ---- combo: bridge (north) + rotated node/tower (south) in one frame ------------------------------------------------------
// tree = buildTree() result (not changed); entryIdx = which of its connectors (name village_deck, lower level) receives the bridge.
// Frame: bridge deck y = FLOOR_H (= the tree's deck), z 0 .. length - 1 the bridge, the node from z = length on, node trunk axis
// at (ax, az). Returns null when the pair cannot form a piece with working exits (reason in `why`).
export function makeCombo(tree, entryIdx, bridgeSpec, poolId) {
  const entry = tree.connectors[entryIdx];
  if (entry.name !== DECK_NAME) return { why: "entry is an upper-level connector" };
  if (tree.connectors.some((c, i) => i !== entryIdx && c.facing === entry.facing)) return { why: "another connector on the entry face (it would be blocked by the bridge)" };
  const k = (4 - ORDER.indexOf(entry.facing)) % 4; // after k turns the entry connector faces north, into the bridge
  const node = rotateBlocks(tree.blocks, k);
  const conns = tree.connectors.map((c, i) => {
    const [x, z] = rotateCell(c.x, c.z, k);
    return { ...c, x, z, facing: turn(c.facing, k), entry: i === entryIdx };
  });
  const e = conns[entryIdx];
  const hx = k % 2 ? tree.box.hz : tree.box.hx, hz = k % 2 ? tree.box.hx : tree.box.hz;
  const br = buildBridge(bridgeSpec.length, bridgeSpec);
  const bridgeEnd = br.shape.connectors[1];
  const dx = bridgeEnd.x - e.x, dz = br.length - e.z; // node translation into the combo frame (e.z = -hz, so the node starts at z = length)
  // every exit face must be the node's own box face: the bridge has to lie inside the node's x range, else the union box would
  // cover the cells in front of the exits and no child could ever be placed there
  const x0 = Math.min(0, dx - hx), x1 = Math.max(br.W - 1, dx + hx);
  if (x0 !== dx - hx || x1 !== dx + hx) return { why: "bridge sticks out of the node's width" };
  const blocks = new Map();
  for (const [kk, v] of br.blocks) { const [x, y, z] = kk.split(",").map(Number); blocks.set(key(x - x0, y + FLOOR_H, z), v); }
  for (const [kk, v] of node) { const [x, y, z] = kk.split(",").map(Number); blocks.set(key(x + dx - x0, y, z + dz), v); }
  const connectors = [];
  const north = br.shape.connectors[0];
  blocks.set(key(north.x - x0, FLOOR_H, north.z), deckJigsaw("north", "minecraft:empty")); // the entry: this piece is the child
  connectors.push({ x: north.x - x0, y: FLOOR_H, z: north.z, facing: "north", entry: true });
  blocks.set(key(bridgeEnd.x - x0, FLOOR_H, br.length - 1), planks()); // bridge end and node entry are one deck
  blocks.set(key(e.x + dx - x0, e.y, e.z + dz), planks());
  for (const c of conns) {
    if (c.entry) continue;
    const at = [c.x + dx - x0, c.y, c.z + dz];
    blocks.set(key(...at), deckJigsaw(c.facing, poolId, DECK_HI_NAME));
    connectors.push({ x: at[0], y: c.y, z: at[2], facing: c.facing, entry: false });
  }
  const sizeX = x1 - x0 + 1, sizeZ = br.length + 2 * hz + 1;
  const topY = tree.topY + 5;
  return {
    blocks, connectors, size: [sizeX, ROOTS + topY + 1, sizeZ], origin: [0, ROOTS, 0],
    // tree axis and the bridge centre in combo coordinates, for markers and wardens
    axis: [dx - x0, br.length + hz], bridgeMid: [(br.W - 1) / 2 - x0 + 0.5, br.length / 2],
    wardenMap: (c) => { const [x, z] = rotateCell(c.x, c.z, k); return { x: x + dx - x0, z: z + dz }; },
    bridgeLen: br.length, k,
  };
}

// ---- braced balcony: a small rim balcony standing on a log pillar to the ground, braced under its deck ------------------
// Child piece, one connector (north). Deck y 0; the pillar runs 40 below the deck (any deck of the village, up to 3 levels, reaches
// the ground); four log braces climb from the pillar to the underside of the deck.
export const BALCONY_DOWN = 40;
export function buildBalcony() {
  const blocks = new Map(), cells = new Set(), widths = [2, 3, 3, 3, 3, 2, 2];
  widths.forEach((w, a) => { for (let x = -w; x <= w; x++) cells.add(`${x},${a}`); });
  const deck = new Deck(blocks, 0, null, { box: { hx: 3, hz: 0 }, cells });
  deck.connect("north", 0, "minecraft:empty");
  const { rails, forced } = deck.build();
  writeRails(blocks, rails, forced);
  const PZ = 3; // pillar row
  const log = (face) => ({ name: B.log, states: { "minecraft:block_face": face } });
  for (let y = -BALCONY_DOWN; y < 0; y++) for (const [x, z] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) blocks.set(key(x, y, PZ + z), log("up"));
  // braces: from the pillar's side up and out to the deck underside (2 cells out one layer below the deck... the deck itself is
  // 3 wide on this row, so the last brace cell sits right under its edge)
  for (const s of [1, -1]) {
    blocks.set(key(s * 2, -3, PZ), log("east")); blocks.set(key(s * 3, -2, PZ), log("east")); blocks.set(key(s * 3, -1, PZ), log("up"));
    blocks.set(key(0, -3, PZ + s * 2), log("south")); blocks.set(key(0, -2, PZ + s * 3), log("south")); blocks.set(key(0, -1, PZ + s * 3), log("up"));
  }
  blocks.set(key(0, 2, widths.length - 1), lantern());
  addLanterns(blocks, { x0: -3, x1: 3, y0: 0, y1: 3, z0: 0, z1: widths.length - 1 }, (x, y, z) => z === 0);
  return { blocks, size: [7, BALCONY_DOWN + 4, widths.length], origin: [3, BALCONY_DOWN, 0], connectors: deck.connectors.map((c) => ({ ...c, y: 0 })) };
}
