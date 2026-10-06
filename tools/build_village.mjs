// Writes the Elven jigsaw village pieces, pools and structure (design: docs/design/lothlorien_jigsaw_settlement.md):
//   node tools/build_village.mjs
// -> lothlorien_bp/structures/lothlorien/village/<piece>.mcstructure   (id lothlorien:village/<piece>)
//    lothlorien_bp/worldgen/template_pools/village_<pool>.json         (id lothlorien:village/<pool>)
//    lothlorien_bp/worldgen/structures/elven_village.json              (no structure set: /place structure only)
// Connector standard: one jigsaw per connection in the deck layer, on the outer face of the piece box, middle of a
// 5-wide deck (3 walk cells + rails), name = target = lothlorien:village_deck, aligned joint, final state planks.
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { toMcstructure } from "./build_structures.mjs";
import { B } from "./flet_mallorn.mjs";
import {
  ROOTS, FLOOR_H, FACING, key, Deck, buildVillageTree, deckJigsaw, lantern, lonelyFence, writeFences,
} from "./village_mallorn.mjs";

const bp = join(dirname(fileURLToPath(import.meta.url)), "..", "lothlorien_bp");
const out = join(bp, "structures", "lothlorien", "village");
mkdirSync(out, { recursive: true });
mkdirSync(join(bp, "worldgen", "template_pools"), { recursive: true });
mkdirSync(join(bp, "worldgen", "structures"), { recursive: true });

const POOL = (n) => `lothlorien:village/${n}`;
const planks = () => ({ name: B.planks, states: {} });
const AIR = { name: "minecraft:air", states: {} };
const summary = [];

// writes a piece; origin = box coordinates of the piece-coordinate origin
function checkConnectors(name, blocks, connectors, depth) {
  // connector standard: deck under 5 cells, rails at +-2, air headroom above the walk cells, for `depth` cells inward
  for (const c of connectors) {
    const { d } = FACING[c.facing], p = [-d[1], d[0]];
    const at = (a, off, y) => blocks.get(key(c.x - d[0] * a + p[0] * off, y, c.z - d[1] * a + p[1] * off));
    for (let a = 0; a < depth; a++) for (let off = -2; off <= 2; off++) {
      const deckB = at(a, off, deckY(name)), ok = a === 0 && off === 0 ? deckB?.name === "minecraft:jigsaw" : deckB?.name === B.planks;
      if (!ok) throw new Error(`${name}: ${c.facing} connector: bad deck at ${a},${off}`);
      for (let h = 1; h <= 3; h++) {
        const b = at(a, off, deckY(name) + h);
        if (Math.abs(off) === 2) { if (h === 1 ? b?.name !== B.fence : (b && b.name !== "minecraft:air" && b.name !== LANTERN_ID)) throw new Error(`${name}: ${c.facing} bad rail column at ${a},${off},${h}`); }
        else if (b?.name !== "minecraft:air") throw new Error(`${name}: ${c.facing} headroom not air at ${a},${off},${h}: ${b?.name}`);
      }
    }
  }
}
const LANTERN_ID = "lothlorien:elven_lantern";
const deckY = (name) => (name.startsWith("bridge") ? 0 : FLOOR_H);
function writePiece(name, blocks, size, origin, deckBoxY, connectors) {
  if (name !== "railing_end") checkConnectors(name, blocks, connectors, name === "lookout_01" ? 1 : 4);
  const [sx, sy, sz] = size;
  const { buffer, clipped } = toMcstructure(blocks, size, origin);
  if (clipped) throw new Error(`${name}: ${clipped} blocks outside the box`);
  writeFileSync(join(out, `${name}.mcstructure`), buffer);
  const tally = (f) => [...blocks.values()].filter(f).length;
  const conn = connectors.map((c) => `${c.facing}@(${c.x + origin[0]},${deckBoxY},${c.z + origin[2]})`).join(" ");
  summary.push(`${name}: ${sx}x${sy}x${sz}, deck y ${deckBoxY}, connectors ${conn || "none"}; ` +
    `${tally((b) => b.name.endsWith("_log") || b.name.endsWith("_wood"))} logs, ${tally((b) => b.name === B.leaves)} leaves, ` +
    `${tally((b) => b.name === B.planks)} planks, ${tally((b) => b.name === B.fence)} fences, ${buffer.length} bytes`);
}

// --- tree pieces ---------------------------------------------------------------------------------
function treePiece(name, opts) {
  const { blocks, deck } = buildVillageTree({ pool: POOL("bridges"), ...opts });
  const half = opts.half, w = 2 * half + 1, h = Math.max(...[...blocks.keys()].map((k) => +k.split(",")[1])) + ROOTS + 1;
  writePiece(name, blocks, [w, h, w], [half, ROOTS, half], ROOTS + FLOOR_H, deck.connectors);
  return deck;
}
treePiece("central_mallorn_01", {
  half: 16, R: 10.5, big: true, topY: 40, seed: 20261007, connectors: ["north", "east", "south", "west"],
  rope: true, anchor: true, rimLamps: 4, crown: 11,
});
treePiece("tree_platform_01", { half: 12, R: 7.5, big: false, topY: 30, seed: 11011, connectors: ["west", "east", "south"], rimLamps: 0, crown: 8 });
treePiece("tree_platform_02", { half: 12, R: 7.5, big: false, topY: 31, seed: 22022, connectors: ["north", "east"], rimLamps: 0, crown: 8 });

