// Elven village assembly simulator: reads the real .mcstructure pieces, template pools and structure JSON and assembles
// villages with Java JigsawPlacement semantics (breadth-first, weighted pool order, fallback, first fit), then checks them.
//   node tools/village_sim.mjs [seeds=20] [firstSeed=1]     (run from mods/lothlorien; PNGs go to temp/elven_village/sim/)
// Also imported by tests/run.mjs.
import { readFileSync, readdirSync, writeFileSync, mkdirSync, realpathSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const bp = join(root, "lothlorien_bp");
export const PLANKS = "lothlorien:mallorn_planks", FENCE = "lothlorien:mallorn_fence", LANTERN_ID = "lothlorien:elven_lantern";
const EMPTY = "minecraft:empty", AIR = "minecraft:air", JIGSAW = "minecraft:jigsaw";
const FACING_VEC = { 2: [0, -1], 3: [0, 1], 4: [-1, 0], 5: [1, 0] };

// ---- little-endian NBT reader (Bedrock) ----------------------------------------------------------------
function readNbt(buf) {
  let p = 0;
  const s = () => { const n = buf.readUInt16LE(p); p += 2; const v = buf.toString("utf8", p, p + n); p += n; return v; };
  const val = (t) => {
    switch (t) {
      case 1: return buf.readInt8(p++);
      case 2: { const v = buf.readInt16LE(p); p += 2; return v; }
      case 3: { const v = buf.readInt32LE(p); p += 4; return v; }
      case 4: { p += 8; return 0; }
      case 5: { p += 4; return 0; }
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
      jigsaws.push({ x, y, z, dirId: entry.states.facing_direction, dir: FACING_VEC[entry.states.facing_direction] ?? null,
        name: e.name, target: e.target, pool: e.target_pool, final: e.final_state, joint: e.joint });
    } else if (entry.name !== AIR) blocks.push({ x, y, z, name: entry.name });
  }
  return { name, size: [sx, sy, sz], grid, blocks, jigsaws, at: (x, y, z) => (x < 0 || y < 0 || z < 0 || x >= sx || y >= sy || z >= sz ? undefined : grid[(x * sy + y) * sz + z]) };
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
    const f = (o) => ({ ...o, x: sz - 1 - o.z, z: o.x });
    cur = { size: [sz, sy, sx], blocks: prev.blocks.map(f), jigsaws: prev.jigsaws.map((j) => ({ ...f(j), dir: j.dir ? [-j.dir[1], j.dir[0]] : null })) };
  }
  return (list[r] = cur);
}

