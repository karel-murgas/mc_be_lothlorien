// Loop closer: every `railing_end` piece of the Elven village carries one invisible `lothlorien:loop_marker` entity (same pattern
// as rail_mender.js: it runs once when it loads, no polling). Jigsaw can only grow a tree, so two railings that face each other across
// a gap are joined here by an arched slab bridge (village_loop.js holds the rules; the sim runs the same code).
//
// On load the marker waits until the chunks around it are loaded, finds its exit by reading the blocks (rotation independent: the
// marker only has to sit on the railing's centre), and asks decide(): build (it is the smaller (x, z) of a mutually-best pair), stand
// down (the partner builds) or none. P7b: an exit without a partner exit may also join the side of a platform (decide() kind "side"). Spans above
// 17 blocks are two bridges with a 5 x 5 landing on a log pier to the ground (decide() scans down for it). Balconies and lookouts carry markers
// too; a partner without a marker (older worlds) does not stand in the way: the marker that finds it builds. Then it removes itself. Unloaded neighbours keep the marker for another load, at most LOOP.maxTries
// times; a blocked corridor gives up for good. The writes run as a job (a few dozen blocks per tick).
import { BlockPermutation, system, world } from "@minecraft/server";
import { LOOP, MARKER_ID, decide, exitAt, finalBlocks } from "./village_loop.js";
import { missingLinks } from "./rail_mender_rules.js";

const START_DELAY_TICKS = 60, RETRY_TICKS = 40, MAX_WAIT_TICKS = 400, WRITES_PER_TICK = 48, TRIES = "lothlorien:loop_tries";
const busy = new Set();

const reader = (dimension) => {
  const cache = new Map();
  return (x, y, z) => {
    const k = `${x},${y},${z}`;
    if (!cache.has(k)) {
      let v;
      try { v = dimension.getBlock({ x, y, z })?.typeId; } catch { v = undefined; }
      cache.set(k, v);
    }
    return cache.get(k);
  };
};

function regionLoaded(dimension, x, y, z) {
  for (let cx = (x - LOOP.radius) >> 4; cx <= (x + LOOP.radius) >> 4; cx++) {
    for (let cz = (z - LOOP.radius) >> 4; cz <= (z + LOOP.radius) >> 4; cz++) if (!dimension.isChunkLoaded({ x: cx * 16, y, z: cz * 16 })) return false;
  }
  return true;
}

function removeMarkerNear(dimension, p) { // the partner's marker, if it is loaded (otherwise it finds its railing gone and leaves quietly)
  for (const e of dimension.getEntities({ type: MARKER_ID, location: { x: p.x + 0.5, y: p.y + 1.5, z: p.z + 0.5 }, maxDistance: 2 })) e.remove();
}

function* build(entity, dimension, plan, at) {
  let n = 0, failed = 0;
  const writes = [...finalBlocks(plan)].filter(([k, b]) => { // skip what is already right (air over air, planks over planks)
    const [x, y, z] = k.split(",").map(Number), cur = at(x, y, z);
    return !(cur === b.id && (b.id === "minecraft:air" || b.id === "lothlorien:mallorn_planks"));
  });
  for (const [k, b] of writes) {
    const [x, y, z] = k.split(",").map(Number);
    try {
      const block = dimension.getBlock({ x, y, z });
      if (b.id === "minecraft:air") block.setType("minecraft:air");
      else block.setPermutation(BlockPermutation.resolve(b.id, b.states ?? {}));
    } catch (e) { failed++; }
    if (++n % WRITES_PER_TICK === 0) yield;
  }
  // fence links toward neighbouring fences that the neighbour update may have dropped (rail_mender's rule)
  const typeAt = (x, y, z) => dimension.getBlock({ x, y, z })?.typeId;
  for (const r of plan.rails) {
    try {
      const block = dimension.getBlock(r), perm = block.permutation, on = missingLinks(r, typeAt, (s) => perm.getState(s));
      if (on.length) { let next = perm; for (const s of on) next = next.withState(s, true); block.setPermutation(next); }
    } catch (e) { failed++; }
  }
  if (!plan.side) removeMarkerNear(dimension, plan.B);
  if (entity.isValid) entity.remove();
  console.warn(`[lothlorien] loop closer: ${plan.side ? "side" : "exit"} bridge of ${plan.length}${plan.landing ? ` with a landing and ${plan.pier.length} pier blocks` : ""} (offset ${plan.offset}) built between ${plan.A.x},${plan.A.y},${plan.A.z} and ${plan.B.x},${plan.B.y},${plan.B.z}: ${writes.length} blocks, ${plan.lanterns.length} lanterns${failed ? `, ${failed} write(s) failed` : ""}`);
}

function retryLater(entity) { // not everything was loaded: keep the marker for the next load, but not forever
  busy.delete(entity.id);
  if (!entity.isValid) return;
  const tries = (Number(entity.getDynamicProperty(TRIES)) || 0) + 1;
  if (tries >= LOOP.maxTries) entity.remove();
  else entity.setDynamicProperty(TRIES, tries);
}

function attempt(entity, waited) {
  try {
    if (!entity.isValid) return busy.delete(entity.id);
    const p = entity.location, dimension = entity.dimension, x = Math.floor(p.x), z = Math.floor(p.z), y = Math.floor(p.y) - 1; // y = the deck cell under the marker
    if (!regionLoaded(dimension, x, y, z)) {
      if (waited >= MAX_WAIT_TICKS) return retryLater(entity);
      return system.runTimeout(() => attempt(entity, waited + RETRY_TICKS), RETRY_TICKS);
    }
    busy.delete(entity.id);
    const at = reader(dimension), A = exitAt(at, x, y, z);
    const hasMarker = (B) => { // a marker (entity) still stands on the partner's centre fence cell
      try { return dimension.getEntities({ type: MARKER_ID, location: { x: B.x + 0.5, y: B.y + 1.5, z: B.z + 0.5 }, maxDistance: 2 }).length > 0; } catch { return true; }
    };
    if (!A) return entity.remove(); // the railing is gone: this exit was already closed from the other side
    const d = decide(at, A, { hasMarker });
    if (d.action === "build") system.runJob(build(entity, dimension, d.plan, at));
    else {
      if (d.reason === "blocked") console.warn(`[lothlorien] loop closer: corridor at ${x},${y},${z} blocked by ${d.blocked[0].block} at ${d.blocked[0].x},${d.blocked[0].y},${d.blocked[0].z} (${d.blocked.length} cells)`);
      else if (d.reason !== "no partner" && d.reason !== "not mutual") console.warn(`[lothlorien] loop closer: exit at ${x},${y},${z} gave up: ${d.reason}`);
      entity.remove();
    }
  } catch (e) {
    busy.delete(entity.id);
    console.warn(`[lothlorien] loop closer: ${e}`);
  }
}

function onMarker(entity) {
  if (!entity || entity.typeId !== MARKER_ID || busy.has(entity.id)) return;
  busy.add(entity.id);
  system.runTimeout(() => attempt(entity, 0), START_DELAY_TICKS);
}

world.afterEvents.entityLoad.subscribe(({ entity }) => onMarker(entity));
world.afterEvents.entitySpawn.subscribe(({ entity }) => onMarker(entity));
