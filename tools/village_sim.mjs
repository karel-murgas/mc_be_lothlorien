// Elven village assembly simulator: reads the real .mcstructure pieces, template pools and structure JSON and assembles
// villages with JigsawPlacement semantics (breadth-first, weighted pool order, fallback, first fit), then checks them.
// Verified against a Bedrock 1.26.5x world save (2026-10-07, see references/10-jigsaw-pieces.md): the geometry of
// real placement IS the Java algorithm (adjacent connector cells, box collision, depth rule, fallback = plugs). What
// differs is block-state handling, which the sim now models: vanilla-namespace states `minecraft:block_face`
// (horizontal logs) and `minecraft:connection_*` (fences) rotate with the piece, custom-namespace states
// (`lothlorien:face` on the rope) do NOT. check() also reports (info, not failures) rope/trunk mismatch, leaves that
// will decay (no leaf path <= 10 to wood) and near-miss dead ends (two open decks a few blocks apart).
//   node tools/village_sim.mjs [seeds=20] [firstSeed=1]     (run from mods/lothlorien; PNGs go to temp/elven_village/sim/)
// Also imported by tests/run.mjs.
import { readFileSync, readdirSync, writeFileSync, mkdirSync, realpathSync, unlinkSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const bp = join(root, "lothlorien_bp");
import { RAIL, SLAB } from "./village_mallorn.mjs";
import { MARKER_ID, decide, exitAt, finalBlocks } from "../lothlorien_bp/scripts/village_loop.js";
export const PLANKS = "lothlorien:mallorn_planks", FENCE = RAIL, LANTERN_ID = "lothlorien:elven_lantern";
const EMPTY = "minecraft:empty", AIR = "minecraft:air", JIGSAW = "minecraft:jigsaw";
const FACING_VEC = { 2: [0, -1], 3: [0, 1], 4: [-1, 0], 5: [1, 0] };
const VERT = { 0: [0, -1, 0], 1: [0, 1, 0] }; // facing_direction 0 down, 1 up (vertical jigsaws: crowns)

// ---- little-endian NBT reader (Bedrock) ----------------------------------------------------------------
export function readNbt(buf) {
  let p = 0;
  const s = () => { const n = buf.readUInt16LE(p); p += 2; const v = buf.toString("utf8", p, p + n); p += n; return v; };
  const val = (t) => {
    switch (t) {
      case 1: return buf.readInt8(p++);
      case 2: { const v = buf.readInt16LE(p); p += 2; return v; }
      case 3: { const v = buf.readInt32LE(p); p += 4; return v; }
      case 4: { p += 8; return 0; }
      case 5: { const v = buf.readFloatLE(p); p += 4; return v; }
      case 6: { p += 8; return 0; }
      case 7: { const n = buf.readInt32LE(p); p += 4 + n; return null; }
      case 8: return s();
      case 9: { const it = buf.readUInt8(p++); const n = buf.readInt32LE(p); p += 4; const a = []; for (let i = 0; i < n; i++) a.push(val(it)); return a; }
      case 10: { const o = {}; for (;;) { const tt = buf.readUInt8(p++); if (!tt) break; const k = s(); o[k] = val(tt); } return o; }
      case 11: { const n = buf.readInt32LE(p); p += 4 + 4 * n; return null; }
      default: throw new Error("nbt tag " + t);
    }
  };
  const t = buf.readUInt8(p++); s(); return val(t);
}

// ---- pieces ---------------------------------------------------------------------------------------------
export function parseMcstructure(buf, name = "?") {
  const v = readNbt(buf);
  const [sx, sy, sz] = v.size;
  const pal = v.structure.palette.default;
  const layer = v.structure.block_indices[0];
  const grid = new Array(layer.length); // block name per cell, null = void
  const blocks = [], jigsaws = [];
  for (let i = 0; i < layer.length; i++) {
    const pi = layer[i];
    if (pi < 0) { grid[i] = null; continue; }
    const entry = pal.block_palette[pi];
    grid[i] = entry.name;
    const z = i % sz, y = Math.floor(i / sz) % sy, x = Math.floor(i / (sz * sy));
    if (entry.name === JIGSAW) {
      const e = pal.block_position_data[String(i)]?.block_entity_data;
      if (!e) throw new Error(`${name}: jigsaw at ${x},${y},${z} has no block entity`);
      const dir = FACING_VEC[entry.states.facing_direction] ?? null;
      jigsaws.push({ x, y, z, dirId: entry.states.facing_direction, dir, vec: dir ? [dir[0], 0, dir[1]] : VERT[entry.states.facing_direction] ?? null,
        name: e.name, target: e.target, pool: e.target_pool, final: e.final_state, joint: e.joint });
    } else if (entry.name !== AIR) blocks.push({ x, y, z, name: entry.name, states: entry.states ?? {} });
  }
  const entities = (v.structure.entities ?? []).map((e) => ({ id: e.identifier, pos: e.Pos, defs: e.definitions, invulnerable: !!e.Invulnerable, mainhand: e.Mainhand?.[0]?.Name }));
  return { name, size: [sx, sy, sz], grid, blocks, jigsaws, entities, at: (x, y, z) => (x < 0 || y < 0 || z < 0 || x >= sx || y >= sy || z >= sz ? undefined : grid[(x * sy + y) * sz + z]) };
}

const SIDES = ["north", "east", "south", "west"];
// One quarter turn clockwise (seen from above), the way Bedrock rotates states (verified from a world save):
// only vanilla-namespace states move; `lothlorien:*` states stay as written.
export function rotateStates(name, st) {
  if (!st) return st;
  const out = { ...st };
  if (typeof st["minecraft:block_face"] === "string" && SIDES.includes(st["minecraft:block_face"]))
    out["minecraft:block_face"] = SIDES[(SIDES.indexOf(st["minecraft:block_face"]) + 1) % 4];
  // trait state of `lothlorien:elven_rope_hanging` (placement_direction); assumed to turn like block_face, test in game
  if (typeof st["minecraft:cardinal_direction"] === "string" && SIDES.includes(st["minecraft:cardinal_direction"]))
    out["minecraft:cardinal_direction"] = SIDES[(SIDES.indexOf(st["minecraft:cardinal_direction"]) + 1) % 4];
  for (let i = 0; i < 4; i++) {
    const from = `minecraft:connection_${SIDES[i]}`, to = `minecraft:connection_${SIDES[(i + 1) % 4]}`;
    if (from in st) out[to] = st[from];
  }
  return out;
}

const rotCache = new WeakMap();
// rotation r (quarter turns clockwise seen from above: (x,z) -> (sz-1-z, x)); returns { size, blocks, jigsaws }
export function rotated(piece, r) {
  let list = rotCache.get(piece);
  if (!list) rotCache.set(piece, (list = []));
  if (list[r]) return list[r];
  let cur;
  if (r === 0) cur = { size: piece.size, blocks: piece.blocks, jigsaws: piece.jigsaws };
  else {
    const prev = rotated(piece, r - 1), [sx, sy, sz] = prev.size;
    const f = (o) => ({ ...o, x: sz - 1 - o.z, z: o.x, ...(o.states ? { states: rotateStates(o.name, o.states) } : {}) });
    cur = { size: [sz, sy, sx], blocks: prev.blocks.map(f), jigsaws: prev.jigsaws.map((j) => ({ ...f(j), dir: j.dir ? [-j.dir[1], j.dir[0]] : null, vec: j.dir ? [-j.dir[1], 0, j.dir[0]] : j.vec })) };
  }
  return (list[r] = cur);
}

export function loadVillageData() {
  const structure = JSON.parse(readFileSync(join(bp, "worldgen/structures/elven_village.json"), "utf8"))["minecraft:jigsaw"];
  if (process.env.VILLAGE_MAX_DEPTH) structure.max_depth = parseInt(process.env.VILLAGE_MAX_DEPTH, 10); // tuning aid only
  const pools = new Map();
  const pdir = join(bp, "worldgen/template_pools");
  for (const f of readdirSync(pdir)) {
    const p = JSON.parse(readFileSync(join(pdir, f), "utf8"))["minecraft:template_pool"];
    pools.set(p.description.identifier, p);
  }
  const pieces = new Map(); // location -> piece
  const getPiece = (loc) => {
    if (!pieces.has(loc)) pieces.set(loc, parseMcstructure(readFileSync(join(bp, "structures", `${loc}.mcstructure`)), loc.split("/").pop()));
    return pieces.get(loc);
  };
  // load every piece the pools reference (throws on a missing pool or file)
  for (const [id, p] of pools) {
    if (!id.startsWith("lothlorien:village/")) continue;
    for (const e of p.elements) getPiece(e.element.location);
    if (p.fallback && p.fallback !== EMPTY && !pools.has(p.fallback)) throw new Error(`pool ${p.fallback} (fallback of ${id}) not found`);
  }
  if (!pools.has(structure.start_pool)) throw new Error(`start pool ${structure.start_pool} not found`);
  return { structure, pools, pieces, getPiece };
}

// ---- RNG ------------------------------------------------------------------------------------------------
function rng(seed) {
  let a = (seed * 2654435761) >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const shuffle = (arr, r) => { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
function weightedOrder(elements, r) {
  const left = [...elements], out = [];
  while (left.length) {
    const total = left.reduce((s, e) => s + (e.weight ?? 1), 0);
    let x = r() * total, i = 0;
    for (; i < left.length - 1; i++) { x -= left[i].weight ?? 1; if (x < 0) break; }
    out.push(left.splice(i, 1)[0]);
  }
  return out;
}

// ---- assembly ---------------------------------------------------------------------------------------------
export function simulate(data, seed, { maxPieces = 600 } = {}) {
  const r = rng(seed), { structure, pools, getPiece } = data;
  const mdc = structure.max_distance_from_center;
  const H = typeof mdc === "number" ? mdc : mdc.horizontal;
  const V = typeof mdc === "number" ? mdc : mdc.vertical ?? H;
  const maxDepth = structure.max_depth;
  const make = (piece, rot, o, depth) => {
    const rp = rotated(piece, rot);
    return { piece, name: piece.name, rot, rp, o, depth, max: [o[0] + rp.size[0] - 1, o[1] + rp.size[1] - 1, o[2] + rp.size[2] - 1] };
  };
  const startEl = weightedOrder(pools.get(structure.start_pool).elements, r)[0];
  const sp = getPiece(startEl.element.location), srot = Math.floor(r() * 4), srp = rotated(sp, srot);
  const anchor = srp.jigsaws.find((j) => j.name === structure.start_jigsaw_name);
  if (!anchor) throw new Error("start jigsaw missing");
  const start = make(sp, srot, [-anchor.x, -anchor.y, -anchor.z], 0);
  const placed = [start], queue = [start], connections = [], unfilled = [];
  let capped = false;
  const fits = (b) => {
    if (b.o[0] < -H || b.max[0] > H || b.o[2] < -H || b.max[2] > H || b.o[1] < -V || b.max[1] > V) return false;
    for (const p of placed) {
      if (b.o[0] <= p.max[0] && b.max[0] >= p.o[0] && b.o[1] <= p.max[1] && b.max[1] >= p.o[1] && b.o[2] <= p.max[2] && b.max[2] >= p.o[2]) return false;
    }
    return true;
  };
  while (queue.length) {
    const parent = queue.shift();
    for (const pj of shuffle(parent.rp.jigsaws, r)) {
      if (parent.used?.has(pj) || pj.pool === EMPTY || !pj.vec) continue;
      const pool = pools.get(pj.pool);
      if (!pool) throw new Error(`unknown pool ${pj.pool}`);
      const fb = pool.fallback && pool.fallback !== EMPTY ? pools.get(pool.fallback) : null;
      const cands = [...(parent.depth < maxDepth ? weightedOrder(pool.elements, r) : []), ...(fb ? weightedOrder(fb.elements, r) : [])];
      const pw = [parent.o[0] + pj.x, parent.o[1] + pj.y, parent.o[2] + pj.z];
      const cell = [pw[0] + pj.vec[0], pw[1] + pj.vec[1], pw[2] + pj.vec[2]];
      let done = false;
      for (const el of cands) {
        if (el.element.element_type === "minecraft:empty_pool_element") continue;
        const piece = getPiece(el.element.location);
        for (const rot of shuffle([0, 1, 2, 3], r)) {
          const rp = rotated(piece, rot);
          for (const cj of shuffle(rp.jigsaws.filter((j) => j.name === pj.target && j.vec && j.vec[0] === -pj.vec[0] && j.vec[1] === -pj.vec[1] && j.vec[2] === -pj.vec[2]), r)) {
            const child = make(piece, rot, [cell[0] - cj.x, cell[1] - cj.y, cell[2] - cj.z], parent.depth + 1);
            if (placed.length >= maxPieces) { capped = true; continue; }
            if (!fits(child)) continue;
            child.used = new Set([cj]);
            placed.push(child); queue.push(child);
            connections.push({ parent, child, pj, cj, pw, cw: [child.o[0] + cj.x, child.o[1] + cj.y, child.o[2] + cj.z] });
            done = true; break;
          }
          if (done) break;
        }
        if (done) break;
      }
      if (!done) unfilled.push({ piece: parent.name, at: pw, pool: pj.pool, vertical: pj.vec[1] !== 0 });
    }
  }
  return { seed, placed, connections, unfilled, capped, start };
}

// ---- merged block world -------------------------------------------------------------------------------------
const OFF = 512, S = 1024;
export const wkey = (x, y, z) => ((x + OFF) * S + (y + OFF)) * S + (z + OFF);
export const wdecode = (k) => { const z = (k % S) - OFF, y = (Math.floor(k / S) % S) - OFF, x = Math.floor(k / (S * S)) - OFF; return [x, y, z]; };
export function buildWorld(res, states = null) {
  const w = new Map();
  for (const p of res.placed) {
    const [ox, oy, oz] = p.o;
    for (const b of p.rp.blocks) { w.set(wkey(ox + b.x, oy + b.y, oz + b.z), b.name); states?.set(wkey(ox + b.x, oy + b.y, oz + b.z), b.states); }
    for (const j of p.rp.jigsaws) w.set(wkey(ox + j.x, oy + j.y, oz + j.z), j.final);
  }
  return w;
}

// ---- rendering ---------------------------------------------------------------------------------------------------
const crcT = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = (b) => { let c = 0xffffffff; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
function png(w, h, rgb) {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * 3 + 1)] = 0; rgb.copy(raw, y * (w * 3 + 1) + 1, y * w * 3, (y + 1) * w * 3); }
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]), crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}
function colour(n) {
  if (n === JIGSAW) return [230, 30, 30];
  if (n.endsWith("planks")) return [200, 165, 105];
  if (n.endsWith("fence")) return [110, 70, 35];
  if (n.endsWith("_log") || n.endsWith("_wood")) return [150, 155, 160];
  if (n.endsWith("leaves")) return [215, 170, 40];
  if (n.includes("lantern")) return [255, 245, 80];
  if (n.endsWith("rope")) return [250, 250, 250];
  return [120, 120, 130];
}
const SCALE = 4, BG = [24, 28, 36];
let scaleNow = SCALE;
function image(w, h, pixel, SCALE = scaleNow) {
  const buf = Buffer.alloc(w * SCALE * h * SCALE * 3);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const c = pixel(x, y) ?? BG;
    for (let dy = 0; dy < SCALE; dy++) for (let dx = 0; dx < SCALE; dx++) {
      const i = ((y * SCALE + dy) * w * SCALE + x * SCALE + dx) * 3;
      buf[i] = c[0]; buf[i + 1] = c[1]; buf[i + 2] = c[2];
    }
  }
  return png(w * SCALE, h * SCALE, buf);
}
export const kindOf = (name) => name.startsWith("central") ? "central" : name.startsWith("combo_node_") ? "node" : name.startsWith("combo_tower_") ? "tower"
  : name.startsWith("bridge_") ? "bridgeAlone" : name.startsWith("crown_") ? "crown"
  : name.startsWith("balcony_") ? "balcony" : name === "lookout_01" ? "lookout" : name === "railing_end" ? "plug" : "other";
