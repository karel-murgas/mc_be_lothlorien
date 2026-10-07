// Regression tests: node tests/run.mjs (run by `mods verify lothlorien`).
import assert from "node:assert/strict";
import { leafUndersideY } from "../lothlorien_bp/scripts/leaf_fall.js";
import { BONEMEAL_TABLE, SPREAD_TRIES, COVERS, pickWeighted } from "../lothlorien_bp/scripts/flora_table.js";
import { readFileSync } from "node:fs";
import { MAX_GROWTH, growChance, bonemealSteps, advanceGrowth } from "../lothlorien_bp/scripts/crop_rules.js";
import { estimateDepth, probeCount, ringOffsets, DEPTH_NAMES, DEPTH_RADII } from "../lothlorien_bp/scripts/depth.js";
import * as H from "../lothlorien_bp/scripts/harmony.js";
import { makeRandom } from "../lothlorien_bp/scripts/mallorn_tree.js";
import { buildFletMallorn, LADDER, ROUND_LADDER, LEAF_KEEP, ROOT_DEPTH, B } from "../tools/flet_mallorn.mjs";
import { SIZE, SIZE_Y, TRUNK_AT, CHOSEN, TRUNK_ANCHOR } from "../tools/build_structures.mjs";
import { existsSync, readdirSync } from "node:fs";
import { loadVillageData, parseMcstructure, runSeeds, rotated, PLANKS, FENCE, LANTERN_ID } from "../tools/village_sim.mjs";

const L = "lothlorien:lothlorien", RIVER = "minecraft:river", FOREST = "minecraft:forest";
const T = new Set([RIVER]);
const depth = (fn) => estimateDepth(fn, L, T);
let failed = 0;
function test(name, fn) {
  try { fn(); console.log(`ok   ${name}`); } catch (e) { failed++; console.log(`FAIL ${name}\n     ${e.message}`); }
}

// Half-plane world: Lothlorien for x < border, forest beyond.
const halfPlane = (border) => (dx) => (dx < border ? L : FOREST);

test("outside the biome", () => assert.equal(depth(() => FOREST).level, 0));
test("border 10 blocks away is edge", () => assert.equal(depth(halfPlane(10)).level, 1));
test("border 30 blocks away is inner", () => assert.equal(depth(halfPlane(30)).level, 2));
test("no border within the rings is heart", () => {
  const r = depth(() => L);
  assert.equal(r.level, 3);
  assert.equal(r.complete, true);
});
test("result does not depend on the side the border is on", () => {
  for (const b of [5, 20, 35, 60]) {
    const east = depth((dx) => (dx < b ? L : FOREST)).level;
    const west = depth((dx) => (dx > -b ? L : FOREST)).level;
    const north = depth((dx, dz) => (dz > -b ? L : FOREST)).level;
    assert.equal(east, west, `border ${b}`);
    assert.equal(east, north, `border ${b}`);
  }
});
// The in-game bug: chunks ahead of a flying player are not loaded yet. An unreadable probe
// must not be treated as inside, or a close border in that direction is ignored.
test("unloaded probes never raise the level", () => {
  const border = 20; // real answer: inner
  const unloadedBeyond = (dx) => (dx >= 12 ? undefined : dx < border ? L : FOREST);
  const r = depth(unloadedBeyond);
  assert.ok(r.level <= 2, `got level ${r.level}`);
  assert.equal(r.complete, false);
  assert.equal(depth((dx) => (dx >= 12 ? undefined : L)).level, 1); // only ring 8 is known
});
test("a river through the biome is not an edge", () => {
  const riverStripe = (dx) => (Math.abs(dx) <= 6 ? RIVER : L);
  assert.equal(depth(riverStripe).level, 3);
});
test("a river outside the biome is outside", () => {
  assert.equal(depth((dx) => (Math.abs(dx) <= 6 ? RIVER : FOREST)).level, 0);
});
test("standing in a river inside the biome counts", () => {
  assert.equal(depth((dx, dz) => (dx === 0 && dz === 0 ? RIVER : L)).level, 3);
});
test("outer rings are dense enough for a 12-block tongue", () => {
  const outer = DEPTH_RADII[DEPTH_RADII.length - 1];
  for (let deg = 0; deg < 360; deg += 7) {
    const a = (deg * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a);
    // Foreign strip 12 wide pointing at the player along angle `a`, reaching to outer - 1.
    const tongue = (dx, dz) => (dx * c + dz * s >= outer - 1 && Math.abs(-dx * s + dz * c) <= 6 ? FOREST : L);
    assert.equal(depth(tongue).level, 2, `angle ${deg}`);
  }
  assert.ok(ringOffsets(outer).length >= 24);
  assert.ok(probeCount() < 120, `probe count ${probeCount()}`);
});

const LEAF = "lothlorien:mallorn_leaves", AIR = "minecraft:air";
const isLeaf = (id) => id === LEAF;
test("leaf fall: single-layer canopy lets go at the top leaf", () =>
  assert.equal(leafUndersideY(20, (y) => (y >= 20 ? LEAF : AIR), isLeaf), 20));
test("leaf fall: thick canopy walks down to the open underside", () =>
  assert.equal(leafUndersideY(20, (y) => (y >= 17 ? LEAF : AIR), isLeaf), 17));
test("leaf fall: nothing when the column is not open below within reach", () =>
  assert.equal(leafUndersideY(20, () => LEAF, isLeaf), undefined));
test("leaf fall: unreadable block gives up", () =>
  assert.equal(leafUndersideY(20, (y) => (y >= 19 ? LEAF : undefined), isLeaf), undefined));

test("bone meal table: ends of the range and only known ids", () => {
  assert.equal(pickWeighted(BONEMEAL_TABLE, 0), "minecraft:short_grass");
  assert.equal(pickWeighted(BONEMEAL_TABLE, 0.999999), "lothlorien:athelas");
  for (const [id] of BONEMEAL_TABLE) assert.ok(["minecraft:short_grass", "minecraft:fern"].includes(id) || id.startsWith("lothlorien:"));
});
test("bone meal table: no vanilla flowers, athelas is the rarest", () => {
  assert.ok(!BONEMEAL_TABLE.some(([id]) => /dandelion|poppy/.test(id)));
  assert.equal(Math.min(...BONEMEAL_TABLE.map(([, w]) => w)), BONEMEAL_TABLE.find(([id]) => id.endsWith("athelas"))[1]);
});

test("bone meal spread: our plants grow more, Athelas the least", () => {
  for (const id of ["elanor", "niphredil", "golden_fern", "athelas"]) assert.ok(SPREAD_TRIES[`lothlorien:${id}`] > 0, id);
  assert.equal(Math.min(...Object.values(SPREAD_TRIES)), SPREAD_TRIES["lothlorien:athelas"]);
  assert.deepEqual(COVERS, ["lothlorien:mallorn_leaf_carpet", "lothlorien:mallorn_blossom"]);
});

// Phase 7: Western Corn and Lembas.
const bp = (f) => JSON.parse(readFileSync(new URL(`../lothlorien_bp/${f}`, import.meta.url), "utf8"));
test("corn: wet soil grows faster than dry, dim light slower, darkness stalls", () => {
  assert.ok(growChance(15, 7) > growChance(15, 0));
  assert.ok(growChance(15, 0) > growChance(7, 0));
  assert.ok(growChance(7, 0) > growChance(4, 0));
  assert.equal(growChance(3, 7), 0);
  assert.ok(growChance(4, 0) > 0, "must tolerate the light wheat cannot (wheat needs 9)");
});
test("corn: bone meal advances 2-5 stages and stops at maturity", () => {
  assert.equal(bonemealSteps(0), 2);
  assert.equal(bonemealSteps(0.999), 5);
  assert.equal(advanceGrowth(5, 5), MAX_GROWTH);
});
test("corn: block states, stage textures and loot agree with the script", () => {
  const b = bp("blocks/western_corn.json")["minecraft:block"];
  assert.deepEqual(b.description.states["lothlorien:growth"], [...Array(MAX_GROWTH + 1).keys()]);
  for (let n = 1; n <= MAX_GROWTH; n++) {
    assert.ok(b.permutations.some((p) => p.condition.endsWith(`== ${n}`) && p.components["minecraft:material_instances"]), `stage ${n}`);
  }
  assert.ok(b.permutations.some((p) => p.condition.endsWith(`== ${MAX_GROWTH}`) && p.components["minecraft:loot"]), "mature loot");
  assert.ok(b.components["minecraft:placement_filter"].conditions[0].block_filter.includes("minecraft:farmland"));
  const mature = bp("loot_tables/blocks/western_corn_mature.json");
  const names = mature.pools.flatMap((p) => p.entries.map((e) => e.name));
  assert.deepEqual(names.sort(), ["lothlorien:western_corn_grain", "lothlorien:western_corn_seeds"]);
  assert.equal(bp("features/western_corn_feature.json")["minecraft:single_block_feature"].places_block.states["lothlorien:growth"], MAX_GROWTH);
});
test("seeds only plant on farmland; Lembas chain is dough -> cake -> wrapped", () => {
  assert.deepEqual(bp("items/western_corn_seeds.json")["minecraft:item"].components["minecraft:block_placer"].use_on, ["minecraft:farmland"]);
  assert.equal(bp("recipes/lembas_dough.json")["minecraft:recipe_shaped"].result.item, "lothlorien:lembas_dough");
  assert.equal(bp("recipes/furnace_lembas_cake.json")["minecraft:recipe_furnace"].input, "lothlorien:lembas_dough");
  assert.equal(bp("recipes/furnace_lembas_cake.json")["minecraft:recipe_furnace"].output, "lothlorien:lembas_cake");
  const wrap = bp("recipes/lembas_wrapped.json")["minecraft:recipe_shaped"];
  assert.deepEqual(Object.values(wrap.key).map((k) => k.item).sort(), ["lothlorien:lembas_cake", "lothlorien:mallorn_leaves"]);
});
test("wrapped Lembas: more nutrition than the cake, eaten faster", () => {
  const food = (n) => bp(`items/${n}.json`)["minecraft:item"].components;
  const cake = food("lembas_cake"), wrapped = food("lembas_wrapped");
  assert.ok(wrapped["minecraft:food"].nutrition > cake["minecraft:food"].nutrition);
  assert.ok(wrapped["minecraft:use_modifiers"].use_duration < cake["minecraft:use_modifiers"].use_duration, "eaten faster");
});

// Giant flet Mallorns (tools/flet_mallorn.mjs), over many seeds.
const flets = [{}, { woven: true, lush: true }].flatMap((opts) =>
  Array.from({ length: 30 }, (_, i) => buildFletMallorn(makeRandom(i * 7919 + 1), opts)));
const plains = Array.from({ length: 30 }, (_, i) => buildFletMallorn(makeRandom(i * 7919 + 1), { woven: true, lush: true, flet: false }));
const at = (t, x, y, z) => t.blocks.get(`${x},${y},${z}`)?.name;
test("flet: ladder unbroken from the ground through the floor, with a floor to step onto", () => {
  for (const t of flets) {
    for (let y = 0; y <= t.floorY; y++) assert.equal(at(t, LADDER.x, y, LADDER.z), B.ropeHanging, `ladder gap at y ${y}`);
    for (let y = 0; y <= t.floorY + 2; y++) assert.equal(at(t, LADDER.x, y, LADDER.z - 1) === B.leaves || at(t, LADDER.x, y, LADDER.z - 1) === B.log, false);
    assert.equal(at(t, LADDER.x, t.floorY, LADDER.z - 1), B.planks);
    for (let y = t.floorY + 1; y <= t.floorY + 3; y++) assert.equal(at(t, LADDER.x, y, LADDER.z), undefined, "headroom over the hole");
  }
});
test("flet: chest stands on the floor with room above", () => {
  for (const t of flets) {
    const [k] = [...t.blocks].find(([, v]) => v.name === B.chest);
    const [x, y, z] = k.split(",").map(Number);
    assert.equal(y, t.floorY + 1);
    assert.ok([B.planks, B.log].includes(at(t, x, y - 1, z)));
    assert.equal(at(t, x, y + 1, z), undefined);
  }
});
test(`giants: every leaf is within ${LEAF_KEEP} steps of a log (no decay after generation)`, () => {
  for (const t of [...flets, ...plains]) {
    const seen = new Set(), queue = [];
    for (const [k, v] of t.blocks) if (v.name === B.log) { seen.add(k); queue.push([k, 0]); }
    for (let i = 0; i < queue.length; i++) {
      const [k, d] = queue[i];
      if (d === LEAF_KEEP) continue;
      const [x, y, z] = k.split(",").map(Number);
      for (const [dx, dy, dz] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) {
        const n = `${x + dx},${y + dy},${z + dz}`;
        if (!seen.has(n) && t.blocks.get(n)?.name === B.leaves) { seen.add(n); queue.push([n, d + 1]); }
      }
    }
    for (const [k, v] of t.blocks) if (v.name === B.leaves) assert.ok(seen.has(k), `far leaf ${k}`);
  }
});
test("giants: tree fits the structure box and drops few leaves", () => {
  for (const t of [...flets, ...plains]) {
    for (const k of t.blocks.keys()) {
      const [x, y, z] = k.split(",").map(Number);
      assert.ok(x + TRUNK_AT >= 0 && x + TRUNK_AT < SIZE && z + TRUNK_AT >= 0 && z + TRUNK_AT < SIZE, `outside x/z ${k}`);
      assert.ok(y + ROOT_DEPTH >= 0 && y + ROOT_DEPTH < SIZE_Y, `outside y ${k}`);
    }
    assert.ok(t.trimmed < 60, `${t.trimmed} leaves trimmed`);
  }
});

test("plain giant: no platform, fence, ladder or chest", () => {
  for (const t of plains) {
    for (const v of t.blocks.values()) assert.ok(![B.ropeHanging, B.chest, B.fence, B.planks].includes(v.name), v.name);
  }
});

// Round-trunk variants (corner cells cut): the same checks, with the ladder at x 1.
const rounds = [{ woven: true, lush: true, round: true }, { woven: true, lush: true, flet: false, round: true }].map((opts) =>
  Array.from({ length: 30 }, (_, i) => buildFletMallorn(makeRandom(i * 7919 + 1), opts)));
const roundFlets = rounds[0], roundPlains = rounds[1];
test("round trunk: 12 cells (corners cut above the roots) up to the top of the 4x4 part; ladder, chest and floor still work", () => {
  for (const t of [...roundFlets, ...roundPlains]) {
    for (let y = -ROOT_DEPTH; y < t.floorY; y++) {
      for (const [x, z] of [[0, 0], [3, 0], [0, 3], [3, 3]]) if (y > 3) assert.ok(![B.log, B.wood].includes(at(t, x, y, z)), `corner log above the foot at ${x},${y},${z}`);
      for (let x = 0; x < 4; x++) for (let z = 0; z < 4; z++) {
        if (![0, 3].includes(x) || ![0, 3].includes(z)) assert.equal([B.log, B.wood, B.ropeHanging].includes(at(t, x, y, z)), true, `hole in trunk ${x},${y},${z}`);
      }
    }
  }
  for (const t of roundFlets) {
    for (let y = 0; y <= t.floorY; y++) assert.equal(at(t, ROUND_LADDER.x, y, ROUND_LADDER.z), B.ropeHanging, `ladder gap at y ${y}`);
    for (let y = -ROOT_DEPTH; y <= t.floorY; y++) assert.ok([B.log, B.wood].includes(at(t, ROUND_LADDER.x, y, ROUND_LADDER.z + 1)), `nothing behind the ladder at y ${y}`);
    for (let y = 0; y <= t.floorY + 2; y++) assert.ok(![B.leaves, B.log, B.wood].includes(at(t, ROUND_LADDER.x, y, ROUND_LADDER.z - 1)), "ladder front blocked");
    for (let y = t.floorY + 1; y <= t.floorY + 3; y++) assert.equal(at(t, ROUND_LADDER.x, y, ROUND_LADDER.z), undefined, "headroom over the hole");
    const [k] = [...t.blocks].find(([, v]) => v.name === B.chest);
    const [x, y, z] = k.split(",").map(Number);
    assert.ok([B.log, B.wood].includes(at(t, x - 1, y, z)), "chest against a trunk cell");
    assert.equal(y, t.floorY + 1);
  }
});
test("round trunk: every log joins the trunk through face or edge contact (nothing hangs by a corner only)", () => {
  for (const t of [...roundFlets, ...roundPlains]) {
    const logs = new Set([...t.blocks].filter(([, v]) => v.name === B.log || v.name === B.wood).map(([k]) => k));
    const seen = new Set(["1,0,1"]), queue = ["1,0,1"];
    for (let i = 0; i < queue.length; i++) {
      const [x, y, z] = queue[i].split(",").map(Number);
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) {
        const n = `${x + dx},${y + dy},${z + dz}`; // rising branches step up and sideways at once: edges count
        if (Math.abs(dx) + Math.abs(dy) + Math.abs(dz) <= 2 && logs.has(n) && !seen.has(n)) { seen.add(n); queue.push(n); }
      }
    }
    assert.equal(seen.size, logs.size, `${logs.size - seen.size} logs not joined to the trunk`);
  }
});
test("round trunk: fits the box and keeps leaves in reach of a log", () => {
  for (const t of [...roundFlets, ...roundPlains]) {
    for (const k of t.blocks.keys()) {
      const [x, y, z] = k.split(",").map(Number);
      assert.ok(x + TRUNK_AT >= 0 && x + TRUNK_AT < SIZE && z + TRUNK_AT >= 0 && z + TRUNK_AT < SIZE && y + ROOT_DEPTH >= 0 && y + ROOT_DEPTH < SIZE_Y, `outside ${k}`);
    }
    assert.ok(t.trimmed < 60);
  }
  for (const t of roundPlains) for (const v of t.blocks.values()) assert.ok(![B.ropeHanging, B.chest, B.fence, B.planks].includes(v.name), v.name);
});

test("giants: the jigsaw pool matches CHOSEN, every piece ships, the structure set uses it", () => {
  const pool = bp("worldgen/template_pools/giant_mallorn.json")["minecraft:template_pool"];
  const GIANT_TREES = pool.elements.map((e) => e.element.location.replace("lothlorien/", ""));
  assert.equal(bp("worldgen/structures/giant_mallorn.json")["minecraft:jigsaw"].start_pool, pool.description.identifier);
  assert.equal(bp("worldgen/structures/giant_mallorn.json")["minecraft:jigsaw"].start_height.value.absolute, -ROOT_DEPTH);
  assert.ok(bp("worldgen/structures/giant_mallorn.json")["minecraft:jigsaw"].max_depth >= 1, "max_depth 0 never builds");
  const set = bp("worldgen/structure_sets/giant_mallorn.json")["minecraft:structure_set"];
  assert.ok(set.placement.separation * 2 < set.placement.spacing, "engine rule: separation < spacing / 2");
  // start chunks of neighbouring cells are at least separation + 1 chunks apart; the trunk anchor keeps each
  // trunk on its start however the piece is rotated (without it, trunks were seen 27 apart at separation 2)
  assert.equal(bp("worldgen/structures/giant_mallorn.json")["minecraft:jigsaw"].start_jigsaw_name, TRUNK_ANCHOR);
  assert.ok((set.placement.separation + 1) * 16 >= SIZE, "neighbouring giants cannot overlap");
  assert.deepEqual(pool.elements.map((e) => e.weight), CHOSEN.map(([, , w]) => w));
  assert.deepEqual(GIANT_TREES, CHOSEN.map(([v, n]) => `mallorn_${v}_${String(n).padStart(2, "0")}`));
  for (const name of GIANT_TREES) {
    assert.ok(existsSync(new URL(`../lothlorien_bp/structures/lothlorien/${name}.mcstructure`, import.meta.url)), name);
  }
});