export function loadVillageData() {
  const structure = JSON.parse(readFileSync(join(bp, "worldgen/structures/elven_village.json"), "utf8"))["minecraft:jigsaw"];
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
      if (parent.used?.has(pj) || pj.pool === EMPTY || !pj.dir) continue;
      const pool = pools.get(pj.pool);
      if (!pool) throw new Error(`unknown pool ${pj.pool}`);
      const fb = pool.fallback && pool.fallback !== EMPTY ? pools.get(pool.fallback) : null;
      const cands = [...(parent.depth < maxDepth ? weightedOrder(pool.elements, r) : []), ...(fb ? weightedOrder(fb.elements, r) : [])];
      const pw = [parent.o[0] + pj.x, parent.o[1] + pj.y, parent.o[2] + pj.z];
      const cell = [pw[0] + pj.dir[0], pw[1], pw[2] + pj.dir[1]];
      let done = false;
      for (const el of cands) {
        if (el.element.element_type === "minecraft:empty_pool_element") continue;
        const piece = getPiece(el.element.location);
        for (const rot of shuffle([0, 1, 2, 3], r)) {
          const rp = rotated(piece, rot);
          for (const cj of shuffle(rp.jigsaws.filter((j) => j.name === pj.target && j.dir && j.dir[0] === -pj.dir[0] && j.dir[1] === -pj.dir[1]), r)) {
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
      if (!done) unfilled.push({ piece: parent.name, at: pw, pool: pj.pool });
    }
  }
  return { seed, placed, connections, unfilled, capped, start };
}

// ---- merged block world -------------------------------------------------------------------------------------
const OFF = 512, S = 1024;
export const wkey = (x, y, z) => ((x + OFF) * S + (y + OFF)) * S + (z + OFF);
export const wdecode = (k) => { const z = (k % S) - OFF, y = (Math.floor(k / S) % S) - OFF, x = Math.floor(k / (S * S)) - OFF; return [x, y, z]; };
export function buildWorld(res) {
  const w = new Map();
  for (const p of res.placed) {
    const [ox, oy, oz] = p.o;
    for (const b of p.rp.blocks) w.set(wkey(ox + b.x, oy + b.y, oz + b.z), b.name);
    for (const j of p.rp.jigsaws) w.set(wkey(ox + j.x, oy + j.y, oz + j.z), j.final);
  }
  return w;
}

// ---- checks ---------------------------------------------------------------------------------------------------
export function check(data, res) {
  const fail = [], world = buildWorld(res);
  const get = (x, y, z) => world.get(wkey(x, y, z));
  const kinds = { tree: 0, bridge: 0, lookout: 0, plug: 0 };
  for (const p of res.placed) {
    if (p.name.startsWith("tree_platform")) kinds.tree++;
    else if (p.name.startsWith("bridge")) kinds.bridge++;
    else if (p.name.startsWith("lookout")) kinds.lookout++;
    else if (p.name === "railing_end") kinds.plug++;
  }
  const startLoc = data.pools.get(data.structure.start_pool).elements.map((e) => data.getPiece(e.element.location).name);
  if (!startLoc.includes(res.start.name) || res.placed[0] !== res.start) fail.push("start piece missing");
  if (res.capped) fail.push("generation did not terminate (piece cap)");
  const P = res.placed;
  for (let i = 0; i < P.length; i++) for (let k = i + 1; k < P.length; k++) {
    const a = P[i], b = P[k];
    if (a.o[0] <= b.max[0] && a.max[0] >= b.o[0] && a.o[1] <= b.max[1] && a.max[1] >= b.o[1] && a.o[2] <= b.max[2] && a.max[2] >= b.o[2]) fail.push(`boxes overlap: ${a.name} / ${b.name}`);
  }
  // connections: face to face, deck + rails continue
  let deckY = null;
  for (const c of res.connections) {
    const f = c.pj.dir;
    const tag = `${c.parent.name}->${c.child.name} at ${c.pw}`;
    if (c.cw[0] !== c.pw[0] + f[0] || c.cw[1] !== c.pw[1] || c.cw[2] !== c.pw[2] + f[1]) fail.push(`${tag}: connectors not adjacent`);
    if (c.cj.dir[0] !== -f[0] || c.cj.dir[1] !== -f[1]) fail.push(`${tag}: connectors not face to face`);
    const y = c.pw[1];
    if (deckY === null) deckY = y; else if (deckY !== y) fail.push(`${tag}: deck at y ${y}, others at ${deckY}`);
    const pp = [-f[1], f[0]];
    for (const [cx, cz] of [[c.pw[0], c.pw[2]], [c.cw[0], c.cw[2]]]) {
      for (let off = -2; off <= 2; off++) {
        const x = cx + pp[0] * off, z = cz + pp[1] * off;
        if (get(x, y, z) !== PLANKS) fail.push(`${tag}: no deck at joint offset ${off}`);
        if (Math.abs(off) === 2 && get(x, y + 1, z) !== FENCE) fail.push(`${tag}: no rail at joint offset ${off}`);
      }
    }
  }
  // walkable cells: deck block with 2 air/void above; flood fill (4-neighbour, same y) from the central platform
  if (deckY === null) deckY = res.start.o[1] + 26;
  const walk = new Set();
  for (const [k, n] of world) {
    if (n !== PLANKS) continue;
    const [x, y, z] = wdecode(k);
    if (y !== deckY) continue;
    const a1 = get(x, y + 1, z), a2 = get(x, y + 2, z);
    if ((a1 === undefined || a1 === AIR) && (a2 === undefined || a2 === AIR)) walk.add(k);
  }
  let startCell = null;
  for (const j of res.start.rp.jigsaws) if (j.pool !== EMPTY && j.dir) { startCell = wkey(res.start.o[0] + j.x, deckY, res.start.o[2] + j.z); break; }
  let reached = 0;
  if (!startCell || !walk.has(startCell)) fail.push("no walkable start cell on the central platform");
  else {
    const seen = new Set([startCell]), stack = [startCell];
    while (stack.length) {
      const [x, y, z] = wdecode(stack.pop());
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const n = wkey(x + dx, y, z + dz); if (walk.has(n) && !seen.has(n)) { seen.add(n); stack.push(n); } }
    }
    reached = seen.size;
    if (seen.size !== walk.size) {
      const left = [...walk].filter((k) => !seen.has(k));
      fail.push(`${left.length} walkable deck cells unreachable (e.g. ${wdecode(left[0]).join(",")}); total ${walk.size}`);
    }
  }
  return { fail, kinds, deckY, walkCells: walk.size, reached, world };
}

