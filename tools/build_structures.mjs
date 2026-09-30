// Writes the giant Mallorn structures:
//   node tools/build_structures.mjs
//      the worldgen set: only the trees in CHOSEN (every other giant structure is removed from the pack)
//   node tools/build_structures.mjs <variant|all> [count] [firstSeed]      (defaults 8 1)
//      curation candidates for the dev-only showcase (tools/dev_scripts/showcase.js); they replace that variant's files but never
//      enter worldgen. Run the plain command again before committing, so the pack keeps only CHOSEN.
// -> lothlorien_bp/structures/lothlorien/mallorn_<variant>_NN.mcstructure (id lothlorien:mallorn_<variant>_NN)
//    and worldgen/template_pools/giant_mallorn.json (the CHOSEN trees) for the jigsaw structure
//    lothlorien:giant_mallorn (worldgen/structures + structure_sets, hand-written). A plain structure
//    feature was cut at chunk borders; jigsaw structures may span chunks.
// Tree NN of every variant uses the same seed, so flet_07 and woven_07 share their trunk and height.
// Each file is SIZE x SIZE_Y x SIZE with the trunk centred horizontally (cells TRUNK_AT..TRUNK_AT+3) and the
// first block above the ground at y ROOT_DEPTH; cells the tree does not fill are structure void, so the
// terrain and plants around it survive. Keep TRUNK_AT / ROOT_DEPTH in step with tools/dev_scripts/showcase.js and
// with start_height (-ROOT_DEPTH) in worldgen/structures/giant_mallorn.json.
import { writeFileSync, mkdirSync, readdirSync, unlinkSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { makeRandom } from "../lothlorien_bp/scripts/mallorn_tree.js";
import { buildFletMallorn, ROOT_DEPTH } from "./flet_mallorn.mjs";

export const SIZE = 40, SIZE_Y = 54, TRUNK_AT = 18;
const BLOCK_VERSION = 18168865; // as in the vanilla 1.26.30 structures

// --- little-endian NBT (Bedrock) -------------------------------------------------------------
const T = { byte: 1, int: 3, string: 8, list: 9, compound: 10 };
const tag = (type, value, of) => ({ type, value, of });
const byte = (v) => tag(T.byte, v ? 1 : 0);
const int = (v) => tag(T.int, v);
const str = (v) => tag(T.string, v);
const list = (of, items) => tag(T.list, items, of);
const compound = (obj) => tag(T.compound, obj);

function encode(root) {
  const parts = [];
  const u8 = (v) => { const b = Buffer.alloc(1); b.writeUInt8(v); parts.push(b); };
  const i32 = (v) => { const b = Buffer.alloc(4); b.writeInt32LE(v); parts.push(b); };
  const s = (v) => { const d = Buffer.from(v, "utf8"); const b = Buffer.alloc(2); b.writeUInt16LE(d.length); parts.push(b, d); };
  const payload = (t) => {
    if (t.type === T.byte) { const b = Buffer.alloc(1); b.writeInt8(t.value); parts.push(b); }
    else if (t.type === T.int) i32(t.value);
    else if (t.type === T.string) s(t.value);
    else if (t.type === T.list) { u8(t.value.length ? t.of : 0); i32(t.value.length); for (const e of t.value) payload(e); }
    else if (t.type === T.compound) {
      for (const [k, v] of Object.entries(t.value)) { u8(v.type); s(k); payload(v); }
      u8(0);
    } else throw new Error(`tag type ${t.type}`);
  };
  u8(T.compound); s(""); payload(root);
  return Buffer.concat(parts);
}

const stateTag = (v) => (typeof v === "boolean" ? byte(v) : typeof v === "number" ? int(v) : str(v));

// blocks: Map<"x,y,z" (tree coords), { name, states, loot? }>. size/offset default to the giant tree box.
export function toMcstructure(blocks, [SX, SY, SZ] = [SIZE, SIZE_Y, SIZE], [OX, OY, OZ] = [TRUNK_AT, ROOT_DEPTH, TRUNK_AT]) {
  const volume = SX * SY * SZ;
  const layer0 = new Array(volume).fill(-1);
  const palette = [], paletteIndex = new Map(), positionData = {};
  let clipped = 0;
  for (const [k, v] of blocks) {
    const [tx, ty, tz] = k.split(",").map(Number);
    const x = tx + OX, y = ty + OY, z = tz + OZ;
    if (x < 0 || x >= SX || y < 0 || y >= SY || z < 0 || z >= SZ) { clipped++; continue; }
    const id = JSON.stringify([v.name, v.states]);
    if (!paletteIndex.has(id)) {
      paletteIndex.set(id, palette.length);
      const states = {};
      for (const [sk, sv] of Object.entries(v.states)) states[sk] = stateTag(sv);
      palette.push(compound({ name: str(v.name), states: compound(states), version: int(BLOCK_VERSION) }));
    }
    const index = (x * SY + y) * SZ + z;
    layer0[index] = paletteIndex.get(id);
    if (v.loot) {
      positionData[String(index)] = compound({
        block_entity_data: compound({
          id: str("Chest"), isMovable: byte(true), Findable: byte(false), Items: list(T.compound, []),
          LootTable: str(v.loot), LootTableSeed: int(0), x: int(x), y: int(y), z: int(z),
        }),
      });
    }
    if (v.jigsaw) {
      positionData[String(index)] = compound({
        block_entity_data: compound({
          id: str("JigsawBlock"), isMovable: byte(true), name: str(v.jigsaw), target: str("minecraft:empty"),
          target_pool: str("minecraft:empty"), final_state: str(v.finalState), joint: str("rollable"),
          x: int(x), y: int(y), z: int(z),
        }),
      });
    }
  }
  const root = compound({
    format_version: int(1),
    size: list(T.int, [SX, SY, SZ].map(int)),
    structure: compound({
      block_indices: list(T.list, [list(T.int, layer0.map(int)), list(T.int, new Array(volume).fill(int(-1)))]),
      entities: list(T.compound, []),
      palette: compound({ default: compound({ block_palette: list(T.compound, palette), block_position_data: compound(positionData) }) }),
    }),
    structure_world_origin: list(T.int, [0, 0, 0].map(int)),
  });
  return { buffer: encode(root), clipped };
}

// Variants: options for buildFletMallorn. Add one here to experiment without touching the others.
export const VARIANTS = {
  flet: {},
  woven: { woven: true, lush: true },
  plain: { woven: true, lush: true, flet: false },
};

// Trees placed by world generation: variant + number (the number is the seed). Picked in game 2026-09-29.
// The third value is the pool weight: flet trees (woven) are 2 x 2 = 4 of 16, so about 1 giant in 4 has a flet.
export const CHOSEN = [["woven", 5, 2], ["woven", 7, 2], ["plain", 2, 3], ["plain", 3, 3], ["plain", 6, 3], ["plain", 8, 3]];

// Jigsaw anchor: the bottom trunk cell holds a jigsaw block with this name, and the jigsaw structure's
// start_jigsaw_name puts that block on the structure start. So the trunk stays on the start point however
// the piece is rotated (without it, rotation about the piece corner moved trunks by up to a piece width).
export const TRUNK_ANCHOR = "lothlorien:giant_trunk";
export const ANCHOR_AT = { x: 1, y: -ROOT_DEPTH, z: 1 };

// Hidden structure marker (Phase 12, white-deer guidance): one unbreakable block inside the buried part of the trunk,
// next to the anchor, 4 blocks under the ground. Every guideable structure gets one (lothlorien:structure_marker).
export const MARKER_AT = { x: 2, y: -ROOT_DEPTH + 1, z: 2 };
export const MARKER_BLOCK = "lothlorien:structure_marker";

const treeName = (variant, n) => `mallorn_${variant}_${String(n).padStart(2, "0")}`;

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const [which, countArg, seedArg] = process.argv.slice(2);
  const bp = join(dirname(fileURLToPath(import.meta.url)), "..", "lothlorien_bp");
  const out = join(bp, "structures", "lothlorien");
  mkdirSync(out, { recursive: true });
  // removes the structure files of the given variants (and per-tree feature files from before 2026-09-30)
  const clean = (variants) => {
    const re = new RegExp(`^mallorn_(${variants.join("|")})_\\d\\d[._]`);
    for (const dir of [out, join(bp, "features")]) for (const f of readdirSync(dir)) if (re.test(f)) unlinkSync(join(dir, f));
  };
  const write = (variant, n) => {
    const tree = buildFletMallorn(makeRandom(n * 7919), VARIANTS[variant]);
    tree.blocks.set(`${ANCHOR_AT.x},${ANCHOR_AT.y},${ANCHOR_AT.z}`, {
      name: "minecraft:jigsaw", states: { facing_direction: 0, rotation: 0 }, jigsaw: TRUNK_ANCHOR, finalState: "lothlorien:mallorn_log",
    });
    tree.blocks.set(`${MARKER_AT.x},${MARKER_AT.y},${MARKER_AT.z}`, { name: MARKER_BLOCK, states: {} });
    const { buffer, clipped } = toMcstructure(tree.blocks);
    const name = treeName(variant, n);
    writeFileSync(join(out, `${name}.mcstructure`), buffer);
    const tally = (t) => [...tree.blocks.values()].filter((b) => b.name.endsWith(t)).length;
    console.log(`${name}: height ${tree.height}, floor ${tree.floorY}, radius ${tree.radius.toFixed(1)}, ` +
      `${tally("_log")} logs, ${tally("_leaves")} leaves (${tree.trimmed} far leaves dropped), ${clipped} clipped, ${buffer.length} bytes`);
  };

  if (!which) {
    clean(Object.keys(VARIANTS));
    for (const [variant, n] of CHOSEN) write(variant, n);
  } else {
    const variants = which === "all" ? Object.keys(VARIANTS) : [which];
    for (const v of variants) if (!VARIANTS[v]) throw new Error(`unknown variant ${v}; known: ${Object.keys(VARIANTS).join(", ")}`);
    const count = parseInt(countArg, 10) || 8, firstSeed = parseInt(seedArg, 10) || 1;
    clean(variants);
    for (const v of variants) for (let n = firstSeed; n < firstSeed + count; n++) write(v, n);
    // worldgen must not lose a chosen tree that falls outside the candidate range
    for (const [v, n] of CHOSEN) if (variants.includes(v) && (n < firstSeed || n >= firstSeed + count)) write(v, n);
    console.log("candidates written; run `node tools/build_structures.mjs` before committing to keep only CHOSEN in the pack");
  }
  mkdirSync(join(bp, "worldgen", "template_pools"), { recursive: true });
  writeFileSync(join(bp, "worldgen", "template_pools", "giant_mallorn.json"), JSON.stringify({
    format_version: "1.21.100",
    "minecraft:template_pool": {
      description: { identifier: "lothlorien:giant_mallorn" },
      elements: CHOSEN.map(([v, n, weight]) => ({
        element: { element_type: "minecraft:single_pool_element", location: `lothlorien/${treeName(v, n)}` },
        weight,
      })),
    },
  }, null, 2) + "\n");
  console.log(`worldgen picks from ${CHOSEN.map(([v, n]) => treeName(v, n)).join(", ")}`);
}
