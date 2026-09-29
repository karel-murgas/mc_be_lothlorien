// Writes the giant Mallorn structures for world generation:
//   node tools/build_structures.mjs [count] [firstSeed]
// -> lothlorien_bp/structures/lothlorien/mallorn_flet_NN.mcstructure (structure id lothlorien:mallorn_flet_NN)
//    and features/mallorn_flet_NN_feature.json + mallorn_flet_feature.json (picks one at random);
//    old mallorn_flet_* files are removed first. The feature rule (feature_rules/mallorn_flet_feature_rules.json) is hand-written.
// Each file is SIZE x SIZE_Y x SIZE with the trunk centred horizontally (cells TRUNK_AT..TRUNK_AT+3) and the
// first block above the ground at y ROOT_DEPTH; cells the tree does not fill are structure void, so the
// terrain and plants around it survive. Keep TRUNK_AT / ROOT_DEPTH in step with the feature rule and
// with scripts/showcase.js.
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

// blocks: Map<"x,y,z" (tree coords), { name, states, loot? }>
export function toMcstructure(blocks) {
  const volume = SIZE * SIZE_Y * SIZE;
  const layer0 = new Array(volume).fill(-1);
  const palette = [], paletteIndex = new Map(), positionData = {};
  let clipped = 0;
  for (const [k, v] of blocks) {
    const [tx, ty, tz] = k.split(",").map(Number);
    const x = tx + TRUNK_AT, y = ty + ROOT_DEPTH, z = tz + TRUNK_AT;
    if (x < 0 || x >= SIZE || y < 0 || y >= SIZE_Y || z < 0 || z >= SIZE) { clipped++; continue; }
    const id = JSON.stringify([v.name, v.states]);
    if (!paletteIndex.has(id)) {
      paletteIndex.set(id, palette.length);
      const states = {};
      for (const [sk, sv] of Object.entries(v.states)) states[sk] = stateTag(sv);
      palette.push(compound({ name: str(v.name), states: compound(states), version: int(BLOCK_VERSION) }));
    }
    const index = (x * SIZE_Y + y) * SIZE + z;
    layer0[index] = paletteIndex.get(id);
    if (v.loot) {
      positionData[String(index)] = compound({
        block_entity_data: compound({
          id: str("Chest"), isMovable: byte(true), Findable: byte(false), Items: list(T.compound, []),
          LootTable: str(v.loot), LootTableSeed: int(0), x: int(x), y: int(y), z: int(z),
        }),
      });
    }
  }
  const root = compound({
    format_version: int(1),
    size: list(T.int, [SIZE, SIZE_Y, SIZE].map(int)),
    structure: compound({
      block_indices: list(T.list, [list(T.int, layer0.map(int)), list(T.int, new Array(volume).fill(int(-1)))]),
      entities: list(T.compound, []),
      palette: compound({ default: compound({ block_palette: list(T.compound, palette), block_position_data: compound(positionData) }) }),
    }),
    structure_world_origin: list(T.int, [0, 0, 0].map(int)),
  });
  return { buffer: encode(root), clipped };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const count = parseInt(process.argv[2], 10) || 8;
  const firstSeed = parseInt(process.argv[3], 10) || 1;
  const bp = join(dirname(fileURLToPath(import.meta.url)), "..", "lothlorien_bp");
  const out = join(bp, "structures", "lothlorien");
  mkdirSync(out, { recursive: true });
  for (const dir of [out, join(bp, "features")]) {
    for (const f of readdirSync(dir)) if (f.startsWith("mallorn_flet_")) unlinkSync(join(dir, f));
  }
  const feature = (id, body) => writeFileSync(join(bp, "features", `${id}.json`),
    JSON.stringify({ format_version: "1.13.0", ...body(`lothlorien:${id}`) }, null, 2) + "\n");
  const names = [];
  for (let i = 0; i < count; i++) {
    const seed = firstSeed + i;
    const tree = buildFletMallorn(makeRandom(seed * 7919));
    const { buffer, clipped } = toMcstructure(tree.blocks);
    const name = `mallorn_flet_${String(i + 1).padStart(2, "0")}`;
    writeFileSync(join(out, `${name}.mcstructure`), buffer);
    names.push(name);
    feature(`${name}_feature`, (identifier) => ({
      "minecraft:structure_template_feature": {
        description: { identifier }, structure_name: `lothlorien:${name}`, adjustment_radius: 0,
        facing_direction: "north", constraints: {},
      },
    }));
    const tally = (n) => [...tree.blocks.values()].filter((v) => v.name.endsWith(n)).length;
    console.log(`${name} seed ${seed}: height ${tree.height}, floor ${tree.floorY}, radius ${tree.radius.toFixed(1)}, ` +
      `${tally("_log")} logs, ${tally("_leaves")} leaves (${tree.trimmed} far leaves dropped), ${clipped} clipped, ${buffer.length} bytes`);
  }
  feature("mallorn_flet_feature", (identifier) => ({
    "minecraft:weighted_random_feature": { description: { identifier }, features: names.map((n) => [`lothlorien:${n}_feature`, 1]) },
  }));
}