const catalogEntries = () => JSON.parse(readFileSync(new URL("../localization/catalog.json", import.meta.url), "utf8")).packs.lothlorien_rp.entries;
const hs = (harmony, timer = 0) => ({ harmony, timer });
const afterPenalty = (h, p) => { const s = hs(h); H.applyPenalty(s, p); return s.harmony; };
test("harmony: band table incl. every edge, wariness and boundary constants", () => {
  const band = (h) => H.bandOf(h);
  assert.deepEqual([10, 9, 0, -1, -14, -15, -29, -30, -60].map(band),
    ["friend", "guest", "guest", "uneasy", "uneasy", "shunned", "shunned", "hated", "hated"]);
  assert.deepEqual([H.FRIEND_FROM, H.GUEST_FROM, H.UNEASY_FROM, H.SHUNNED_FROM, H.MIN_HARMONY, H.MAX_HARMONY], [10, 0, -14, -29, -60, 10]);
  assert.deepEqual(H.BANDS, ["hated", "shunned", "uneasy", "guest", "friend"]);
  assert.ok(H.isFriend(hs(10)) && !H.isFriend(hs(9)) && H.isHated(hs(-30)) && !H.isHated(hs(-29)));
});
test("harmony: recovery is +1 per 60 s inside up to 10, +1 per 120 s outside and never above 0", () => {
  const a = hs(0); H.tick(a, true, 59); assert.equal(a.harmony, 0); H.tick(a, true, 1); assert.equal(a.harmony, 1);
  H.tick(a, true, 100000); assert.equal(a.harmony, 10, "capped at +10");
  const b = hs(-5); H.tick(b, false, 119); assert.equal(b.harmony, -5); H.tick(b, false, 1); assert.equal(b.harmony, -4);
  H.tick(b, false, 10000); assert.equal(b.harmony, 0, "outside stops at 0");
  const c = hs(6); H.tick(c, false, 10000); assert.equal(c.harmony, 6, "positive harmony is kept outside, not raised");
  const d = hs(-3); H.tick(d, true, 60); assert.equal(d.harmony, -2, "inside recovers from below zero too");
  const e = hs(10, 40); H.tick(e, true, 1); assert.equal(e.timer, 0, "no credit piles up at the cap");
});
test("harmony: a deed restarts the minute timer", () => {
  const s = hs(0); H.tick(s, true, 50); H.recordDeed(s, "animal"); assert.equal(s.harmony, -3); assert.equal(s.timer, 0);
  H.tick(s, true, 59); assert.equal(s.harmony, -3); H.tick(s, true, 1); assert.equal(s.harmony, -2);
});
test("harmony: above 0 a penalty point costs 2, from 0 down 1 (point by point)", () => {
  assert.equal(afterPenalty(4, 3), -1, "2, 0, -1");
  assert.equal(afterPenalty(5, 3), -1, "3, 1, -1");
  assert.equal(afterPenalty(1, 1), -1);
  assert.equal(afterPenalty(10, 1), 8);
  assert.equal(afterPenalty(10, 3), 4);
  assert.equal(afterPenalty(0, 3), -3, "at 0 and below one point costs one");
  assert.equal(afterPenalty(-10, 3), -13);
  assert.ok(!H.isFriend(hs(8)), "any deed loses Friend");
});
test("harmony: floor at -60", () => {
  assert.equal(afterPenalty(-58, 10), -60);
  const s = hs(-60); H.recordDeed(s, "unicorn"); assert.equal(s.harmony, -60);
});
test("harmony: every deed cost", () => {
  assert.deepEqual(H.DEED_COSTS, { animal: 3, monster: 1, white_deer: 6, unicorn: 10, warden_fight: 1, warden_kill: 6, player: 3 });
  for (const [kind, cost] of Object.entries(H.DEED_COSTS)) { const s = hs(0); H.recordDeed(s, kind); assert.equal(s.harmony, -cost, kind); }
  const s = hs(10); H.recordDeed(s, "monster"); assert.equal(s.harmony, 8);
  const u = hs(10); H.recordDeed(u, "unicorn"); assert.equal(u.harmony, -5, "8, 6, 4, 2, 0, then five at 1 each");
  const n = hs(3, 7); H.recordDeed(n, "nonsense"); assert.deepEqual(n, hs(3, 7), "unknown deed kinds count nothing");
});
test("harmony: victims are classified into deed kinds (inanimate counts nothing, wardens and players are their own kinds)", () => {
  const k = H.deedKindOf;
  assert.equal(k("minecraft:armor_stand", ["inanimate", "mob"]), undefined);
  assert.equal(k("lothlorien:deer", ["mob"]), "animal");
  assert.equal(k("minecraft:cow", ["cow", "animal", "mob"]), "animal");
  assert.equal(k("minecraft:villager_v2", ["villager"]), "animal");
  assert.equal(k("minecraft:zombie", ["zombie", "monster", "mob"]), "monster");
  assert.equal(k(W.WHITE_DEER_ID, ["mob"]), "white_deer");
  assert.equal(k("lothlorien:unicorn"), "unicorn");
  assert.equal(k(EW.WARDEN_ID, ["lothlorien_warden", "irongolem", "mob"]), "warden_kill");
  assert.equal(k("minecraft:player", ["player"]), "player");
  assert.equal(k("minecraft:cow"), "animal");
});
test("harmony: death changes nothing, except inside the forest while Hated (-> -29)", () => {
  const cases = [[-30, true, -29], [-60, true, -29], [-30, false, -30], [-29, true, -29], [-20, true, -20], [-20, false, -20], [5, true, 5], [10, true, 10]];
  for (const [h, inside, want] of cases) { const s = hs(h, 33); H.recordDeath(s, inside); assert.equal(s.harmony, want, `${h} inside=${inside}`); }
  assert.equal(H.bandOf(H.HATED_DEATH_HARMONY), "shunned");
});
test("harmony: chat lines per band change and direction; Friend gained / lost; the deed hint is rate limited", () => {
  const m = H.changeMessages;
  assert.deepEqual(m(9, 10), ["friend.gained"]);
  assert.deepEqual(m(10, 8), ["friend.lost"]);
  assert.deepEqual(m(10, -5), ["friend.lost", "harmony.worse.uneasy"]);
  assert.deepEqual(m(5, -2), ["harmony.worse.uneasy"]);
  assert.deepEqual(m(-10, -16), ["harmony.worse.shunned"]);
  assert.deepEqual(m(-20, -31), ["harmony.worse.hated"]);
  assert.deepEqual(m(-30, -29), ["harmony.better.shunned"]);
  assert.deepEqual(m(-15, -14), ["harmony.better.uneasy"]);
  assert.deepEqual(m(-1, 0), ["harmony.better.guest"]);
  assert.deepEqual(m(3, 2), [], "same band: no band line");
  const entries = catalogEntries();
  for (const key of ["harmony.worse.uneasy", "harmony.worse.shunned", "harmony.worse.hated", "harmony.better.shunned", "harmony.better.uneasy", "harmony.better.guest", "harmony.hint", "harmony.debug", "friend.gained", "friend.lost"]) {
    assert.ok(entries[`lothlorien.message.${key}`], key);
  }
  assert.ok(!Object.keys(entries).some((k) => k.includes("disharmony")), "the Disharmony keys are retired");
  assert.ok(H.hintDue(undefined, 5) && !H.hintDue(1000, 1000 + H.HINT_GAP_MS - 1) && H.hintDue(1000, 1000 + H.HINT_GAP_MS));
  assert.equal(H.HINT_GAP_MS, 30000);
});
test("harmony: the action bar shows the band name inside the forest only; saved state round-trips; junk is tolerated", () => {
  const entries = catalogEntries();
  for (const [h, band] of [[10, "friend"], [0, "guest"], [-5, "uneasy"], [-20, "shunned"], [-40, "hated"]]) {
    assert.deepEqual(H.statusText(hs(h), true), { rawtext: [{ text: H.BAND_ICONS[band] }, { translate: `lothlorien.message.status.${band}` }] }, band);
    assert.equal(H.statusText(hs(h), false), undefined);
    assert.ok(entries[`lothlorien.message.status.${band}`], band);
  }
  const glyphs = Object.values(H.BAND_ICONS).map((i) => i.trim());
  assert.deepEqual(glyphs, ["\uE500", "\uE501", "\uE502", "\uE503", "\uE504"], "one glyph per band, U+E500...U+E504 in band order");
  assert.equal(new Set(glyphs).size, 5);
  const png = readFileSync(new URL("../lothlorien_rp/font/glyph_E5.png", import.meta.url));
  assert.equal(png.subarray(1, 4).toString(), "PNG");
  assert.deepEqual([png.readUInt32BE(16), png.readUInt32BE(20)], [256, 256], "glyph page: 16x16 cells of 16 px");
  const s = hs(-7, 12.5);
  assert.deepEqual(H.parse(H.serialize(s)), s);
  assert.deepEqual(H.parse(undefined), H.newState()); assert.deepEqual(H.parse("{oops"), H.newState());
  assert.deepEqual(H.parse('{"harmony":"x","timer":-4}'), H.newState());
  assert.deepEqual(H.parse('{"harmony":500,"timer":3}'), hs(10, 3), "clamped");
  assert.deepEqual(H.parse('{"harmony":-500}'), hs(-60, 0));
  assert.deepEqual(H.parse('{"points":3,"calm":9,"friend":2}'), H.newState(), "the old Disharmony format is ignored");
});
test("harmony: the game wiring - deeds need player or victim inside, only a player killer, saves only on change, hated tag, debug event", () => {
  const game = readFileSync(new URL("../lothlorien_bp/scripts/harmony_game.js", import.meta.url), "utf8");
  assert.ok(game.includes('"lothlorien:harmony"') && !game.includes("isharmony"));
  assert.ok(/isInside\(player\.dimension, player\.location\) \|\| isInside\(victim\.dimension, victim\.location\)/.test(game), "player OR victim inside");
  assert.ok(game.includes("damageSource.damagingEntity") && game.includes("deedKindOf(deadEntity.typeId"));
  assert.ok(/if \(state\.harmony === before\) return false;[\s\S]*setDynamicProperty\(PROPERTY/.test(game), "save only when harmony changed");
  assert.ok(game.includes("HATED_TAG") && game.includes("addTag") && game.includes("removeTag"));
  assert.ok(game.includes("handleHarmonyEvent"));
  assert.ok(readFileSync(new URL("../lothlorien_bp/scripts/main.js", import.meta.url), "utf8").includes("startHarmony(inBiome, DEBUG_TAG)"));
});

// Phase 11: deer.
import * as R from "../lothlorien_bp/scripts/deer_rules.js";
const readJson = (p) => JSON.parse(readFileSync(new URL(p, import.meta.url), "utf8"));
const deerEntity = () => readJson("../lothlorien_bp/entities/deer.json")["minecraft:entity"];
const avoidRadius = (e, w) => e.component_groups[`lothlorien:state_${w}`]["minecraft:behavior.avoid_mob_type"].entity_types[0].max_dist;

test("deer: wariness follows the Harmony band (Friend -> friend, Guest -> calm, Uneasy -> l1, Shunned -> l2, Hated -> l3)", () => {
  assert.deepEqual(["friend", "guest", "uneasy", "shunned", "hated"].map(R.warinessFor), ["friend", "calm", "l1", "l2", "l3"]);
  assert.deepEqual([10, 9, 0, -1, -14, -15, -29, -30].map((h) => R.warinessFor(H.bandOf(h))), ["friend", "calm", "calm", "l1", "l1", "l2", "l2", "l3"]);
  assert.equal(R.warinessFor(undefined), "calm");
});
test("deer: the most severe player inside their own flight radius decides", () => {
  const pick = (...c) => R.pickWariness(c.map(([distance, wariness]) => ({ distance, wariness })));
  assert.equal(pick([25, "l3"], [5, "calm"]), "l3");
  assert.equal(pick([35, "l3"], [5, "calm"]), "calm"); // l3 player too far to matter
  assert.equal(pick([15, "l2"], [12, "l1"], [2, "friend"]), "l2");
  assert.equal(pick([2, "friend"], [8, "calm"]), "calm");
  assert.equal(pick([30, "l2"], [35, "calm"]), "l2"); // nobody inside their radius: nearest decides
  assert.equal(R.pickWariness([]), undefined);
});
test("deer: flight radii match the entity file", () => {
  const e = deerEntity();
  for (const w of R.WARINESS) assert.equal(avoidRadius(e, w), R.FLIGHT_RADIUS[w], w);
});
test("deer: every wariness has a state group and a set event; flight distance grows with the Harmony band", () => {
  const e = deerEntity();
  for (const w of R.WARINESS) {
    assert.ok(e.component_groups[`lothlorien:state_${w}`], `group ${w}`);
    assert.ok(e.events[R.setEventFor(w)], `event ${w}`);
  }
  const r = (w) => avoidRadius(e, w);
  assert.ok(r("friend") < r("calm") && r("calm") < r("l1") && r("l1") < r("l2") && r("l2") < r("l3"));
  assert.ok(R.WATCH_RADIUS > r("l3") && R.WATCH_RADIUS > r("alarmed"), "watch radius covers the flight distances");
});
test("deer: only calm states can be lured; the alarm hands back through the property", () => {
  const e = deerEntity();
  const lured = (w) => !!e.component_groups[`lothlorien:state_${w}`]["minecraft:behavior.tempt"];
  assert.deepEqual(["calm", "l1", "friend", "l2", "l3", "alarmed"].map(lured), [true, false, true, false, false, false]);
  const back = e.events["lothlorien:alarm_over"].sequence.map((s) => s.trigger).sort();
  assert.deepEqual(back, R.WARINESS.map(R.setEventFor).sort());
  assert.equal(e.component_groups["lothlorien:state_alarmed"]["minecraft:timer"].time_down_event.event, "lothlorien:alarm_over");
});
test("deer: bucks drop antlers, does do not; babies drop nothing", () => {
  const e = deerEntity();
  assert.equal(e.component_groups["lothlorien:adult_buck"]["minecraft:loot"].table, "loot_tables/entities/deer_buck.json");
  assert.equal(e.component_groups["lothlorien:adult_doe"]["minecraft:loot"].table, "loot_tables/entities/deer.json");
  assert.ok(!e.component_groups["lothlorien:baby"]["minecraft:loot"]);
  assert.ok(!e.components["minecraft:loot"]);
  const names = (t) => readJson(`../lothlorien_bp/${t}`).pools.flatMap((p) => p.entries.map((x) => x.name));
  assert.ok(!names("loot_tables/entities/deer.json").includes("lothlorien:deer_antler"));
  assert.ok(names("loot_tables/entities/deer_buck.json").includes("lothlorien:deer_antler"));
});
test("deer: biome-only spawn rule with density limit, standard despawn, not persistent", () => {
  const rules = readJson("../lothlorien_bp/spawn_rules/deer.json")["minecraft:spawn_rules"];
  assert.equal(rules.description.identifier, R.DEER_ID);
  for (const c of rules.conditions) {
    assert.equal(c["minecraft:biome_filter"].value, "lothlorien");
    assert.ok(c["minecraft:density_limit"].surface > 0);
  }
  const comps = deerEntity().components;
  assert.deepEqual(comps["minecraft:despawn"], { despawn_from_distance: {} });
  assert.ok(!comps["minecraft:persistent"]);
});

// Deer antler block and its drop.
import * as AR from "../lothlorien_bp/scripts/antler_rules.js";
test("antler block: a permutation for every floor, ceiling and wall placement; no block-list filter", () => {
  const b = readJson("../lothlorien_bp/blocks/deer_antler.json")["minecraft:block"];
  const conds = b.permutations.map((p) => p.condition);
  for (const d of ["north", "east", "south", "west"]) {
    assert.ok(conds.some((c) => c.includes("'up'") && c.includes(`'${d}'`)), `floor ${d}`);
    assert.ok(conds.some((c) => c.includes("'down'") && c.includes(`'${d}'`)), `ceiling ${d}`);
    assert.ok(conds.some((c) => c.includes(`block_face') == '${d}'`) && !c.includes("'up'") && !c.includes("'down'")), `wall ${d}`);
  }
  const geo = (frag) => b.permutations.filter((p) => p.condition.includes(frag)).map((p) => p.components["minecraft:geometry"]);
  assert.ok(geo("'down'").every((g) => g === "geometry.lothlorien.deer_antler_ceiling"));
  assert.ok(b.permutations.filter((p) => !p.condition.includes("'up'") && !p.condition.includes("'down'"))
    .every((p) => p.components["minecraft:geometry"] === "geometry.lothlorien.deer_antler_wall"));
  assert.ok(!b.components["minecraft:placement_filter"], "placeable on any block, like an item frame");
  assert.ok(b.components["lothlorien:antler_support"], "support handled by script events");
  assert.ok(!b.components["minecraft:tick"], "no polling");
});
test("antler support: opposite side of the clicked face; air and liquid drop it, unloaded keeps it", () => {
  assert.deepEqual(AR.supportOffset("up"), { x: 0, y: -1, z: 0 });
  assert.deepEqual(AR.supportOffset("down"), { x: 0, y: 1, z: 0 });
  assert.deepEqual(AR.supportOffset("north"), { x: 0, y: 0, z: 1 });
  assert.deepEqual(AR.supportOffset("east"), { x: -1, y: 0, z: 0 });
  assert.equal(AR.isUnsupported({ isAir: true, isLiquid: false }), true);
  assert.equal(AR.isUnsupported({ isAir: false, isLiquid: true }), true);
  assert.equal(AR.isUnsupported({ isAir: false, isLiquid: false }), false);
  assert.equal(AR.isUnsupported(undefined), false);
});
test("antler drop: only on ground blocks, never on litter", () => {
  for (const d of ["north", "east", "south", "west"]) {
    const f = readJson(`../lothlorien_bp/features/deer_antler_${d}_feature.json`)["minecraft:single_block_feature"];
    assert.deepEqual(f.may_replace, ["minecraft:air"]);
    const bottom = f.may_attach_to.bottom.map((x) => x.name);
    assert.ok(bottom.includes("minecraft:grass_block"));
    assert.ok(!bottom.some((n) => n.includes("carpet") || n.includes("blossom")), "no litter as support");
  }
});
test("antler drop: every feature it names exists; about 1 in 16 chunks, findable on a walk", () => {
  const f = (n) => readJson(`../lothlorien_bp/features/${n}.json`);
  const rule = readJson("../lothlorien_bp/feature_rules/deer_antler_drop_feature_rules.json")["minecraft:feature_rules"];
  assert.equal(rule.description.places_feature, "lothlorien:deer_antler_drop_feature");
  const scatter = f("deer_antler_drop_feature")["minecraft:scatter_feature"];
  const weighted = f(scatter.places_feature.split(":")[1])["minecraft:weighted_random_feature"];
  for (const [name] of weighted.features) assert.ok(f(name.split(":")[1])["minecraft:single_block_feature"], name);
  // 1/64 was too rare to find (owner, 2026-10-02: none seen in several forests; the save had one site per ~50 chunks)
  const perChunk = rule.distribution.scatter_chance.numerator / rule.distribution.scatter_chance.denominator;
  assert.ok(perChunk >= 1 / 20 && perChunk <= 1 / 12, `per chunk ${perChunk}`);
});
test("antler: bucks' item is a block placer and flet chests can hold exactly one", () => {
  const item = readJson("../lothlorien_bp/items/deer_antler.json")["minecraft:item"].components;
  assert.equal(item["minecraft:block_placer"].block, "lothlorien:deer_antler");
  const chest = readJson("../lothlorien_bp/loot_tables/chests/mallorn_flet.json");
  const e = chest.pools.flatMap((p) => p.entries).find((x) => x.name === "lothlorien:deer_antler");
  assert.ok(e, "antler in chest");
  assert.equal(e.functions[0].count, 1);
});

// Phase 12: white deer guidance.
import * as W from "../lothlorien_bp/scripts/white_deer_rules.js";
import { CHEST_BLOCK, hasChest } from "../tools/build_structures.mjs";
import * as G from "../tools/dev_scripts/guide_goal/variants.mjs";

test("white deer: a guidance in progress continues only while Friend", () => {
  assert.equal(W.canBeGuided("friend"), true);
  assert.deepEqual(["guest", "uneasy", "shunned", "hated"].map(W.canBeGuided), [false, false, false, false]);
});
// Phase 12 gift: the white deer leads to a spot where it lays a Great Mallorn nut; the nut grows a flet giant.
import * as N from "../lothlorien_bp/scripts/great_mallorn_rules.js";
import { ANCHOR_AT } from "../tools/build_structures.mjs";
test("gift spot: rings inside the default simulation distance, farthest first, every heading", () => {
  const all = N.giftCandidates(100, -40);
  assert.equal(all.length, N.GIFT_RINGS.length * N.GIFT_HEADINGS);
  assert.deepEqual([...new Set(all.map((c) => c.ring))], [...N.GIFT_RINGS].sort((a, b) => b - a));
  assert.ok(N.GIFT_RINGS.every((r) => r <= 56 && r >= 32), "loaded at simulation distance 4 (64 blocks) from any spot in the player chunk");
  for (const c of all) assert.ok(Math.abs(Math.hypot(c.x - 100, c.z + 40) - c.ring) < 1.5);
  const grid = N.borderGrid(0, 0);
  assert.ok(grid.every((p) => Math.hypot(p.x, p.z) <= N.BORDER_SCAN && p.x % N.BORDER_STEP === 0));
  assert.ok(grid.some((p) => p.x === N.BORDER_SCAN) && grid.length < 600, "covers the scan circle with a bounded probe count");
});
test("gift spot: away from the known border (towards the heart), not just the farthest ring", () => {
  // deer at 0,0; the biome border runs north-south 30 blocks to the west (x = -30)
  const border = Array.from({ length: 25 }, (_, i) => ({ x: -30, z: -96 + i * 8 }));
  const spots = N.giftCandidates(0, 0).map((c) => ({ ...c, y: 70, inside: c.x > -30 }));
  const best = N.pickGiftSpot(spots, border);
  assert.ok(best.x > 30, `leads east, away from the edge (got ${best.x}, ${best.z})`);
  // a far spot near the edge loses to a nearer one deep in
  const edgeFar = { x: -20, z: 0, ring: 56, y: 70, inside: true }, deepNear = { x: 36, z: 0, ring: 36, y: 70, inside: true };
  assert.equal(N.pickGiftSpot([edgeFar, deepNear], border), deepNear);
  // equal depth (within the slack): the longer walk wins
  const a = { x: 40, z: 0, ring: 40, y: 70, inside: true }, b = { x: 44, z: 3, ring: 52, y: 70, inside: true };
  assert.equal(N.pickGiftSpot([a, b], border), b);
  // no border in sight: the longest walk; nothing standable inside: undefined
  assert.equal(N.pickGiftSpot([a, b], []), b);
  assert.equal(N.pickGiftSpot([{ ...a, inside: false }, { ...b, y: undefined }], border), undefined);
});
test("great nut: tree box and anchor match the structure builder; the sprout sits in the trunk at ground level", () => {
  assert.deepEqual([N.SIZE, N.SIZE_Y, N.TRUNK_AT, N.ROOT_DEPTH], [SIZE, SIZE_Y, TRUNK_AT, ROOT_DEPTH]);
  assert.deepEqual(N.ANCHOR, { x: TRUNK_AT + ANCHOR_AT.x, y: ROOT_DEPTH + ANCHOR_AT.y, z: TRUNK_AT + ANCHOR_AT.z });
  const at = { x: 100, y: 64, z: -20 }, o = N.treeOrigin(at);
  const cell = { x: at.x - o.x, y: at.y - o.y, z: at.z - o.z };
  assert.ok(cell.x >= TRUNK_AT && cell.x <= TRUNK_AT + 3 && cell.z >= TRUNK_AT && cell.z <= TRUNK_AT + 3, "inside the 4x4 trunk");
  assert.equal(cell.y, ROOT_DEPTH, "first cell above the ground");
});
test("great nut: grows only flet giants that ship in the pack and in worldgen", () => {
  const flets = CHOSEN.filter(([v]) => v === "round").map(([v, n]) => `lothlorien:mallorn_${v}_${String(n).padStart(2, "0")}`);
  assert.deepEqual([...N.FLET_TREES].sort(), flets.sort());
  for (const id of N.FLET_TREES) assert.ok(existsSync(new URL(`../lothlorien_bp/structures/${id.replace(":", "/")}.mcstructure`, import.meta.url)), id);
});
test("great nut: terrain, plants, leaves and logs give way; anything built stops the tree", () => {
  for (const id of ["minecraft:air", "minecraft:grass_block", "minecraft:stone", "minecraft:iron_ore", "minecraft:oak_leaves", "minecraft:oak_log",
    "minecraft:short_grass", "minecraft:red_tulip", "minecraft:water", "lothlorien:mallorn_leaves", "lothlorien:mallorn_log", "lothlorien:elanor",
    N.SPROUT_ID]) assert.ok(N.isNatural(id), id);
  for (const id of ["minecraft:oak_planks", "minecraft:stripped_oak_log", "minecraft:cobblestone", "minecraft:stone_bricks", "minecraft:glass",
    "minecraft:chest", "minecraft:torch", "minecraft:farmland", "minecraft:oak_door", "lothlorien:mallorn_planks", "lothlorien:mallorn_stripped_log",
    "minecraft:stone_slab", "minecraft:sandstone"]) assert.ok(!N.isNatural(id), id);
});
test("great nut: unique rare item that plants the sprout; sprout grows like a sapling, survives blasts, gives the nut back", () => {
  const item = readJson("../lothlorien_bp/items/great_mallorn_nut.json")["minecraft:item"];
  assert.equal(item.description.identifier, N.NUT_ID);
  assert.equal(item.components["minecraft:block_placer"].block, N.SPROUT_ID);
  assert.equal(item.components["minecraft:glint"], true);
  assert.equal(item.components["minecraft:compostable"], undefined, "the one gift is never composted by accident");
  const block = readJson("../lothlorien_bp/blocks/great_mallorn_sprout.json")["minecraft:block"];
  const sapling = readJson("../lothlorien_bp/blocks/mallorn_sapling.json")["minecraft:block"];
  assert.equal(block.description.identifier, N.SPROUT_ID);
  assert.deepEqual(block.description.states, sapling.description.states);
  assert.deepEqual(block.components["minecraft:placement_filter"], sapling.components["minecraft:placement_filter"], "same soil as the sapling");
  assert.ok(block.components["lothlorien:great_sprout"]);
  assert.ok(block.components["minecraft:destructible_by_explosion"].explosion_resistance >= 1200);
  assert.ok(!block.components["minecraft:flammable"]);
  const loot = readJson("../lothlorien_bp/loot_tables/blocks/great_mallorn_sprout.json");
  assert.deepEqual(loot.pools.flatMap((p) => p.entries.map((e) => e.name)), [N.NUT_ID]);
  for (const f of ["loot_tables/chests/mallorn_flet.json"]) assert.ok(!readFileSync(new URL(`../lothlorien_bp/${f}`, import.meta.url), "utf8").includes(N.NUT_ID), "not in loot");
  const src = readFileSync(new URL("../lothlorien_bp/scripts/great_mallorn.js", import.meta.url), "utf8");
  assert.ok(src.includes("event.cancel = true") && src.includes("repeatedUse"), "bone meal refused once per use");
  assert.ok(/playerPlaceBlock[\s\S]*message\("mallorn.planted"\)/.test(src), "planting sends a localized space warning");
  const catalog = readJson("../localization/catalog.json");
  assert.match(catalog.packs.lothlorien_rp.entries["lothlorien.message.mallorn.planted"].source, /40 blocks wide and 50 high/);
  assert.ok(readFileSync(new URL("../lothlorien_bp/scripts/main.js", import.meta.url), "utf8").includes('import "./great_mallorn.js"'));
});
test("the actionbar is only the Harmony band status (and the debug readout); other messages use chat", () => {
  for (const f of ["white_deer.js", "great_mallorn.js", "deer.js", "trees.js", "athelas.js", "lembas.js", "crop.js", "antler.js"]) {
    const src = readFileSync(new URL(`../lothlorien_bp/scripts/${f}`, import.meta.url), "utf8");
    assert.ok(!src.includes("setActionBar"), f);
  }
});
test("white deer: the gift is given once per deer, the spot is kept until then, the acorn only goes when it leads", () => {
  const src = readFileSync(new URL("../lothlorien_bp/scripts/white_deer.js", import.meta.url), "utf8");
  assert.ok(!/findMarker|getBlocks\(|MARKER/.test(src), "no marker search left");
  assert.ok(/getDynamicProperty\(GIFTED\)[\s\S]*return;/.test(src), "a gifted deer refuses (acorn kept)");
  assert.ok(src.includes("setDynamicProperty(GIFTED, true)") && src.includes("setDynamicProperty(GIFT_SPOT, undefined)"));
  assert.ok(/function arrive[\s\S]*giveGift/.test(src), "arrival lays the nut");
  const lead = src.slice(src.indexOf("function lead("), src.indexOf("function end("));
  assert.ok(lead.indexOf("consumeAcorn") > lead.indexOf("guide_start"), "acorn used only when guidance starts");
});
const flat = () => 64; // every column standable at y 64
const at0 = { x: 0, y: 64, z: 0 };
test("waypoints: open ground gives a HOP-block waypoint straight at the target", () => {
  const w = W.pickWaypoint(at0, { x: 80, z: 0 }, flat);
  assert.equal(w.final, false);
  assert.ok(Math.abs(w.x - W.HOP) < 1e-9 && Math.abs(w.z) < 1e-9 && w.y === 64);
  assert.ok(W.HOP <= 14 && W.MIN_HOP >= 8, "hops of 8-14 blocks");
});
test("waypoints: a lake ahead turns the heading, bias side first; a near wall shortens the hop", () => {
  const lake = (x, z) => (x > 4 && Math.abs(z) < 20 ? undefined : 64);
  const w = W.pickWaypoint(at0, { x: 80, z: 0 }, lake, { bias: -1 });
  assert.equal(w.turn, -1);
  assert.ok(Math.abs(w.z) >= 20 || w.x <= 4);
  const wall = (x) => (x > 10 ? undefined : 64);
  const v = W.pickWaypoint(at0, { x: 80, z: 0 }, wall);
  assert.ok(v.turn === 0 && v.x <= 10 && v.x >= W.MIN_HOP);
});
test("waypoints: a skipped heading is not reused; boxed in gives undefined", () => {
  assert.notEqual(W.pickWaypoint(at0, { x: 80, z: 0 }, flat, { skip: new Set([0]) }).deg, 0);
  assert.equal(W.pickWaypoint(at0, { x: 80, z: 0 }, () => undefined), undefined);
});
test("waypoints: the final hop lands within FINAL_RING of a blocked target, on the deer's side", () => {
  const trunk = (x, z) => (W.horizontal({ x, z }, { x: 10, z: 0 }) < 2 ? undefined : 64);
  const w = W.pickWaypoint(at0, { x: 10, z: 0 }, trunk);
  assert.equal(w.final, true);
  assert.ok(w.x < 10 && W.horizontal(w, { x: 10, z: 0 }) <= W.FINAL_RING && W.FINAL_RING <= 5);
});
test("waypoints: 80 blocks of open ground is 6 hops", () => {
  let p = { ...at0 }, n = 0;
  while (n < 20) {
    const w = W.pickWaypoint(p, { x: 80, z: 0 }, flat);
    n++;
    if (w.final) break;
    p = { x: w.x, y: w.y, z: w.z };
  }
  assert.equal(n, 6);
});
test("hop status: reached, progress, stuck after 5 s", () => {
  const hop = W.newHop({ x: 14, z: 0 }, at0);
  assert.equal(hop.best, 14);
  assert.equal(W.hopStatus(hop, { x: 14 - W.REACHED, z: 0 }, W.GUIDE_TICKS), "next");
  assert.equal(W.hopStatus(hop, { x: 5, z: 0 }, W.GUIDE_TICKS), "go");
  assert.equal(hop.stuck, 0);
  let s;
  for (let t = 0; t < W.HOP_STUCK_TICKS; t += W.GUIDE_TICKS) s = W.hopStatus(hop, { x: 5, z: 0 }, W.GUIDE_TICKS);
  assert.equal(s, "retry");
  assert.equal(W.HOP_STUCK_TICKS, 100);
  assert.ok(W.GUIDE_TICKS <= 5);
});
test("white deer: no teleport stepping left in the rules or the game script", () => {
  for (const k of ["pickStep", "STEP", "MOVE_TICKS", "headings"]) assert.ok(!(k in W), k);
  const src = readFileSync(new URL("../lothlorien_bp/scripts/white_deer.js", import.meta.url), "utf8");
  assert.ok(!/deer\.teleport\(/.test(src), "the deer itself is never teleported");
  assert.ok(src.includes("spawnEntity(BEACON_ID"), "one beacon per session");
});
test("white deer: progress resets the stuck timer, standing still does not", () => {
  const s = { bestDist: 50, stuck: 0 };
  W.trackProgress(s, 49.5, true, 2);
  assert.equal(s.stuck, 2);
  W.trackProgress(s, 48, true, 2);
  assert.deepEqual([s.bestDist, s.stuck], [48, 0]);
  W.trackProgress(s, 48, false, 2); // waiting for the player is not stuck
  assert.equal(s.stuck, 0);
});
test("white deer: phases (arrive, wait for the player, give up)", () => {
  const base = { toTarget: 40, toPlayer: 5, stuck: 0, age: 0, playerCalm: true };
  const ph = (o) => W.phase({ ...base, ...o });
  assert.equal(ph({}), "walk");
  assert.equal(ph({ toPlayer: W.WAIT_DIST + 1 }), "wait");
  assert.equal(ph({ toPlayer: W.ABORT_DIST + 1 }), "abort");
  assert.equal(ph({ playerCalm: false }), "abort");
  assert.equal(ph({ toTarget: W.ARRIVE_DIST }), "arrived");
  assert.equal(ph({ stuck: W.STUCK_TICKS }), "abort");
  assert.equal(ph({ stuck: W.STUCK_TICKS, toTarget: W.STUCK_ARRIVE_DIST }), "arrived");
  assert.equal(ph({ age: W.MAX_TICKS + 1 }), "abort");
});

const whiteEntity = () => readJson("../lothlorien_bp/entities/white_deer.json")["minecraft:entity"];
const everything = (e) => [e.components, ...Object.values(e.component_groups)];
const GRAIN = "lothlorien:western_corn_grain";
test("ordinary deer: no coat variant, no guiding state (Phase 12 moved to its own entity)", () => {
  const e = deerEntity();
  const text = JSON.stringify(e);
  for (const bad of ["lothlorien:coat", "lothlorien:guiding", "state_guiding", "guide_start", "coat_white"]) {
    assert.ok(!text.includes(bad), bad);
  }
  const rc = readJson("../lothlorien_rp/render_controllers/deer.render_controllers.json").render_controllers["controller.render.lothlorien.deer"];
  assert.ok(!rc.textures[0].includes("white"));
});
test("ordinary deer: Western Corn grain is the only food (lure, breeding, fawn growth); not the seeds, acorn or apple", () => {
  const e = deerEntity();
  for (const w of ["calm", "friend"]) assert.deepEqual(e.component_groups[`lothlorien:state_${w}`]["minecraft:behavior.tempt"].items, [GRAIN], w);
  assert.deepEqual(e.component_groups["lothlorien:adult"]["minecraft:breedable"].breed_items, [GRAIN]);
  assert.deepEqual(e.component_groups["lothlorien:baby"]["minecraft:ageable"].feed_items, [GRAIN]);
  const text = JSON.stringify(e);
  for (const bad of ["mallorn_acorn", "\"apple\"", "western_corn_seeds"]) assert.ok(!text.includes(bad), bad);
  assert.ok(existsSync(new URL("../lothlorien_bp/items/western_corn_grain.json", import.meta.url)), "grain item exists");
});
test("white deer: a separate loner entity, not tamable, not breedable, no babies; leashable, no balloon", () => {
  const e = whiteEntity();
  assert.equal(e.description.identifier, W.WHITE_DEER_ID);
  assert.equal(e.description.identifier, R.WHITE_DEER_ID);
  assert.ok(e.description.is_spawnable && e.description.is_summonable);
  const keys = new Set(everything(e).flatMap((c) => Object.keys(c)));
  for (const bad of ["minecraft:breedable", "minecraft:behavior.breed", "minecraft:offspring", "minecraft:is_baby", "minecraft:ageable",
    "minecraft:behavior.follow_parent", "minecraft:tameable", "minecraft:balloonable", "minecraft:spawn_egg_interaction",
    "minecraft:behavior.follow_mob", "minecraft:behavior.follow_owner"]) {
    assert.ok(!keys.has(bad), bad);
  }
  assert.ok(e.components["minecraft:leashable"], "a lead works on it (the owner's wish)");
  assert.ok(!e.events["minecraft:entity_born"] && !e.events["minecraft:ageable_grow_up"]);
  assert.ok(!e.description.properties["lothlorien:coat"]);
  assert.deepEqual(e.components["minecraft:despawn"], { despawn_from_distance: {} });
  assert.ok(e.components["minecraft:type_family"].family.includes("lothlorien_white_deer"));
  assert.ok(!e.components["minecraft:type_family"].family.includes("lothlorien_deer"), "own family");
});
test("white deer: same wariness states and flight distances as the deer; only the acorn lures it", () => {
  const e = whiteEntity(), d = deerEntity();
  // same flight, except the lure item that switches flight from its holder off
  const sameLure = (avoid) => JSON.parse(JSON.stringify(avoid).replaceAll(W.ACORN_ID, R.CORN_ID));
  for (const w of [...R.WARINESS, "alarmed", "tame"]) {
    assert.deepEqual(sameLure(e.component_groups[`lothlorien:state_${w}`]["minecraft:behavior.avoid_mob_type"]),
      d.component_groups[`lothlorien:state_${w}`]["minecraft:behavior.avoid_mob_type"], w);
    assert.ok(e.events[R.setEventFor(w)] || w === "alarmed" || w === "tame", w);
  }
  const lured = (w) => e.component_groups[`lothlorien:state_${w}`]["minecraft:behavior.tempt"]?.items;
  assert.deepEqual(["calm", "friend"].map(lured), [[W.ACORN_ID], [W.ACORN_ID]]);
  assert.deepEqual(["l1", "l2", "l3", "alarmed"].map(lured), [undefined, undefined, undefined, undefined]);
  assert.deepEqual(e.events["lothlorien:alarm_over"], d.events["lothlorien:alarm_over"]);
  assert.equal(e.component_groups["lothlorien:state_alarmed"]["minecraft:timer"].time_down_event.event, "lothlorien:alarm_over");
  for (const k of ["minecraft:behavior.panic", "minecraft:behavior.float", "minecraft:behavior.random_stroll", "minecraft:navigation.walk", "minecraft:movement"]) {
    assert.deepEqual(e.components[k], d.components[k], k);
  }
  assert.ok(R.DEER_TYPES.includes(W.WHITE_DEER_ID), "deer.js drives its wariness and alarm");
});
test("both deer: a held lure beats flight, a fed (tame) deer does not flee from players, attack still wins", () => {
  for (const [e, lure] of [[deerEntity(), R.CORN_ID], [whiteEntity(), W.ACORN_ID]]) {
    const g = e.component_groups;
    const playerEntries = (grp) => grp["minecraft:behavior.avoid_mob_type"].entity_types
      .filter((t) => JSON.stringify(t.filters).includes('"value":"player"'));
    const exempts = (t) => t.filters.all_of?.some((f) => f.test === "has_equipment" && f.subject === "other" && f.operator === "!=" && f.value === lure);
    for (const w of ["calm", "friend"]) {
      assert.ok(playerEntries(g[`lothlorien:state_${w}`]).every(exempts), `${w}: holding ${lure} stops the flight`);
      assert.equal(g[`lothlorien:state_${w}`]["minecraft:behavior.tempt"].can_get_scared, false, `${w}: the lure is not broken by movement`);
    }
    for (const w of ["l1", "l2", "l3", "alarmed"]) assert.ok(!playerEntries(g[`lothlorien:state_${w}`]).some(exempts), `${w}: the lure does not help`);
    assert.equal(playerEntries(g["lothlorien:state_tame"]).length, 0, "tame: no flight from players");
    assert.deepEqual(g["lothlorien:state_tame"]["minecraft:behavior.tempt"].items, [lure]);
    assert.equal(e.description.properties["lothlorien:tame"].default, false);
    for (const [name, ev] of Object.entries(e.events)) {
      const removes = [ev, ...(ev.sequence ?? [])].flatMap((s) => s.remove?.component_groups ?? []);
      if (removes.includes("lothlorien:state_calm")) assert.ok(removes.includes("lothlorien:state_tame"), `${name} removes state_tame`);
    }
    for (const w of ["calm", "friend"]) {
      const seq = e.events[R.setEventFor(w)].sequence;
      const addFor = (tame) => seq.find((s) => s.filters?.domain === "lothlorien:tame" && s.filters.value === tame).add.component_groups;
      assert.deepEqual([addFor(false), addFor(true)], [[`lothlorien:state_${w}`], ["lothlorien:state_tame"]]);
    }
    for (const w of ["l1", "l2", "l3"]) assert.deepEqual(e.events[R.setEventFor(w)].add.component_groups, [`lothlorien:state_${w}`], w);
    assert.equal(e.components["minecraft:behavior.panic"].priority, 1, "panic outranks the lure (3)");
  }
  const src = (f) => readFileSync(new URL(`../lothlorien_bp/scripts/${f}`, import.meta.url), "utf8");
  assert.ok(src("deer.js").includes('triggerEvent("lothlorien:untame")'), "a player hurting a deer untames it");
  assert.ok(/tame\(target\)/.test(src("deer.js")), "feeding corn tames a deer");
  assert.ok(src("white_deer.js").includes('triggerEvent("lothlorien:become_tame")'), "a white deer taking the acorn is tamed");
  // a property set by script is not visible before the next tick, so tame state goes through entity events
  for (const f of ["deer.js", "white_deer.js"]) assert.ok(!/setProperty\("lothlorien:tame"/.test(src(f)), f);
});
test("both deer: tame or leashed = persistent, like vanilla tamed animals; either one alone keeps it", () => {
  for (const e of [deerEntity(), whiteEntity()]) {
    const K = "lothlorien:kept", ev = e.events;
    assert.deepEqual(e.component_groups[K], { "minecraft:persistent": {} });
    assert.ok(e.components["minecraft:despawn"], "wild deer still despawn");
    const l = e.components["minecraft:leashable"];
    assert.deepEqual([l.on_leash.event, l.on_unleash.event], ["lothlorien:leashed", "lothlorien:unleashed"]);
    assert.deepEqual(ev["lothlorien:leashed"].add.component_groups, [K]);
    assert.deepEqual(ev["lothlorien:become_tame"], { set_property: { "lothlorien:tame": true }, add: { component_groups: [K] } });
    const unleash = ev["lothlorien:unleashed"].sequence[0];
    assert.deepEqual([unleash.filters.domain, unleash.filters.value, unleash.remove.component_groups], ["lothlorien:tame", false, [K]]);
    const [untameSet, untameRemove] = ev["lothlorien:untame"].sequence;
    assert.equal(untameSet.set_property["lothlorien:tame"], false);
    assert.deepEqual([untameRemove.filters.test, untameRemove.filters.value, untameRemove.remove.component_groups], ["is_leashed", false, [K]]);
    for (const [name, x] of Object.entries(ev)) {
      if (!name.includes("tame") && !name.includes("leash")) assert.ok(!JSON.stringify(x).includes(K), `${name} leaves ${K} alone`);
    }
  }
});
test("white deer: guiding state follows the beacon (one goal, below panic, above avoid) and only guide_start adds it", () => {
  const e = whiteEntity();
  const g = "lothlorien:state_guiding";
  for (const [name, ev] of Object.entries(e.events)) {
    if (name.startsWith("lothlorien:set_") || name === "lothlorien:alarm") {
      const first = ev.sequence?.[0] ?? ev; // set_calm/set_friend: reset first, then the tame-dependent add
      assert.ok(first.remove.component_groups.includes(g), name);
      assert.equal(first.set_property["lothlorien:guiding"], false, name);
    }
    if (name !== "lothlorien:guide_start") assert.ok(![ev, ...(ev.sequence ?? [])].some((s) => s.add?.component_groups?.includes(g)), name);
  }
  assert.deepEqual(e.events["lothlorien:guide_start"].add.component_groups, [g]);
  assert.equal(e.events["lothlorien:guide_start"].set_property["lothlorien:guiding"], true);
  assert.equal(e.events["lothlorien:guide_end"].trigger, "lothlorien:alarm_over");
  const guiding = e.component_groups[g];
  assert.ok(!guiding["minecraft:behavior.tempt"]);
  assert.deepEqual(guiding["minecraft:behavior.avoid_mob_type"].entity_types.map((t) => t.filters.value).sort(), ["monster", "wolf"]);
  // the goal is exactly one of the prepared variants (switch_guide_goal.mjs), the shipped one is follow_target_leader
  const variant = G.currentVariant(e);
  assert.ok(variant, "a known guide goal variant");
  for (const [k, v] of Object.entries(G.VARIANTS[variant](G.BEACON_FILTER))) assert.deepEqual(guiding[k], v, k);
  assert.equal(variant, "leader", "shipped goal (change this line together with a switch)");
  const prios = Object.keys(G.VARIANTS[variant](G.BEACON_FILTER)).map((k) => guiding[k].priority);
  assert.ok(prios.every((p) => p > e.components["minecraft:behavior.panic"].priority && p < guiding["minecraft:behavior.avoid_mob_type"].priority));
  const within = guiding["minecraft:behavior.follow_target_leader"]?.within_radius ?? 24;
  assert.ok(within > W.HOP + W.REACHED, "the beacon stays inside the goal's radius");
  assert.ok(Number(readJson("../lothlorien_bp/entities/white_deer.json").format_version.split(".")[1]) >= 26, "follow_target_leader needs 1.26.20+");
});
test("white deer: no experiment groups shipped (switch_guide_goal.mjs --clean)", () => {
  const e = whiteEntity();
  assert.ok(![...Object.keys(e.component_groups), ...Object.keys(e.events)].some((k) => k.startsWith("lothlorien:test_")));
  const copy = structuredClone(e);
  G.removeExperiment(G.addExperiment(copy));
  assert.deepEqual(copy, e, "experiment add + clean round-trips");
  for (const name of Object.keys(G.VARIANTS)) assert.equal(G.currentVariant(G.applyVariant(structuredClone(e), name)), name, name);
});
test("white deer: holding an acorn gives the interaction the script listens for; the item is not used up by the engine", () => {
  const e = whiteEntity();
  const [i] = e.components["minecraft:interact"].interactions;
  assert.ok(JSON.stringify(i.on_interact.filters).includes(W.ACORN_ID));
  assert.equal(i.use_item, false);
  assert.ok(existsSync(new URL(`../lothlorien_bp/items/${W.ACORN_ID.split(":")[1]}.json`, import.meta.url)), "acorn item exists");
  const lang = readFileSync(new URL("../lothlorien_rp/texts/en_US.lang", import.meta.url), "utf8");
  for (const key of [i.interact_text, "entity.lothlorien:white_deer.name", "item.spawn_egg.entity.lothlorien:white_deer.name"]) {
    assert.ok(lang.includes(`${key}=`), key);
  }
  assert.ok(lang.includes("entity.lothlorien:white_deer.name=White Deer\n") || lang.includes("entity.lothlorien:white_deer.name=White Deer\r\n"));
});
test("white deer: rare single spawns in the biome at SPAWN_WEIGHT, flagged natural by the herd event", () => {
  const rule = readJson("../lothlorien_bp/spawn_rules/white_deer.json")["minecraft:spawn_rules"];
  const deer = readJson("../lothlorien_bp/spawn_rules/deer.json")["minecraft:spawn_rules"];
  assert.equal(rule.description.identifier, W.WHITE_DEER_ID);
  assert.equal(rule.description.population_control, "animal");
  const [c] = rule.conditions, [dc] = deer.conditions;
  assert.equal(rule.conditions.length, 1);
  assert.deepEqual(c["minecraft:herd"], { min_size: 1, max_size: 1, event: "lothlorien:spawn_natural" });
  assert.equal(c["minecraft:density_limit"].surface, 1);
  assert.equal(c["minecraft:weight"].default, W.SPAWN_WEIGHT, "tune in white_deer_rules.js and the spawn rule together");
  assert.ok(c["minecraft:weight"].default < dc["minecraft:weight"].default, "fewer than deer");
  assert.deepEqual(c["minecraft:biome_filter"], dc["minecraft:biome_filter"]);
  const e = whiteEntity();
  assert.deepEqual(e.description.properties["lothlorien:natural"], { type: "bool", default: false, client_sync: false });
  const natural = e.events["lothlorien:spawn_natural"];
  assert.equal(natural.set_property["lothlorien:natural"], true);
  assert.equal(natural.trigger, "lothlorien:set_calm", "a natural spawn is fully set up even if entity_spawned does not also run");
  assert.deepEqual(e.events["minecraft:entity_spawned"], { trigger: "lothlorien:set_calm" }, "summon and egg: never flagged");
  assert.ok(!JSON.stringify(e.events["minecraft:entity_spawned"]).includes("natural"));
});
test("white deer: depth table - none outside, few at the edge, more inside, all in the heart; clamps odd levels", () => {
  assert.deepEqual([0, 1, 2, 3].map(W.spawnKeepChance), W.SPAWN_KEEP_BY_DEPTH);
  assert.equal(W.SPAWN_KEEP_BY_DEPTH.length, DEPTH_NAMES.length, "one chance per depth level (depth.js)");
  assert.equal(W.spawnKeepChance(0), 0);
  assert.equal(W.spawnKeepChance(3), 1);
  for (let l = 1; l < 4; l++) assert.ok(W.spawnKeepChance(l) > W.spawnKeepChance(l - 1), `level ${l} more than ${l - 1}`);
  assert.equal(W.spawnKeepChance(7), 1); assert.equal(W.spawnKeepChance(-1), 0); assert.equal(W.spawnKeepChance(undefined), 0);
  assert.ok(W.keepNaturalSpawn(3, 0.999) && !W.keepNaturalSpawn(0, 0));
  assert.ok(W.keepNaturalSpawn(1, W.spawnKeepChance(1) - 0.001) && !W.keepNaturalSpawn(1, W.spawnKeepChance(1)));
  // share of kept spawns over many rolls follows the table
  let kept = 0;
  for (let i = 0; i < 1000; i++) if (W.keepNaturalSpawn(2, i / 1000)) kept++;
  assert.equal(kept, Math.round(W.spawnKeepChance(2) * 1000));
  const src = readFileSync(new URL("../lothlorien_bp/scripts/white_deer.js", import.meta.url), "utf8");
  assert.ok(src.includes("EntityInitializationCause.Loaded") && src.includes('setProperty("lothlorien:natural", false)'), "judged once, not on reload");
});
test("white deer: always an antlered hart; sure antler plus the usual deer drops, on any death", () => {
  const e = whiteEntity();
  assert.ok(!e.description.properties["lothlorien:sex"], "no sex split");
  const text = JSON.stringify(e);
  for (const bad of ["adult_doe", "adult_buck", "spawn_doe", "spawn_buck", "lothlorien:sex"]) assert.ok(!text.includes(bad), bad);
  assert.equal(e.components["minecraft:loot"].table, "loot_tables/entities/white_deer.json");
  assert.ok(!e.components["minecraft:experience_reward"].on_bred);
  const loot = readJson("../lothlorien_bp/loot_tables/entities/white_deer.json");
  const pool = (name) => loot.pools.find((p) => p.entries.some((x) => x.name === name));
  const antler = pool("lothlorien:deer_antler");
  assert.ok(antler && !antler.conditions && antler.entries.length === 1 && antler.rolls === 1, "guaranteed, no player-kill or chance condition");
  assert.deepEqual(antler.entries[0].functions, [{ function: "set_count", count: 1 }]);
  // leather and venison exactly as a buck deer
  const buck = readJson("../lothlorien_bp/loot_tables/entities/deer_buck.json");
  for (const name of ["minecraft:leather", "lothlorien:venison_raw"]) {
    assert.deepEqual(pool(name), buck.pools.find((p) => p.entries.some((x) => x.name === name)), name);
  }
});
test("white deer: leash rule - a lead always wins over guidance", () => {
  assert.equal(W.offerRefusal({ band: "friend", leashed: false }), undefined);
  assert.equal(W.offerRefusal({ band: "friend", leashed: true }), "leashed");
  assert.equal(W.offerRefusal({ band: "shunned", leashed: true }), "leashed");
  for (const band of ["uneasy", "shunned", "hated"]) assert.equal(W.offerRefusal({ band, leashed: false }), "restless", band);
  assert.equal(W.offerRefusal({ band: "guest", leashed: false }), "untrusted"); // a Guest is not enough: Friend only
  const base = { toTarget: 40, toPlayer: 5, stuck: 0, age: 0, playerCalm: true };
  assert.equal(W.phase(base), "walk");
  assert.equal(W.phase({ ...base, leashed: true }), "leashed");
  assert.equal(W.phase({ ...base, toTarget: 1, leashed: true }), "leashed", "even at the goal");
  assert.equal(W.phase({ ...base, toPlayer: 30, leashed: true }), "leashed");
  const src = readFileSync(new URL("../lothlorien_bp/scripts/white_deer.js", import.meta.url), "utf8");
  assert.ok(src.includes('getComponent("minecraft:leashable")?.isLeashed'), "the game script reads the lead");
});
test("harmony: a white deer kill costs 6 (two animals), a unicorn 10, a warden 6 on top of 1 per fight", () => {
  const cost = (kind) => { const x = hs(0); H.recordDeed(x, kind); return -x.harmony; };
  assert.equal(cost(H.deedKindOf(W.WHITE_DEER_ID)), 6);
  assert.equal(cost(H.deedKindOf(R.DEER_ID)), 3);
  assert.equal(cost("white_deer"), 2 * cost("animal"));
  assert.equal(H.bandOf(-cost("white_deer")), "uneasy");
  assert.equal(cost(H.deedKindOf(EW.WARDEN_ID)) + cost("warden_fight"), 7);
});
test("white deer: client entity uses the white texture on the antlered deer model only; no unused fawn texture", () => {
  const c = readJson("../lothlorien_rp/entity/white_deer.entity.json")["minecraft:client_entity"].description;
  assert.equal(c.identifier, W.WHITE_DEER_ID);
  assert.deepEqual(c.geometry, { default: "geometry.lothlorien.deer_buck" }, "always antlered");
  const rc = readJson("../lothlorien_rp/render_controllers/white_deer.render_controllers.json").render_controllers["controller.render.lothlorien.white_deer"];
  assert.equal(rc.geometry, "Geometry.default");
  assert.deepEqual(c.textures, { default: "textures/entity/deer/deer_white" });
  assert.ok(existsSync(new URL(`../lothlorien_rp/${c.textures.default}.png`, import.meta.url)));
  assert.ok(!existsSync(new URL("../lothlorien_rp/textures/entity/deer/deer_white_baby.png", import.meta.url)));
  assert.ok(c.spawn_egg, "spawn egg");
  const geo = readFileSync(new URL("../lothlorien_rp/models/entity/deer.geo.json", import.meta.url), "utf8");
  for (const g of Object.values(c.geometry)) assert.ok(geo.includes(`"${g}"`), g);
  assert.ok(readJson("../lothlorien_rp/sounds.json").entity_sounds.entities[W.WHITE_DEER_ID], "sounds");
});
test("guide beacon: invisible, weightless, untouchable helper that removes itself; no spawn rule", () => {
  const b = readJson("../lothlorien_bp/entities/guide_beacon.json")["minecraft:entity"];
  assert.equal(b.description.identifier, W.BEACON_ID);
  assert.equal(b.description.is_spawnable, false);
  assert.equal(b.description.is_summonable, true, "spawnEntity and /summon need it");
  const c = b.components;
  assert.ok(c["minecraft:type_family"].family.includes(G.BEACON_FILTER.value));
  assert.deepEqual(c["minecraft:physics"], { has_gravity: false, has_collision: false });
  // Not pushable = no pushable_by_* component; minecraft:pushable is rejected by entity format 1.26.50.
  for (const k of ["minecraft:pushable", "minecraft:pushable_by_entity", "minecraft:pushable_by_block"]) assert.equal(c[k], undefined, k);
  assert.deepEqual(c["minecraft:damage_sensor"].triggers, { cause: "all", deals_damage: "no" });
  assert.ok(!c["minecraft:is_collidable"] && !c["minecraft:despawn"]);
  const t = c["minecraft:timer"];
  assert.ok(t.time * 20 > W.MAX_TICKS && !t.looping, "outlives the longest session");
  assert.ok(b.component_groups[b.events[t.time_down_event.event].add.component_groups[0]]["minecraft:instant_despawn"]);
  assert.ok(!existsSync(new URL("../lothlorien_bp/spawn_rules/guide_beacon.json", import.meta.url)));
  const client = readJson("../lothlorien_rp/entity/guide_beacon.entity.json")["minecraft:client_entity"].description;
  assert.ok(!client.spawn_egg, "no spawn egg");
  const geo = readJson("../lothlorien_rp/models/entity/guide_beacon.geo.json")["minecraft:geometry"][0];
  assert.equal(geo.description.identifier, client.geometry.default);
  assert.ok(geo.bones.flatMap((x) => x.cubes).every((cube) => cube.size.every((v) => v === 0)), "nothing to render");
});
test("giant structures: the flet giants the nut grows hold a chest, plain giants none; no leftover marker blocks", () => {
  for (const [v, n] of CHOSEN) {
    const id = `lothlorien:mallorn_${v}_${String(n).padStart(2, "0")}`;
    const bytes = readFileSync(new URL(`../lothlorien_bp/structures/${id.replace(":", "/")}.mcstructure`, import.meta.url));
    assert.equal(bytes.includes(Buffer.from(CHEST_BLOCK)), N.FLET_TREES.includes(id), `${id}: chest only in the flet giants`);
    assert.ok(!bytes.includes(Buffer.from("structure_marker")), `${id}: marker removed (run node tools/build_structures.mjs)`);
  }
  assert.ok(!existsSync(new URL("../lothlorien_bp/blocks/structure_marker.json", import.meta.url)));
  // the generator rule itself: flet trees have a chest, plain giants none
  assert.ok(flets.every((t) => hasChest(t.blocks)) && plains.every((t) => !hasChest(t.blocks)));
});
test("two plank sets: logs -> silver planks, stripped -> heartwood planks; heartwood blocks are clones on shared geometry", () => {
  const result = (f) => readJson(`../lothlorien_bp/recipes/${f}.json`)["minecraft:recipe_shaped"].result.item;
  assert.equal(result("mallorn_planks_from_log"), "lothlorien:mallorn_planks");
  assert.equal(result("mallorn_planks_from_wood"), "lothlorien:mallorn_planks");
  assert.equal(result("mallorn_heartwood_planks_from_stripped_log"), "lothlorien:mallorn_heartwood_planks");
  assert.equal(result("mallorn_heartwood_planks_from_stripped_wood"), "lothlorien:mallorn_heartwood_planks");
  const lang = readFileSync(new URL("../lothlorien_rp/texts/en_US.lang", import.meta.url), "utf8");
  const strip = (v) => JSON.stringify(v).replaceAll("mallorn_heartwood_", "mallorn_").replace(/"minecraft:map_color":"#[0-9a-f]{6}"/g, "");
  for (const part of ["planks", "stairs", "slab", "double_slab", "fence", "fence_gate", "door", "trapdoor", "button", "pressure_plate"]) {
    const gold = readJson(`../lothlorien_bp/blocks/mallorn_heartwood_${part}.json`);
    const silver = readJson(`../lothlorien_bp/blocks/mallorn_${part}.json`);
    assert.equal(strip(gold), strip(silver), `${part}: out of step with silver (run python -B tools/make_heartwood_set.py)`);
    assert.ok(!JSON.stringify(gold).includes("geometry.lothlorien.mallorn_heartwood"), `${part}: geometry is shared`);
    assert.ok(lang.includes(`tile.lothlorien:mallorn_heartwood_${part}.name=`), `${part}: name`);
    if (part !== "double_slab") {
      assert.ok(existsSync(new URL(`../lothlorien_bp/items/mallorn_heartwood_${part}.json`, import.meta.url)), `${part}: item`);
    }
  }
  const src = readFileSync(new URL("../lothlorien_bp/scripts/blocks.js", import.meta.url), "utf8");
  assert.ok(src.includes('const WOODS = ["mallorn", "mallorn_heartwood"]'), "door pairing, slab merging, button/plate support know both sets");
});
test("icons: every non-cube plank-family block draws its icon through item_visual with an explicit vanilla pose", () => {
  // Without item_visual the icon was turned (stairs, gate) and auto-fitted (slab drawn big and high); a gui pose
  // without rotation left the fence a quarter turn off. Poses: Kaioga 1.26.50 templates (tuned against vanilla).
  const YAW = { stairs: 135, fence_gate: 135, slab: 225, fence: 225, trapdoor: 225, pressure_plate: 225, button: 225 };
  const geos = new Map();
  for (const f of readdirSync(new URL("../lothlorien_rp/models/blocks/", import.meta.url))) {
    for (const g of readJson(`../lothlorien_rp/models/blocks/${f}`)["minecraft:geometry"]) geos.set(g.description.identifier, g);
  }
  for (const set of ["mallorn", "mallorn_heartwood"]) {
    for (const [part, yaw] of Object.entries(YAW)) {
      const comps = readJson(`../lothlorien_bp/blocks/${set}_${part}.json`)["minecraft:block"].components;
      const visual = comps["minecraft:item_visual"];
      assert.ok(visual && visual.material_instances, `${set}_${part}: item_visual with material_instances`);
      assert.deepEqual(visual.material_instances, comps["minecraft:material_instances"], `${set}_${part}: icon uses the block's textures`);
      const geo = geos.get(visual.geometry);
      assert.ok(geo, `${set}_${part}: item_visual geometry ${visual.geometry} exists`);
      const gui = geo.item_display_transforms?.gui;
      assert.ok(gui && gui.fit_to_frame === false, `${set}_${part}: fit_to_frame off (vanilla size and height)`);
      assert.deepEqual(gui.rotation, [30, yaw, 0], `${set}_${part}: gui rotation`);
    }
  }
  // the stairs icon is a straight stair whose tall half is EAST (geometry x is mirrored: x -8..0)
  const top = geos.get("geometry.lothlorien.mallorn_stairs_item").bones[0].cubes.find((c) => c.origin[1] === 8);
  assert.deepEqual([top.origin, top.size], [[-8, 8, -8], [8, 8, 16]]);
  const stair = geos.get("geometry.lothlorien.mallorn_stairs_item");
  for (const cube of stair.bones[0].cubes) {
    assert.equal(cube.uv.up.uv_rotation, 90, "stair item top grain follows the stair run");
    assert.equal(cube.uv.down.uv_rotation, 90, "stair item underside follows the stair run");
  }
  for (const set of ["mallorn", "mallorn_heartwood"]) {
    assert.ok(readJson(`../lothlorien_bp/items/${set}_door.json`)["minecraft:item"].components["minecraft:icon"], `${set}_door: 2D icon`);
  }
});
test("fence: every material instance the fence models name is defined on the block and its icon (both sets); geometry format allows its display transforms", () => {
  for (const g of ["mallorn_fence", "mallorn_fence_carried"]) {
    const geo = JSON.stringify(readJson(`../lothlorien_rp/models/blocks/${g}.geo.json`));
    const used = new Set([...geo.matchAll(/"material_instance":"(\w+)"/g)].map((x) => x[1]));
    for (const set of ["mallorn", "mallorn_heartwood"]) {
      const c = readJson(`../lothlorien_bp/blocks/${set}_fence.json`)["minecraft:block"].components;
      const mi = g.endsWith("carried") ? c["minecraft:item_visual"].material_instances : c["minecraft:material_instances"];
      for (const name of used) assert.ok(mi[name], `${set} ${g}: ${name}`);
      assert.equal(mi["*"].texture, `lothlorien:${set}_fence_post`);
    }
    const f = readJson(`../lothlorien_rp/models/blocks/${g}.geo.json`);
    const v = f.format_version.split(".").map(Number);
    const atLeast = (w) => v[0] !== w[0] ? v[0] > w[0] : v[1] !== w[1] ? v[1] > w[1] : (v[2] ?? 0) >= w[2];
    if (f["minecraft:geometry"][0].item_display_transforms?.shelf) assert.ok(atLeast([1, 26, 40]), `${g}: "shelf" needs format 1.26.40+`);
  }
});
test("gate: carved models (tools/make_mallorn_gate.py) wear the fence post texture in both sets; bones, icon pose and open side kept", () => {
  const closed = readJson("../lothlorien_rp/models/blocks/mallorn_fence_gate_closed.geo.json");
  const open = readJson("../lothlorien_rp/models/blocks/mallorn_fence_gate_open.geo.json");
  for (const [f, bones] of [[closed, ["posts", "rails"]], [open, ["posts", "leaves"]]]) {
    assert.equal(f.format_version, "1.26.50");
    const g = f["minecraft:geometry"][0];
    assert.deepEqual(g.bones.map((b) => b.name), bones);
    assert.ok(g.bones.every((b) => b.cubes.length > 0));
    assert.ok(!JSON.stringify(g).includes("material_instance"), "every face uses the block's * material");
  }
  const gui = closed["minecraft:geometry"][0].item_display_transforms.gui;
  assert.deepEqual([gui.rotation, gui.fit_to_frame], [[30, 135, 0], false], "icon pose confirmed in game");
  // open leaves swing to -z, inside the open selection box (z -8..0)
  for (const c of open["minecraft:geometry"][0].bones[1].cubes) {
    assert.ok(c.origin[2] >= -8.5 && c.origin[2] + c.size[2] <= 1.5, `open leaf at z ${c.origin[2]}`);
  }
  const atlas = readJson("../lothlorien_rp/textures/terrain_texture.json").texture_data;
  for (const set of ["mallorn", "mallorn_heartwood"]) {
    const c = readJson(`../lothlorien_bp/blocks/${set}_fence_gate.json`)["minecraft:block"].components;
    for (const mi of [c["minecraft:material_instances"], c["minecraft:item_visual"].material_instances]) {
      assert.equal(mi["*"].texture, `lothlorien:${set}_fence_post`);
      assert.ok(atlas[mi["*"].texture], `${set}: texture key in terrain_texture.json`);
    }
    assert.equal(c["minecraft:item_visual"].geometry, "geometry.lothlorien.mallorn_fence_gate_closed");
  }
});
import * as NR from "../lothlorien_bp/scripts/nectar_rules.js";
import * as DR from "../lothlorien_bp/scripts/dew_rules.js";
test("Phase 14b: nectar bloom fills only under Mallorn leaves, 1/7 per stage", () => {
  assert.equal(NR.nectarAfterTick(0, true, 0.1), 1);
  assert.equal(NR.nectarAfterTick(0, true, 0.2), 0, "dice fail");
  assert.equal(NR.nectarAfterTick(0, false, 0), 0, "no leaves above: stays dry");
  assert.equal(NR.nectarAfterTick(NR.MAX_NECTAR, true, 0), NR.MAX_NECTAR, "full stays full");
  assert.ok(NR.MALLORN_LEAVES.has("lothlorien:mallorn_golden_leaves") && NR.MALLORN_LEAVES.has("lothlorien:mallorn_leaves"));
  assert.deepEqual([0.39, 0.4, 0.84, 0.85].map(NR.treeBloomCount), [0, 1, 1, 2]);
});
test("Phase 14b: morning dew window, chances and leaves-above scan", () => {
  for (const t of [23000, 23999, 0, 1000, 2999]) assert.ok(DR.inDewWindow(t), `dew at ${t}`);
  for (const t of [3000, 6000, 12000, 22999]) assert.ok(!DR.inDewWindow(t), `no dew at ${t}`);
  assert.ok(DR.inDewWindow(24000 + 100), "time wraps");
  const yes = () => true;
  const no = () => false;
  assert.equal(DR.dewAfterTick(false, 500, 1 / 8, 0.1, yes), true);
  assert.equal(DR.dewAfterTick(false, 500, 1 / 8, 0.2, yes), false, "dice fail");
  assert.equal(DR.dewAfterTick(false, 500, 1, 0, no), false, "needs leaves above");
  assert.equal(DR.dewAfterTick(true, 500, 0, 0.99, no), true, "dew stays within the window");
  assert.equal(DR.dewAfterTick(true, 8000, 1, 0, yes), false, "dew dries outside the window");
  assert.equal(DR.dewAfterTick(false, 8000, 1, 0, yes), false, "no new dew by day");
  assert.equal(DR.DEW_CHANCE["lothlorien:mallorn_leaf_carpet"], 1 / 8);
  assert.equal(DR.DEW_CHANCE["lothlorien:mallorn_blossom"], 1 / 2);
  const leaf = (id) => id === "L";
  assert.ok(DR.leavesAbove((dy) => (dy === 5 ? "L" : "air"), leaf));
  assert.ok(!DR.leavesAbove(() => "air", leaf));
  assert.ok(!DR.leavesAbove((dy) => (dy > 2 ? undefined : "air"), leaf), "unloaded chunk stops the scan");
  assert.ok(!DR.leavesAbove((dy) => (dy === 41 ? "L" : "air"), leaf), "scan limit");
});
test("Phase 14b: Dew bottle fills drop by drop into a Bottle of morning dew", () => {
  assert.equal(DR.dropsIn(DR.NEW_DEW_BOTTLE_DAMAGE), 1, "a new Dew bottle holds one drop");
  let damage = DR.NEW_DEW_BOTTLE_DAMAGE;
  let uses = 1;
  for (let r = DR.addDrop(damage); !r.full; r = DR.addDrop(damage)) {
    assert.equal(DR.dropsIn(r.damage), DR.dropsIn(damage) + 1);
    damage = r.damage;
    uses++;
  }
  assert.equal(uses + 1, DR.DEW_DROPS, "8 uses in all from a glass bottle (the last one completes it)");
  assert.ok(damage > 0, "the bar never reaches a full bottle early");
});
test("Phase 14b: nectar and dew content is wired (pack JSON)", () => {
  const bloom = readJson("../lothlorien_bp/blocks/nectar_bloom.json")["minecraft:block"];
  assert.deepEqual(bloom.description.states["lothlorien:nectar"], [0, 1, 2, 3]);
  assert.deepEqual(bloom.components["minecraft:placement_filter"].conditions[0].allowed_faces, ["down"]);
  const atlas = readJson("../lothlorien_rp/textures/terrain_texture.json").texture_data;
  for (const s of [0, 1, 2, 3]) assert.ok(atlas[`lothlorien:nectar_bloom_${s}`], `bloom stage ${s} in the atlas`);
  for (const name of ["mallorn_leaf_carpet", "mallorn_blossom"]) {
    const b = readJson(`../lothlorien_bp/blocks/${name}.json`)["minecraft:block"];
    assert.deepEqual(b.description.states["lothlorien:dew"], [false, true]);
    assert.ok("lothlorien:dew_cover" in b.components);
    const dewy = b.permutations.find((p) => p.condition === "q.block_state('lothlorien:dew')");
    const tex = dewy.components["minecraft:material_instances"]["*"].texture;
    assert.equal(tex, `lothlorien:${name}_dew`);
    assert.ok(atlas[tex], "dew texture in the atlas");
  }
  const recipe = readJson("../lothlorien_bp/recipes/miruvor.json")["minecraft:recipe_shaped"];
  assert.equal(recipe.key.H.item, "lothlorien:mallorn_nectar", "Miruvor takes nectar, not honey");
  assert.equal(readJson("../lothlorien_bp/items/dew_bottle.json")["minecraft:item"].components["minecraft:durability"].max_durability, DR.DEW_DROPS);
  const agg = readJson("../lothlorien_bp/features/select_mallorn_tree_with_litter_feature.json")["minecraft:aggregate_feature"].features;
  assert.ok(agg.indexOf("lothlorien:mallorn_blossom_scatter_feature") < agg.indexOf("lothlorien:mallorn_leaf_carpet_scatter_feature"), "blossoms before litter");
  assert.ok(agg.includes("lothlorien:nectar_bloom_scatter_feature"));
});
// ---- Phase 15: swan and ground squirrel ----
import * as SR from "../lothlorien_bp/scripts/swan_rules.js";
import * as QR from "../lothlorien_bp/scripts/squirrel_rules.js";
const ACORN = "lothlorien:mallorn_acorn";
const swanEntity = () => readJson("../lothlorien_bp/entities/swan.json")["minecraft:entity"];
const squirrelEntity = () => readJson("../lothlorien_bp/entities/squirrel.json")["minecraft:entity"];
test("Phase 15: a swan stays when Lothlorien is near (the spot or any ring up to 48 blocks), else it is removed", () => {
  assert.equal(SR.nearOffsets().length, 1 + SR.NEAR_RADII.length * SR.NEAR_HEADINGS);
  assert.equal(SR.nearBiome(() => RIVER, L), false, "a river far from the biome");
  assert.equal(SR.nearBiome((dx, dz) => (dx === 0 && dz === 0 ? L : RIVER), L), true, "in the biome");
  assert.equal(SR.nearBiome((dx) => (dx < -30 ? L : FOREST), L), true, "biome 30 blocks west");
  assert.equal(SR.nearBiome((dx) => (dx > 70 ? L : FOREST), L), false, "biome 70 blocks east: too far");
  assert.equal(SR.nearBiome(() => undefined, L), false, "unloaded chunks are not the biome");
});
test("Phase 15: swan spawn rule takes Lothlorien or river water, and the natural-spawn event", () => {
  const rule = readJson("../lothlorien_bp/spawn_rules/swan.json")["minecraft:spawn_rules"];
  const c = rule.conditions[0];
  assert.deepEqual(c["minecraft:biome_filter"].any_of.map((t) => t.value).sort(), ["lothlorien", "river"]);
  assert.ok("minecraft:spawns_underwater" in c && "minecraft:spawns_on_surface" in c);
  assert.equal(c["minecraft:herd"].event, "lothlorien:spawn_natural");
  assert.equal(swanEntity().events["lothlorien:spawn_natural"].set_property["lothlorien:natural"], true);
  assert.ok("lothlorien:natural" in swanEntity().description.properties);
});
test("Phase 15: swan and squirrel read the Harmony band like the deer (same states, radii, alarm; in WARY_TYPES)", () => {
  assert.deepEqual(R.WARY_TYPES, [R.DEER_ID, R.WHITE_DEER_ID, "lothlorien:swan", "lothlorien:squirrel", "lothlorien:unicorn"]);
  for (const e of [swanEntity(), squirrelEntity()]) {
    for (const w of R.WARINESS) {
      assert.equal(avoidRadius(e, w), R.FLIGHT_RADIUS[w], `${e.description.identifier} ${w}`);
      assert.ok(e.events[R.setEventFor(w)], `event ${w}`);
    }
    assert.equal(avoidRadius(e, "alarmed"), 36);
    assert.ok(e.events["lothlorien:alarm"] && e.events["lothlorien:alarm_over"]);
    assert.ok(e.description.properties["lothlorien:wariness"] && e.description.properties["lothlorien:alarmed"]);
  }
});
test("Phase 15: swan floats on the surface like the chicken (float goal, path over water; no fish-style swimming) and drops a feather", () => {
  const e = swanEntity();
  assert.ok("minecraft:behavior.float" in e.components, "float goal keeps it on the surface");
  assert.equal(e.components["minecraft:navigation.walk"].can_path_over_water, true);
  assert.ok(!("minecraft:buoyant" in e.components), "buoyant sank the swan to the bottom (game log: simulate_waves not valid; 2026-10-02)");
  for (const k of ["minecraft:behavior.random_swim", "minecraft:navigation.generic", "minecraft:movement.amphibious"]) assert.ok(!(k in e.components), `${k} makes it dive`);
  assert.deepEqual(e.components["minecraft:despawn"], { despawn_from_distance: {} });
  const loot = readJson("../lothlorien_bp/loot_tables/entities/swan.json").pools[0].entries.map((x) => x.name);
  assert.deepEqual(loot, ["minecraft:feather"]);
});
test("Phase 15: squirrel gifts are for Friends only; calm and restless players are refused", () => {
  assert.equal(QR.offerRefusal({ band: "friend", cooldownLeft: 0 }), undefined);
  assert.equal(QR.offerRefusal({ band: "guest", cooldownLeft: 0 }), "untrusted");
  for (const band of ["uneasy", "shunned", "hated"]) assert.equal(QR.offerRefusal({ band, cooldownLeft: 0 }), "restless", band);
  assert.equal(QR.offerRefusal({ band: "friend", cooldownLeft: 100 }), "full");
  assert.equal(QR.cooldownLeft(100, 160), 60);
  assert.equal(QR.cooldownLeft(200, 160), 0);
  assert.equal(QR.cooldownLeft(100, undefined), 0);
});
test("Phase 15: squirrel errand: away point, phases, abort", () => {
  const from = { x: 0, y: 64, z: 0 };
  const open = QR.pickAway(from, (x, z, y) => y, 0);
  assert.ok(Math.abs(Math.hypot(open.x, open.z) - 14) < 1e-6, "farthest distance first");
  assert.equal(QR.pickAway(from, () => undefined, 1), undefined);
  const east = QR.pickAway(from, (x) => (x > 0 ? 70 : undefined), Math.PI); // west fails, a later heading works
  assert.ok(east.x > 0 && east.y === 70);
  const p = (o) => QR.nextPhase({ phase: "away", age: 10, phaseAge: 10, toBeacon: 10, toPlayer: 10, digFor: 80, ...o });
  assert.equal(p({}), "away");
  assert.equal(p({ toBeacon: QR.AWAY_ARRIVE }), "dig");
  assert.equal(p({ phaseAge: QR.AWAY_TIMEOUT }), "dig", "never gets there: digs where it is");
  assert.equal(p({ phase: "dig", phaseAge: 79 }), "dig");
  assert.equal(p({ phase: "dig", phaseAge: 80 }), "return");
  assert.equal(p({ phase: "return" }), "return");
  assert.equal(p({ phase: "return", toPlayer: QR.GIFT_DIST }), "gift");
  assert.equal(p({ toPlayer: QR.ABORT_DIST + 1 }), "abort");
  assert.equal(p({ phase: "return", age: QR.MAX_TICKS + 1 }), "abort");
  assert.ok(QR.digTicks(0) === QR.DIG_TICKS.min && QR.digTicks(0.999) === QR.DIG_TICKS.max);
});
test("Phase 15: squirrel entity: errand group follows the beacon, wolves and monsters still scare it, three coats", () => {
  const e = squirrelEntity();
  const g = e.component_groups["lothlorien:state_guiding"];
  assert.equal(g["minecraft:behavior.follow_target_leader"].leader_filters.value, "lothlorien_guide_beacon");
  assert.ok(g["minecraft:behavior.follow_target_leader"].priority < g["minecraft:behavior.avoid_mob_type"].priority);
  assert.ok(g["minecraft:behavior.avoid_mob_type"].entity_types.every((t) => ["wolf", "monster"].includes(t.filters.value)));
  for (const ev of ["lothlorien:guide_start", "lothlorien:guide_end", "lothlorien:guide_abort"]) assert.ok(e.events[ev], ev);
  assert.ok(e.component_groups["lothlorien:state_calm"]["minecraft:behavior.tempt"].items.includes(ACORN));
  const coats = e.description.properties["lothlorien:coat"].values;
  const client = readJson("../lothlorien_rp/entity/squirrel.entity.json")["minecraft:client_entity"].description;
  assert.deepEqual(Object.keys(client.textures).sort(), [...coats].sort());
  for (const t of Object.values(client.textures)) assert.ok(existsSync(new URL(`../lothlorien_rp/${t}.png`, import.meta.url)), t);
  assert.equal(e.components["minecraft:interact"].interactions[0].on_interact.filters.all_of[1].value, ACORN);
});
test("Phase 15: squirrel gift table has litter, petals, athelas and corn seeds, and every item exists in the pack", () => {
  const entries = readJson("../lothlorien_bp/loot_tables/gifts/squirrel.json").pools[0].entries;
  const ids = entries.map((x) => x.name);
  for (const want of ["lothlorien:mallorn_leaf_carpet", "lothlorien:mallorn_blossom", "lothlorien:athelas", "lothlorien:western_corn_seeds"]) assert.ok(ids.includes(want), want);
  for (const id of ids) assert.ok(existsSync(new URL(`../lothlorien_bp/items/${id.split(":")[1]}.json`, import.meta.url)), `item ${id}`);
  const weight = (n) => entries.find((x) => x.name === n).weight;
  assert.ok(weight("lothlorien:athelas") < weight("lothlorien:mallorn_blossom"), "athelas is rarer than petals");
  assert.equal(QR.GIFT_TABLE, "gifts/squirrel");
});
test("Phase 15: art, sounds and names are wired for both animals", () => {
  const sounds = readJson("../lothlorien_rp/sounds.json").entity_sounds.entities;
  const lang = readFileSync(new URL("../lothlorien_rp/texts/en_US.lang", import.meta.url), "utf8");
  for (const n of ["swan", "squirrel"]) {
    assert.ok(sounds[`lothlorien:${n}`].events.ambient, `${n} sounds`);
    assert.ok(lang.includes(`entity.lothlorien:${n}.name=`) && lang.includes(`item.spawn_egg.entity.lothlorien:${n}.name=`), `${n} lang`);
    assert.ok(existsSync(new URL(`../lothlorien_rp/models/entity/${n}.geo.json`, import.meta.url)), `${n} geometry`);
  }
});
// ---- Phase 15: unicorn ----
import * as UR from "../lothlorien_bp/scripts/unicorn_rules.js";
const unicornEntity = () => readJson("../lothlorien_bp/entities/unicorn.json")["minecraft:entity"];
test("unicorn: offers need a calm Friend, an unfrightened unicorn and a pause between offers", () => {
  const ok = { band: "friend", tame: false, alarmed: false, sinceLast: undefined };
  assert.equal(UR.offerRefusal(ok), undefined);
  assert.equal(UR.offerRefusal({ ...ok, band: "guest" }), "untrusted");
  for (const band of ["uneasy", "shunned", "hated"]) assert.equal(UR.offerRefusal({ ...ok, band }), "restless", band);
  assert.equal(UR.offerRefusal({ ...ok, alarmed: true }), "alarmed");
  assert.equal(UR.offerRefusal({ ...ok, tame: true }), "tame");
  assert.equal(UR.offerRefusal({ ...ok, sinceLast: UR.OFFER_GAP_TICKS - 1 }), "wait");
  assert.equal(UR.offerRefusal({ ...ok, sinceLast: UR.OFFER_GAP_TICKS }), undefined);
});
test("unicorn: the third offer bonds it; only the owner may ride", () => {
  assert.deepEqual([0, 1, 2].map((t) => UR.nextTrust(t).bonded), [false, false, true]);
  assert.equal(UR.nextTrust(3).trust, UR.TRUST_OFFERS);
  assert.equal(UR.ticksSince(100, 40), 60);
  assert.equal(UR.ticksSince(10, 40), undefined);
  assert.equal(UR.ticksSince(10, undefined), undefined);
  assert.ok(UR.mayRide("a", "a") && !UR.mayRide("a", "b") && UR.mayRide(undefined, "b"));
});
test("unicorn entity: Harmony wariness states and flight radii (calm is as timid as l1; Friend alone may lure it with Elanor)", () => {
  const e = unicornEntity();
  for (const w of R.WARINESS) {
    assert.ok(e.component_groups[`lothlorien:state_${w}`], `group ${w}`);
    assert.ok(e.events[R.setEventFor(w)], `event ${w}`);
    assert.equal(avoidRadius(e, w), w === "calm" ? R.FLIGHT_RADIUS.l1 : R.FLIGHT_RADIUS[w], w);
  }
  assert.ok(e.component_groups["lothlorien:state_friend"]["minecraft:behavior.tempt"].items.includes(UR.ELANOR_ID));
  for (const w of ["calm", "l1", "l2", "l3"]) assert.ok(!("minecraft:behavior.tempt" in e.component_groups[`lothlorien:state_${w}`]), `${w} must not lure`);
  assert.ok(e.events["lothlorien:alarm"] && e.events["lothlorien:alarm_over"]);
  assert.ok("lothlorien:alarmed" in e.description.properties && "lothlorien:tame" in e.description.properties);
});
test("unicorn entity: bonded = rideable without a saddle or lead, persistent, the best horse's stats", () => {
  const e = unicornEntity();
  const bonded = e.component_groups["lothlorien:bonded"];
  for (const c of ["minecraft:rideable", "minecraft:input_ground_controlled", "minecraft:can_power_jump", "minecraft:behavior.player_ride_tamed", "minecraft:persistent", "minecraft:variable_max_auto_step"]) {
    assert.ok(c in bonded, c);
  }
  assert.ok(!("minecraft:rideable" in e.components), "wild unicorns cannot be mounted");
  for (const c of ["minecraft:leashable", "minecraft:equippable", "minecraft:tamemount", "minecraft:breedable"]) assert.ok(!(c in e.components) && !(c in bonded), `${c} must be absent`);
  assert.equal(e.components["minecraft:health"].value, 30);
  assert.equal(e.components["minecraft:movement"].value, 0.3375);
  assert.equal(e.components["minecraft:horse.jump_strength"].value, 1.0);
  assert.ok(e.events["lothlorien:become_tame"].add.component_groups.includes("lothlorien:bonded"));
});
test("unicorn: spawn rule is uncommon and in Lothlorien; art, sounds and names are wired", () => {
  const rule = readJson("../lothlorien_bp/spawn_rules/unicorn.json")["minecraft:spawn_rules"].conditions[0];
  assert.equal(rule["minecraft:biome_filter"].value, "lothlorien");
  assert.ok(rule["minecraft:weight"].default < 10, "rarer than the deer (10)");
  const client = readJson("../lothlorien_rp/entity/unicorn.entity.json")["minecraft:client_entity"].description;
  assert.ok(existsSync(new URL(`../lothlorien_rp/${client.textures.default}.png`, import.meta.url)));
  assert.ok(readJson(`../lothlorien_rp/models/entity/unicorn.geo.json`)[client.geometry.default]);
  assert.ok(readJson("../lothlorien_rp/sounds.json").entity_sounds.entities["lothlorien:unicorn"].events.ambient);
  const lang = readFileSync(new URL("../lothlorien_rp/texts/en_US.lang", import.meta.url), "utf8");
  for (const k of ["entity.lothlorien:unicorn.name=", "item.spawn_egg.entity.lothlorien:unicorn.name=", "action.interact.lothlorien.offer_elanor="]) assert.ok(lang.includes(k), k);
});
// Phase 17b: Elven rope placement, drops and the tree's rope.
import * as ROPE from "../lothlorien_bp/scripts/elven_rope_rules.js";
test("Elven rope: fills down first, then up, one piece per item", () => {
  const free = (lo, hi) => (y) => y >= lo && y <= hi;
  assert.deepEqual(ROPE.planRope({ downFrom: 10, upFrom: 11, count: 3, free: free(0, 20) }), [10, 9, 8]);
  assert.deepEqual(ROPE.planRope({ downFrom: 10, upFrom: 11, count: 6, free: free(8, 20) }), [10, 9, 8, 11, 12, 13], "bottom reached: carries on up");
  assert.deepEqual(ROPE.planRope({ downFrom: 10, upFrom: 11, count: 4, free: free(10, 12) }), [10, 11, 12], "stops at the first blocked row");
  assert.deepEqual(ROPE.planRope({ downFrom: 4, upFrom: 12, count: 3, free: free(0, 20) }), [4, 3, 2], "extension: down from the bottom first");
  assert.deepEqual(ROPE.planRope({ downFrom: 4, upFrom: 12, count: 4, free: free(4, 20) }), [4, 12, 13, 14], "extension: up from the top once down is blocked");
  assert.deepEqual(ROPE.planRope({ downFrom: 0, upFrom: 1, count: 3, free: free(0, 9), minY: 0 }), [0, 1, 2], "world bottom");
});
test("Elven rope: whole column found, drops split into stacks of 64", () => {
  const pieces = new Set([3, 4, 5, 9]);
  assert.deepEqual(ROPE.columnBounds((y) => pieces.has(y), 4), { bottom: 3, top: 5 });
  assert.deepEqual(ROPE.columnBounds((y) => pieces.has(y), 9), { bottom: 9, top: 9 });
  assert.deepEqual(ROPE.dropStacks(64), [64]);
  assert.deepEqual(ROPE.dropStacks(70), [64, 6]);
  assert.deepEqual(ROPE.dropStacks(1), [1]);
});
test("Elven rope: wall lies behind the face, the piece in front of the clicked face", () => {
  for (const f of ROPE.FACES) {
    const w = ROPE.wallOffset(f);
    const p = ROPE.pieceOffset(f);
    assert.deepEqual([w.x + p.x, w.z + p.z], [0, 0], f);
  }
  assert.deepEqual(ROPE.wallOffset("north"), { x: 0, z: 1 });
  assert.equal(ROPE.wallOffset("up"), undefined);
  assert.equal(ROPE.isUnsupported({ isAir: true, isLiquid: false }), true);
  assert.equal(ROPE.isUnsupported({ isAir: false, isLiquid: false }), false);
  assert.equal(ROPE.isUnsupported(undefined), false, "unloaded chunk keeps the rope");
});
test("Elven rope: levitation controller reaches the ladder speed at once and holds it", () => {
  const target = 3.2 / 20;
  let v = 0;
  const speeds = [];
  for (let tick = 0; tick < 200; tick++) speeds.push((v = ROPE.levitationStep(v, target).v));
  assert.ok(speeds[0] > target * 0.9, `first tick ${speeds[0]}`);
  const mean = speeds.slice(5).reduce((a, b) => a + b, 0) / (speeds.length - 5);
  assert.ok(Math.abs(mean - target) < 0.002, `mean ${mean * 20} b/s`);
  // the old fixed level 2.35 gives the 2.1 blocks/s measured in game: the model matches the game
  const m = ROPE.LEVITATION;
  let w = 0;
  for (let tick = 0; tick < 100; tick++) w = m.drag * (w + m.pull * (2.35 * m.perLevel - w));
  assert.ok(Math.abs(w * 20 - 2.13) < 0.03, `steady ${w * 20}`);
  // falling into the rope: the first levels are high, never above the cap
  assert.equal(ROPE.levitationStep(-1, target).amplifier, m.maxLevel - 1);
  assert.equal(ROPE.levitationStep(1, target).amplifier, 0, "level never below 1");
  assert.ok(ROPE.CLIMB.effectTicks <= 10, "short effects");
  assert.equal(ROPE.brakes(-0.25, ROPE.CLIMB.downSpeed / 20), true, "5 blocks/s down brakes");
  assert.equal(ROPE.brakes(-0.15, ROPE.CLIMB.downSpeed / 20), false, "3 blocks/s down slides on");
});
test("Elven rope: every rule the wiring calls is imported (a missing import throws inside try/catch, silently)", () => {
  const src = readFileSync(new URL("../lothlorien_bp/scripts/elven_rope.js", import.meta.url), "utf8");
  const imported = src.match(/import \{([^}]*)\} from "\.\/elven_rope_rules\.js"/)[1].split(",").map((n) => n.trim());
  for (const name of Object.keys(ROPE)) {
    if (new RegExp(`\\b${name}\\b`).test(src.replace(/^import .*$/gm, ""))) assert.ok(imported.includes(name), `${name} used but not imported`);
  }
});
test("Elven rope: block, item and recipe agree", () => {
  const block = readJson("../lothlorien_bp/blocks/elven_rope.json")["minecraft:block"];
  assert.deepEqual(block.description.states["lothlorien:face"], ROPE.FACES);
  assert.equal(block.components["minecraft:collision_box"], false, "climb through it");
  assert.equal(block.components["minecraft:loot"], undefined, "the script drops the whole rope");
  assert.equal(block.permutations.length, ROPE.FACES.length);
  const item = readJson("../lothlorien_bp/items/elven_rope.json")["minecraft:item"];
  assert.equal(item.components["minecraft:max_stack_size"], 64);
  assert.ok("lothlorien:rope" in item.components);
  const recipe = readJson("../lothlorien_bp/recipes/elven_rope.json")["minecraft:recipe_shaped"];
  assert.deepEqual(Object.values(recipe.key).map((i) => i.item).sort(), ["lothlorien:golden_fern", "lothlorien:morning_dew"]);
  assert.equal(recipe.result.count, 1);
});
test("flet tree: the rope hangs on the trunk, facing away from it", () => {
  for (const t of flets) {
    const piece = t.blocks.get(`${LADDER.x},0,${LADDER.z}`);
    assert.deepEqual(piece, { name: B.ropeHanging, states: { "minecraft:cardinal_direction": "north" } });
    assert.ok([B.log, B.wood].includes(at(t, LADDER.x, 0, LADDER.z + 1)), "wall behind the rope");
  }
});
// Elven lighting (Phase 17): lantern, jar, chandelier.
const LAMPS = { elven_lantern: ["up", "down"], elven_lantern_heartwood: ["up", "down"],
  firefly_jar: ["up"], elven_chandelier: ["down"] };
test("elven lamps: faces they may be placed on, light, and script support for each", () => {
  const antlerJs = readFileSync(new URL("../lothlorien_bp/scripts/antler.js", import.meta.url), "utf8");
  for (const [id, faces] of Object.entries(LAMPS)) {
    const b = readJson(`../lothlorien_bp/blocks/${id}.json`)["minecraft:block"];
    assert.deepEqual(b.components["minecraft:placement_filter"].conditions[0].allowed_faces, faces, id);
    assert.ok(b.components["minecraft:light_emission"] >= 11, `${id} gives light`);
    assert.equal(b.components["minecraft:light_dampening"], 0, `${id} lets light through`);
    assert.ok("lothlorien:lamp_support" in b.components, `${id} pops off when its support goes`);
    assert.ok(antlerJs.includes(`"lothlorien:${id}"`), `${id} is in the support script's id list`);
  }
});
test("elven lantern: one model stands or hangs by its spire; the jar is all blend (one render_method per block)", () => {
  const b = readJson("../lothlorien_bp/blocks/elven_lantern.json")["minecraft:block"];
  assert.equal(b.components["minecraft:geometry"], "geometry.lothlorien.elven_lantern");
  assert.deepEqual(b.components["minecraft:placement_filter"].conditions[0].allowed_faces, ["up", "down"]);
  assert.equal(b.components["minecraft:material_instances"].wood.render_method, "opaque"); // the carving is real cubes
  const gold = readJson("../lothlorien_bp/blocks/elven_lantern_heartwood.json")["minecraft:block"].components;
  assert.equal(gold["minecraft:geometry"], b.components["minecraft:geometry"]);
  assert.equal(gold["minecraft:material_instances"].wood.texture, "lothlorien:elven_lantern_wood_heartwood");
  const jar = readJson("../lothlorien_bp/blocks/firefly_jar.json")["minecraft:block"].components;
  assert.equal(jar["minecraft:material_instances"].glass.render_method, "blend");
  for (const [k, m] of Object.entries(jar["minecraft:material_instances"])) assert.equal(m.render_method, "blend", `jar ${k}: one render_method per block`);
  for (const g of ["elven_lantern", "firefly_jar", "elven_chandelier"]) {
    assert.ok(existsSync(new URL(`../lothlorien_rp/models/blocks/${g}.geo.json`, import.meta.url)), g);
  }
});
test("elven lantern: one core paints every outward side", () => {
  const geo = readJson("../lothlorien_rp/models/blocks/elven_lantern.geo.json")["minecraft:geometry"][0];
  const sides = ["north", "east", "south", "west"];
  const cores = geo.bones.flatMap((bone) => bone.cubes).filter((cube) =>
    sides.every((side) => cube.uv?.[side]?.material_instance === "glow"));
  assert.equal(cores.length, 1, "one four-sided glow core");
  assert.ok(cores[0].origin[0] < 0 && cores[0].origin[2] < 0, "core is centred behind the windows");
});
test("elven lamps: items place their block; recipes use existing items and chain lantern -> chandelier", () => {
  const ids = new Set(readdirSync(new URL("../lothlorien_bp/items", import.meta.url)).map((f) => `lothlorien:${f.replace(".json", "")}`));
  for (const id of Object.keys(LAMPS)) {
    const definition = readJson(`../lothlorien_bp/items/${id}.json`)["minecraft:item"];
    const item = definition.components;
    assert.equal(item["minecraft:block_placer"].block, `lothlorien:${id}`);
    assert.deepEqual(definition.description.menu_category,
      { category: "items", group: "minecraft:itemGroup.name.lanterns" }, `${id}: creative group`);
    const r = readJson(`../lothlorien_bp/recipes/${id}.json`)["minecraft:recipe_shaped"];
    for (const k of Object.values(r.key)) assert.ok(k.item.startsWith("minecraft:") || ids.has(k.item), `${id}: ${k.item}`);
    assert.equal(r.result.item, `lothlorien:${id}`);
  }
  const lantern = readJson("../lothlorien_bp/recipes/elven_lantern.json")["minecraft:recipe_shaped"];
  assert.ok(Object.values(lantern.key).some((k) => k.item === "lothlorien:bottle_of_fireflies"));
  const heartwood = readJson("../lothlorien_bp/recipes/elven_lantern_heartwood.json")["minecraft:recipe_shaped"];
  assert.ok(Object.values(heartwood.key).some((k) => k.item === "lothlorien:mallorn_heartwood_trapdoor"));
  const chandelier = readJson("../lothlorien_bp/recipes/elven_chandelier.json")["minecraft:recipe_shaped"];
  assert.ok(Object.values(chandelier.key).some((k) => k.item === "lothlorien:elven_lantern"));
  assert.ok(Object.values(chandelier.key).some((k) => k.item === "lothlorien:deer_antler"));
});
test("elven lamps: flipbook entries exist for every animated tile, names are in the lang file", () => {
  const flips = readJson("../lothlorien_rp/textures/flipbook_textures.json").map((f) => f.atlas_tile);
  for (const t of ["elven_lantern_glow", "elven_jar_inner"]) assert.ok(flips.includes(`lothlorien:${t}`), t);
  const lang = readFileSync(new URL("../lothlorien_rp/texts/en_US.lang", import.meta.url), "utf8");
  for (const id of Object.keys(LAMPS)) {
    assert.ok(lang.includes(`tile.lothlorien:${id}.name=`) && lang.includes(`item.lothlorien:${id}=`), id);
  }
});
test("Mallorn boat items use the boat and chest-boat creative groups", () => {
  for (const wood of ["mallorn", "mallorn_heartwood"]) {
    for (const [suffix, group] of [["boat", "boat"], ["chest_boat", "chestboat"]]) {
      const item = readJson(`../lothlorien_bp/items/${wood}_${suffix}.json`)["minecraft:item"];
      assert.deepEqual(item.description.menu_category,
        { category: "items", group: `minecraft:itemGroup.name.${group}` });
    }
  }
});
// --- Elven village (R3 layout): connector standard of every piece, vertical crown jigsaws, slab arches, pools, assembled villages ---
const VILLAGE = "../lothlorien_bp/structures/lothlorien/village";
const villageData = loadVillageData();
const DECK_NAME = "lothlorien:village_deck", DECK_HI_NAME = "lothlorien:village_deck_hi", CROWN_NAME = "lothlorien:village_crown";
const MALLORN_LOG = "lothlorien:mallorn_log";
const villagePieces = () => readdirSync(new URL(`${VILLAGE}/`, import.meta.url)).filter((f) => f.endsWith(".mcstructure")).map((f) =>
  parseMcstructure(readFileSync(new URL(`${VILLAGE}/${f}`, import.meta.url)), f.replace(".mcstructure", "")));
const isTree = (n) => /^(combo_|central_)/.test(n);
test("village: every deck connector is a rim connector on the box face, faces outward and follows the connector standard", () => {
  const pieces = villagePieces();
  assert.ok(pieces.length >= 25, `${pieces.length} village pieces`);
  for (const piece of pieces) {
    const name = piece.name, [sx, , sz] = piece.size;
    const deckJigsaws = piece.jigsaws.filter((j) => j.dir && j.pool !== undefined && j.target === DECK_NAME);
    if (name.startsWith("crown_")) { assert.equal(deckJigsaws.length, 0, `${name}: crowns have no deck connector`); continue; }
    assert.ok(deckJigsaws.length >= 1, `${name}: no deck connector`);
    for (const j of deckJigsaws) {
      const tag = `${name} ${j.dirId}@${j.x},${j.y},${j.z}`;
      const [dx, dz] = j.dir;
      const onFace = dx === 1 ? j.x === sx - 1 : dx === -1 ? j.x === 0 : dz === 1 ? j.z === sz - 1 : j.z === 0;
      assert.ok(onFace, `${tag}: not on the outer face of the box`);
      assert.ok(j.name === DECK_NAME || (j.name === DECK_HI_NAME && /^(combo_|central_)/.test(name)), `${tag}: name ${j.name}`);
      assert.equal(j.final, PLANKS, `${tag}: final_state`);
      assert.equal(j.joint, "aligned", `${tag}: joint`);
      const plug = name === "railing_end", pp = [-dz, dx];
      for (let off = -2; off <= 2; off++) {
        const x = j.x + pp[0] * off, z = j.z + pp[1] * off, at = (h) => piece.at(x, j.y + h, z);
        const deck = at(0);
        assert.ok(off === 0 ? deck === "minecraft:jigsaw" : deck === PLANKS, `${tag}: deck at ${off} is ${deck}`);
        if (Math.abs(off) === 2) assert.equal(at(1), FENCE, `${tag}: rail at ${off}`);
        else if (!plug) for (let h = 1; h <= 3; h++) assert.ok([null, "minecraft:air"].includes(at(h)), `${tag}: headroom ${off},${h}: ${at(h)}`);
      }
    }
  }
});
test("village: tree pieces carry an upward rollable crown jigsaw (log final state) 5 above the top deck; crowns have the matching downward one", () => {
  const pieces = villagePieces();
  const trees = pieces.filter((p) => isTree(p.name));
  assert.ok(trees.length >= 10, `${trees.length} tree pieces`);
  for (const p of trees) {
    const ups = p.jigsaws.filter((j) => j.dirId === 1);
    assert.equal(ups.length, 1, `${p.name}: upward jigsaws`);
    const [j] = ups, [sx, sy, sz] = p.size;
    assert.equal(j.name, CROWN_NAME); assert.equal(j.target, CROWN_NAME); assert.equal(j.joint, "rollable"); assert.equal(j.final, MALLORN_LOG);
    assert.ok(villageData.pools.has(j.pool), `${p.name}: crown pool ${j.pool}`);
    assert.equal(j.y, sy - 1, `${p.name}: crown jigsaw on the top face`);
    if (!p.name.startsWith("combo_")) assert.deepEqual([j.x, j.z], [(sx - 1) / 2, (sz - 1) / 2], `${p.name}: crown jigsaw on the trunk axis`);
    const topDeck = Math.max(...p.jigsaws.filter((k) => k.dir).map((k) => k.y));
    assert.equal(j.y - topDeck, 5, `${p.name}: crown box starts 6 above the top deck (headroom + highest arch box)`);
    assert.equal(p.at(j.x, j.y - 1, j.z), MALLORN_LOG, `${p.name}: trunk reaches the jigsaw`);
  }
  const crowns = pieces.filter((p) => p.name.startsWith("crown_"));
  assert.ok(crowns.length >= 5);
  for (const p of crowns) {
    const downs = p.jigsaws.filter((j) => j.dirId === 0);
    assert.equal(downs.length, 1, `${p.name}: downward jigsaws`);
    const [j] = downs, [sx, , sz] = p.size;
    assert.equal(j.name, CROWN_NAME); assert.equal(j.target, CROWN_NAME); assert.equal(j.final, MALLORN_LOG); assert.equal(j.pool, "minecraft:empty");
    assert.deepEqual([j.x, j.y, j.z], [(sx - 1) / 2, 0, (sz - 1) / 2], `${p.name}: jigsaw at the bottom centre`);
    assert.equal(p.at(j.x, 1, j.z), MALLORN_LOG, `${p.name}: the trunk continues above the jigsaw`);
    assert.ok(p.blocks.some((b) => b.name === "lothlorien:mallorn_leaves"), `${p.name}: leaves`);
    assert.equal(p.blocks.filter((b) => b.y === 0 && b.name !== "lothlorien:mallorn_leaves" && b.name !== MALLORN_LOG).length, 0, `${p.name}: nothing but leaves and trunk in the jigsaw layer`);
  }
  const pool = (id) => villageData.pools.get(`lothlorien:village/${id}`);
  const locs = (id) => pool(id).elements.map((e) => e.element.location.split("/").pop());
  assert.deepEqual(locs("crowns"), ["crown_large", "crown_medium"]);
  assert.equal(pool("crowns").fallback, "lothlorien:village/crowns_fallback");
  assert.deepEqual(locs("crowns_fallback"), ["crown_large", "crown_medium", "crown_small"], "trees at max_depth only see the fallback: it offers the big crowns too");
  assert.deepEqual(locs("crowns_small"), ["crown_small"]);
  assert.equal(pool("crowns_central").fallback, "lothlorien:village/crowns_small");
  assert.ok(locs("crowns_central").length >= 2);
  assert.equal(pool("exits").elements.length, 3);
  assert.equal(pool("combos").fallback, "lothlorien:village/exits");
  assert.equal(pool("exits").fallback, "lothlorien:village/plugs");
  assert.ok(!villageData.pools.has("lothlorien:village/bridges") && !villageData.pools.has("lothlorien:village/nodes"), "no pool hands out a bridge or a node alone");
  assert.ok(villageData.getPiece("lothlorien/village/central_mallorn_01").jigsaws.some((j) => j.name === "lothlorien:village_anchor"), "start anchor");
});
test("village: the one rail constant is the only rail block, bridges are symmetric slab arches in half steps, rails follow", () => {
  const SLAB_ID = "lothlorien:mallorn_slab";
  for (const p of villagePieces()) {
    for (const b of p.blocks) assert.ok(!b.name.endsWith("_fence") || b.name === FENCE, `${p.name}: another rail block ${b.name}`);
    for (const b of p.blocks) if (b.name === SLAB_ID) assert.ok(["bottom", "top"].includes(b.states["minecraft:vertical_half"]), `${p.name}: slab state`);
  }
  const lengths = new Set();
  for (const p of villagePieces().filter((q) => /^combo_.*_bridge_\d+$/.test(q.name))) { // straight bridges: the arch of the combo, along the entry column
    const L = Number(p.name.match(/_bridge_(\d+)$/)[1]);
    lengths.add(L);
    const entry = p.jigsaws.find((j) => j.dirId === 2 && j.z === 0 && j.name === DECK_NAME), cx = entry.x, y0 = entry.y;
    const surf = [];
    for (let z = 0; z < L; z++) {
      let s = null;
      for (let y = y0; y < p.size[1]; y++) {
        const n = p.at(cx, y, z);
        if (n === PLANKS) s = 2 * (y - y0) + 2; else if (n === SLAB_ID) s = 2 * (y - y0) + 1;
        if (n === "minecraft:jigsaw") s = 2 * (y - y0) + 2;
      }
      surf.push(s);
    }
    const bn = `${p.name} (bridge ${L})`;
    assert.equal(surf[0], 2, `${bn}: starts at the connector deck`);
    assert.deepEqual(surf, [...surf].reverse(), `${bn}: symmetric arch ${surf}`);
    for (let z = 1; z < L; z++) assert.ok(Math.abs(surf[z] - surf[z - 1]) <= 1, `${bn}: step > 0.5 block at ${z}: ${surf}`);
    assert.equal(Math.max(...surf) - 2, L <= 7 ? 2 : 4, `${bn}: rise`);
    for (let z = 0; z < L; z++) for (const x of [cx - 2, cx + 2]) { // rail one cell above the block the walker stands on
      const layer = surf[z] % 2 === 0 ? surf[z] / 2 - 1 : (surf[z] - 1) / 2;
      assert.equal(p.at(x, y0 + layer + 1, z), FENCE, `${bn}: rail at ${x},${z}`);
    }
  }
  assert.deepEqual([...lengths].sort((a, b) => a - b), [7, 9, 11, 13, 15], "every straight bridge length is used by some combo"); // P9: no 5-long bridge, the bigger crowns need room
  const names = villagePieces().map((q) => q.name);
  for (const n of ["bridge_dog_11_l", "bridge_dog_11_r", "bridge_dog_13_l", "bridge_dog_13_r"]) assert.ok(names.some((q) => q.endsWith(`_${n}`)), `a combo with ${n}`);
});
test("village: platform shapes differ (irregular rectilinear outlines of different sizes)", () => {
  const seen = new Map();
  for (const p of villagePieces().filter((q) => isTree(q.name))) {
    const ys = p.jigsaws.filter((j) => j.dir).map((j) => j.y), y = Math.min(...ys);
    const cells = p.blocks.filter((b) => b.y === y && b.name === PLANKS).map((b) => `${b.x},${b.z}`).sort().join(";") + `|${p.size}`;
    seen.set(p.name, cells);
  }
  const nodes = new Set([...seen.keys()].filter((n) => /^combo_node_/.test(n)).map((n) => n.match(/^combo_(node_[a-z])_/)[1]));
  assert.equal(nodes.size, 6, "all six node platforms are used by combos");
  assert.ok(new Set(villagePieces().filter((q) => /^combo_tower_/.test(q.name)).map((q) => q.name.match(/^combo_(tower_[a-z])_/)[1])).size === 3, "all three towers are used by combos");
  const sizes = new Set([...seen.keys()].map((n) => villageData.getPiece(`lothlorien/village/${n}`).size.slice(0, 1).concat(villageData.getPiece(`lothlorien/village/${n}`).size.slice(2)).join("x")));
  assert.ok(sizes.size >= 8, `footprint sizes: ${[...sizes]}`);
});
test("village: pools, fallbacks, piece files and connector pools all resolve", () => {
  const ids = [...villageData.pools.keys()].filter((k) => k.startsWith("lothlorien:village/"));
  assert.ok(ids.length >= 8, `${ids.length} pools`);
  for (const id of ids) {
    const p = villageData.pools.get(id);
    for (const e of p.elements) {
      assert.ok(existsSync(new URL(`../lothlorien_bp/structures/${e.element.location}.mcstructure`, import.meta.url)), `${id}: ${e.element.location}`);
      for (const j of villageData.getPiece(e.element.location).jigsaws) {
        if (j.name === DECK_NAME || j.name === DECK_HI_NAME || j.name === CROWN_NAME) assert.ok(j.pool === "minecraft:empty" || villageData.pools.has(j.pool), `${id}: ${e.element.location} points at missing pool ${j.pool}`);
      }
    }
    if (p.fallback && p.fallback !== "minecraft:empty") assert.ok(villageData.pools.has(p.fallback), `${id}: fallback ${p.fallback}`);
  }
  assert.ok(villageData.pools.has(villageData.structure.start_pool));
  assert.ok(villageData.structure.max_depth >= 1);
  const used = new Set([...villageData.pools.values()].flatMap((p) => p.elements.map((e) => e.element.location.split("/").pop())));
  for (const p of villagePieces()) assert.ok(used.has(p.name), `${p.name}: piece file is in no pool (remove it)`);
});
// --- Elven village P6: no bridge to nowhere, no hanging balcony ---
test("village combos: a bridge only exists inside a combo piece with its destination tree (entry on the bridge, tree exits, crown jigsaw, trunk to the ground)", () => {
  const names = readdirSync(new URL(`${VILLAGE}/`, import.meta.url)).filter((f) => f.endsWith(".mcstructure")).map((f) => f.replace(".mcstructure", ""));
  assert.ok(!names.some((n) => /^(bridge_|node_|tower_|tree_platform)/.test(n)), "no bridge, node or tower piece is shipped alone");
  const combos = villagePieces().filter((p) => p.name.startsWith("combo_"));
  assert.ok(combos.length >= 30, `${combos.length} combo pieces`);
  const pool = (id) => villageData.pools.get(`lothlorien:village/${id}`);
  const inCombos = new Set(pool("combos").elements.map((e) => e.element.location.split("/").pop()));
  for (const p of combos) {
    assert.ok(inCombos.has(p.name), `${p.name} is in the combos pool`);
    const deck = p.jigsaws.filter((j) => j.dir && j.target === DECK_NAME);
    const entries = deck.filter((j) => j.name === DECK_NAME);
    assert.equal(entries.length, 1, `${p.name}: exactly one entry connector (the bridge's far end)`);
    const [en] = entries;
    assert.deepEqual([en.dirId, en.z, en.pool], [2, 0, "minecraft:empty"], `${p.name}: entry faces north on the bridge end`);
    assert.ok(deck.length >= 2 && deck.every((j) => j === en || (j.name === DECK_HI_NAME && j.pool === "lothlorien:village/combos")), `${p.name}: the tree's exits only act as parents and point at combos`);
    // the destination tree: crown jigsaw on a log trunk that reaches the bottom of the box, deck on the entry level
    const up = p.jigsaws.find((j) => j.dirId === 1);
    assert.ok(up, `${p.name}: crown jigsaw`);
    assert.equal(p.at(up.x, up.y - 1, up.z), MALLORN_LOG, `${p.name}: trunk`);
    assert.equal(p.at(up.x, 0, up.z), MALLORN_LOG, `${p.name}: trunk reaches the ground (ROOTS)`);
    // the bridge end is joined to the platform inside the piece: no jigsaw faces south on the bridge, the exits are the node's own faces
    const L = deck.length;
    assert.ok(!p.jigsaws.some((j) => j.dirId === 3 && j.z < 5), `${p.name}: no connector at the bridge's far end (it is joined to the node)`);
    assert.ok(L >= 2);
  }
});
test("village exits: no free-floating balcony; the braced balcony and the lookout stand on a log pillar to the bottom of the box and are braced under the deck", () => {
  assert.ok(!existsSync(new URL(`${VILLAGE}/balcony_small.mcstructure`, import.meta.url)), "balcony_small is gone");
  for (const p of villageData.pools.values()) for (const e of p.elements) assert.ok(!/balcony_small/.test(e.element.location), "balcony_small is in no pool");
  const bal = villagePieces().find((p) => p.name === "balcony_braced");
  const con = bal.jigsaws.find((j) => j.dir);
  assert.deepEqual([con.name, con.target, con.pool, con.final], [DECK_NAME, DECK_NAME, "minecraft:empty", PLANKS]);
  const logs = bal.blocks.filter((b) => b.name === MALLORN_LOG);
  const pillarX = new Set(logs.filter((b) => b.y === 0).map((b) => `${b.x},${b.z}`));
  assert.ok(pillarX.size >= 5, "pillar cross-section at the bottom of the box");
  for (const k of pillarX) { const [x, z] = k.split(",").map(Number); for (let y = 0; y < con.y; y++) assert.equal(bal.at(x, y, z), MALLORN_LOG, `pillar column ${k} is continuous up to the deck (y ${y})`); }
  assert.ok(con.y >= 40, "the pillar runs 40 below the deck: it reaches the ground from any deck of the village (up to 3 levels)");
  const braces = logs.filter((b) => b.y >= con.y - 3 && b.y < con.y && !pillarX.has(`${b.x},${b.z}`));
  assert.ok(braces.length >= 8, `braces under the deck: ${braces.length}`);
  assert.ok(braces.every((b) => ["bottom", undefined].every(() => true)) && braces.some((b) => b.y === con.y - 1), "a brace ends right under the deck");
  const lookout = villagePieces().find((p) => p.name === "lookout_01");
  assert.equal(lookout.at(4, 0, 4), MALLORN_LOG, "lookout pillar to the bottom of the box");
  const ex = villageData.pools.get("lothlorien:village/exits");
  assert.deepEqual(ex.elements.map((e) => e.element.location.split("/").pop()).sort(), ["balcony_braced", "lookout_01", "railing_end"]);
  assert.equal(ex.fallback, "lothlorien:village/plugs");
});
test("village sim: the bridge-without-destination metric flags a bridge piece placed alone and a combo without its tree", () => {
  const ck = (placed) => { // minimal fake placement run through the same counting rules
    const hasLog = (p) => p.piece.blocks.some((b) => b.y === 0 && /_(log|wood)$/.test(b.name));
    return placed.filter((p) => p.name.startsWith("bridge_") || (p.name.startsWith("combo_") && !(hasLog(p) && p.piece.jigsaws.some((j) => j.dirId === 1)))).length;
  };
  const good = villageData.getPiece("lothlorien/village/" + villagePieces().find((p) => p.name.startsWith("combo_")).name);
  assert.equal(ck([{ name: "combo_x", piece: good }]), 0);
  assert.equal(ck([{ name: "bridge_7", piece: good }]), 1);
  assert.equal(ck([{ name: "combo_x", piece: { blocks: [], jigsaws: [] } }]), 1);
});
let villageRows = null;
const villages = () => (villageRows ??= runSeeds(villageData, 30, 1));
test("village: 30 simulated villages connect, never overlap, terminate, are fully walkable in 3D, have crowns and ~8-10 trees", () => {
  const t0 = Date.now();
  const rows = villages();
  for (const r of rows) {
    assert.deepEqual([...new Set(r.ck.fail)].slice(0, 3), [], `seed ${r.seed}`);
    assert.equal(r.ck.unreachable, 0, `seed ${r.seed}: unreachable walk cells`);
    assert.equal(r.ck.overlaps, 0);
    assert.ok(r.ck.walkCells > 200 && r.ck.reached === r.ck.walkCells, `seed ${r.seed}: walk cells ${r.ck.reached}/${r.ck.walkCells}`);
    assert.ok(r.ck.kinds.crown >= r.ck.kinds.trees - 3, `seed ${r.seed}: crowns ${r.ck.kinds.crown} for ${r.ck.kinds.trees} trees`);
  }
  assert.ok(new Set(rows.map((r) => r.hash)).size >= 25, "layouts barely vary");
  const avg = rows.reduce((s, r) => s + r.ck.kinds.trees, 0) / rows.length;
  assert.ok(avg >= 7 && avg <= 12, `average ${avg} trees`);
  assert.ok(rows.filter((r) => r.ck.levels >= 2).length >= rows.length * 0.6, "two levels in most villages");
  for (const r of rows) { // P6: no bridge to nowhere, no hanging balcony
    assert.equal(r.ck.kinds.bridgesNoDest, 0, `seed ${r.seed}: bridges without a destination tree`);
    assert.equal(r.ck.kinds.unsupported, 0, `seed ${r.seed}: unsupported balcony`);
    assert.equal(r.ck.kinds.bridgeAlone, 0, `seed ${r.seed}: a bridge piece placed alone`);
  }
  assert.ok(rows.reduce((s, r) => s + r.ck.open, 0) / rows.length <= 1.5, "too many open connectors");
  assert.ok(Date.now() - t0 < 20000, `simulation took ${Date.now() - t0} ms`);
});
// --- Elven village: engine-state fixes (leaf decay, fence links, rope side under rotation) ---
const shippedStructures = () => ["../lothlorien_bp/structures/lothlorien", VILLAGE].flatMap((d) =>
  readdirSync(new URL(`${d}/`, import.meta.url)).filter((f) => f.endsWith(".mcstructure")).map((f) =>
    parseMcstructure(readFileSync(new URL(`${d}/${f}`, import.meta.url)), f.replace(".mcstructure", ""))));
test("village and giants: no orphan leaves (every leaf has a 6-neighbour path of <= 10 leaves to a log; trees.js decays the rest)", () => {
  for (const piece of shippedStructures()) {
    const names = new Map(piece.blocks.map((b) => [`${b.x},${b.y},${b.z}`, b.name]));
    const dist = new Map();
    const queue = [];
    for (const [k, n] of names) if (n === "lothlorien:mallorn_log" || n === "lothlorien:mallorn_wood") { dist.set(k, 0); queue.push(k); }
    for (let i = 0; i < queue.length; i++) {
      const [x, y, z] = queue[i].split(",").map(Number);
      for (const [dx, dy, dz] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) {
        const n = `${x + dx},${y + dy},${z + dz}`;
        if (names.get(n) === "lothlorien:mallorn_leaves" && !dist.has(n)) { dist.set(n, dist.get(queue[i]) + 1); queue.push(n); }
      }
    }
    const orphans = [...names].filter(([k, n]) => n === "lothlorien:mallorn_leaves" && !(dist.get(k) <= 10));
    assert.equal(orphans.length, 0, `${piece.name}: ${orphans.length} orphan leaves, e.g. ${orphans[0]?.[0]}`);
  }
});
test("village: fence links are symmetric and consistent in every piece (the stored state matches the neighbouring fence)", () => {
  const OPP = { north: "south", south: "north", east: "west", west: "east" };
  const VEC = { north: [0, -1], south: [0, 1], west: [-1, 0], east: [1, 0] };
  const pieces = shippedStructures().filter((p) => villageData.pieces.has(`lothlorien/village/${p.name}`));
  assert.ok(pieces.length >= 25);
  for (const piece of pieces) {
    const at = new Map(piece.blocks.map((b) => [`${b.x},${b.y},${b.z}`, b]));
    for (const b of piece.blocks) {
      if (b.name !== FENCE) continue;
      for (const [side, [dx, dz]] of Object.entries(VEC)) {
        const stored = !!b.states[`minecraft:connection_${side}`];
        const inBox = piece.at(b.x + dx, b.y, b.z + dz) !== undefined;
        const nb = at.get(`${b.x + dx},${b.y},${b.z + dz}`);
        const tag = `${piece.name} fence ${b.x},${b.y},${b.z} ${side}`;
        if (!inBox) continue; // a link out of the box is the connector standard's forced link, checked in the connector test
        assert.equal(stored, nb?.name === FENCE, `${tag}: stored ${stored}, neighbour ${nb?.name}`);
        if (nb?.name === FENCE) assert.equal(!!nb.states[`minecraft:connection_${OPP[side]}`], stored, `${tag}: one-way link`);
      }
    }
  }
});
test("village: rails are straight runs and square corners only (no diagonal staircase of single cells)", () => {
  for (const piece of shippedStructures()) {
    if (!villageData.pieces.has(`lothlorien/village/${piece.name}`)) continue;
    const rail = new Set(piece.blocks.filter((b) => b.name === FENCE && b.y > 0).map((b) => `${b.x},${b.y},${b.z}`));
    for (const k of rail) {
      const [x, y, z] = k.split(",").map(Number);
      for (const [dx, dz] of [[1, 1], [1, -1]]) {
        // a diagonal pair with neither orthogonal cell present would be an unlinked staircase step
        if (rail.has(`${x + dx},${y},${z + dz}`)) assert.ok(rail.has(`${x + dx},${y},${z}`) || rail.has(`${x},${y},${z + dz}`), `${piece.name}: diagonal rail step at ${k}`);
      }
    }
  }
});
test("village: simulated villages have no wrong rope side, no decaying leaf, linked rails across every joint", () => {
  for (const r of villages()) {
    assert.equal(r.ck.info.ropeWrong, 0, `seed ${r.seed}: ropes facing away from the trunk`);
    assert.ok(r.ck.info.ropes > 0 && r.ck.info.hangingRopes === r.ck.info.ropes, `seed ${r.seed}: village ropes are the rotating variant`);
    assert.equal(r.ck.info.decay, 0, `seed ${r.seed}: leaves that will decay`);
    assert.ok(!r.ck.fail.some((f) => f.includes("rail link")), `seed ${r.seed}: ${r.ck.fail.find((f) => f.includes("rail link"))}`);
  }
});
test("Elven rope hanging: structure-only twin of the rope, same geometry, a state Bedrock rotates, same script handling", () => {
  const rope = readJson("../lothlorien_bp/blocks/elven_rope.json")["minecraft:block"];
  const hang = readJson("../lothlorien_bp/blocks/elven_rope_hanging.json")["minecraft:block"];
  assert.equal(hang.description.identifier, "lothlorien:elven_rope_hanging");
  assert.deepEqual(hang.description.menu_category, { category: "none" }, "hidden from the Creative menu");
  assert.deepEqual(hang.description.traits["minecraft:placement_direction"].enabled_states, ["minecraft:cardinal_direction"]);
  assert.equal(hang.description.states, undefined, "no custom state: custom-namespace states are not rotated with a piece");
  assert.deepEqual(hang.components, rope.components, "same geometry, texture, sound, selection box");
  assert.equal(hang.components["minecraft:loot"], undefined, "the script drops the whole rope as the normal item");
  assert.deepEqual(hang.permutations.map((p) => p.condition.replace("minecraft:cardinal_direction", "lothlorien:face")), rope.permutations.map((p) => p.condition));
  assert.deepEqual(hang.permutations.map((p) => p.components), rope.permutations.map((p) => p.components), "same side for the same value");
  const js = readFileSync(new URL("../lothlorien_bp/scripts/elven_rope.js", import.meta.url), "utf8");
  assert.ok(js.includes('"lothlorien:elven_rope_hanging"') && js.includes("ROPE_IDS.has"), "script treats it as a rope (climb, break, wall check)");
  const lang = readFileSync(new URL("../lothlorien_rp/texts/en_US.lang", import.meta.url), "utf8");
  assert.ok(lang.includes("tile.lothlorien:elven_rope_hanging.name=Elven Rope"), "named like the rope");
});

// --- Elven village round 4: crown trunk, rail steps, bridge body, stair opening, rails over leaves, light ---
import { RING, STAIR_FULL, STAIR_TOP, STAIR_CUT, FLOOR_H as V_FLOOR, LEVEL_H as V_LEVEL, ROOTS as V_ROOTS, worstLight, LIGHT_TARGET, LANTERN_LIGHT } from "../tools/village_mallorn.mjs";
const SLAB_ID = "lothlorien:mallorn_slab", LEAVES_ID = "lothlorien:mallorn_leaves";
const halfOf = (p) => { const up = p.jigsaws.find((j) => j.dirId === 1); return up ? [up.x, up.z] : [(p.size[0] - 1) / 2, (p.size[2] - 1) / 2]; }; // trunk axis (a combo is not centred on it)
test("village crowns: the trunk keeps its full section well up into the crown and thins only in the top third (3x3 village, 5x5 central)", () => {
  for (const p of villagePieces().filter((q) => q.name.startsWith("crown_"))) {
    const central = p.name.startsWith("crown_central"), H = p.size[1], top = H - 4, [hx, hz] = halfOf(p);
    const trunkAt = (y) => p.blocks.filter((b) => b.y === y && b.name === MALLORN_LOG && b.states["minecraft:block_face"] !== "east" && b.states["minecraft:block_face"] !== "south"
      && Math.abs(b.x - hx) <= 2 && Math.abs(b.z - hz) <= 2).length;
    const counts = []; for (let y = 1; y <= top; y++) counts.push(trunkAt(y));
    assert.ok(counts[0] >= (central ? 21 : 9), `${p.name}: starts with the full section, got ${counts[0]}`);
    for (let y = 1; y < counts.length; y++) assert.ok(counts[y] <= counts[y - 1], `${p.name}: the trunk only tapers ${counts}`);
    assert.ok(counts[Math.floor(top * 0.3) - 1] >= 9, `${p.name}: 3x3 or wider at 30%`);
    assert.ok(counts[Math.floor(top * 0.6) - 1] >= 5, `${p.name}: plus or wider at 60%`);
    assert.equal(counts[top - 1], 1, `${p.name}: 1x1 at the top`);
    assert.equal(p.blocks.filter((b) => b.y === 0 && b.name !== MALLORN_LOG).length, 0, `${p.name}: only trunk in the jigsaw layer`);
  }
  for (const p of villagePieces().filter((q) => isTree(q.name))) { // the platform trunk below carries the same full section
    const [hx, hz] = halfOf(p), central = p.name.startsWith("central"), top = p.size[1] - 1;
    const n = (y) => p.blocks.filter((b) => b.y === y && b.name === MALLORN_LOG && Math.abs(b.x - hx) <= 2 && Math.abs(b.z - hz) <= 2).length + (p.at(hx, y, hz) === "minecraft:jigsaw" ? 1 : 0);
    assert.ok(n(top - 1) >= (central ? 21 : 9), `${p.name}: full section under the crown jigsaw`);
  }
});
test("village trees (P9, giant Mallorn style): root flare of bark at ground level, trunk down to ROOTS, bent branches and big leaf blobs in the crowns", () => {
  const WOOD_ID = "lothlorien:mallorn_wood", BRANCH = (b) => b.name === MALLORN_LOG && ["east", "south", "west", "north"].includes(b.states["minecraft:block_face"]); // combos are turned: east/south become west/north
  for (const p of villagePieces().filter((q) => isTree(q.name))) {
    const [hx, hz] = halfOf(p), central = p.name.startsWith("central"), r = central ? 2 : 1;
    const outside = (b) => Math.max(Math.abs(b.x - hx), Math.abs(b.z - hz)) > r;
    const flare = p.blocks.filter((b) => b.name === WOOD_ID && b.y >= V_ROOTS && b.y < V_ROOTS + 4 && outside(b));
    assert.ok(flare.length >= (central ? 30 : 15), `${p.name}: root flare of bark round the trunk at nominal ground level, got ${flare.length}`);
    assert.ok(flare.some((b) => b.y === V_ROOTS) && flare.some((b) => b.y >= V_ROOTS + 2), `${p.name}: the flare rises above the ground`);
    assert.ok(!p.blocks.some((b) => b.name === WOOD_ID && b.y >= V_ROOTS + 8), `${p.name}: bark foot only near the ground`);
    const trunkBottom = p.blocks.filter((b) => b.y === 0 && b.name === MALLORN_LOG && !outside(b)).length + (p.at(hx, 0, hz) === "minecraft:jigsaw" ? 1 : 0); // the start anchor jigsaw replaces the centre log
    assert.ok(trunkBottom >= (central ? 21 : 9), `${p.name}: the trunk reaches ROOTS below nominal ground with its full section (${trunkBottom})`);
    // the round trunk: no corner cell in the central 5x5
    if (central) for (const [cx, cz] of [[-2, -2], [2, -2], [-2, 2], [2, 2]]) assert.ok(!p.blocks.some((b) => b.y === V_ROOTS + 8 && b.x === hx + cx && b.z === hz + cz && b.name === MALLORN_LOG), "round trunk: corner cell empty");
    assert.ok(p.blocks.filter(BRANCH).length >= (central ? 40 : 15), `${p.name}: bent low branches on the bare trunk`);
  }
  const need = { crown_small: [7, 16], crown_medium: [8, 20], crown_large: [10, 24], crown_central_a: [16, 34], crown_central_b: [13, 30] };
  for (const [name, [h, H]] of Object.entries(need)) {
    const p = villagePieces().find((q) => q.name === name);
    assert.deepEqual([(p.size[0] - 1) / 2, p.size[1]], [h, H], `${name}: giant-style crowns are this big`);
    const branches = p.blocks.filter(BRANCH), leaves = p.blocks.filter((b) => b.name === LEAVES_ID);
    assert.ok(branches.length >= 3 * h, `${name}: bent branches (${branches.length})`);
    assert.ok(new Set(branches.map((b) => b.y)).size >= 5, `${name}: branches climb (rise on the way)`);
    assert.ok(leaves.length >= 14 * h * h / 3, `${name}: full leaf blobs (${leaves.length})`);
    const [hx, hz] = halfOf(p), far = Math.max(...branches.map((b) => Math.max(Math.abs(b.x - hx), Math.abs(b.z - hz))));
    assert.ok(far >= h - 5, `${name}: branches reach out (${far} of ${h})`);
  }
});
test("village bridges: the rail is one continuous stepped line (consecutive rail fences are face-adjacent, no diagonal-only joins)", () => {
  const bridges = [...STRAIGHT, ...DOGS].map((spec) => { // the shapes the combos are built from (a bridge is never a piece of its own)
    const b = buildBridge(spec.length, spec);
    return { name: spec.name, blocks: [...b.blocks].map(([k, v]) => { const [x, y, z] = k.split(",").map(Number); return { x, y, z, name: v.name }; }) };
  });
  assert.equal(bridges.length, 9);
  for (const p of bridges) {
    const rail = new Set(p.blocks.filter((b) => b.name === FENCE).map((b) => `${b.x},${b.y},${b.z}`));
    let sawStep = false;
    for (const k of rail) {
      const [x, y, z] = k.split(",").map(Number);
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) {
        const n = Math.abs(dx) + Math.abs(dy) + Math.abs(dz);
        if (n !== 2 || !rail.has(`${x + dx},${y + dy},${z + dz}`)) continue;
        if (dy !== 0) sawStep = true;
        // a diagonal pair needs a rail at one of the shared face neighbours (an L of face-adjacent fences)
        const joined = [[dx, 0, 0], [0, dy, 0], [0, 0, dz]].some(([a, b, c]) => (a || b || c) && rail.has(`${x + a},${y + b},${z + c}`));
        assert.ok(joined, `${p.name}: diagonal-only rail join at ${k} -> ${[dx, dy, dz]}`);
      }
    }
    if (/bridge_(9|11|13)$|dog/.test(p.name)) assert.ok(sawStep, `${p.name}: expected stepped rails`);
    const seen = new Set(); let comps = 0; // one rail line per side
    for (const k of rail) {
      if (seen.has(k)) continue;
      comps++; const st = [k]; seen.add(k);
      while (st.length) {
        const [x, y, z] = st.pop().split(",").map(Number);
        for (const [a, b, c] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) { const m = `${x + a},${y + b},${z + c}`; if (rail.has(m) && !seen.has(m)) { seen.add(m); st.push(m); } }
      }
    }
    assert.equal(comps, 2, `${p.name}: one rail line per side, got ${comps}`);
  }
});
import { bridgeShape } from "../lothlorien_bp/scripts/village_bridge.js";
import { buildBridge, STRAIGHT, DOGS, rotateCell } from "../tools/village_combo.mjs";
test("bridgeShape: dog-legs shift one block sideways per block forward, walk stays 3 wide and connected, exits at the ends", () => {
  for (const [len, off] of [[11, 2], [11, -2], [13, 3], [13, -3], [9, 0], [9, 4]]) {
    const s = bridgeShape(len, off, len <= 7 ? 1 : 2), xs = (z) => s.walk.filter((c) => c[2] === z).map((c) => c[0]).sort((a, b) => a - b);
    for (let z = 0; z < len; z++) {
      const r = xs(z);
      assert.equal(r.length, 3, `${len}/${off} row ${z}: 3 wide`);
      if (z) assert.ok(Math.abs(r[1] - xs(z - 1)[1]) <= 1, `${len}/${off} row ${z}: centre moves at most one block`);
    }
    assert.equal(s.connectors[1].x - s.connectors[0].x, off);
    assert.equal(s.size[0], 5 + Math.abs(off));
  }
});
test("village: a bottom slab is never one slab thin - a top slab (or solid block) directly under every bottom slab", () => {
  for (const p of villagePieces()) {
    for (const b of p.blocks) {
      if (b.name !== SLAB_ID || b.states["minecraft:vertical_half"] !== "bottom") continue;
      const under = p.blocks.find((q) => q.x === b.x && q.y === b.y - 1 && q.z === b.z);
      const jig = p.at(b.x, b.y - 1, b.z) === "minecraft:jigsaw";
      assert.ok(jig || (under && (under.name === PLANKS || under.name === MALLORN_LOG || (under.name === SLAB_ID && under.states["minecraft:vertical_half"] === "top"))), `${p.name}: thin slab at ${[b.x, b.y, b.z]}`);
    }
  }
});
test("village towers: the upper floor covers the stair opening as far as headroom allows (full deck / top slab), spiral stays walkable", () => {
  assert.deepEqual(STAIR_FULL.concat(STAIR_TOP, STAIR_CUT).sort((a, b) => a - b), [9, 10, 11, 12, 13]);
  assert.ok(STAIR_CUT.length <= 3, `remaining hole ${STAIR_CUT.length} cells`);
  const towers = villagePieces().filter((p) => p.name.startsWith("combo_tower_"));
  assert.ok(towers.length >= 6, `${towers.length} tower combos`);
  for (const p of towers) {
    const [hx, hz] = halfOf(p), yU = V_ROOTS + V_FLOOR + V_LEVEL;
    const k = (4 - ["north", "east", "south", "west"].indexOf(p.name.match(/^combo_tower_[a-z]_(north|east|south|west)_/)[1])) % 4; // the combo is the tower turned k quarter turns
    for (let i = 0; i < 14; i++) {
      const [rx, rz] = rotateCell(...RING[i], k), s = 3 + i, at = p.at(rx + hx, yU, rz + hz), blk = p.blocks.find((q) => q.x === rx + hx && q.y === yU && q.z === rz + hz);
      if (2 * V_LEVEL - s >= 4) assert.equal(at, PLANKS, `${p.name}: ring ${i} under full deck`);
      else if (2 * V_LEVEL + 1 - s >= 4) assert.ok(at === SLAB_ID && blk.states["minecraft:vertical_half"] === "top", `${p.name}: ring ${i} top slab, got ${at}`);
      else assert.ok(at === null || at === "minecraft:air", `${p.name}: ring ${i} stays open, got ${at}`);
    }
  }
  for (const r of villages()) assert.equal(r.ck.unreachable, 0, `seed ${r.seed}: unreachable walk cells`);
});
test("village: rails, deck, walk cells and headroom win over leaves in every piece (no leaf within 3 above a deck or stair block)", () => {
  for (const p of villagePieces()) {
    for (const b of p.blocks) {
      if (b.name !== PLANKS && b.name !== SLAB_ID) continue;
      for (let h = 1; h <= 3; h++) assert.notEqual(p.at(b.x, b.y + h, b.z), LEAVES_ID, `${p.name}: leaf ${h} above deck at ${[b.x, b.y, b.z]}`);
    }
  }
});
test("village: crown pieces never reach a platform's rail, deck, walk or headroom cells in any of the 4 rollable rotations; crowns own only their cells (void elsewhere, no air)", () => {
  const pool = (id) => villageData.pools.get(`lothlorien:village/${id}`);
  const crownsOf = (first) => {
    const out = [];
    for (let id = first; id && id !== "minecraft:empty"; id = pool(id.split("/").pop())?.fallback) for (const e of pool(id.split("/").pop()).elements) out.push(villageData.getPiece(e.element.location));
    return out;
  };
  for (const tree of villagePieces().filter((p) => isTree(p.name))) {
    const up = tree.jigsaws.find((j) => j.dirId === 1), members = crownsOf(up.pool);
    assert.ok(members.length >= 1);
    const guarded = new Map();
    for (let y = 0; y < tree.size[1]; y++) for (let x = 0; x < tree.size[0]; x++) for (let z = 0; z < tree.size[2]; z++) {
      const n = tree.at(x, y, z);
      if ([PLANKS, SLAB_ID, FENCE, LANTERN_ID, "minecraft:air"].includes(n)) guarded.set(`${x},${y},${z}`, n);
    }
    for (const crown of members) {
      assert.equal(crown.blocks.filter((b) => b.name === "minecraft:air").length, 0, `${crown.name}: no air blocks (void outside its own cells)`);
      for (let r = 0; r < 4; r++) {
        const rp = rotated(crown, r), cj = rp.jigsaws.find((j) => j.dirId === 0);
        const o = [up.x - cj.x, up.y + 1 - cj.y, up.z - cj.z]; // the crown's jigsaw cell sits one above the platform's
        for (const b of rp.blocks) {
          const k = `${o[0] + b.x},${o[1] + b.y},${o[2] + b.z}`;
          assert.ok(!guarded.has(k), `${tree.name} + ${crown.name} rot ${r}: crown ${b.name} on platform ${guarded.get(k)} at ${k}`);
        }
        assert.ok(o[1] > tree.size[1] - 1, `${tree.name} + ${crown.name}: the crown box starts above the platform box`);
      }
    }
  }
});
test("village: block light - every walkable cell of every piece is lit to >= 8 by lanterns inside the piece (leaves, slabs and full blocks stop light; air, void, fences and lanterns pass it)", () => {
  assert.equal(LANTERN_LIGHT, readJson("../lothlorien_bp/blocks/elven_lantern.json")["minecraft:block"].components["minecraft:light_emission"], "the model uses the lantern's real emission");
  const worst = {};
  for (const p of villagePieces()) {
    const nameAt = (x, y, z) => { const n = p.at(x, y, z); return n === null ? undefined : n; };
    const r = worstLight(nameAt, { x0: 0, x1: p.size[0] - 1, y0: 0, y1: p.size[1] - 1, z0: 0, z1: p.size[2] - 1 });
    if (!r.cells) continue;
    assert.ok(r.worst >= LIGHT_TARGET, `${p.name}: walk cell ${r.at} has block light ${r.worst}`);
    const type = p.name.replace(/_(dog_)?\d+.*$/, "").replace(/_[a-z]$/, "");
    worst[type] = Math.min(worst[type] ?? 99, r.worst);
  }
  console.log("worst walk-cell block light per piece type:", JSON.stringify(worst));
});

// --- rail mender: marker entity in every rail piece, pure link rule ---
import * as MEND from "../lothlorien_bp/scripts/rail_mender_rules.js";
test("rail mender: markers inside the box, and every rail of every village piece lies inside the scan box of a marker (combos carry two: bridge middle and tree axis)", () => {
  for (const p of villagePieces()) {
    const rails = p.blocks.filter((b) => b.name === FENCE);
    const m = p.entities.filter((e) => e.id === MEND.MENDER_ID);
    assert.equal(p.entities.length - p.entities.filter((e) => e.id === "lothlorien:elven_warden" || e.id === "lothlorien:loop_marker").length, m.length, `${p.name}: only markers (and village wardens, loop markers)`);
    assert.equal(m.length, !rails.length ? 0 : p.name.startsWith("combo_") ? 2 : 1, `${p.name}: ${rails.length} rails, ${m.length} markers`);
    for (const e of m) {
      const [x, y, z] = e.pos;
      assert.ok(x >= 0 && x < p.size[0] && y >= 0 && y < p.size[1] && z >= 0 && z < p.size[2], `${p.name}: marker inside the box`);
    }
    for (const r of rails) {
      const covered = m.some((e) => { const box = MEND.scanBox({ x: e.pos[0], y: e.pos[1], z: e.pos[2] }); return r.x >= box.from.x && r.x <= box.to.x && r.z >= box.from.z && r.z <= box.to.z && r.y >= box.from.y && r.y <= box.to.y; });
      assert.ok(covered, `${p.name}: rail ${r.x},${r.y},${r.z} is outside every marker's scan box`);
    }
  }
});
test("rail mender: marker entity files exist and the scan box is centred on the marker", () => {
  const bpE = JSON.parse(readFileSync(new URL("../lothlorien_bp/entities/rail_mender.json", import.meta.url), "utf8"))["minecraft:entity"];
  assert.equal(bpE.description.identifier, MEND.MENDER_ID);
  assert.ok(bpE.components["minecraft:persistent"] && bpE.components["minecraft:physics"].has_collision === false);
  assert.ok(existsSync(new URL("../lothlorien_rp/entity/rail_mender.entity.json", import.meta.url)));
  const b = MEND.scanBox({ x: 10.5, y: 70, z: -3.5 });
  assert.deepEqual(b.from, { x: -7, y: 67, z: -21 });
  assert.deepEqual(b.to, { x: 27, y: 84, z: 13 });
});
test("rail mender: only switches links on, only toward our own fences, never toward loaded other blocks or unloaded cells", () => {
  const world = new Map([["1,0,0", "lothlorien:mallorn_fence"], ["-1,0,0", "lothlorien:mallorn_heartwood_fence"], ["0,0,1", "minecraft:oak_fence"], ["0,0,-1", undefined]]);
  const typeAt = (x, y, z) => world.get(`${x},${y},${z}`);
  const none = () => false;
  assert.deepEqual(MEND.missingLinks({ x: 0, y: 0, z: 0 }, typeAt, none).sort(), ["minecraft:connection_east", "minecraft:connection_west"]);
  assert.deepEqual(MEND.missingLinks({ x: 0, y: 0, z: 0 }, typeAt, (s) => s === "minecraft:connection_east"), ["minecraft:connection_west"]);
  assert.deepEqual(MEND.missingLinks({ x: 5, y: 0, z: 5 }, typeAt, none), []);
});
const railJs = readFileSync(new URL("../lothlorien_bp/scripts/rail_mender.js", import.meta.url), "utf8");
test("rail mender: script is imported by main.js and removes the marker only after the scan", () => {
  assert.ok(readFileSync(new URL("../lothlorien_bp/scripts/main.js", import.meta.url), "utf8").includes('import "./rail_mender.js"'));
  assert.ok(railJs.includes("entityLoad") && railJs.includes("entitySpawn") && railJs.includes("entity.remove()"));
});

// --- loop closer (P7): marker on every closed railing exit, pure partner / corridor rules, light on runtime-built bridges ---
import * as LOOP from "../lothlorien_bp/scripts/village_loop.js";
import { blockLight as sharedLight } from "../../../.claude/skills/bedrock-modding/scripts/structure_light.mjs";
import { closeLoops, buildWorld, wkey, markerCell, walkability } from "../tools/village_sim.mjs";
const SLAB_NAME = "lothlorien:mallorn_slab";
// synthetic village: a platform connector row (deck, rails at +-2, 3 air cells walk + headroom) and the railing_end row beyond it
function fixtureWorld(exits) {
  const w = new Map(), at = (x, y, z) => w.get(`${x},${y},${z}`) ?? "minecraft:air";
  for (const e of exits) {
    const a = [e.dir[1], e.dir[0]]; // along the row
    for (const [row, back] of [[0, 0], [1, 1]]) { // row 0 = railing row, row 1 = platform connector row
      const cx = e.x - e.dir[0] * back, cz = e.z - e.dir[1] * back;
      for (let o = -2; o <= 2; o++) {
        w.set(`${cx + a[0] * o},${e.y},${cz + a[1] * o}`, PLANKS);
        if (row === 0 || Math.abs(o) === 2) w.set(`${cx + a[0] * o},${e.y + 1},${cz + a[1] * o}`, FENCE);
      }
    }
  }
  return { w, at };
}
const E = (x, z, dir, y = 40) => ({ x, y, z, dir });
test("loop closer: every railing_end carries exactly one loop marker on its centre fence cell; no other piece has one; entity and script are wired", () => {
  const re = villagePieces().filter((p) => p.name === "railing_end");
  assert.equal(re.length, 1);
  assert.deepEqual(re[0].entities.filter((e) => e.id === LOOP.MARKER_ID).map((e) => e.pos), [[2.5, 1.5, 0.5]]);
  for (const p of villagePieces()) if (p.name !== "railing_end") assert.ok(!p.entities.some((e) => e.id === LOOP.MARKER_ID), `${p.name}: stray loop marker`);
  let seen = 0;
  for (const r of villages()) { // in every rotation the marker sits on the centre fence of a placed railing_end, and the exit signature faces away from the platform
    const states = new Map(), world = buildWorld(r.res, states), at = (x, y, z) => world.get(wkey(x, y, z)) ?? "minecraft:air";
    for (const p of r.res.placed.filter((q) => q.name === "railing_end")) {
      const [x, y, z] = markerCell(p);
      assert.equal(at(x, y + 1, z), FENCE, `seed ${r.seed}: marker on the centre fence`);
      assert.equal(at(x, y, z), PLANKS);
      seen++;
    }
  }
  assert.ok(seen > 100, `${seen} railing_end exits seen`);
  const entity = readJson("../lothlorien_bp/entities/loop_marker.json")["minecraft:entity"];
  assert.equal(entity.description.identifier, LOOP.MARKER_ID);
  assert.ok(entity.components["minecraft:persistent"] && entity.components["minecraft:physics"].has_collision === false && entity.description.is_spawnable === false);
  assert.ok(existsSync(new URL("../lothlorien_rp/entity/loop_marker.entity.json", import.meta.url)) && existsSync(new URL("../lothlorien_rp/models/entity/loop_marker.geo.json", import.meta.url)));
  assert.ok(readFileSync(new URL("../lothlorien_bp/scripts/main.js", import.meta.url), "utf8").includes('import "./loop_marker.js"'));
  const js = readFileSync(new URL("../lothlorien_bp/scripts/loop_marker.js", import.meta.url), "utf8");
  assert.ok(js.includes("entityLoad") && js.includes("entitySpawn") && js.includes("entity.remove()") && js.includes("system.runJob") && !js.includes("runInterval"));
});
test("loop closer: partner search takes facing exits at the same height within reach, nearest first, and refuses the rest", () => {
  const A = E(0, 0, [0, 1]);
  const find = (...others) => { const { at } = fixtureWorld([A, ...others]); return LOOP.findPartner(at, A); };
  const ok = find(E(0, 12, [0, -1]));
  assert.deepEqual([ok.B.x, ok.B.z, ok.length, ok.offset], [0, 12, 13, 0]);
  assert.equal(find(E(3, 12, [0, -1])).offset, 3); // ex = (dir.z, -dir.x) = (1, 0)
  assert.equal(find(E(-3, 12, [0, -1])).offset, -3);
  assert.equal(find(E(0, 12, [0, -1]), E(1, 9, [0, -1])).B.z, 9, "nearest first");
  assert.equal(find(E(0, 5, [0, -1])), null, "too close (needs 5 free cells between the rows)");
  assert.ok(find(E(0, 6, [0, -1])) && find(E(0, 17, [0, -1])));
  assert.equal(find(E(0, 18, [0, -1])), null, "too far");
  assert.equal(find(E(7, 12, [0, -1])), null, "too far sideways");
  assert.equal(find(E(0, 12, [0, 1])), null, "same facing, not facing each other");
  assert.equal(find(E(0, 12, [0, -1], 41)), null, "other deck height");
  assert.equal(find(E(0, -12, [0, -1])), null, "behind");
  assert.equal(find(E(6, 8, [0, -1])), null, "sideways 6 > maxOffset");
  assert.equal(LOOP.exitAt(fixtureWorld([A]).at, 0, 40, 0).dir.join(), "0,1");
  assert.equal(LOOP.exitAt(fixtureWorld([E(4, 4, [1, 0])]).at, 4, 40, 4).dir.join(), "1,0");
  assert.equal(LOOP.exitAt(fixtureWorld([E(4, 4, [-1, 0])]).at, 4, 40, 4).dir.join(), "-1,0");
  assert.equal(LOOP.exitAt(fixtureWorld([A]).at, 0, 40, -1), null, "the platform's own connector row is no exit");
});
test("loop closer: exactly one of a pair builds (smaller x, z), the other stands down; non-mutual pairs do nothing; all 4 headings", () => {
  const A = E(0, 0, [0, 1]), B = E(2, 12, [0, -1]), { at } = fixtureWorld([A, B]);
  assert.equal(LOOP.decide(at, A).action, "build");
  assert.equal(LOOP.decide(at, B).action, "standDown");
  const C = E(-1, 9, [0, -1]), w2 = fixtureWorld([A, B, C]); // A prefers C (nearer); B's best is A
  assert.equal(LOOP.decide(w2.at, A).partner.z, 9);
  assert.equal(LOOP.decide(w2.at, B).action, "none", "B's best is A, A's best is C: not mutual");
  for (const dir of [[0, 1], [1, 0], [0, -1], [-1, 0]]) {
    const a1 = E(10, 10, dir), b1 = E(10 + dir[0] * 12 + dir[1] * 2, 10 + dir[1] * 12 - dir[0] * 2, [-dir[0], -dir[1]]), f = fixtureWorld([a1, b1]);
    const d = LOOP.decide(f.at, a1), e = LOOP.decide(f.at, b1);
    assert.deepEqual([d.action, e.action].sort(), ["build", "standDown"], `heading ${dir}`);
    assert.equal((d.action === "build" ? d : e).plan.length, 13);
  }
});
test("loop closer: corridor check - air and leaves are cleared, anything else (log, planks, rock, unloaded) aborts; a built bridge removes both exits and clears leaves", () => {
  const A = E(0, 0, [0, 1]), B = E(3, 12, [0, -1]);
  const build = (extra = []) => { const f = fixtureWorld([A, B]); for (const [k, v] of extra) f.w.set(k, v); return f; };
  const base = build(), plan = LOOP.decide(base.at, A).plan;
  assert.equal(plan.offset, 3);
  assert.deepEqual(LOOP.blockedCells(base.at, plan), []);
  const mid = [...LOOP.finalBlocks(plan)].find(([k, b]) => b.id === PLANKS && k.split(",")[2] === "6")[0];
  const [mx, my, mz] = mid.split(",").map(Number);
  for (const [name, block, blocks] of [["leaves", "lothlorien:mallorn_leaves", false], ["log", "lothlorien:mallorn_log", true], ["stone", "minecraft:stone", true], ["planks", PLANKS, true]]) {
    for (const dy of [0, 1, 3]) { // the deck itself and the headroom both count
      const f = build([[`${mx},${my + dy},${mz}`, block]]), d = LOOP.decide(f.at, A);
      if (name === "planks" && dy === 0) continue; // the deck cell may already be planks only in the end rows
      assert.equal(d.action, blocks ? "none" : "build", `${name} at +${dy}`);
      if (blocks) assert.equal(d.reason, "blocked");
    }
  }
  assert.equal(LOOP.decide((x, y, z) => (z === 6 ? undefined : base.at(x, y, z)), A).action, "none", "unloaded cells abort");
  const f = build([[`${mx},${my + 2},${mz}`, "lothlorien:mallorn_leaves"]]), d = LOOP.decide(f.at, A);
  assert.equal(d.action, "build");
  for (const [k, b] of LOOP.finalBlocks(d.plan)) b.id === "minecraft:air" ? f.w.delete(k) : f.w.set(k, b.id);
  assert.equal(LOOP.exitAt(f.at, A.x, A.y, A.z), null);
  assert.equal(LOOP.exitAt(f.at, B.x, B.y, B.z), null);
  assert.equal(f.at(A.x, A.y + 1, A.z), "minecraft:air", "the railing's centre is open");
  assert.equal(f.at(A.x + 2, A.y + 1, A.z), FENCE, "the railing's outer posts stay as the bridge rails");
  assert.equal(f.at(mx, my + 2, mz), "minecraft:air", "leaves in the corridor are cleared");
});
test("loop closer: runtime bridges are lit to >= 8 on every walk cell (shared flood fill over the plan's own blocks), all lengths / offsets / headings", () => {
  const passes = (n) => n === undefined || /^minecraft:air$|fence$|elven_lantern$/.test(n);
  let worst = 99, count = 0;
  for (const dir of [[0, 1], [1, 0], [0, -1], [-1, 0]]) {
    for (let length = LOOP.LOOP.minDist + 1; length <= LOOP.LOOP.maxDist + 1; length++) {
      const maxOff = Math.min(LOOP.LOOP.maxOffset, length - 3);
      for (let off = -maxOff; off <= maxOff; off++) {
        const A = E(0, 0, dir), ex = [dir[1], -dir[0]], B = E(dir[0] * (length - 1) + ex[0] * off, dir[1] * (length - 1) + ex[1] * off, [-dir[0], -dir[1]]);
        const plan = LOOP.planBridge(A, B, length, off), blocks = LOOP.finalBlocks(plan);
        const xs = [...blocks.keys()].map((k) => k.split(",").map(Number)), lo = [0, 1, 2].map((i) => Math.min(...xs.map((c) => c[i]))), hi = [0, 1, 2].map((i) => Math.max(...xs.map((c) => c[i])));
        const get = (x, y, z) => blocks.get(`${x + lo[0]},${y + lo[1]},${z + lo[2]}`)?.id;
        const size = [hi[0] - lo[0] + 1, hi[1] - lo[1] + 1, hi[2] - lo[2] + 1];
        const L = sharedLight(get, size, { [LOOP.LANTERN]: 14 }, passes);
        for (const [k, b] of blocks) { // walk cells = feet cells above a plank / slab with two air cells above
          if (b.id !== PLANKS && b.id !== SLAB_NAME) continue;
          const [x, y, z] = k.split(",").map(Number);
          if (blocks.get(`${x},${y + 1},${z}`)?.id !== "minecraft:air" || blocks.get(`${x},${y + 2},${z}`)?.id !== "minecraft:air") continue;
          const l = L.get(`${x - lo[0]},${y + 1 - lo[1]},${z - lo[2]}`) ?? 0;
          worst = Math.min(worst, l); count++;
          assert.ok(l >= LOOP.LOOP.lightTarget, `heading ${dir} length ${length} offset ${off}: walk cell ${x},${y + 1},${z} has light ${l}`);
        }
        assert.equal(plan.lanterns.filter((l) => l.row === 0 || l.row === length - 1).length, 0, "no lantern in the connector rows");
        assert.ok(plan.lanterns.length <= 8, `${plan.lanterns.length} lanterns`);
      }
    }
  }
  console.log(`loop closer bridges: ${count} walk cells, darkest ${worst}`);
});
test("loop closer: in simulated villages every closed loop leaves both exits gone, a continuous walkable deck and the counts add up", () => {
  let loops = 0;
  for (const r of villages()) {
    const states = new Map(), world = buildWorld(r.res, states), lp = closeLoops(r.res, world, states);
    loops += lp.loops;
    assert.ok(lp.missed <= 1, `seed ${r.seed}: ${lp.missed} markers not on an exit`);
    assert.ok(lp.remaining <= lp.markers - lp.loops, "every bridge consumes at least its own exit (the far end may be a lookout arm: same 5-wide rail wall)");
    assert.equal(walkability(r.res, world, states).unreachable.length, 0, `seed ${r.seed}: walkable deck after the loops`);
  }
  assert.ok(loops >= 1, "at least one loop closes in 30 seeds");
});

// --- elven warden: entity invariants, spawn rule, natural-spawn thinning, friendly fire, village wardens ---
import * as EW from "../lothlorien_bp/scripts/elven_warden_rules.js";
const wardenEntity = () => readJson("../lothlorien_bp/entities/elven_warden.json")["minecraft:entity"];
test("elven warden: family has mob + irongolem (monsters hunt it, arrows get the mob group), never monster", () => {
  const fam = wardenEntity().components["minecraft:type_family"].family;
  for (const f of ["lothlorien_warden", "irongolem", "mob"]) assert.ok(fam.includes(f), f);
  assert.ok(!fam.includes("monster") && !fam.includes("player"));
});
test("elven warden: shoots monsters (spiders and creepers included), never players or other families; bow never drops, arrows do", () => {
  const c = wardenEntity().components;
  const filters = c["minecraft:behavior.nearest_attackable_target"].entity_types[0].filters.all_of;
  assert.deepEqual(filters[0], { test: "is_family", subject: "other", value: "monster" });
  const excluded = filters.slice(1).map((f) => { assert.equal(f.operator, "!="); return f.value; }).sort();
  assert.deepEqual(excluded, ["aquatic", "creaking", "enderman", "piglin", "shulker", "wither", "warden", "zombie_pigman"].sort());
  for (const keep of ["creeper", "spider", "cave_spider"]) assert.ok(!excluded.includes(keep), `${keep} stays a target`);
  const targets = c["minecraft:behavior.nearest_attackable_target"].entity_types;
  assert.equal(targets.length, 2, "monsters, and Hated players");
  assert.ok(!JSON.stringify(targets[0]).includes('"player"'), "players are only targets through the hated tag entry");
  assert.ok(JSON.stringify(targets[1]).includes('"has_tag"'));
  const hurt = c["minecraft:behavior.hurt_by_target"];
  assert.ok(!("alert_same_type" in hurt) && hurt.entity_types.max_dist >= 64, "alert_same_type fails to load at format 1.26.50 (content log, 1.26.52)");
  // nearby wardens join through the wolf / zombie pigman pattern: target acquired -> angry group -> broadcast_anger
  assert.equal(c["minecraft:on_target_acquired"].event, "lothlorien:become_angry");
  const e = wardenEntity();
  assert.equal(e.component_groups["lothlorien:angry"]["minecraft:angry"].broadcast_anger, true);
  assert.equal(e.component_groups["lothlorien:angry"]["minecraft:angry"].calm_event.event, "lothlorien:on_calm");
  assert.deepEqual(e.events["lothlorien:become_angry"].add.component_groups, ["lothlorien:angry"]);
  assert.deepEqual(e.events["lothlorien:on_calm"].remove.component_groups, ["lothlorien:angry"]);
  assert.equal(c["minecraft:shooter"].def, "minecraft:arrow");
  const ra = c["minecraft:behavior.ranged_attack"];
  assert.equal(ra.attack_range.max, 18); assert.ok(!("attack_radius" in ra) && !("attack_radius_min" in ra), "not in the schema at format 1.26.50: the entity fails to load"); assert.ok(ra.speed_multiplier < 1, "closes in at a walk");
  assert.equal(c["minecraft:movement"].value, 0.25);
  assert.equal(c["minecraft:behavior.avoid_mob_type"].entity_types[0].max_dist, 5, "keeps monsters off (kiting)");
  assert.ok(!("set_persistent" in c["minecraft:behavior.ranged_attack"]) && !("set_persistent" in c["minecraft:behavior.nearest_attackable_target"]));
  assert.deepEqual(c["minecraft:equipment"].slot_drop_chance, [{ slot: "slot.weapon.mainhand", drop_chance: 0 }]);
  assert.ok(!c["minecraft:experience_reward"], "no XP");
  assert.equal(c["minecraft:loot"].table, "loot_tables/entities/elven_warden.json");
  const loot = readJson("../lothlorien_bp/loot_tables/entities/elven_warden.json");
  assert.deepEqual(loot.pools.flatMap((p) => p.entries.map((e) => e.name)), ["minecraft:arrow"], "arrows only, like a skeleton (0-2, looting +1)");
  const gear = JSON.stringify(readJson("../lothlorien_bp/loot_tables/entities/elven_warden_gear.json"));
  assert.ok(gear.includes('"minecraft:bow"'));
});
test("elven warden: natural wardens despawn by the standard rule; only the village group is persistent", () => {
  const e = wardenEntity();
  assert.deepEqual(e.components["minecraft:despawn"], { despawn_from_distance: {} }, "standard rules, no filters (TECHNICAL_NOTES, Phase 10)");
  assert.ok(!e.components["minecraft:persistent"]);
  const g = e.component_groups[EW.VILLAGE_GROUP];
  assert.ok(g["minecraft:persistent"] && g["minecraft:home"].restriction_radius <= 20 && g["minecraft:behavior.move_towards_home_restriction"]);
  assert.deepEqual(e.events["lothlorien:village_warden"].add.component_groups, [EW.VILLAGE_GROUP], "summon hook for tests");
  assert.equal(e.events["lothlorien:spawn_natural"].set_property["lothlorien:natural"], true);
  assert.ok(!e.events["minecraft:entity_spawned"], "nothing to set up at spawn");
  assert.deepEqual(e.description.properties["lothlorien:natural"], { type: "bool", default: false, client_sync: false });
});
test("elven warden: spawn rule has a ground and a deck condition with the weights of elven_warden_rules.js", () => {
  const r = readJson("../lothlorien_bp/spawn_rules/elven_warden.json")["minecraft:spawn_rules"];
  assert.equal(r.description.identifier, EW.WARDEN_ID);
  assert.equal(r.description.population_control, "pillager", "own surface cap: the animal cap (4 per 9x9 chunks) is full of critters");
  assert.equal(r.conditions.length, 2);
  const [ground, deck] = r.conditions;
  assert.equal(ground["minecraft:weight"].default, EW.SPAWN_WEIGHT_GROUND);
  assert.equal(deck["minecraft:weight"].default, EW.SPAWN_WEIGHT_DECK);
  assert.deepEqual([...EW.DECK_BLOCKS].sort(), [...deck["minecraft:spawns_on_block_filter"]].sort());
  for (const c of r.conditions) {
    assert.equal(c["minecraft:herd"].event, "lothlorien:spawn_natural");
    assert.equal(c["minecraft:biome_filter"].value, "lothlorien");
    assert.ok(!c["minecraft:brightness_filter"], "day and night guard");
  }
});
test("elven warden: natural spawns - always at the edge and on decks, 30 % elsewhere in the biome, none outside", () => {
  assert.equal(EW.spawnKeepChance(0, false), 0);
  assert.equal(EW.spawnKeepChance(0, true), 0, "never outside the biome");
  assert.equal(EW.spawnKeepChance(1, false), 1);
  for (const level of [1, 2, 3]) assert.equal(EW.spawnKeepChance(level, true), 1, `deck at level ${level}`);
  assert.equal(EW.spawnKeepChance(2, false), 0.3);
  assert.equal(EW.spawnKeepChance(3, false), 0.3);
  let kept = 0;
  for (let i = 0; i < 1000; i++) if (EW.keepNaturalSpawn(3, false, i / 1000)) kept++;
  assert.equal(kept, 300);
  assert.ok(EW.keepNaturalSpawn(1, false, 0.999) && !EW.keepNaturalSpawn(3, false, 0.3));
  const src = readFileSync(new URL("../lothlorien_bp/scripts/elven_warden.js", import.meta.url), "utf8");
  assert.ok(src.includes("EntityInitializationCause.Loaded") && src.includes('setProperty("lothlorien:natural", false)'), "judged once, not on reload");
  assert.ok(!src.includes("runInterval"), "event-driven, no polling");
  assert.ok(readFileSync(new URL("../lothlorien_bp/scripts/main.js", import.meta.url), "utf8").includes("startElvenWardens(depthAt)"));
});
test("elven warden: friendly fire - never on wardens, own creatures, animals; players only after hitting a warden", () => {
  const v = (typeId, families = []) => ({ typeId, families });
  const ff = (victim, sinceProvokedMs, hated) => EW.isFriendlyFire({ shooterId: EW.WARDEN_ID, victim, sinceProvokedMs, hated });
  assert.ok(ff(v(EW.WARDEN_ID, ["lothlorien_warden", "irongolem", "mob"])));
  assert.ok(ff(v("lothlorien:deer", ["mob"])) && ff(v("lothlorien:unicorn")) && ff(v("lothlorien:swan")));
  assert.ok(ff(v("minecraft:cow", ["cow", "animal", "mob"])));
  assert.ok(ff(v("minecraft:player"), undefined), "unprovoked player is shielded");
  assert.ok(ff(v("minecraft:player"), EW.PROVOKE_MS + 1), "provocation expires");
  assert.ok(!ff(v("minecraft:player"), 0) && !ff(v("minecraft:player"), EW.PROVOKE_MS), "a player who hit a warden is fair game");
  assert.ok(!ff(v("minecraft:player"), undefined, true) && !ff(v("minecraft:player"), EW.PROVOKE_MS + 1, true), "a Hated player is never shielded");
  assert.ok(ff(v("minecraft:player"), undefined, false) && ff(v("lothlorien:deer"), undefined, true), "the hated flag only concerns players");
  assert.ok(!ff(v("minecraft:zombie", ["zombie", "monster", "mob"])), "monsters take arrows");
  assert.ok(!ff(v("minecraft:villager_v2", ["villager"])), "villagers in the line of fire are accepted");
  assert.ok(!EW.isFriendlyFire({ shooterId: "minecraft:skeleton", victim: v("minecraft:player"), sinceProvokedMs: undefined }), "only warden arrows");
  const src = readFileSync(new URL("../lothlorien_bp/scripts/elven_warden.js", import.meta.url), "utf8");
  assert.ok(src.includes("beforeEvents.entityHurt") && src.includes("event.cancel = true"));
});
test("elven warden: Harmony - a fight costs 1 (first hit after 60 s), a kill 6; Hated players are shot on sight; localized name and spawn egg name", () => {
  assert.ok(EW.isNewFight(undefined) && EW.isNewFight(EW.PROVOKE_MS + 1) && !EW.isNewFight(EW.PROVOKE_MS) && !EW.isNewFight(0));
  assert.equal(H.deedCost("warden_fight"), 1);
  assert.equal(H.deedCost(H.deedKindOf(EW.WARDEN_ID)), 6);
  const src = readFileSync(new URL("../lothlorien_bp/scripts/elven_warden.js", import.meta.url), "utf8");
  assert.ok(/isNewFight[\s\S]*recordWardenFight\(hitter, hurtEntity\)/.test(src), "a new fight is charged");
  assert.ok(src.includes("hasTag(HATED_TAG)"), "friendly fire reads the hated tag");
  const tag = readFileSync(new URL("../lothlorien_bp/scripts/harmony_game.js", import.meta.url), "utf8").match(/HATED_TAG = "([a-z_]+)"/)[1];
  const goal = readJson("../lothlorien_bp/entities/elven_warden.json")["minecraft:entity"].components["minecraft:behavior.nearest_attackable_target"];
  const hatedEntry = goal.entity_types.find((t) => JSON.stringify(t.filters).includes(tag));
  assert.ok(hatedEntry, "the warden targets players carrying the hated tag");
  assert.deepEqual(hatedEntry.filters.all_of.map((f) => [f.test, f.subject, f.value]), [["is_family", "other", "player"], ["has_tag", "other", tag]]);
  const lang = readFileSync(new URL("../lothlorien_rp/texts/en_US.lang", import.meta.url), "utf8");
  assert.ok(/entity\.lothlorien:elven_warden\.name=Elven Warden\r?\n/.test(lang));
  assert.ok(/item\.spawn_egg\.entity\.lothlorien:elven_warden\.name=Elven Warden Spawn Egg\r?\n/.test(lang));
});
test("elven warden: village wardens - 2 on the central tree, 1 on some nodes/towers, persistent, mortal, armed, on open deck", () => {
  const counts = {};
  for (const p of villagePieces()) {
    const w = p.entities.filter((e) => e.id === EW.WARDEN_ID);
    counts[p.name] = w.length;
    for (const e of w) {
      assert.ok(isTree(p.name), `${p.name}: wardens only on tree pieces`);
      assert.deepEqual(e.defs, [`+${EW.WARDEN_ID}`, `+${EW.VILLAGE_GROUP}`], `${p.name}: village group via the definitions list`);
      assert.equal(e.invulnerable, false, `${p.name}: mortal`);
      assert.equal(e.mainhand, EW.BOW_ID, `${p.name}: bow in hand`);
      const [x, y, z] = e.pos;
      assert.ok(x > 0 && x < p.size[0] && z > 0 && z < p.size[2] && y > 0 && y < p.size[1], `${p.name}: inside the box`);
      // feet cell: planks below, air above, open deck around, no rail or fence within 2 cells
      const [cx, cy, cz] = [Math.floor(x), Math.floor(y), Math.floor(z)];
      assert.equal(p.at(cx, cy - 1, cz), PLANKS, `${p.name}: deck under the warden`);
      for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
        assert.equal(p.at(cx + dx, cy - 1, cz + dz), PLANKS, `${p.name}: open deck around`);
        for (const h of [0, 1, 2]) assert.ok([undefined, null, "minecraft:air"].includes(p.at(cx + dx, cy + h, cz + dz)), `${p.name}: headroom ${dx},${h},${dz}`);
      }
      for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) assert.notEqual(p.at(cx + dx, cy, cz + dz), FENCE, `${p.name}: away from rails`);
    }
  }
  assert.equal(counts.central_mallorn_01, 2);
  const nodes = Object.entries(counts).filter(([n, c]) => n !== "central_mallorn_01" && c > 0);
  assert.ok(nodes.length >= 3 && nodes.every(([, c]) => c === 1), `1 warden on each of some node/tower pieces: ${JSON.stringify(counts)}`);
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  assert.ok(total >= 5, `${total} wardens across the pieces`);
});
test("elven warden: village group is applied through the structure's definitions list and exists in the entity file", () => {
  assert.ok(Object.keys(wardenEntity().component_groups).includes(EW.VILLAGE_GROUP));
  const src = readFileSync(new URL("../tools/build_village.mjs", import.meta.url), "utf8");
  assert.ok(src.includes('"+lothlorien:village_warden"') && src.includes("invulnerable: false"));
});

if (failed) { console.log(`${failed} test(s) failed`); process.exit(1); }
console.log("all tests passed");