// a combo piece = bridge + its destination tree; the bridge kind is the name suffix
export const bridgeKindOf = (name) => (!name.startsWith("combo_") ? null : /_bridge_dog_/.test(name) ? "dog" : "straight");

// ---- walking: 3D, half-block steps ---------------------------------------------------------------------------------
// Heights in half-blocks. A block in layer y spans [2y, 2y+2]; a bottom slab [2y, 2y+1], a top slab [2y+1, 2y+2]; a rail
// [2y, 2y+3] (1.5 blocks). Walking surfaces are mallorn planks and slabs; a cell is walkable when nothing solid reaches into
// the 2 blocks above the surface; a step is allowed between 4-neighbour cells whose surfaces differ by <= 1 (0.5 block).
const extent = (n, st, y) => {
  if (n === undefined || n === AIR || n === JIGSAW || (n && n.startsWith("lothlorien:elven_rope"))) return null;
  if (n === SLAB) return st?.["minecraft:vertical_half"] === "top" ? [2 * y + 1, 2 * y + 2] : [2 * y, 2 * y + 1];
  if (n === FENCE) return [2 * y, 2 * y + 3];
  return [2 * y, 2 * y + 2];
};
export function walkability(res, world, states) {
  const cells = [], byCol = new Map();
  for (const [k, n] of world) {
    if (n !== PLANKS && n !== SLAB) continue;
    const [x, y, z] = wdecode(k);
    const top = n === PLANKS || states.get(k)?.["minecraft:vertical_half"] === "top";
    const s = top ? 2 * y + 2 : 2 * y + 1;
    let clear = true;
    for (let h = 1; h <= 2 && clear; h++) {
      const q = wkey(x, y + h, z), e = extent(world.get(q), states.get(q), y + h);
      if (e && e[0] < s + 4 && e[1] > s) clear = false;
    }
    if (!clear) continue;
    const c = { x, y, z, s };
    cells.push(c);
    const ck = x * S + z;
    if (!byCol.has(ck)) byCol.set(ck, []);
    byCol.get(ck).push(c);
  }
  let start = null;
  for (const j of res.start.rp.jigsaws) if (j.pool !== EMPTY && j.dir) {
    const sx = res.start.o[0] + j.x, sy = res.start.o[1] + j.y, sz = res.start.o[2] + j.z;
    start = (byCol.get(sx * S + sz) ?? []).find((c) => c.y === sy);
    break;
  }
  const seen = new Set();
  if (start) {
    seen.add(start);
    const stack = [start];
    while (stack.length) {
      const c = stack.pop();
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        for (const n of byCol.get((c.x + dx) * S + c.z + dz) ?? []) if (!seen.has(n) && Math.abs(n.s - c.s) <= 1) { seen.add(n); stack.push(n); }
      }
    }
  }
  return { cells, reached: seen.size, start, unreachable: cells.filter((c) => !seen.has(c)) };
}

