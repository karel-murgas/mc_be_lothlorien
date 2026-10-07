// Writes the Elven jigsaw village pieces, pools and structure (design: docs/design/lothlorien_jigsaw_settlement.md):
//   node tools/build_village.mjs
// -> lothlorien_bp/structures/lothlorien/village/<piece>.mcstructure   (id lothlorien:village/<piece>)
//    lothlorien_bp/worldgen/template_pools/village_<pool>.json         (id lothlorien:village/<pool>)
//    lothlorien_bp/worldgen/structures/elven_village.json              (no structure set: /place structure only)
// Pieces: tree nodes = platform piece (rim connectors, trunk to deck + 5) + crown piece on an upward jigsaw; two-level
// towers with a slab spiral stair; slab-arched bridges (straight and dog-leg); balcony / lookout / plug ends; central tree.
// Connector standard: one jigsaw per connection in the deck layer, on the outer face of the piece box, in the middle of a
// 3-wide walk opening (deck under 5 cells, rails at +-2), name = target = lothlorien:village_deck (upper-level connectors of
// towers: name village_deck_hi, parent role only), aligned joint, final state planks.
import { writeFileSync, mkdirSync, readdirSync, unlinkSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { toMcstructure } from "./build_structures.mjs";
import { B } from "./flet_mallorn.mjs";
import { bridgeShape } from "../lothlorien_bp/scripts/village_bridge.js";
import {
  ROOTS, FLOOR_H, LEVEL_H, FACING, SHAPES, key, AIR, planks, slab, Deck, buildTree, buildCrown, deckJigsaw, lantern, lonelyRail,
  writeRails, RAIL, shapeCells, addLanterns,
} from "./village_mallorn.mjs";

export const MAX_DEPTH = 5;
const MENDER = "lothlorien:rail_mender";
const WARDEN = "lothlorien:elven_warden";
// Village wardens (entities/elven_warden.json, group lothlorien:village_warden = persistent + home): placed as template
// entities on the lower deck of these pieces. Whether Bedrock places structure entities in jigsaw pieces is an open question
// (same as the rail mender), to be seen in game.
const WARDENS = { central_mallorn_01: 2, node_b: 1, node_c: 1, node_f: 1, tower_a: 1, tower_c: 1 };
const bp = join(dirname(fileURLToPath(import.meta.url)), "..", "lothlorien_bp");
const out = join(bp, "structures", "lothlorien", "village");
mkdirSync(out, { recursive: true });
mkdirSync(join(bp, "worldgen", "template_pools"), { recursive: true });
mkdirSync(join(bp, "worldgen", "structures"), { recursive: true });
for (const f of readdirSync(out)) unlinkSync(join(out, f)); // pieces of earlier layouts must not linger

const POOL = (n) => `lothlorien:village/${n}`;
const summary = [];

// connector standard (depth 1: the connector cell itself): deck under 5 cells, rails at +-2 one above, 3 air above the walk cells
function checkConnectors(name, blocks, connectors) {
  for (const c of connectors) {
    const { d } = FACING[c.facing], p = [-d[1], d[0]];
    for (let off = -2; off <= 2; off++) {
      const x = c.x + p[0] * off, z = c.z + p[1] * off;
      const deckB = blocks.get(key(x, c.y, z));
      if (off === 0 ? deckB?.name !== "minecraft:jigsaw" : deckB?.name !== B.planks && deckB?.name !== "minecraft:jigsaw") throw new Error(`${name}: ${c.facing} connector: bad deck at ${off}`);
      for (let h = 1; h <= 3; h++) {
        const b = blocks.get(key(x, c.y + h, z));
        if (Math.abs(off) === 2) { if (h === 1 && b?.name !== RAIL) throw new Error(`${name}: ${c.facing} no rail at ${off}`); }
        else if (b?.name !== "minecraft:air") throw new Error(`${name}: ${c.facing} headroom not air at ${off},${h}: ${b?.name}`);
      }
    }
  }
}
// Standing cells for `count` wardens on the deck layer y = FLOOR_H (tree coordinates): planks under the cell and its 8
// neighbours, 3 x 3 x 3 explicit air above, no rail within 2 cells, so nothing but open deck around (not at a connector, the
// trunk, the rope hole, a stair or a lantern). The first warden stands near ring `want`, the next ones as far from the earlier
// ones as possible. Deterministic. Returns [{ x, z }] (tree coordinates); throws when there is no room.
export function wardenCells(name, blocks, count, want) {
  if (!count) return [];
  const at = (x, y, z) => blocks.get(key(x, y, z))?.name;
  const ok = [];
  for (const k of blocks.keys()) {
    const [x, y, z] = k.split(",").map(Number);
    if (y !== FLOOR_H || at(x, y, z) !== B.planks) continue;
    let good = true;
    for (let dx = -2; dx <= 2 && good; dx++) for (let dz = -2; dz <= 2 && good; dz++) {
      if (at(x + dx, y + 1, z + dz) === RAIL) good = false;
      if (Math.abs(dx) <= 1 && Math.abs(dz) <= 1) {
        if (at(x + dx, y, z + dz) !== B.planks) good = false;
        for (let h = 1; h <= 3; h++) if (at(x + dx, y + h, z + dz) !== "minecraft:air") good = false;
      }
    }
    if (good) ok.push({ x, z, d: Math.hypot(x, z) });
  }
  const near = ok.filter((c) => Math.abs(c.d - want) <= 2.5);
  const pool = (near.length >= count ? near : ok).sort((a, b) => Math.abs(a.d - want) - Math.abs(b.d - want) || a.x - b.x || a.z - b.z);
  if (pool.length < count) throw new Error(`${name}: no room for ${count} wardens`);
  const picked = [pool[0]];
  while (picked.length < count) {
    const next = pool.filter((c) => !picked.includes(c)).sort((a, b) =>
      Math.min(...picked.map((p) => Math.hypot(b.x - p.x, b.z - p.z))) - Math.min(...picked.map((p) => Math.hypot(a.x - p.x, a.z - p.z))) || a.x - b.x || a.z - b.z)[0];
    picked.push(next);
  }
  return picked.map(({ x, z }) => ({ x, z }));
}
function writePiece(name, blocks, size, origin, connectors) {
  checkConnectors(name, blocks, connectors);
  const [sx, sy, sz] = size;
  // one invisible rail mender marker per piece with rails (scripts/rail_mender.js): box centre, at the lowest rail's height
  const railYs = [...blocks].filter(([, b]) => b.name === RAIL).map(([k]) => Number(k.split(",")[1]));
  const markers = railYs.length ? [{ id: MENDER, x: sx / 2, y: Math.min(...railYs) + origin[1], z: sz / 2 }] : [];
  const wardens = wardenCells(name, blocks, WARDENS[name] ?? 0, name.startsWith("central") ? 7 : 5).map((c) => ({
    id: WARDEN, x: c.x + origin[0] + 0.5, y: FLOOR_H + 1 + origin[1], z: c.z + origin[2] + 0.5,
    definitions: [`+${WARDEN}`, "+lothlorien:village_warden"], mainhand: "minecraft:bow", invulnerable: false,
  }));
  const { buffer, clipped } = toMcstructure(blocks, size, origin, [...markers, ...wardens]);
  if (clipped) throw new Error(`${name}: ${clipped} blocks outside the box`);
  writeFileSync(join(out, `${name}.mcstructure`), buffer);
  const tally = (f) => [...blocks.values()].filter(f).length;
  const conn = connectors.map((c) => `${c.facing}@y${c.y + origin[1]}`).join(" ");
  summary.push(`${name}: ${sx}x${sy}x${sz}, connectors ${conn || "none"}; ` +
    `${wardens.length} wardens, ${tally((b) => b.name.endsWith("_log") || b.name.endsWith("_wood"))} logs, ${tally((b) => b.name === B.leaves)} leaves, ` +
    `${tally((b) => b.name === B.planks)} planks, ${tally((b) => b.name.includes("slab"))} slabs, ${tally((b) => b.name === RAIL)} rails, ${buffer.length} bytes`);
}

// --- tree nodes: platform piece + crown ----------------------------------------------------------------------
const treePiece = (name, opts) => {
  const t = buildTree({ pool: POOL("bridges"), upPool: POOL("crowns"), ...opts });
  writePiece(name, t.blocks, t.size, t.origin, t.connectors);
};
const C = (facing, off, hi = false) => ({ facing, off, hi });
// single level: shape, connectors (face, offset along the face), trunk plus-shaped (round 3x3)
treePiece("node_a", { trunk: "square3", levels: [{ rows: SHAPES.cutrect13, conn: [C("north", 1), C("south", -2)] }], seed: 11011, lamps: 2 });
treePiece("node_b", { trunk: "square3", levels: [{ rows: SHAPES.octagon15, conn: [C("west", 1), C("east", -1), C("south", 0)] }], seed: 22022, lamps: 2 });
treePiece("node_c", { trunk: "square3", levels: [{ rows: SHAPES.plus15, conn: [C("north", -1), C("east", 1), C("south", 1), C("west", 0)] }], seed: 33033, lamps: 3 });
treePiece("node_d", { trunk: "square3", levels: [{ rows: SHAPES.oval17, conn: [C("east", 0), C("west", 0), C("north", -2)] }], seed: 44044, lamps: 2 });
treePiece("node_e", { trunk: "square3", levels: [{ rows: SHAPES.cutrect11, conn: [C("north", -1), C("east", 1)] }], seed: 55055, lamps: 2 });
treePiece("node_f", { trunk: "square3", levels: [{ rows: SHAPES.cutrect17, conn: [C("west", 1), C("east", -1), C("south", 1)] }], seed: 66066, lamps: 3 });
// two levels: lower deck, upper deck +8, slab spiral stair in the ring round a 3x3 trunk
treePiece("tower_a", { trunk: "square3", seed: 77077, lamps: 0, levels: [
  { rows: SHAPES.octagon15, conn: [C("south", -1), C("west", 1)] }, { rows: SHAPES.plus15, conn: [C("north", 1, true), C("east", -1, true)], clip: (x, z) => z >= 4 }] }); // no south arm: the stair well is there
treePiece("tower_b", { trunk: "square3", seed: 88088, lamps: 0, levels: [
  { rows: SHAPES.plus15, conn: [C("east", 1), C("north", -1), C("south", 0)] }, { rows: SHAPES.octagon15, conn: [C("south", 1, true), C("west", -1, true)] }] });
treePiece("tower_c", { trunk: "square3", seed: 99099, lamps: 0, levels: [
  { rows: SHAPES.oval17, conn: [C("north", 2), C("south", -2)] }, { rows: SHAPES.cutrect17.concat([6]), conn: [C("east", 1, true), C("west", -1, true)] }] });
// central tree: single level, 5x5 round trunk, 4 rim connectors, Elven rope from the ground to the deck, start anchor
treePiece("central_mallorn_01", {
  levels: [{ rows: SHAPES.octagon21, conn: [C("north", -3), C("east", 2), C("south", 4), C("west", -2)] }],
  trunk: "round5", seed: 20261007, rope: true, anchor: true, lamps: 4, upPool: POOL("crowns_central"),
});

// --- crown pieces ------------------------------------------------------------------------------------------------
const crown = (name, o) => { const c = buildCrown(o); writePiece(name, c.blocks, c.size, c.origin, []); };
crown("crown_small", { h: 7, H: 16, seed: 4004, branches: 8, blob: 2.1 });
crown("crown_medium", { h: 8, H: 20, seed: 6006, branches: 9, blob: 2.6 });
crown("crown_large", { h: 10, H: 24, seed: 8008, branches: 11, blob: 2.9 });
crown("crown_central_a", { h: 16, H: 34, seed: 12012, branches: 14, blob: 3.6, central: true });
crown("crown_central_b", { h: 13, H: 30, seed: 10010, branches: 12, blob: 3.3, central: true });

// --- bridges: 5 wide (+ shift for dog-legs), deck at box y 0 on the connectors, gently arched with bottom slabs ----------
// The shape (deck, arch, rails, connectors) is lothlorien_bp/scripts/village_bridge.js bridgeShape(length, offset, rise), pure JS
// so the runtime loop-closer builds the same bridge. Arch: one half block (plank / bottom slab) per cell; rise 1 for L <= 7, 2 for
// L >= 9. Dog-legs shift one block sideways per block forward (45 degrees) between two straight runs; the rail is one face-adjacent line.
function bridge(name, length, { shift = 0, mirror = false, lanterns = false } = {}) {
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
  for (const c of shape.connectors) blocks.set(key(c.x, 0, c.z), deckJigsaw(c.facing, POOL("nodes")));
  writePiece(name, blocks, shape.size, [0, 0, 0], shape.connectors);
}
for (const L of [7, 9, 11, 13, 15]) bridge(`bridge_${L}`, L, { lanterns: L >= 9 });
bridge("bridge_dog_11_l", 11, { shift: 2 });
bridge("bridge_dog_11_r", 11, { shift: 2, mirror: true });
bridge("bridge_dog_13_l", 13, { shift: 3 });
bridge("bridge_dog_13_r", 13, { shift: 3, mirror: true });

// --- ends -------------------------------------------------------------------------------------------------------
// balcony_small: half-round deck, rails all round, lantern; one connector, 7 x 6
{
  const blocks = new Map(), cells = new Set(), widths = [2, 3, 3, 3, 2, 2];
  widths.forEach((w, a) => { for (let x = -w; x <= w; x++) cells.add(`${x},${a}`); });
  const deck = new Deck(blocks, 0, null, { box: { hx: 3, hz: 0 }, cells });
  deck.connect("north", 0, "minecraft:empty");
  const { rails, forced } = deck.build();
  writeRails(blocks, rails, forced);
  blocks.set(key(0, 2, widths.length - 1), lantern());
  addLanterns(blocks, { x0: -3, x1: 3, y0: 0, y1: 3, z0: 0, z1: widths.length - 1 }, (x, y, z) => z === 0);
  writePiece("balcony_small", blocks, [7, 4, widths.length], [3, 0, 0], deck.connectors.map((c) => ({ ...c, y: 0 })));
}
// lookout_01: square-ish platform on a log pillar down to ROOTS, one connector
{
  const blocks = new Map();
  for (let y = -ROOTS; y < FLOOR_H; y++) for (const [x, z] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) blocks.set(key(x, y, z), { name: B.log, states: { "minecraft:block_face": "up" } });
  const deck = new Deck(blocks, FLOOR_H, SHAPES.lookout9, { box: { hx: 4, hz: 4 } });
  deck.connect("north", 0, "minecraft:empty");
  const { rails, forced } = deck.build();
  writeRails(blocks, rails, forced);
  blocks.set(key(0, FLOOR_H + 2, 4), lantern()); // on the rail post at the far end
  addLanterns(blocks, { x0: -4, x1: 4, y0: -ROOTS, y1: FLOOR_H + 3, z0: -4, z1: 4 }, (x, y, z) => z === -4);
  writePiece("lookout_01", blocks, [9, ROOTS + FLOOR_H + 4, 9], [4, ROOTS, 4], deck.connectors.map((c) => ({ ...c, y: FLOOR_H })));
}
// railing_end (plug): deck row of 5 + 5 rails; connector at the middle deck cell facing the parent
{
  const blocks = new Map(), rails = new Set(), forced = new Map();
  for (let x = 0; x < 5; x++) { blocks.set(key(x, 0, 0), planks()); rails.add(key(x, 1, 0)); }
  forced.set(key(0, 1, 0), ["north"]); forced.set(key(4, 1, 0), ["north"]);
  writeRails(blocks, rails, forced);
  blocks.set(key(2, 0, 0), deckJigsaw("north", "minecraft:empty"));
  writePiece("railing_end", blocks, [5, 2, 1], [0, 0, 0], []);
}

// --- pools and structure -------------------------------------------------------------------------------------------
const poolFiles = new Set();
const pool = (name, elements, fallback) => {
  const node = {
    description: { identifier: POOL(name) },
    elements: elements.map(([piece, weight]) => ({
      element: { element_type: "minecraft:single_pool_element", location: `lothlorien/village/${piece}`, projection: "rigid" },
      weight,
    })),
  };
  if (fallback) node.fallback = fallback;
  poolFiles.add(`village_${name}.json`);
  writeFileSync(join(bp, "worldgen", "template_pools", `village_${name}.json`),
    JSON.stringify({ format_version: "1.21.100", "minecraft:template_pool": node }, null, 2) + "\n");
};
pool("start", [["central_mallorn_01", 1]]);
pool("bridges", [["bridge_7", 3], ["bridge_9", 3], ["bridge_11", 3], ["bridge_13", 2], ["bridge_15", 1],
  ["bridge_dog_11_l", 1], ["bridge_dog_11_r", 1], ["bridge_dog_13_l", 1], ["bridge_dog_13_r", 1]], POOL("plugs"));
pool("nodes", [["node_a", 3], ["node_b", 3], ["node_c", 3], ["node_d", 3], ["node_e", 3], ["node_f", 3],
  ["tower_a", 3], ["tower_b", 3], ["tower_c", 3], ["balcony_small", 4], ["lookout_01", 1]], POOL("ends"));
pool("ends", [["balcony_small", 8], ["lookout_01", 2], ["railing_end", 1]], "minecraft:empty");
pool("plugs", [["railing_end", 1]]);
pool("crowns", [["crown_large", 3], ["crown_medium", 2]], POOL("crowns_small"));
pool("crowns_small", [["crown_small", 1]]);
pool("crowns_central", [["crown_central_a", 2], ["crown_central_b", 1]], POOL("crowns_small"));
for (const f of readdirSync(join(bp, "worldgen", "template_pools"))) if (f.startsWith("village_") && !poolFiles.has(f)) unlinkSync(join(bp, "worldgen", "template_pools", f));

writeFileSync(join(bp, "worldgen", "structures", "elven_village.json"), JSON.stringify({
  format_version: "1.21.100",
  "minecraft:jigsaw": {
    description: { identifier: "lothlorien:elven_village" },
    biome_filters: [{ test: "has_biome_tag", value: "lothlorien" }],
    step: "surface_structures",
    terrain_adaptation: "none",
    start_pool: POOL("start"),
    start_jigsaw_name: "lothlorien:village_anchor",
    max_depth: MAX_DEPTH,
    start_height: { type: "constant", value: { absolute: -ROOTS } },
    heightmap_projection: "world_surface",
    max_distance_from_center: { horizontal: 116, vertical: 116 },
  },
}, null, 2) + "\n");

console.log(summary.join("\n"));
