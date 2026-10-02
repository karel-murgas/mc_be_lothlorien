// Regression tests: node tests/run.mjs (run by `mods verify lothlorien`).
import assert from "node:assert/strict";
import { leafUndersideY } from "../lothlorien_bp/scripts/leaf_fall.js";
import { BONEMEAL_TABLE, SPREAD_TRIES, COVERS, pickWeighted } from "../lothlorien_bp/scripts/flora_table.js";
import { readFileSync } from "node:fs";
import { MAX_GROWTH, growChance, bonemealSteps, advanceGrowth } from "../lothlorien_bp/scripts/crop_rules.js";
import { estimateDepth, probeCount, ringOffsets, DEPTH_NAMES, DEPTH_RADII } from "../lothlorien_bp/scripts/depth.js";
import * as D from "../lothlorien_bp/scripts/disharmony.js";
import { makeRandom } from "../lothlorien_bp/scripts/mallorn_tree.js";
import { buildFletMallorn, LADDER, ROUND_LADDER, LEAF_KEEP, ROOT_DEPTH, B } from "../tools/flet_mallorn.mjs";
import { SIZE, SIZE_Y, TRUNK_AT, CHOSEN, TRUNK_ANCHOR } from "../tools/build_structures.mjs";
import { existsSync, readdirSync } from "node:fs";

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
    for (let y = 0; y <= t.floorY; y++) assert.equal(at(t, LADDER.x, y, LADDER.z), B.ladder, `ladder gap at y ${y}`);
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
    for (const v of t.blocks.values()) assert.ok(![B.ladder, B.chest, B.fence, B.planks].includes(v.name), v.name);
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
        if (![0, 3].includes(x) || ![0, 3].includes(z)) assert.equal([B.log, B.wood, B.ladder].includes(at(t, x, y, z)), true, `hole in trunk ${x},${y},${z}`);
      }
    }
  }
  for (const t of roundFlets) {
    for (let y = 0; y <= t.floorY; y++) assert.equal(at(t, ROUND_LADDER.x, y, ROUND_LADDER.z), B.ladder, `ladder gap at y ${y}`);
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
  for (const t of roundPlains) for (const v of t.blocks.values()) assert.ok(![B.ladder, B.chest, B.fence, B.planks].includes(v.name), v.name);
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

test("disharmony: levels", () => {
  assert.deepEqual([0, 1, 2, 3, 4, 9].map(D.levelFor), [0, 1, 2, 2, 3, 3]);
});
test("disharmony: a point decays after 3 min inside, 6 min outside", () => {
  const a = D.newState(); D.recordKill(a); D.tick(a, true, 179); assert.equal(a.points, 1); D.tick(a, true, 1); assert.equal(a.points, 0);
  const b = D.newState(); D.recordKill(b); D.tick(b, false, 359); assert.equal(b.points, 1); D.tick(b, false, 1); assert.equal(b.points, 0);
});
test("disharmony: a new kill restarts the decay timer", () => {
  const s = D.newState(); D.recordKill(s); D.tick(s, true, 170); D.recordKill(s); D.tick(s, true, 170);
  assert.equal(s.points, 2); D.tick(s, true, 10); assert.equal(s.points, 1);
});
test("disharmony: death resets points and timers", () => {
  const s = D.newState(); D.recordKill(s); D.recordKill(s); D.tick(s, true, 100); D.recordDeath(s);
  assert.deepEqual(s, D.newState());
});
test("disharmony: Friend after 10 calm minutes inside; outside pauses progress; kill or death loses it", () => {
  const s = D.newState(); D.tick(s, true, 300); D.tick(s, false, 1000); assert.equal(s.friend, 300);
  D.tick(s, true, 299); assert.ok(!D.isFriend(s)); D.tick(s, true, 1); assert.ok(D.isFriend(s));
  D.tick(s, false, 1000); assert.ok(D.isFriend(s));
  D.recordKill(s); assert.ok(!D.isFriend(s));
  D.tick(s, true, 600); D.recordDeath(s); assert.ok(!D.isFriend(s));
});
test("disharmony: status hidden outside, saved state round-trips, junk is tolerated", () => {
  const s = D.newState(); D.recordKill(s);
  assert.equal(D.statusText(s, false), undefined); assert.equal(D.statusText(s, true), "Disharmony I");
  assert.deepEqual(D.parse(D.serialize(s)), s);
  assert.deepEqual(D.parse(undefined), D.newState()); assert.deepEqual(D.parse("{oops"), D.newState());
});

// Phase 11: deer.
import * as R from "../lothlorien_bp/scripts/deer_rules.js";
const readJson = (p) => JSON.parse(readFileSync(new URL(p, import.meta.url), "utf8"));
const deerEntity = () => readJson("../lothlorien_bp/entities/deer.json")["minecraft:entity"];
const avoidRadius = (e, w) => e.component_groups[`lothlorien:state_${w}`]["minecraft:behavior.avoid_mob_type"].entity_types[0].max_dist;

test("deer: wariness follows Disharmony level; Friend only at level 0", () => {
  assert.equal(R.warinessFor(0, false), "calm");
  assert.equal(R.warinessFor(0, true), "friend");
  assert.deepEqual([1, 2, 3].map((l) => R.warinessFor(l, false)), ["l1", "l2", "l3"]);
  assert.equal(R.warinessFor(2, true), "l2");
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
test("deer: every wariness has a state group and a set event; flight distance grows with Disharmony", () => {
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

test("white deer: only Disharmony 0 is guided", () => {
  assert.equal(W.canBeGuided(0), true);
  assert.deepEqual([1, 2, 3].map(W.canBeGuided), [false, false, false]);
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
  assert.ok(/playerPlaceBlock[\s\S]*40 blocks wide/.test(src), "planting warns about the space");
  assert.ok(readFileSync(new URL("../lothlorien_bp/scripts/main.js", import.meta.url), "utf8").includes('import "./great_mallorn.js"'));
});
test("the actionbar is only the Disharmony / Friend status (and the debug readout); other messages use chat", () => {
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
  assert.equal(W.offerRefusal({ level: 0, friend: true, leashed: false }), undefined);
  assert.equal(W.offerRefusal({ level: 0, friend: true, leashed: true }), "leashed");
  assert.equal(W.offerRefusal({ level: 2, friend: false, leashed: true }), "leashed");
  assert.equal(W.offerRefusal({ level: 1, friend: false, leashed: false }), "restless");
  assert.equal(W.offerRefusal({ level: 0, friend: false, leashed: false }), "untrusted"); // calm is not enough: Friend only
  const base = { toTarget: 40, toPlayer: 5, stuck: 0, age: 0, playerCalm: true };
  assert.equal(W.phase(base), "walk");
  assert.equal(W.phase({ ...base, leashed: true }), "leashed");
  assert.equal(W.phase({ ...base, toTarget: 1, leashed: true }), "leashed", "even at the goal");
  assert.equal(W.phase({ ...base, toPlayer: 30, leashed: true }), "leashed");
  const src = readFileSync(new URL("../lothlorien_bp/scripts/white_deer.js", import.meta.url), "utf8");
  assert.ok(src.includes('getComponent("minecraft:leashable")?.isLeashed'), "the game script reads the lead");
});
test("disharmony: a white deer kill counts as two deer kills, everything else as one", () => {
  assert.equal(D.killWeight(W.WHITE_DEER_ID), 2);
  assert.equal(D.killWeight(R.DEER_ID), 1);
  assert.equal(D.killWeight("minecraft:cow"), 1);
  const a = D.newState(); D.recordKill(a, D.killWeight(W.WHITE_DEER_ID));
  const b = D.newState(); D.recordKill(b, D.killWeight(R.DEER_ID)); D.recordKill(b, D.killWeight(R.DEER_ID));
  assert.deepEqual(a, b);
  assert.equal(D.levelFor(a.points), 2, "straight to Disharmony II");
  D.tick(a, true, D.DECAY_SECONDS_INSIDE); assert.equal(a.points, 1, "decays one point at a time");
  const c = D.newState(); D.recordKill(c); assert.equal(c.points, 1, "default weight 1");
  const game = readFileSync(new URL("../lothlorien_bp/scripts/disharmony_game.js", import.meta.url), "utf8");
  assert.ok(game.includes("killWeight(deadEntity.typeId)"));
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
test("Phase 15: swan and squirrel read Disharmony like the deer (same states, radii, alarm; in WARY_TYPES)", () => {
  assert.deepEqual(R.WARY_TYPES, [R.DEER_ID, R.WHITE_DEER_ID, "lothlorien:swan", "lothlorien:squirrel"]);
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
  assert.equal(QR.offerRefusal({ level: 0, friend: true, cooldownLeft: 0 }), undefined);
  assert.equal(QR.offerRefusal({ level: 0, friend: false, cooldownLeft: 0 }), "untrusted");
  assert.equal(QR.offerRefusal({ level: 1, friend: true, cooldownLeft: 0 }), "restless");
  assert.equal(QR.offerRefusal({ level: 0, friend: true, cooldownLeft: 100 }), "full");
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
if (failed) { console.log(`${failed} test(s) failed`); process.exit(1); }
console.log("all tests passed");