// ---- checks ---------------------------------------------------------------------------------------------------
export function check(data, res) {
  const fail = [], states = new Map(), world = buildWorld(res, states);
  const get = (x, y, z) => world.get(wkey(x, y, z));
  const kinds = { central: 0, node: 0, tower: 0, straight: 0, dog: 0, crown: 0, crownSmall: 0, balcony: 0, lookout: 0, plug: 0, bridgeAlone: 0 };
  for (const p of res.placed) { const k = kindOf(p.name); if (k in kinds) kinds[k]++; if (p.name === "crown_small") kinds.crownSmall++; const bk = bridgeKindOf(p.name); if (bk) kinds[bk]++; }
  kinds.trees = kinds.central + kinds.node + kinds.tower;
  // P6: a bridge only exists inside a combo piece, together with the tree it leads to (trunk column to the bottom of the box + crown jigsaw);
  // balconies and lookouts stand on a log pillar that reaches the bottom of their box (no hanging balcony)
  const hasLogAtBottom = (p) => p.piece.blocks.some((b) => b.y === 0 && /_(log|wood)$/.test(b.name)) || p.piece.jigsaws.some((j) => j.y === 0);
  kinds.bridgesNoDest = res.placed.filter((p) => p.name.startsWith("bridge_") || (p.name.startsWith("combo_") && !(hasLogAtBottom(p) && p.piece.jigsaws.some((j) => j.dirId === 1)))).length;
  kinds.unsupported = res.placed.filter((p) => (p.name.startsWith("balcony_") || p.name === "lookout_01") && !(hasLogAtBottom(p) && p.piece.size[1] >= 38)).length;
  kinds.wardens = res.placed.reduce((n, p) => n + p.piece.entities.filter((e) => e.id === "lothlorien:elven_warden").length, 0); // template entities (placed if Bedrock keeps them)
  const startLoc = data.pools.get(data.structure.start_pool).elements.map((e) => data.getPiece(e.element.location).name);
  if (!startLoc.includes(res.start.name) || res.placed[0] !== res.start) fail.push("start piece missing");
  if (res.capped) fail.push("generation did not terminate (piece cap)");
  const P = res.placed;
  let overlaps = 0;
  for (let i = 0; i < P.length; i++) for (let k = i + 1; k < P.length; k++) {
    const a = P[i], b = P[k];
    if (a.o[0] <= b.max[0] && a.max[0] >= b.o[0] && a.o[1] <= b.max[1] && a.max[1] >= b.o[1] && a.o[2] <= b.max[2] && a.max[2] >= b.o[2]) { overlaps++; fail.push(`boxes overlap: ${a.name} / ${b.name}`); }
  }
  // connections: face to face, deck + rails continue; vertical ones: trunk log through both jigsaws
  const levelsY = new Set();
  const topDeck = (p) => Math.max(...p.rp.jigsaws.filter((j) => j.dir).map((j) => p.o[1] + j.y));
  for (const c of res.connections) {
    const f = c.pj.vec;
    const tag = `${c.parent.name}->${c.child.name} at ${c.pw}`;
    if (c.cw[0] !== c.pw[0] + f[0] || c.cw[1] !== c.pw[1] + f[1] || c.cw[2] !== c.pw[2] + f[2]) fail.push(`${tag}: connectors not adjacent`);
    if (c.cj.vec[0] !== -f[0] || c.cj.vec[1] !== -f[1] || c.cj.vec[2] !== -f[2]) fail.push(`${tag}: connectors not face to face`);
    if (f[1] !== 0) {
      const [x, y, z] = c.pw;
      for (const dy of [-1, 0, 1, 2]) if (!/mallorn_(log|wood)$/.test(get(x, y + dy, z) ?? "")) fail.push(`${tag}: trunk not continuous at ${dy}`);
      if (f[1] > 0 && c.child.o[1] < topDeck(c.parent) + 4) fail.push(`${tag}: crown box reaches into the deck headroom`);
      continue;
    }
    levelsY.add(c.pw[1]);
    const y = c.pw[1], pp = [-f[2], f[0]];
    for (const [cx, cz] of [[c.pw[0], c.pw[2]], [c.cw[0], c.cw[2]]]) {
      for (let off = -2; off <= 2; off++) {
        const x = cx + pp[0] * off, z = cz + pp[1] * off;
        if (get(x, y, z) !== PLANKS) fail.push(`${tag}: no deck at joint offset ${off}`);
        if (Math.abs(off) === 2 && get(x, y + 1, z) !== FENCE) fail.push(`${tag}: no rail at joint offset ${off}`);
      }
    }
    // the rails across a joint must link to each other from both sides (no half rail at a closed connection)
    const sideOf = (v) => (v[2] < 0 ? "north" : v[2] > 0 ? "south" : v[0] < 0 ? "west" : "east");
    for (const off of [-2, 2]) {
      const a = states.get(wkey(c.pw[0] + pp[0] * off, y + 1, c.pw[2] + pp[1] * off)), b = states.get(wkey(c.cw[0] + pp[0] * off, y + 1, c.cw[2] + pp[1] * off));
      if (!a?.[`minecraft:connection_${sideOf(f)}`] || !b?.[`minecraft:connection_${sideOf([-f[0], 0, -f[2]])}`]) fail.push(`${tag}: rail link across the joint missing at offset ${off}`);
    }
  }
  if (kinds.bridgesNoDest) fail.push(`${kinds.bridgesNoDest} bridge(s) without a destination tree`);
  if (kinds.unsupported) fail.push(`${kinds.unsupported} unsupported balcony / lookout`);
  const walk = walkability(res, world, states);
  if (!walk.start) fail.push("no walkable start cell on the central platform");
  else if (walk.unreachable.length) {
    const u = walk.unreachable[0];
    fail.push(`${walk.unreachable.length} walkable deck cells unreachable (e.g. ${u.x},${u.y},${u.z} s${u.s}); total ${walk.cells.length}`);
  }
  // ---- info (not failures here, but the CLI and tests demand zero): what Bedrock does to block states and leaves ----
  const info = { ropeWrong: 0, ropes: 0, hangingRopes: 0, fenceOneWay: 0, fenceDangling: 0, decay: 0, leaves: 0, nearMiss: nearMisses(res).length };
  const SIDE_VEC = { north: [0, -1], south: [0, 1], west: [-1, 0], east: [1, 0] };
  for (const [k, n] of world) {
    const [x, y, z] = wdecode(k);
    if (n === "lothlorien:elven_rope" || n === "lothlorien:elven_rope_hanging") {
      info.ropes++;
      const hanging = n === "lothlorien:elven_rope_hanging";
      if (hanging) info.hangingRopes++;
      const f = SIDE_VEC[states.get(k)?.[hanging ? "minecraft:cardinal_direction" : "lothlorien:face"]];
      const nb = f && world.get(wkey(x - f[0], y, z - f[1]));
      if (!(nb === "lothlorien:mallorn_log" || nb === "lothlorien:mallorn_wood")) info.ropeWrong++;
    } else if (n === FENCE) {
      for (const [side, v] of Object.entries(SIDE_VEC)) {
        const stored = states.get(k)?.[`minecraft:connection_${side}`];
        const nbFence = world.get(wkey(x + v[0], y, z + v[1])) === FENCE;
        // a one-way link draws half a rail: only at open connector ends that touch a platform (joined connections are checked above);
        // a link to nothing is an open stub end
        const back = states.get(wkey(x + v[0], y, z + v[1]))?.[`minecraft:connection_${{ north: "south", south: "north", west: "east", east: "west" }[side]}`];
        if (nbFence && stored && !back) info.fenceOneWay++;
        if (!nbFence && stored) info.fenceDangling++;
      }
    }
  }
  // leaf decay (trees.js): a non-persistent leaf breaks unless wood is within 10 steps through leaves
  const LEAF = "lothlorien:mallorn_leaves", WOODS = new Set(["lothlorien:mallorn_log", "lothlorien:mallorn_wood"]);
  const dist = new Map(), queue = [];
  for (const [k, n] of world) if (WOODS.has(n)) { dist.set(k, 0); queue.push(k); }
  for (let qi = 0; qi < queue.length; qi++) {
    const k = queue[qi], d = dist.get(k), [x, y, z] = wdecode(k);
    for (const [dx, dy, dz] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) {
      const q = wkey(x + dx, y + dy, z + dz);
      if (world.get(q) === LEAF && !dist.has(q)) { dist.set(q, d + 1); queue.push(q); }
    }
  }
  for (const [k, n] of world) if (n === LEAF) { info.leaves++; if (!(dist.get(k) <= 10)) info.decay++; }
  const startY = res.start.o[1] + res.start.rp.jigsaws.find((j) => j.dir).y;
  const levels = levelsY.size ? Math.max(...[...levelsY].map((y) => Math.round((y - startY) / 8))) + 1 : 1;
  const open = res.unfilled.filter((u) => !u.vertical).length;
  return { fail, kinds, levels, open, openVertical: res.unfilled.length - open, overlaps, unreachable: walk.unreachable.length, walkCells: walk.cells.length, reached: walk.reached, world, states, info };
}