export const layoutHash = (res) => res.placed.map((p) => `${p.name}/${p.rot}/${p.o.join(",")}`).sort().join(";");

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
function image(w, h, pixel) {
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
export function renderTop(world) {
  const top = new Map(); let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9, y1 = 1;
  for (const [k, n] of world) {
    if (n === AIR) continue;
    const [x, y, z] = wdecode(k), c = x * S + z, cur = top.get(c);
    if (!cur || cur.y < y) top.set(c, { y, n });
    x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); y1 = Math.max(y1, y);
  }
  return image(x1 - x0 + 1, z1 - z0 + 1, (px, pz) => {
    const t = top.get((px + x0) * S + (pz + z0)); if (!t) return null;
    const k = 0.55 + 0.45 * Math.max(0, t.y) / y1;
    return colour(t.n).map((v) => Math.min(255, Math.round(v * k)));
  });
}
export function renderSide(world) {
  const front = new Map(); let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
  for (const [k, n] of world) {
    if (n === AIR) continue;
    const [x, y, z] = wdecode(k), c = x * S + y, cur = front.get(c);
    if (!cur || cur.z < z) front.set(c, { z, n });
    x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
  }
  return image(x1 - x0 + 1, y1 - y0 + 1, (px, py) => { const t = front.get((px + x0) * S + (y1 - py)); return t ? colour(t.n) : null; });
}
export function asciiDeck(world, deckY, maxCols = 100) {
  let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
  for (const [k] of world) { const [x, y, z] = wdecode(k); if (y === deckY) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); } }
  if (x1 - x0 + 1 > maxCols) { const c = Math.round((x0 + x1) / 2); x0 = c - Math.floor(maxCols / 2); x1 = x0 + maxCols - 1; }
  const rows = [];
  for (let z = z0; z <= z1; z++) {
    let s = "";
    for (let x = x0; x <= x1; x++) {
      const n = world.get(wkey(x, deckY, z));
      s += !n ? "." : n.endsWith("_log") || n.endsWith("_wood") ? "O" : n === PLANKS ? (world.get(wkey(x, deckY + 1, z)) === FENCE ? "+" : "#") : n === FENCE ? "+" : ".";
    }
    rows.push(s);
  }
  return rows.join("\n");
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
  const rows = runSeeds(data, count, first);
  console.log("seed pieces trees bridges lookouts plugs unfilled walkable reached  result");
  let bad = 0;
  for (const { seed, res, ck } of rows) {
    const ok = ck.fail.length === 0; if (!ok) bad++;
    console.log(`${String(seed).padStart(4)} ${String(res.placed.length).padStart(6)} ${String(ck.kinds.tree).padStart(5)} ${String(ck.kinds.bridge).padStart(7)} ${String(ck.kinds.lookout).padStart(8)} ${String(ck.kinds.plug).padStart(5)} ${String(res.unfilled.length).padStart(8)} ${String(ck.walkCells).padStart(8)} ${String(ck.reached).padStart(7)}  ${ok ? "ok" : "FAIL"}`);
    for (const f of [...new Set(ck.fail)].slice(0, 6)) console.log(`       ! ${f}`);
    for (const u of res.unfilled) console.log(`       unfilled: ${u.piece} at ${u.at} (pool ${u.pool})`);
  }
  const n = rows.map((r) => r.res.placed.length);
  const unf = rows.reduce((s, r) => s + r.res.unfilled.length, 0);
  console.log(`\nseeds ${rows.length}: pieces min/avg/max ${Math.min(...n)}/${(n.reduce((a, b) => a + b, 0) / n.length).toFixed(1)}/${Math.max(...n)}, failures ${bad}, unfilled connectors ${unf}, distinct layouts ${new Set(rows.map((r) => r.hash)).size}`);
  rows.slice(0, 6).forEach(({ seed, ck }, i) => {
    writeFileSync(join(outDir, `seed${seed}_top.png`), renderTop(ck.world));
    if (i === 0) writeFileSync(join(outDir, `seed${seed}_side.png`), renderSide(ck.world));
  });
  console.log(`PNGs: ${outDir}`);
  if (rows.length) console.log(`\nseed ${rows[0].seed} at deck level (y ${rows[0].ck.deckY}):\n` + asciiDeck(rows[0].ck.world, rows[0].ck.deckY));
  process.exit(bad ? 1 : 0);
}
// realpath: C:\mcmods is a junction, so argv[1] and import.meta.url can name the same file differently
if (process.argv[1] && realpathSync(fileURLToPath(import.meta.url)) === realpathSync(process.argv[1])) main();
