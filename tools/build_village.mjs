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
import { checkWalk } from "../../../.claude/skills/bedrock-modding/scripts/structure_walk.mjs"; // shared walkability checker (headroom, steps, edges, rings, rail links)
import { makeCombo, buildBalcony, STRAIGHT, DOGS } from "./village_combo.mjs";
import { sideTarget } from "../lothlorien_bp/scripts/village_loop.js"; // the runtime's own rim test decides where a side marker may stand
import {
  ROOTS, FLOOR_H, LEVEL_H, FACING, SHAPES, key, AIR, planks, slab, Deck, buildTree, buildCrown, deckJigsaw, lantern, lonelyRail,
  writeRails, RAIL, shapeCells, addLanterns,
} from "./village_mallorn.mjs";

export const MAX_DEPTH = 2; // hops from the central tree (a combo = one hop; its crown is a sibling, not a deeper level)
// exits (no combo fits, or the depth is used up): mostly a plain railing, sometimes a braced balcony or a lookout. The combos pool also
// holds them as early ends (tuned with the sim so a village keeps ~8-10 trees at max_depth 2).
const EXIT_WEIGHTS = { railing: 4, balcony: 2, lookout: 1 };
const EARLY_END = { railing_end: 10, balcony_braced: 6, lookout_01: 2 };
const MENDER = "lothlorien:rail_mender";
const WARDEN = "lothlorien:elven_warden";
const LOOP_MARKER = "lothlorien:loop_marker";
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