export const layoutHash = (res) => res.placed.map((p) => `${p.name}/${p.rot}/${p.o.join(",")}`).sort().join(";");

// Dead-end decks (a connector left open or closed by a plug) of two different pieces that end within `max` blocks of each
// other without joining: the "bridges that almost meet / lead nowhere" seen in game.
export function nearMisses(res, max = 8) {
  const PLUGS = new Set(["railing_end", "lookout_01", "balcony_braced"]);
  const partner = new Map(), pid = new Map(res.placed.map((p, i) => [p, i]));
  const kj = (p, j) => `${pid.get(p)}:${j.x},${j.y},${j.z}`;
  for (const c of res.connections) { partner.set(kj(c.parent, c.pj), c.child); partner.set(kj(c.child, c.cj), c.parent); }
  const ends = [];
  for (const p of res.placed) {
    if (PLUGS.has(p.name)) continue;
    for (const j of p.rp.jigsaws) {
      if (!j.dir || j.pool === EMPTY) continue;
      const q = partner.get(kj(p, j));
      if (q === undefined || PLUGS.has(q.name)) ends.push({ p, w: [p.o[0] + j.x, p.o[1] + j.y, p.o[2] + j.z] });
    }
  }
  const out = [];
  for (let i = 0; i < ends.length; i++) for (let k = i + 1; k < ends.length; k++) {
    const a = ends[i], b = ends[k], dx = b.w[0] - a.w[0], dz = b.w[2] - a.w[2];
    if (a.p === b.p || a.w[1] !== b.w[1] || Math.max(Math.abs(dx), Math.abs(dz)) > max) continue;
    out.push({ a: a.p.name, b: b.p.name, at: a.w, off: [dx, dz] });
  }
  return out;
}

