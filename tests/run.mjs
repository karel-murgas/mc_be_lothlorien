// Regression tests: node tests/run.mjs (run by `mods verify lothlorien`).
import assert from "node:assert/strict";
import { leafUndersideY } from "../lothlorien_bp/scripts/leaf_fall.js";
import { BONEMEAL_TABLE, SPREAD_TRIES, COVERS, pickWeighted } from "../lothlorien_bp/scripts/flora_table.js";
import { readFileSync } from "node:fs";
import { MAX_GROWTH, growChance, bonemealSteps, advanceGrowth } from "../lothlorien_bp/scripts/crop_rules.js";
import { estimateDepth, probeCount, ringOffsets, DEPTH_RADII } from "../lothlorien_bp/scripts/depth.js";
import * as D from "../lothlorien_bp/scripts/disharmony.js";
import { makeRandom } from "../lothlorien_bp/scripts/mallorn_tree.js";
import { buildFletMallorn, LADDER, LEAF_KEEP, ROOT_DEPTH, B } from "../tools/flet_mallorn.mjs";
import { SIZE, SIZE_Y, TRUNK_AT, CHOSEN, TRUNK_ANCHOR } from "../tools/build_structures.mjs";
import { existsSync } from "node:fs";

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
test("antler drop: every feature it names exists; rarity sits between plain giants and lookout trees", () => {
  const f = (n) => readJson(`../lothlorien_bp/features/${n}.json`);
  const rule = readJson("../lothlorien_bp/feature_rules/deer_antler_drop_feature_rules.json")["minecraft:feature_rules"];
  assert.equal(rule.description.places_feature, "lothlorien:deer_antler_drop_feature");
  const scatter = f("deer_antler_drop_feature")["minecraft:scatter_feature"];
  const weighted = f(scatter.places_feature.split(":")[1])["minecraft:weighted_random_feature"];
  for (const [name] of weighted.features) assert.ok(f(name.split(":")[1])["minecraft:single_block_feature"], name);
  // giants: one structure per ~6x6 chunks, about 1 in 4 a lookout tree (flet) => 1/36 and 1/144 per chunk
  const perChunk = rule.distribution.scatter_chance.numerator / rule.distribution.scatter_chance.denominator;
  assert.ok(perChunk < 1 / 36 && perChunk > 1 / 144, `per chunk ${perChunk}`);
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
import { MARKER_AT, MARKER_BLOCK } from "../tools/build_structures.mjs";

test("white deer: only Disharmony 0 is guided", () => {
  assert.equal(W.canBeGuided(0), true);
  assert.deepEqual([1, 2, 3].map(W.canBeGuided), [false, false, false]);
});
test("white deer: search columns are chunk-aligned, nearest first, and stay inside the radius", () => {
  const cols = W.sliceOrigins(5, 5, 40);
  assert.deepEqual([cols[0].x, cols[0].z, cols[0].dist], [0, 0, 0]);
  assert.ok(cols.every((c, i) => c.x % 16 === 0 && c.z % 16 === 0 && c.dist <= 40 && (i === 0 || cols[i - 1].dist <= c.dist)));
  assert.ok(cols.some((c) => c.x === -48) && !cols.some((c) => c.x === -64));
  assert.deepEqual(W.searchSpan(64, -64, 320), { from: 24, to: 80 });
  assert.deepEqual(W.searchSpan(-60, -64, 320), { from: -64, to: -44 }); // clamped to the world floor
});
test("white deer: a step heads straight for the target, turns round an obstacle, gives up when boxed in", () => {
  const from = { x: 0, y: 64, z: 0 }, target = { x: 10, z: 0 };
  const free = W.pickStep(from, target, (x, z, y) => y);
  assert.ok(Math.abs(free.x - W.STEP) < 1e-9 && Math.abs(free.z) < 1e-9 && free.turn === 0);
  const wall = (x, z, y) => (x > 0.1 && Math.abs(z) < 0.1 ? undefined : y); // blocked dead ahead only
  const round = W.pickStep(from, target, wall, 1);
  assert.ok(round.turn !== 0 && round.x > 0);
  assert.equal(W.pickStep(from, target, () => undefined), undefined);
  assert.equal(W.pickStep(from, target, (x, z, y) => y + 1).y, 65); // the probe decides the standing height
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
test("white deer: the entity has a white coat, a guiding state and the events the script fires", () => {
  const e = deerEntity();
  assert.deepEqual(e.description.properties["lothlorien:coat"].values, ["tawny", "white"]);
  assert.equal(e.description.properties["lothlorien:coat"].client_sync, true);
  assert.equal(e.description.properties["lothlorien:guiding"].type, "bool");
  for (const ev of ["lothlorien:coat_white", "lothlorien:guide_start", "lothlorien:guide_end"]) assert.ok(e.events[ev], ev);
  // the guiding state is one of the mutually exclusive state groups: every switch removes it, only guide_start adds it
  const g = "lothlorien:state_guiding";
  for (const [name, ev] of Object.entries(e.events)) {
    if (name.startsWith("lothlorien:set_") || name === "lothlorien:alarm") assert.ok(ev.remove.component_groups.includes(g), name);
    if (name.startsWith("lothlorien:set_") || name === "lothlorien:alarm") assert.equal(ev.set_property["lothlorien:guiding"], false, name);
  }
  assert.deepEqual(e.events["lothlorien:guide_start"].add.component_groups, [g]);
  assert.equal(e.events["lothlorien:guide_end"].trigger, "lothlorien:alarm_over");
  // guided deer flee only wolves and monsters, never the player, and are not lured
  const guiding = e.component_groups[g];
  assert.ok(!guiding["minecraft:behavior.tempt"]);
  assert.deepEqual(guiding["minecraft:behavior.avoid_mob_type"].entity_types.map((t) => t.filters.value).sort(), ["monster", "wolf"]);
  // about 1 in 25 natural spawns is white, born fawns never
  const nat = e.events["minecraft:entity_spawned"].sequence.find((s) => s.randomize?.some((r) => r.trigger === "lothlorien:coat_white"));
  assert.ok(nat && nat.randomize.reduce((a, r) => a + r.weight, 0) === 25);
  assert.ok(!JSON.stringify(e.events["minecraft:entity_born"]).includes("coat_white"));
  // corn lures deer in the calm states (needed to get within reach of a white deer)
  for (const w of ["calm", "friend"]) assert.ok(e.component_groups[`lothlorien:state_${w}`]["minecraft:behavior.tempt"].items.includes(W.CORN_ID), w);
  assert.ok(existsSync(new URL(`../lothlorien_bp/items/${W.CORN_ID.split(":")[1]}.json`, import.meta.url)), "corn item exists");
});
test("white deer: client entity has both white textures on disk and the render controller picks them", () => {
  const tex = readJson("../lothlorien_rp/entity/deer.entity.json")["minecraft:client_entity"].description.textures;
  for (const k of ["white", "white_baby"]) assert.ok(existsSync(new URL(`../lothlorien_rp/${tex[k]}.png`, import.meta.url)), k);
  const rc = readJson("../lothlorien_rp/render_controllers/deer.render_controllers.json").render_controllers["controller.render.lothlorien.deer"];
  assert.ok(rc.textures[0].includes("Texture.white") && rc.textures[0].includes("Texture.white_baby"));
});
test("structure marker: unbreakable hidden block, one buried in the trunk of every chosen giant", () => {
  const b = readJson("../lothlorien_bp/blocks/structure_marker.json")["minecraft:block"];
  assert.equal(b.description.identifier, W.MARKER_ID);
  assert.equal(b.description.identifier, MARKER_BLOCK);
  assert.equal(b.components["minecraft:destructible_by_mining"], false);
  assert.ok(!b.description.menu_category, "not in the creative menu");
  assert.ok(MARKER_AT.y < 0 && MARKER_AT.x >= 0 && MARKER_AT.x <= 3 && MARKER_AT.z >= 0 && MARKER_AT.z <= 3, "inside the buried trunk");
  for (const [v, n] of CHOSEN) {
    const file = new URL(`../lothlorien_bp/structures/lothlorien/mallorn_${v}_${String(n).padStart(2, "0")}.mcstructure`, import.meta.url);
    assert.ok(readFileSync(file).includes(Buffer.from(MARKER_BLOCK)), `${v} ${n} has the marker (run node tools/build_structures.mjs)`);
  }
});

if (failed) { console.log(`${failed} test(s) failed`); process.exit(1); }
console.log("all tests passed");