// --- bridges: 5 wide, deck at box y 0, along z -------------------------------------------------------
function bridge(name, length, lanternPosts) {
  const blocks = new Map();
  const fences = new Set(), forced = new Map();
  for (let z = 0; z < length; z++) {
    for (let x = 0; x < 5; x++) {
      blocks.set(key(x, 0, z), planks());
      if (x >= 1 && x <= 3) for (let h = 1; h <= 3; h++) blocks.set(key(x, h, z), AIR);
    }
    for (const x of [0, 4]) {
      fences.add(`${x},${z}`);
      const sides = [];
      if (z === 0) sides.push("north");
      if (z === length - 1) sides.push("south");
      if (sides.length) forced.set(`${x},${z}`, sides);
    }
  }
  writeFences(blocks, 1, fences, forced);
  if (lanternPosts) {
    const z = Math.floor(length / 2);
    for (const x of [0, 4]) { blocks.set(key(x, 2, z), lonelyFence()); blocks.set(key(x, 3, z), lantern()); }
  }
  const connectors = [{ x: 2, z: 0, facing: "north" }, { x: 2, z: length - 1, facing: "south" }];
  for (const c of connectors) blocks.set(key(c.x, 0, c.z), deckJigsaw(c.facing, POOL("nodes")));
  writePiece(name, blocks, [5, 4, length], [0, 0, 0], 0, connectors);
}
bridge("bridge_short", 7, false);
bridge("bridge_long", 11, true);

// --- lookout: round platform <= 9x9 on a log pillar down to ROOTS, one connector ------------------------
{
  const blocks = new Map();
  const deckY = FLOOR_H;
  for (let y = -ROOTS; y < deckY; y++) for (const [x, z] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) blocks.set(key(x, y, z), { name: B.log, states: { "minecraft:block_face": "up" } });
  const deck = new Deck(blocks, deckY, { half: 4, R: 4.3 });
  deck.platform();
  deck.walkway("north", "minecraft:empty");
  deck.finish();
  blocks.set(key(2, deckY + 1, 2), lantern());
  writePiece("lookout_01", blocks, [9, ROOTS + deckY + 4, 9], [4, ROOTS, 4], ROOTS + deckY, deck.connectors);
}

// --- railing_end: deck row of 5 + 5 fences above; connector at the middle deck cell facing the parent ----------
{
  const blocks = new Map();
  const fences = new Set(), forced = new Map();
  for (let x = 0; x < 5; x++) { blocks.set(key(x, 0, 0), planks()); fences.add(`${x},0`); }
  forced.set("0,0", ["north"]); forced.set("4,0", ["north"]);
  writeFences(blocks, 1, fences, forced);
  const connectors = [{ x: 2, z: 0, facing: "north" }];
  blocks.set(key(2, 0, 0), deckJigsaw("north", "minecraft:empty"));
  writePiece("railing_end", blocks, [5, 2, 1], [0, 0, 0], 0, connectors);
}

// --- pools and structure ----------------------------------------------------------------------------
const pool = (name, elements, fallback) => {
  const node = {
    description: { identifier: POOL(name) },
    elements: elements.map(([piece, weight]) => ({
      element: { element_type: "minecraft:single_pool_element", location: `lothlorien/village/${piece}`, projection: "rigid" },
      weight,
    })),
  };
  if (fallback) node.fallback = fallback;
  writeFileSync(join(bp, "worldgen", "template_pools", `village_${name}.json`),
    JSON.stringify({ format_version: "1.21.100", "minecraft:template_pool": node }, null, 2) + "\n");
};
pool("start", [["central_mallorn_01", 1]]);
pool("bridges", [["bridge_short", 5], ["bridge_long", 5], ["railing_end", 1]], POOL("plugs"));
pool("nodes", [["tree_platform_01", 1], ["tree_platform_02", 1]], POOL("ends"));
pool("ends", [["lookout_01", 4], ["railing_end", 1]], "minecraft:empty");
pool("plugs", [["railing_end", 1]]);

writeFileSync(join(bp, "worldgen", "structures", "elven_village.json"), JSON.stringify({
  format_version: "1.21.100",
  "minecraft:jigsaw": {
    description: { identifier: "lothlorien:elven_village" },
    biome_filters: [{ test: "has_biome_tag", value: "lothlorien" }],
    step: "surface_structures",
    terrain_adaptation: "none",
    start_pool: POOL("start"),
    start_jigsaw_name: "lothlorien:village_anchor",
    max_depth: 6,
    start_height: { type: "constant", value: { absolute: -ROOTS } },
    heightmap_projection: "world_surface",
    max_distance_from_center: { horizontal: 116, vertical: 116 },
  },
}, null, 2) + "\n");

console.log(summary.join("\n"));