// ---- loop closing (P7): the same pure rules as scripts/loop_marker.js, run on the simulated world ----------------------------------
// Marker cell of a placed railing_end: the template entity position turned with the piece (continuous quarter turns, x' = sz - z, z' = x).
export function markerCell(p) {
  const e = p.piece.entities.find((q) => q.id === MARKER_ID);
  if (!e) return null;
  let [x, y, z] = e.pos, [sx, , sz] = p.piece.size;
  for (let i = 0; i < p.rot; i++) { [x, z] = [sz - z, x]; [sx, sz] = [sz, sx]; }
  return [p.o[0] + Math.floor(x), p.o[1] + Math.floor(y) - 1, p.o[2] + Math.floor(z)]; // deck cell under the marker
}
// Every marker acts once, in (x, z) order, on the world as the earlier ones left it (in game: load order). Applies the bridges to
// `world` / `states`. -> { markers, missed (marker not on an exit), loops, lengths, offsets, reasons, remaining (closed exits left) }
export function closeLoops(res, world, states) {
  const at = (x, y, z) => world.get(wkey(x, y, z)) ?? AIR;
  const markers = res.placed.filter((p) => p.name === "railing_end").map(markerCell).filter(Boolean).sort((a, b) => a[0] - b[0] || a[2] - b[2]);
  const out = { markers: markers.length, missed: 0, loops: 0, lengths: [], offsets: [], reasons: {}, remaining: 0, builds: [] };
  for (const [x, y, z] of markers) {
    const A = exitAt(at, x, y, z);
    if (!A) { if (at(x, y + 1, z) === FENCE) out.missed++; continue; } // gone = closed from the other side
    const d = decide(at, A);
    if (d.action === "build") {
      for (const [k, b] of finalBlocks(d.plan)) {
        const [bx, by, bz] = k.split(",").map(Number), wk = wkey(bx, by, bz);
        if (b.id === AIR) world.delete(wk); else world.set(wk, b.id);
        if (b.id === AIR) states.delete(wk); else states.set(wk, b.states ?? {});
      }
      out.loops++; out.lengths.push(d.plan.length); out.offsets.push(Math.abs(d.plan.offset)); out.builds.push(d.plan);
    } else if (d.action === "none") out.reasons[d.reason] = (out.reasons[d.reason] ?? 0) + 1;
  }
  for (const [x, y, z] of markers) if (exitAt(at, x, y, z)) out.remaining++;
  return out;
}