// Walkability (owner 2026-10-08, rules in .claude/skills/bedrock-modding/references/13-structure-walkability.md): every piece is checked
// with the shared checker; any violation stops the build. opts.ring: [{ trunk: [[x, z]], level }] (walk ring round a trunk at deck level),
// opts.connectors: deck connectors that must be reachable from each other. `blocks` are in piece coordinates (any origin).
export function walkReport(blocks, { connectors = [], ring = [] } = {}) {
  const ks = [...blocks.keys()].map((k) => k.split(",").map(Number));
  const lo = (i) => Math.min(...ks.map((k) => k[i])), hi = (i) => Math.max(...ks.map((k) => k[i]));
  const box = { x0: lo(0), x1: hi(0), y0: lo(1), y1: hi(1), z0: lo(2), z1: hi(2) };
  const must = connectors.map((c) => ({ x: c.x, y: c.y + 1, z: c.z }));
  const r = checkWalk((x, y, z) => blocks.get(key(x, y, z)), box, { must, ring });
  return r.violations;
}
export function assertWalk(name, blocks, opts) {
  const v = walkReport(blocks, opts);
  if (v.length) throw new Error(`${name}: ${v.length} walkability violations, e.g. ${v.slice(0, 6).map((x) => `${x.rule} at ${x.at} (${x.detail})`).join("; ")}`);
}

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
// Where a platform's plain rim sides can start a bridge (F1): one marker per straight rim run, on the run's middle cell, where the runtime's
// sideTarget holds for a bridge heading into the platform (5-run of rail on 5 planks, two plain deck rows behind with open air; a stair opening,
// trunk, slab or connector row fails it). `inRegion(x, z)` limits the cells (a combo's bridge half is excluded). -> [[x, z, deckY]] in box coordinates.
export function sideMarkerCells(blocks, origin, inRegion = () => true) {
  const nameAt = (x, y, z) => blocks.get(key(x, y, z))?.name ?? "minecraft:air";
  const runs = new Map();
  for (const [k, b] of blocks) {
    if (b.name !== B.planks) continue;
    const [x, y, z] = k.split(",").map(Number);
    if (!inRegion(x, z) || nameAt(x, y + 1, z) !== RAIL) continue;
    for (const out of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
      if (!sideTarget(nameAt, x, y, z, [-out[0], -out[1]])) continue;
      const along = out[0] ? z : x, line = out[0] ? x : z, id = `${out}|${y}|${line}`;
      (runs.get(id) ?? runs.set(id, { out, y, line, cells: [] }).get(id)).cells.push(along);
    }
  }
  const res = [];
  for (const r of runs.values()) { // split into contiguous runs of the along coordinate
    const cs = r.cells.sort((a, b) => a - b);
    let start = 0;
    for (let i = 1; i <= cs.length; i++) {
      if (i < cs.length && cs[i] === cs[i - 1] + 1) continue;
      const along = cs[start + Math.floor((i - start - 1) / 2)];
      res.push(r.out[0] ? [r.line, along, r.y] : [along, r.line, r.y]);
      start = i;
    }
  }
  return res.sort((a, b) => a[2] - b[2] || a[0] - b[0] || a[1] - b[1]).map(([x, z, y]) => [x + origin[0] + 0.5, z + origin[2] + 0.5, y]);
}
// extra.markers: [[x, z]] rail mender marker positions in box coordinates (default: the box centre); extra.wardens: standing cells
// [{ x, z }] in block coordinates (default: computed here for WARDENS[name])
function writePiece(name, blocks, size, origin, connectors, extra = {}) {
  checkConnectors(name, blocks, connectors);
  if (!name.startsWith("crown_")) assertWalk(name, blocks, { connectors });
  const [sx, sy, sz] = size;
  // rail mender markers (scripts/rail_mender.js, scan radius 17): one at the box centre, two for a combo (bridge middle and tree axis,
  // so the whole bridge + node is covered); y = the lowest rail
  const railYs = [...blocks].filter(([, b]) => b.name === RAIL).map(([k]) => Number(k.split(",")[1]));
  const markers = railYs.length ? (extra.markers ?? [[sx / 2, sz / 2]]).map(([x, z]) => ({ id: MENDER, x, y: Math.min(...railYs) + origin[1], z })) : [];
  // loop closer (scripts/loop_marker.js): every closed exit (railing_end) carries one marker on the centre fence cell (y + 0.5 = cell middle, so
  // rotation rounding cannot change the cell); it finds its railing, a facing one and the bridge direction from the blocks, not from its own rotation
  // Balcony and lookout ends have the very same signature on their free rim sides (5 planks + fences, 5-wide connector row behind), so they carry
  // markers too (extra.loopMarkers: [[x, z]] box coordinates of the rim's centre cell): a loop may start there and the end becomes a walk-through.
  // Side markers (round 2, F1): [x, z, deckY] in box coordinates + block key y of the deck; a platform rim run of its own is a bridge START too.
  for (const m of name === "railing_end" ? [[sx / 2, sz / 2]] : extra.loopMarkers ?? []) markers.push({ id: LOOP_MARKER, x: m[0], y: m[2] === undefined ? Math.min(...railYs) + origin[1] + 0.5 : m[2] + 1 + origin[1] + 0.5, z: m[1] });
  const cells = extra.wardens ?? wardenCells(name, blocks, WARDENS[name] ?? 0, name.startsWith("central") ? 7 : 5);
  const wardens = cells.map((c) => ({
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

// --- tree nodes: platform + crown. Nodes and towers are never written alone: each is a part of combo pieces -----------------
const treeSpec = (opts) => {
  const t = buildTree({ pool: POOL("combos"), upPool: POOL("crowns"), ...opts });
  // a tower has the stair base on its lower deck and the opening on its upper deck: a closed walk ring round the 3x3 trunk must stay free on both (owner: "going round the staircase was not possible")
  const trunk = []; for (let x = -1; x <= 1; x++) for (let z = -1; z <= 1; z++) trunk.push([x, z]);
  assertWalk(`tree seed ${opts.seed}`, t.blocks, { connectors: t.connectors, ring: opts.levels.length === 2 ? [{ trunk, level: FLOOR_H + 1 }, { trunk, level: FLOOR_H + LEVEL_H + 1 }] : [] });
  return t;
};
const C = (facing, off, hi = false) => ({ facing, off, hi });
// single level: shape, connectors (face, offset along the face), trunk 3x3
const NODES = {
  node_a: treeSpec({ trunk: "square3", levels: [{ rows: SHAPES.cutrect13, conn: [C("north", 1), C("south", -2)] }], seed: 11011, lamps: 2 }),
  node_b: treeSpec({ trunk: "square3", levels: [{ rows: SHAPES.octagon15, conn: [C("west", 1), C("east", -1), C("south", 0)] }], seed: 22022, lamps: 2 }),
  node_c: treeSpec({ trunk: "square3", levels: [{ rows: SHAPES.plus15, conn: [C("north", -1), C("east", 1), C("south", 1), C("west", 0)] }], seed: 33033, lamps: 3 }),
  node_d: treeSpec({ trunk: "square3", levels: [{ rows: SHAPES.oval17, conn: [C("east", 0), C("west", 0), C("north", -2)] }], seed: 44044, lamps: 2 }),
  node_e: treeSpec({ trunk: "square3", levels: [{ rows: SHAPES.cutrect11, conn: [C("north", -1), C("east", 1)] }], seed: 55055, lamps: 2 }),
  node_f: treeSpec({ trunk: "square3", levels: [{ rows: SHAPES.cutrect17, conn: [C("west", 1), C("east", -1), C("south", 1)] }], seed: 66066, lamps: 3 }),
  // two levels: lower deck, upper deck +8, slab spiral stair in the ring round a 3x3 trunk
  tower_a: treeSpec({ trunk: "square3", seed: 77077, lamps: 0, levels: [
    { rows: SHAPES.octagon15, conn: [C("south", -1), C("west", 1)] }, { rows: SHAPES.octagon15, conn: [C("north", 1, true), C("east", -1, true)], clip: (x, z) => z >= 6 }] }), // upper deck stops at z 5: rows to z 4 keep the walk ring round the stair opening (was plus15 clipped at z 4)
  tower_b: treeSpec({ trunk: "square3", seed: 88088, lamps: 0, levels: [
    { rows: SHAPES.plus15w, conn: [C("east", 1), C("north", -1), C("south", 0)] }, { rows: SHAPES.octagon15, conn: [C("south", 1, true), C("west", -1, true)] }] }),
  tower_c: treeSpec({ trunk: "square3", seed: 99099, lamps: 0, levels: [
    { rows: SHAPES.oval17, conn: [C("north", 2), C("south", -2)] }, { rows: SHAPES.cutrect17.concat([6]), conn: [C("east", 1, true), C("west", -1, true)] }] }),
};
// central tree: single level, 5x5 round trunk, 4 rim connectors, Elven rope from the ground to the deck, start anchor
{
  const t = buildTree({
    pool: POOL("combos"), levels: [{ rows: SHAPES.octagon21, conn: [C("north", -3), C("east", 2), C("south", 4), C("west", -2)] }],
    trunk: "round5", seed: 20261007, rope: true, anchor: true, lamps: 4, upPool: POOL("crowns_central"),
  });
  writePiece("central_mallorn_01", t.blocks, t.size, t.origin, t.connectors, { loopMarkers: sideMarkerCells(t.blocks, t.origin) });
}

// --- combo pieces: bridge + destination tree in one piece ------------------------------------------------------------------
// Every (node, entry connector) pair gets a straight bridge (lengths cycle 7..15) and every second pair also a dog-leg
// (cycle 11l, 11r, 13l, 13r); the entry connector's face is the bridge side, the other connectors stay exits.
// Owner 2026-10-08: dog-legs inside combos are "ugly and unnecessary, it could have been straight" (the destination tree
// moves with the bridge anyway). Combos use straight bridges only; the diagonal stays for the loop-closer, which must
// reach exits that are offset sideways.
const DOG_COMBOS = false;
const comboList = [];
{
  let pair = 0;
  const next = { straight: 0, dog: 0 }; // each bridge variant is used in turn
  for (const [node, tree] of Object.entries(NODES)) {
    for (let ei = 0; ei < tree.connectors.length; ei++) {
      const facing = tree.connectors[ei].facing;
      if (makeCombo(tree, ei, STRAIGHT[0], POOL("combos")).why?.match(/^(entry|another)/)) continue; // no bridge side on this connector
      const want = [[STRAIGHT, "straight"]];
      if (DOG_COMBOS && pair % 2 === 0) want.push([DOGS, "dog"]);
      for (const [list, kind] of want) {
        for (let t = 0; t < list.length; t++) {
          const spec = list[(next[kind] + t) % list.length];
          const cb = makeCombo(tree, ei, spec, POOL("combos"));
          if (cb.why) continue; // this bridge sticks out of this node's width: next one
          const name = `combo_${node}_${facing}_${spec.name}`;
          const nodeWardens = wardenCells(node, tree.blocks, WARDENS[node] ?? 0, 5).map(cb.wardenMap);
          writePiece(name, cb.blocks, cb.size, cb.origin, cb.connectors, {
            markers: [[cb.bridgeMid[0], cb.bridgeMid[1]], [cb.axis[0] + 0.5, cb.axis[1] + 0.5]], wardens: nodeWardens,
            loopMarkers: sideMarkerCells(cb.blocks, cb.origin, (x, z) => z >= cb.bridgeLen), // the node's rims; the bridge half has none
          });
          comboList.push({ name, kind, node });
          next[kind] += t + 1;
          break;
        }
      }
      pair++;
    }
  }
}

// --- crown pieces ------------------------------------------------------------------------------------------------
const crown = (name, o) => { const c = buildCrown(o); writePiece(name, c.blocks, c.size, c.origin, []); };
crown("crown_small", { h: 7, H: 16, seed: 4004, branches: 8, blob: 2.1 });
crown("crown_medium", { h: 8, H: 20, seed: 6006, branches: 9, blob: 2.6 });
crown("crown_large", { h: 10, H: 24, seed: 8008, branches: 11, blob: 2.9 });
crown("crown_central_a", { h: 16, H: 34, seed: 12012, branches: 14, blob: 3.6, central: true });
crown("crown_central_b", { h: 13, H: 30, seed: 10010, branches: 12, blob: 3.3, central: true });

// --- ends ---------------------------------------------------------------------------------------------------------------
// balcony_braced: half-round rim balcony on a log pillar to the ground, braced under the deck; one connector, 7 x 7
{
  const b = buildBalcony();
  writePiece("balcony_braced", b.blocks, b.size, b.origin, b.connectors, { loopMarkers: [[b.origin[0] + 0.5, b.size[2] - 0.5]] }); // centre of the far rim row
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
  // the three free sides (south, east, west) are 5-wide rim rows: loop markers on their centres
  writePiece("lookout_01", blocks, [9, ROOTS + FLOOR_H + 4, 9], [4, ROOTS, 4], deck.connectors.map((c) => ({ ...c, y: FLOOR_H })), { loopMarkers: [[4.5, 8.5], [8.5, 4.5], [0.5, 4.5]] });
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
// a platform exit gets a combo (bridge + tree) or, when none fits, a railing / braced balcony / lookout; never a bridge alone
pool("combos", comboList.map((c) => [c.name, (c.kind === "dog" ? 2 : 3) + (c.node.startsWith("tower_") ? 2 : 0)]) // towers weigh more: most villages should climb to a second level
    .concat(Object.entries(EARLY_END)), POOL("exits"));
pool("exits", [["railing_end", EXIT_WEIGHTS.railing], ["balcony_braced", EXIT_WEIGHTS.balcony], ["lookout_01", EXIT_WEIGHTS.lookout]], POOL("plugs"));
pool("plugs", [["railing_end", 1]]);
// trees placed at max_depth only get the fallback pool (Java rule), so the fallback offers the big crowns too; small is the last resort
pool("crowns", [["crown_large", 3], ["crown_medium", 2]], POOL("crowns_fallback"));
pool("crowns_fallback", [["crown_large", 12], ["crown_medium", 8], ["crown_small", 1]]);
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
