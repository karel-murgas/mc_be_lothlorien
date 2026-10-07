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
import {
  ROOTS, FLOOR_H, LEVEL_H, FACING, SHAPES, key, AIR, planks, slab, Deck, buildTree, buildCrown, deckJigsaw, lantern, lonelyRail,
  writeRails, RAIL, shapeCells,
} from "./village_mallorn.mjs";

export const MAX_DEPTH = 5;
const MENDER = "lothlorien:rail_mender";
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
function writePiece(name, blocks, size, origin, connectors) {
  checkConnectors(name, blocks, connectors);
  const [sx, sy, sz] = size;
  // one invisible rail mender marker per piece with rails (scripts/rail_mender.js): box centre, at the lowest rail's height
  const railYs = [...blocks].filter(([, b]) => b.name === RAIL).map(([k]) => Number(k.split(",")[1]));
  const markers = railYs.length ? [{ id: MENDER, x: sx / 2, y: Math.min(...railYs) + origin[1], z: sz / 2 }] : [];
  const { buffer, clipped } = toMcstructure(blocks, size, origin, markers);
  if (clipped) throw new Error(`${name}: ${clipped} blocks outside the box`);
  writeFileSync(join(out, `${name}.mcstructure`), buffer);
  const tally = (f) => [...blocks.values()].filter(f).length;
  const conn = connectors.map((c) => `${c.facing}@y${c.y + origin[1]}`).join(" ");
  summary.push(`${name}: ${sx}x${sy}x${sz}, connectors ${conn || "none"}; ` +
    `${tally((b) => b.name.endsWith("_log") || b.name.endsWith("_wood"))} logs, ${tally((b) => b.name === B.leaves)} leaves, ` +
    `${tally((b) => b.name === B.planks)} planks, ${tally((b) => b.name.includes("slab"))} slabs, ${tally((b) => b.name === RAIL)} rails, ${buffer.length} bytes`);
}

// --- tree nodes: platform piece + crown ----------------------------------------------------------------------
const treePiece = (name, opts) => {
  const t = buildTree({ pool: POOL("bridges"), upPool: POOL("crowns"), ...opts });
  writePiece(name, t.blocks, t.size, t.origin, t.connectors);
};
const C = (facing, off, hi = false) => ({ facing, off, hi });
// single level: shape, connectors (face, offset along the face), trunk plus-shaped (round 3x3)
treePiece("node_a", { levels: [{ rows: SHAPES.cutrect13, conn: [C("north", 1), C("south", -2)] }], seed: 11011, lamps: 2 });
treePiece("node_b", { levels: [{ rows: SHAPES.octagon15, conn: [C("west", 1), C("east", -1), C("south", 0)] }], seed: 22022, lamps: 2 });
treePiece("node_c", { levels: [{ rows: SHAPES.plus15, conn: [C("north", -1), C("east", 1), C("south", 1), C("west", 0)] }], seed: 33033, lamps: 3 });
treePiece("node_d", { levels: [{ rows: SHAPES.oval17, conn: [C("east", 0), C("west", 0), C("north", -2)] }], seed: 44044, lamps: 2 });
treePiece("node_e", { levels: [{ rows: SHAPES.cutrect11, conn: [C("north", -1), C("east", 1)] }], seed: 55055, lamps: 2 });
treePiece("node_f", { levels: [{ rows: SHAPES.cutrect17, conn: [C("west", 1), C("east", -1), C("south", 1)] }], seed: 66066, lamps: 3 });
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
crown("crown_small", { h: 4, H: 14, seed: 4004, branches: 5, blob: 1.8 });
crown("crown_medium", { h: 6, H: 18, seed: 6006, branches: 7, blob: 2.2 });
crown("crown_large", { h: 8, H: 22, seed: 8008, branches: 8, blob: 2.6 });
crown("crown_central_a", { h: 12, H: 28, seed: 12012, branches: 10, blob: 3.2 });
crown("crown_central_b", { h: 10, H: 24, seed: 10010, branches: 9, blob: 3.0 });

// --- bridges: 5 wide (+ shift for dog-legs), deck at box y 0 on the connectors, gently arched with bottom slabs ----------
// Walking surface in half-blocks k(z) = min(z, L-1-z, top): even k = planks at layer k/2, odd k = bottom slab at layer
// (k+1)/2, one half-step (0.5 block, steppable) per cell. top 2 (rise 1) for L <= 7, 4 (rise 2) for L >= 9.
// Rails: one cell above the block the walker stands on; straight runs and square corners only (dog-leg: 3 wide rows
// between the two straight parts).
function bridge(name, length, { shift = 0, mirror = false, lanterns = false } = {}) {
  const blocks = new Map(), W = 5 + shift, top = length <= 7 ? 2 : 4;
  const j0 = shift ? Math.floor((length - 3) / 2) : -1;
  const range = (z) => (z < 0 ? [0, 4] : z >= length ? [shift, shift + 4] : !shift || z < j0 ? [0, 4] : z <= j0 + 2 ? [0, shift + 4] : [shift, shift + 4]);
  const isDeck = (x, z) => { const [a, b] = range(z); return x >= a && x <= b; };
  const mx = (x) => (mirror ? W - 1 - x : x);
  const kOf = (z) => Math.min(z, length - 1 - z, top);
  const layerOf = (k) => (k % 2 === 0 ? k / 2 : (k + 1) / 2);
  const rails = new Set(), forced = new Map();
  for (let z = 0; z < length; z++) {
    const k = kOf(z), L = layerOf(k), [a, b] = range(z);
    for (let x = a; x <= b; x++) {
      blocks.set(key(mx(x), L, z), k % 2 === 0 ? planks() : slab("bottom"));
      for (let h = 1; h <= 3; h++) blocks.set(key(mx(x), L + h, z), AIR);
      let rim = false;
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) if (!isDeck(x + dx, z + dz)) rim = true;
      if (!rim) continue;
      const rk = key(mx(x), L + 1, z);
      rails.add(rk);
      const sides = [];
      if (z === 0) sides.push("north");
      if (z === length - 1) sides.push("south");
      if (sides.length) forced.set(rk, sides);
    }
  }
  // the walk cells of the rail rows' air are overwritten by the rails above
  writeRails(blocks, rails, forced);
  if (lanterns) {
    const z = Math.floor(length / 2), L = layerOf(kOf(z));
    for (const x of [0, 4]) { blocks.set(key(mx(x), L + 2, z), lonelyRail()); blocks.set(key(mx(x), L + 3, z), lantern()); }
  }
  const connectors = [{ x: mx(2), y: 0, z: 0, facing: "north" }, { x: mx(shift + 2), y: 0, z: length - 1, facing: "south" }];
  for (const c of connectors) blocks.set(key(c.x, 0, c.z), deckJigsaw(c.facing, POOL("nodes")));
  writePiece(name, blocks, [W, layerOf(top) + 4, length], [0, 0, 0], connectors);
}
for (const L of [5, 7, 9, 11, 13]) bridge(`bridge_${L}`, L, { lanterns: L >= 9 });
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
pool("bridges", [["bridge_5", 2], ["bridge_7", 3], ["bridge_9", 3], ["bridge_11", 2], ["bridge_13", 1],
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