// ---- rendering: deck map with height shading, and a side view ------------------------------------------------------------
const DECKISH = (n) => n === PLANKS || n === SLAB || n === FENCE || n === LANTERN_ID;
function shadeTop(world) {
  const top = new Map(); let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9, ylo = 1e9, yhi = -1e9;
  const rank = (n) => (DECKISH(n) ? 3 : /_log$|_wood$/.test(n) ? 2 : n.endsWith("leaves") ? 1 : 0);
  for (const [k, n] of world) {
    if (n === AIR || n === JIGSAW || rank(n) === 0) continue;
    const [x, y, z] = wdecode(k), c = x * S + z, cur = top.get(c);
    x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z);
    const r = rank(n);
    if (r === 3) { ylo = Math.min(ylo, y); yhi = Math.max(yhi, y); }
    if (!cur || r > cur.r || (r === cur.r && y > cur.y)) top.set(c, { y, n, r });
  }
  return { top, x0, x1, z0, z1, ylo, yhi: Math.max(yhi, ylo + 1) };
}
export function renderTop(world) {
  const { top, x0, x1, z0, z1, ylo, yhi } = shadeTop(world);
  return image(x1 - x0 + 1, z1 - z0 + 1, (px, pz) => {
    const t = top.get((px + x0) * S + (pz + z0)); if (!t) return null;
    if (t.r === 1) return [70, 58, 22];
    if (t.r === 2) return [120, 124, 130];
    const k = 0.35 + 0.65 * Math.max(0, Math.min(1, (t.y - ylo) / (yhi - ylo)));
    const base = t.n === FENCE ? [150, 95, 50] : t.n === LANTERN_ID ? [255, 245, 80] : t.n === SLAB ? [225, 190, 120] : [215, 175, 115];
    return base.map((v) => Math.min(255, Math.round(v * k)));
  });
}
export function renderSide(world, crop = null, scale = SCALE) {
  const front = new Map(); let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
  for (const [k, n] of world) {
    if (n === AIR || n === JIGSAW) continue;
    const [x, y, z] = wdecode(k), c = x * S + y, cur = front.get(c);
    if (crop && (x < crop.x0 || x > crop.x1 || z < crop.z0 || z > crop.z1 || y < (crop.y0 ?? -1e9) || y > (crop.y1 ?? 1e9))) continue;
    if (!cur || cur.z < z) front.set(c, { z, n });
    x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
  }
  return image(x1 - x0 + 1, y1 - y0 + 1, (px, py) => { const t = front.get((px + x0) * S + (y1 - py)); return t ? colour(t.n) : null; }, scale);
}

// ---- CLI ---------------------------------------------------------------------------------------------------------
export function runSeeds(data, count, first = 1) {
  const rows = [];
  for (let s = first; s < first + count; s++) {
    const res = simulate(data, s), ck = check(data, res);
    rows.push({ seed: s, res, ck, hash: layoutHash(res) });
  }
  return rows;
}
function main() {
  const count = parseInt(process.argv[2] ?? "20", 10), first = parseInt(process.argv[3] ?? "1", 10);
  const data = loadVillageData();
  const outDir = join(root, "..", "..", "temp", "elven_village", "sim");
  mkdirSync(outDir, { recursive: true });
  for (const f of readdirSync(outDir)) if (f.endsWith(".png")) unlinkSync(join(outDir, f));
  const rows = runSeeds(data, count, first);
  for (const row of rows) { // P7: the loop closer acts on the finished village (after the checks above), then the deck must still be walkable
    row.lp = closeLoops(row.res, row.ck.world, row.ck.states);
    row.lpUnreach = walkability(row.res, row.ck.world, row.ck.states).unreachable.length;
  }
  console.log(`max_depth ${data.structure.max_depth}`);
  console.log("seed pieces trees(tow) lvl straight dog balc look plug open crowns(sm) unreach overl ropeW decay oneWay noDest result");
  let bad = 0;
  const pad = (v, n) => String(v).padStart(n);
  for (const { seed, res, ck } of rows) {
    const ok = ck.fail.length === 0 && ck.info.ropeWrong === 0 && ck.info.decay === 0 && rows.find((r) => r.seed === seed).lpUnreach === 0; if (!ok) bad++;
    const k = ck.kinds;
    console.log(`${pad(seed, 4)} ${pad(res.placed.length, 6)} ${pad(`${k.trees}(${k.tower})`, 10)} ${pad(ck.levels, 3)} ${pad(k.straight, 8)} ${pad(k.dog, 3)} ${pad(k.balcony, 4)} ${pad(k.lookout, 4)} ${pad(k.plug, 4)} ${pad(ck.open, 4)} ${pad(`${k.crown}(${k.crownSmall})`, 10)} ${pad(ck.unreachable, 7)} ${pad(ck.overlaps, 5)} ${pad(ck.info.ropeWrong, 5)} ${pad(ck.info.decay, 5)} ${pad(ck.info.fenceOneWay, 9)} ${pad(ck.kinds.bridgesNoDest, 6)} ${ok ? "ok" : "FAIL"}`);
    for (const f of [...new Set(ck.fail)].slice(0, 6)) console.log(`       ! ${f}`);
  }
  const avg = (f) => (rows.reduce((a, r) => a + f(r), 0) / rows.length).toFixed(1);
  const mm = (f) => `${Math.min(...rows.map(f))}/${avg(f)}/${Math.max(...rows.map(f))}`;
  console.log(`\nseeds ${rows.length}: failures ${bad}, distinct layouts ${new Set(rows.map((r) => r.hash)).size}`);
  console.log(`  pieces ${mm((r) => r.res.placed.length)} | trees ${mm((r) => r.ck.kinds.trees)} | towers avg ${avg((r) => r.ck.kinds.tower)} | levels used ${mm((r) => r.ck.levels)} (villages with 2+ levels: ${rows.filter((r) => r.ck.levels >= 2).length}/${rows.length})`);
  console.log(`  bridges straight ${avg((r) => r.ck.kinds.straight)} dog-leg ${avg((r) => r.ck.kinds.dog)} | balconies ${avg((r) => r.ck.kinds.balcony)} lookouts ${avg((r) => r.ck.kinds.lookout)} plugs ${avg((r) => r.ck.kinds.plug)} | open connectors ${avg((r) => r.ck.open)} (vertical ${avg((r) => r.ck.openVertical)}) | crowns ${avg((r) => r.ck.kinds.crown)}, small fallback ${avg((r) => r.ck.kinds.crownSmall)} | wardens per village (template entities) ${mm((r) => r.ck.kinds.wardens)}`);
  console.log(`  exits ending in railing ${avg((r) => r.ck.kinds.plug)} / braced balcony ${avg((r) => r.ck.kinds.balcony)} / lookout ${avg((r) => r.ck.kinds.lookout)} per village; bridges without a destination tree ${rows.reduce((a, r) => a + r.ck.kinds.bridgesNoDest, 0)}, unsupported balconies ${rows.reduce((a, r) => a + r.ck.kinds.unsupported, 0)}`);
  const lsum = (f) => rows.reduce((a, r) => a + f(r.lp), 0), reasons = {};
  for (const r of rows) for (const [k, v] of Object.entries(r.lp.reasons)) reasons[k] = (reasons[k] ?? 0) + v;
  console.log(`  loops (loop closer, markers on closed railing exits): closed ${mm((r) => r.lp.loops)} per village (villages with a loop: ${rows.filter((r) => r.lp.loops).length}/${rows.length}), ` +
    `closed exits before ${avg((r) => r.lp.markers)} / left ${avg((r) => r.lp.remaining)} per village; no partner ${reasons["no partner"] ?? 0}, not mutual ${reasons["not mutual"] ?? 0}, corridor blocked ${reasons.blocked ?? 0}, ` +
    `markers not on an exit ${lsum((l) => l.missed)}/${lsum((l) => l.markers)}, unreachable walk cells after the loops ${rows.reduce((a, r) => a + r.lpUnreach, 0)}; bridge lengths ${rows.flatMap((r) => r.lp.lengths).join(",") || "-"}`);
  const sum = (f) => rows.reduce((a, r) => a + f(r.ck.info), 0);
  console.log(`  totals: unreachable walk cells ${rows.reduce((a, r) => a + r.ck.unreachable, 0)}, overlaps ${rows.reduce((a, r) => a + r.ck.overlaps, 0)}, wrong ropes ${sum((i) => i.ropeWrong)}/${sum((i) => i.ropes)}, ` +
    `decaying leaves ${sum((i) => i.decay)}/${sum((i) => i.leaves)}, one-way fence links (open ends only) ${sum((i) => i.fenceOneWay)} (dangling stub ends ${sum((i) => i.fenceDangling)}), near-miss ends ${sum((i) => i.nearMiss)}`);
  rows.slice(0, 6).forEach(({ seed, ck }, i) => {
    writeFileSync(join(outDir, `seed${seed}_top.png`), renderTop(ck.world));
    if (i === 0) writeFileSync(join(outDir, `seed${seed}_side.png`), renderSide(ck.world));
  });
  console.log(`PNGs: ${outDir}`);
  process.exit(bad ? 1 : 0);
}
// realpath: C:\mcmods is a junction, so argv[1] and import.meta.url can name the same file differently
if (process.argv[1] && realpathSync(fileURLToPath(import.meta.url)) === realpathSync(process.argv[1])) main();
