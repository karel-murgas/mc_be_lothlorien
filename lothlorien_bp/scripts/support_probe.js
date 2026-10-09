// TEMPORARY engine experiment, 2026-10-08. Remove after the results are reviewed.
// Earlier modes test native survival. Only the scripted variant has repair.
import { world, system, BlockPermutation, BlockPistonState, BlockTypes } from "@minecraft/server";
import { message } from "./messages.js";
import { calibratedFacing, caseStatus, summarizeCases, reportGroups } from "./support_probe_rules.js";
import { CANDIDATE_SUPPORT_TAGS, summarizeTagInventory } from "./support_tag_inventory.js";
import { createSupportScriptPrototype } from "./support_probe_script.js";

const NS = "lothlorien:support_probe_";
const ORIGINAL_VARIANTS = ["broad", "mounted", "movable"];
const LISTED_VARIANTS = ["listed", "listed_movable"];
const FILTER_VARIANTS = ["constant", "constant_movable", "negative", "negative_movable", "tagged", "listed_bound"];
const COMPAT_VARIANTS = ["hybrid", "hybrid_movable"];
const DIAGNOSTIC_VARIANTS = ["tagged", "mixed_control", "hybrid", "split", "material"];
const BOUND_VARIANTS = [...FILTER_VARIANTS, ...COMPAT_VARIANTS, "mixed_control", "split", "material", "scripted"];
const VARIANTS = [...ORIGINAL_VARIANTS, ...LISTED_VARIANTS, ...BOUND_VARIANTS];
const FIXTURES = ["minecraft:glass", "minecraft:white_wool", "minecraft:honey_block", "minecraft:oak_planks",
  "minecraft:chest", NS + "solid", NS + "excluded", "minecraft:water", "minecraft:lava"];
const COMPAT_SUPPORTS = ["minecraft:stone", "minecraft:slime", "minecraft:dirt", "minecraft:grass_block",
  "minecraft:oak_planks", "minecraft:glass", "minecraft:white_wool", "minecraft:honey_block", "minecraft:chest",
  "minecraft:deepslate", "minecraft:ice", "lothlorien:mallorn_planks", "lothlorien:mallorn_heartwood_planks",
  NS + "solid", NS + "excluded", "minecraft:air", "minecraft:water", "minecraft:lava",
  "minecraft:glowstone", "minecraft:sea_lantern", "minecraft:ochre_froglight", "minecraft:pearlescent_froglight",
  "minecraft:verdant_froglight", "minecraft:red_wool", "minecraft:red_stained_glass"];
const NORMAL = {
  up: { x: 0, y: 1, z: 0 }, down: { x: 0, y: -1, z: 0 },
  north: { x: 0, y: 0, z: -1 }, south: { x: 0, y: 0, z: 1 },
  east: { x: 1, y: 0, z: 0 }, west: { x: -1, y: 0, z: 0 },
};
const HEADS = new Set(["minecraft:piston_arm_collision", "minecraft:sticky_piston_arm_collision"]);
const RESULT_PROPERTY = "lothlorien:support_probe_results";
const add = (p, v, n = 1) => ({ x: p.x + v.x * n, y: p.y + v.y * n, z: p.z + v.z * n });
const key = p => `${p.x},${p.y},${p.z}`;
const pause = ticks => new Promise(resolve => system.runTimeout(resolve, ticks));
let active;
let tagAuditRunning = false;
let handProbeToken = 0;
const scriptPrototype = createSupportScriptPrototype({
  context: () => active?.mode === "script" && !active.scriptSuspended ? active : undefined,
  pause, normals: NORMAL, inside, warn: line => console.warn(line),
});

async function auditTags(player) {
  tagAuditRunning = true;
  player.sendMessage(message("probe.tags_started"));
  try {
    const records = [];
    for (const type of BlockTypes.getAll()) {
      try { records.push({ id: type.id, tags: BlockPermutation.resolve(type.id).getTags() }); }
      catch (error) { records.push({ id: type.id, error: String(error.message || error) }); }
      if (records.length % 16 === 0) await pause(1);
    }
    const report = summarizeTagInventory(records);
    const counts = group => ({ total: group.total, resolved: group.resolved,
      unresolved: group.unresolved.length, untagged: group.untagged.length, uncovered: group.uncovered.length });
    console.warn(`[support-tags] SUMMARY ${JSON.stringify({ scope: "registered default permutations", vanilla: counts(report.vanilla),
      modded: counts(report.modded), availableTags: Object.keys(report.tags).length, candidateTags: CANDIDATE_SUPPORT_TAGS })}`);
    for (const [tag, counts] of Object.entries(report.tags)) console.warn(`[support-tags] TAG ${tag} ${JSON.stringify(counts)}`);
    for (const group of ["vanilla", "modded"]) {
      for (const category of ["untagged", "uncovered"]) {
        const ids = report[group][category];
        for (let start = 0; start < ids.length; start += 12)
          console.warn(`[support-tags] ${category.toUpperCase()}_${group.toUpperCase()} ${JSON.stringify(ids.slice(start, start + 12))}`);
      }
      for (const error of report[group].unresolved) console.warn(`[support-tags] UNRESOLVED ${JSON.stringify(error)}`);
    }
    const examples = new Set(["minecraft:stone", "minecraft:deepslate", "minecraft:glass", "minecraft:ice", "minecraft:slime",
      "minecraft:honey_block", "minecraft:white_wool", "minecraft:oak_planks", "minecraft:chest", "minecraft:bedrock", "minecraft:dirt", "minecraft:grass_block"]);
    for (const record of records) if (examples.has(record.id) || !record.id.startsWith("minecraft:") && record.id.endsWith("_planks"))
      console.warn(`[support-tags] SAMPLE ${JSON.stringify(record)}`);
    player.sendMessage(message("probe.tags_done", report.vanilla.resolved, report.vanilla.untagged.length, report.vanilla.uncovered.length));
  } finally { tagAuditRunning = false; }
}

function trace(kind, block, detail = {}) {
  if (!active || block.dimension.id !== active.dimension.id) return;
  const p = block.location;
  if (!inside(p, active.origin)) return;
  const entry = { tick: system.currentTick, test: active.test, kind, position: { ...p }, ...detail };
  active.traces.push(entry);
  console.log(`[support-probe] ${JSON.stringify(entry)}`);
}
function inside(p, origin) {
  return p.x >= origin.x && p.x <= origin.x + 6 && p.y >= origin.y && p.y <= origin.y + 6 && p.z >= origin.z && p.z <= origin.z + 6;
}
system.beforeEvents.startup.subscribe(({ blockComponentRegistry }) => {
  // Placement-only hypothesis: item defaults admit all clicked faces; save the
  // real clicked face before enabling its strict native survival permutation.
  // This component never removes blocks, spawns drops or handles pistons.
  blockComponentRegistry.registerCustomComponent("lothlorien:support_probe_bind", {
    beforeOnPlayerPlace(event) {
      const face = String(event.face).toLowerCase();
      if (!NORMAL[face]) { event.cancel = true; return; }
      event.permutationToPlace = event.permutationToPlace.withState("minecraft:block_face", face)
        .withState("lothlorien:probe_bound", true);
      if (!active) console.warn(`[support-place] BIND ${JSON.stringify({ face, type: event.permutationToPlace.type.id,
        states: event.permutationToPlace.getAllStates() })}`);
    },
  });
  blockComponentRegistry.registerCustomComponent("lothlorien:support_probe_trace", {
    beforeOnPlayerPlace(event) {
      if (!active) console.warn(`[support-place] BEFORE ${JSON.stringify({ face: event.face,
        type: event.permutationToPlace.type.id, states: event.permutationToPlace.getAllStates() })}`);
    },
    onPlace({ block }) {
      trace("place", block, { type: block.typeId });
      if (!active) console.warn(`[support-place] PLACED ${JSON.stringify({ type: block.typeId,
        position: block.location, states: block.permutation.getAllStates() })}`);
    },
    onBreak({ block, brokenBlockPermutation }) {
      trace("break", block, { type: brokenBlockPermutation.type.id });
    },
  });
  blockComponentRegistry.registerCustomComponent("lothlorien:support_probe_script", {
    beforeOnPlayerPlace(event) {
      const normal = NORMAL[String(event.face).toLowerCase()];
      if (!normal) { event.cancel = true; return; }
      try {
        const support = event.dimension.getBlock(add(event.block.location, normal, -1));
        if (!support || support.isAir || support.isLiquid || support.typeId === "minecraft:moving_block") {
          event.cancel = true; return;
        }
        handProbeToken = handProbeToken % 15 + 1;
        event.permutationToPlace = event.permutationToPlace.withState("lothlorien:probe_token", handProbeToken);
      } catch { event.cancel = true; }
    },
    onTick: scriptPrototype.onTick,
  });
});
world.afterEvents.pistonActivate.subscribe(event => {
  if (!active || event.dimension.id !== active.dimension.id || !inside(event.block.location, active.origin)) return;
  scriptPrototype.onPiston(event).catch(error => console.warn(`[support-script] ERROR ${error.message}`));
  try {
    const piston = event.piston;
    trace("piston", event.block, { expanding: event.isExpanding, state: piston.state, moving: piston.isMoving,
      attached: piston.getAttachedBlocksLocations().map(p => ({ ...p })) });
    const context = active;
    const test = active.test;
    const p = { ...event.block.location };
    for (const delay of [1, 2, 4, 8]) system.runTimeout(() => {
      if (active !== context || active.test !== test) return;
      const b = context.dimension.getBlock(p);
      try {
        const component = b?.getComponent("minecraft:piston");
        trace("piston-later", b, { delay, state: component?.state, moving: component?.isMoving,
          attached: component?.getAttachedBlocksLocations().map(q => ({ ...q })) });
      } catch (error) { console.warn(`[support-probe] trace: ${error.message}`); }
    }, delay);
  } catch (error) { console.warn(`[support-probe] piston: ${error.message}`); }
});

function blockAt(p) {
  const b = active.dimension.getBlock(p);
  if (!b) throw new Error(`Unavailable block at ${key(p)}`);
  return b;
}
function put(p, id, states) {
  if (!inside(p, active.origin)) throw new Error("Probe attempted to leave its reserved area");
  active.cells.set(key(p), { ...p });
  blockAt(p).setPermutation(BlockPermutation.resolve(id, states));
}
function itemCount(itemId = "minecraft:stick") {
  return active.dimension.getEntities({ type: "minecraft:item", location: active.center, maxDistance: 6 })
    .reduce((n, entity) => {
      const item = entity.getComponent("minecraft:item")?.itemStack;
      return n + (item?.typeId === itemId ? item.amount : 0);
    }, 0);
}
async function clean(keepFloor = true) {
  active.scriptSuspended = true;
  active.scriptNextToken = 0;
  scriptPrototype.reset();
  // Only this experiment's known block types in its initially empty volume.
  const allowed = new Set(["minecraft:air", "minecraft:stone", "minecraft:slime", "minecraft:redstone_block",
    "minecraft:piston", "minecraft:sticky_piston", "minecraft:piston_arm_collision", "minecraft:sticky_piston_arm_collision", "minecraft:redstone_wire",
    ...VARIANTS.map(name => NS + name), ...FIXTURES, ...COMPAT_SUPPORTS]);
  for (const p of active.volume) {
    const block = blockAt(p);
    if (!allowed.has(block.typeId)) throw new Error(`Unexpected block ${block.typeId} at ${key(p)}; cleanup stopped`);
  }
  // Turn power off and allow every piston to settle before clearing the rig.
  for (const p of active.volume) if (blockAt(p).typeId === "minecraft:redstone_block") blockAt(p).setType("minecraft:air");
  await pause(12);
  for (const entity of active.dimension.getEntities({ type: "minecraft:item", location: active.center, maxDistance: 6 })) {
    if (["minecraft:stick", "minecraft:redstone"].includes(entity.getComponent("minecraft:item")?.itemStack.typeId)) entity.remove();
  }
  for (const p of active.volume) {
    const block = blockAt(p);
    if (!allowed.has(block.typeId)) throw new Error(`Unexpected block during cleanup at ${key(p)}`);
    if (!block.isAir) block.setType("minecraft:air");
  }
  active.cells.clear();
  // A catch floor keeps the diagnostic loot within range for counting/cleanup.
  if (keepFloor) for (let x = 0; x < 7; x++) for (let z = 0; z < 7; z++) {
    put(add(active.origin, { x, y: 0, z }), "minecraft:stone");
  }
  await pause(2);
  active.scriptSuspended = false;
}
class Inconclusive extends Error {}

async function settle(p, expectedState) {
  for (let attempt = 0; attempt < 30; attempt++) {
    await pause(1);
    const piston = blockAt(p).getComponent("minecraft:piston");
    if (attempt >= 9 && piston && !piston.isMoving && (!expectedState || piston.state === expectedState)) return;
  }
  throw new Inconclusive(`Piston did not reach ${expectedState || "a settled state"} within 30 ticks at ${key(p)}`);
}
async function calibrate() {
  const samples = [];
  for (let state = 0; state < 6; state++) {
    await clean();
    active.test = `calibration/${state}`;
    put(active.center, "minecraft:piston", { facing_direction: state });
    // Opposite power sources keep the piston powered whichever way its head
    // moves, including when it pushes one of the power sources.
    put(add(active.center, NORMAL.east), "minecraft:redstone_block");
    put(add(active.center, NORMAL.west), "minecraft:redstone_block");
    await settle(active.center, BlockPistonState.Expanded);
    const heads = Object.entries(NORMAL)
      .filter(([, normal]) => HEADS.has(blockAt(add(active.center, normal)).typeId))
      .map(([face]) => face);
    const sample = { state, heads };
    samples.push(sample);
    console.log(`[support-probe] CALIBRATION ${JSON.stringify(sample)}`);
  }
  active.facing = calibratedFacing(samples);
  console.log(`[support-probe] FACING ${JSON.stringify(active.facing)}`);
  await clean();
}
async function extended(p, axis) {
  await settle(p, BlockPistonState.Expanded);
  if (!HEADS.has(blockAt(add(p, axis)).typeId)) {
    throw new Inconclusive(`Piston head is not on the expected side of ${key(p)}`);
  }
}
function probe(p, variant, face) {
  const states = { "minecraft:block_face": face, "minecraft:cardinal_direction": "north" };
  // Programmatic placement bypasses the player placement callback. Test the
  // resulting strict native permutation directly; hand placement is separate.
  if (BOUND_VARIANTS.includes(variant)) states["lothlorien:probe_bound"] = true;
  if (variant === "scripted") states["lothlorien:probe_token"] = ++active.scriptNextToken;
  put(p, NS + variant, states);
  return states["lothlorien:probe_token"];
}
function assert(condition, message, details) {
  if (!condition) {
    const error = new Error(message);
    if (details) error.details = details;
    throw error;
  }
}
function snapshot(p) {
  const block = blockAt(p);
  return { position: p, type: block.typeId, states: block.permutation.getAllStates(), tags: block.permutation.getTags() };
}
function logSummary(summary) {
  // The owner's Creator Log showed warnings only, hiding console.log results.
  console.warn(`[support-probe] SUMMARY ${JSON.stringify({ revision: summary.revision || 1,
    mode: summary.mode, variants: summary.variants, ...summarizeCases(summary.results), facing: summary.facing,
    groups: reportGroups(summary.results).map(({ label, total, passed, failed, inconclusive }) => ({ label, total, passed, failed, inconclusive })) })}`);
}
function showReport(player, summary, all = false) {
  const counts = summarizeCases(summary.results);
  player.sendMessage(message("probe.summary", counts.passed, counts.failed, counts.inconclusive, counts.total));
  if (all) {
    for (const result of summary.results) player.sendMessage(message("probe.result", result.label,
      message(`probe.${caseStatus(result)}`)));
  } else {
    for (const group of reportGroups(summary.results)) {
      if (group.results.length === 1) player.sendMessage(message("probe.result", group.label,
        message(`probe.${caseStatus(group.results[0])}`)));
      else player.sendMessage(message("probe.group", group.label, group.passed, group.failed, group.inconclusive));
    }
    player.sendMessage(message("probe.report_hint"));
  }
}
async function test(label, run) {
  await clean();
  active.test = label;
  try {
    const details = await run();
    active.results.push({ label, status: "pass", pass: true, ...details });
    console.log(`[support-probe] PASS ${label} ${JSON.stringify(details)}`);
  } catch (error) {
    const status = error instanceof Inconclusive ? "inconclusive" : "fail";
    active.results.push({ label, status, pass: false, error: error.message, ...(error.details ? { details: error.details } : {}) });
    console.warn(`[support-probe] ${status.toUpperCase()} ${label}: ${error.message}${error.details ? "; details=" + JSON.stringify(error.details) : ""}`);
  }
}

async function observeLoot(ticks = 12) {
  let drops = itemCount();
  for (let tick = 0; tick < ticks; tick++) { await pause(1); drops = Math.max(drops, itemCount()); }
  return drops;
}

async function diagnose(center) {
  // Change one filter property at a time. Every survival assertion starts
  // valid, rather than asking setPermutation to enforce player admission.
  for (const variant of DIAGNOSTIC_VARIANTS) {
    const supports = variant === "tagged" ? ["minecraft:stone"]
      : variant === "mixed_control" ? ["minecraft:stone", "minecraft:glass"]
      : ["minecraft:stone", "minecraft:glass", "lothlorien:mallorn_planks"];
    for (const support of supports) for (const cause of ["remove", "push", "pull"])
      await test(`${variant}/${support.split(":")[1]}/${cause}`, async () => {
        const axis = NORMAL.east, pos = add(center, NORMAL.up);
        const piston = add(center, axis, cause === "pull" ? -2 : -1), power = add(piston, axis, -1);
        if (cause !== "remove") {
          put(piston, cause === "pull" ? "minecraft:sticky_piston" : "minecraft:piston", { facing_direction: active.facing.east });
          if (cause === "pull") { put(power, "minecraft:redstone_block"); await extended(piston, axis); }
        }
        put(center, support); probe(pos, variant, "up"); await pause(3);
        assert(blockAt(pos).typeId === NS + variant && itemCount() === 0, "Valid baseline missing or dropped");
        if (cause === "remove") put(center, "minecraft:air");
        else {
          put(power, cause === "push" ? "minecraft:redstone_block" : "minecraft:air");
          if (cause === "push") await extended(piston, axis); else await settle(piston, BlockPistonState.Retracted);
          if (blockAt(add(center, axis, cause === "push" ? 1 : -1)).typeId !== support)
            throw new Inconclusive(`Piston did not move ${support}`);
        }
        const drops = await observeLoot();
        const details = { source: support, remaining: snapshot(pos), support: snapshot(center), drops };
        assert(blockAt(pos).isAir && drops === 1, "Expected selected-support loss to pop once", details);
        return details;
      });
    for (const replacement of ["minecraft:air", "minecraft:water", "minecraft:lava", NS + "solid", NS + "excluded"])
      await test(`${variant}/replacement-${replacement.split(":")[1]}`, async () => {
        const pos = add(center, NORMAL.up);
        // Contain fluids before creating the valid baseline, keeping setup
        // neighbor updates out of the replacement under examination.
        if (replacement === "minecraft:water" || replacement === "minecraft:lava")
          for (const face of ["down", "north", "south", "east", "west"]) put(add(center, NORMAL[face]), "minecraft:stone");
        put(center, "minecraft:stone"); probe(pos, variant, "up"); await pause(3);
        assert(blockAt(pos).typeId === NS + variant && itemCount() === 0, "Valid replacement baseline missing or dropped");
        put(center, replacement);
        const drops = await observeLoot();
        const details = { replacement, remaining: snapshot(pos), support: snapshot(center), drops };
        if (replacement === "minecraft:lava" && blockAt(pos).isAir && drops === 0) {
          const error = new Inconclusive("Probe vanished over lava without observable loot before burning");
          error.details = details; throw error;
        }
        assert(blockAt(pos).isAir && drops === 1, "Valid support replaced by invalid support did not pop once", details);
        return details;
      });
  }
  for (const variant of ["listed_movable", "hybrid_movable"])
    await test(`${variant}/destination-recheck`, async () => {
      const axis = NORMAL.east, piston = add(center, axis, -1), power = add(piston, axis, -1), dest = add(center, axis);
      const support = add(dest, NORMAL.down);
      put(add(center, NORMAL.down), "minecraft:stone"); probe(center, variant, "up");
      put(piston, "minecraft:piston", { facing_direction: active.facing.east }); await pause(3);
      assert(blockAt(center).typeId === NS + variant && itemCount() === 0, "Destination baseline missing or dropped");
      put(power, "minecraft:redstone_block"); await extended(piston, axis); await pause(20);
      assert(HEADS.has(blockAt(center).typeId), "Original cell did not become piston head");
      const native = { remaining: snapshot(dest), support: snapshot(support), drops: itemCount() };
      const passed = blockAt(dest).isAir && native.drops === 1;
      // A forced neighbor update is diagnostic evidence, never credited as a
      // native movement pass. Test whether a missing update explains retention.
      if (native.remaining.type === NS + variant) {
        put(support, "minecraft:stone"); await pause(3); put(support, "minecraft:air"); await pause(12);
      }
      const details = { native, afterForcedUpdate: snapshot(dest), finalDrops: itemCount() };
      assert(passed, "Native unsupported destination did not pop; forced update shown separately", details);
      return details;
    });
}

async function scriptedCases(center) {
  async function attachment(pos, kind, face = "up") {
    const token = kind === "scripted" ? probe(pos, "scripted", face) : undefined;
    if (kind === "vanilla") put(pos, "minecraft:redstone_wire");
    await pause(8);
    const expected = kind === "scripted" ? NS + "scripted" : "minecraft:redstone_wire";
    assert(blockAt(pos).typeId === expected && itemCount(kind === "scripted" ? "minecraft:stick" : "minecraft:redstone") === 0,
      "Attachment baseline missing or already dropped");
    if (kind === "scripted" && !scriptPrototype.has(token))
      throw new Inconclusive("Scheduled block tick did not register the pre-motion attachment; no test-side registration is used");
    return token;
  }
  const loot = kind => kind === "scripted" ? "minecraft:stick" : "minecraft:redstone";
  function details(pos, support, kind) {
    return { remaining: snapshot(pos), support: snapshot(support), drops: itemCount(loot(kind)), ...scriptPrototype.report() };
  }
  async function pushLoss(kind, face, replacement) {
    const normal = NORMAL[face], axisName = normal.x === 0 ? "east" : "south", axis = NORMAL[axisName];
    const pos = add(center, normal), chained = replacement !== "head";
    const piston = add(center, axis, chained ? -2 : -1), power = add(piston, axis, -1);
    put(piston, "minecraft:piston", { facing_direction: active.facing[axisName] });
    if (chained) put(add(center, axis, -1), replacement === "identical" ? "minecraft:stone" : "minecraft:dirt");
    put(center, "minecraft:stone");
    const token = await attachment(pos, kind, face);
    put(power, "minecraft:redstone_block"); await extended(piston, axis); await pause(12);
    if (blockAt(add(center, axis)).typeId !== "minecraft:stone") throw new Inconclusive("Support did not move to its destination");
    const expected = replacement === "head" ? "minecraft:piston_arm_collision"
      : replacement === "identical" ? "minecraft:stone" : "minecraft:dirt";
    if (blockAt(center).typeId !== expected) throw new Inconclusive(`Expected replacement ${expected}, got ${blockAt(center).typeId}`);
    const result = details(pos, center, kind);
    assert(blockAt(pos).isAir && result.drops === 1, "Original support departure did not detach exactly once", result);
    if (kind === "scripted") assert(result.repairs.length === 1 && result.repairs[0].token === token
      && result.repairs[0].reason === "support-departed", "Departure must be handled by the event, not final-invalid polling", result);
    return result;
  }
  for (const kind of ["vanilla", "scripted"]) {
    const faces = kind === "vanilla" ? ["up"] : Object.keys(NORMAL);
    for (const face of faces) await test(`${kind}/${face}/head-departure`, () => pushLoss(kind, face, "head"));
    for (const replacement of ["ordinary", "identical"])
      await test(`${kind}/up/${replacement}-replacement`, () => pushLoss(kind, "up", replacement));
    await test(`${kind}/fresh-head-and-retract`, async () => {
      const axis = NORMAL.up, head = add(center, axis), pos = add(head, axis), power = add(center, NORMAL.west);
      put(center, "minecraft:piston", { facing_direction: active.facing.up }); put(power, "minecraft:redstone_block");
      await extended(center, axis);
      const token = await attachment(pos, kind);
      // Trigger a neighbor update after programmatic placement to establish
      // survival on the head, not just bypassed player admission.
      put(add(pos, NORMAL.east), "minecraft:stone"); put(add(pos, NORMAL.east), "minecraft:air"); await pause(8);
      assert(blockAt(pos).typeId === (kind === "scripted" ? NS + "scripted" : "minecraft:redstone_wire"),
        "Fresh attachment could not survive on an upward-facing head", details(pos, head, kind));
      put(power, "minecraft:air"); await settle(center, BlockPistonState.Retracted); await pause(12);
      const result = { token, ...details(pos, head, kind) };
      assert(blockAt(pos).isAir && result.drops === 1, "Head retraction did not detach exactly once", result);
      return result;
    });
  }
  await test("scripted/support-pull", async () => {
    const axis = NORMAL.east, piston = add(center, axis, -2), power = add(piston, axis, -1), pos = add(center, NORMAL.up);
    put(piston, "minecraft:sticky_piston", { facing_direction: active.facing.east });
    put(power, "minecraft:redstone_block"); await extended(piston, axis);
    put(center, "minecraft:stone"); await attachment(pos, "scripted");
    put(power, "minecraft:air"); await settle(piston, BlockPistonState.Retracted); await pause(12);
    if (blockAt(add(center, axis, -1)).typeId !== "minecraft:stone") throw new Inconclusive("Sticky piston did not pull support");
    const result = details(pos, center, "scripted");
    assert(blockAt(pos).isAir && result.drops === 1, "Pulled support did not detach exactly once", result);
    return result;
  });
  for (const supported of [true, false]) await test(`scripted/direct-${supported ? "supported" : "unsupported"}`, async () => {
    const axis = NORMAL.east, piston = add(center, axis, -1), power = add(piston, axis, -1), dest = add(center, axis);
    put(add(center, NORMAL.down), "minecraft:stone");
    if (supported) put(add(dest, NORMAL.down), "minecraft:stone");
    put(piston, "minecraft:piston", { facing_direction: active.facing.east });
    const token = await attachment(center, "scripted");
    put(power, "minecraft:redstone_block"); await extended(piston, axis); await pause(12);
    const result = { token, ...details(dest, add(dest, NORMAL.down), "scripted") };
    assert(HEADS.has(blockAt(center).typeId), "Original attachment cell did not become piston head", result);
    if (supported) assert(blockAt(dest).typeId === NS + "scripted" && blockAt(dest).permutation.getState("lothlorien:probe_token") === token
      && result.drops === 0 && result.repairs.length === 0, "Supported relocation did not preserve the attachment", result);
    else assert(blockAt(dest).isAir && result.drops === 1 && result.repairs.length === 1,
      "Unsupported relocation was not repaired exactly once", result);
    return result;
  });
  await test("scripted/slime-assembly", async () => {
    const axis = NORMAL.east, piston = add(center, axis, -1), power = add(piston, axis, -1), pos = add(center, NORMAL.up), dest = add(pos, axis);
    put(center, "minecraft:slime"); put(piston, "minecraft:piston", { facing_direction: active.facing.east });
    const token = await attachment(pos, "scripted");
    put(power, "minecraft:redstone_block"); await extended(piston, axis); await pause(12);
    if (blockAt(add(center, axis)).typeId !== "minecraft:slime") throw new Inconclusive("Slime support did not move");
    const result = { token, ...details(dest, add(center, axis), "scripted") };
    assert(blockAt(dest).typeId === NS + "scripted" && blockAt(dest).permutation.getState("lothlorien:probe_token") === token
      && result.drops === 0 && result.repairs.length === 0, "Allowed intact assembly did not survive", result);
    return result;
  });
  await test("scripted/stationary-guard", async () => {
    const axis = NORMAL.east, piston = add(center, axis, -1), power = add(piston, axis, -1);
    const pos = add(center, NORMAL.up), guard = add(piston, NORMAL.up);
    put(piston, "minecraft:piston", { facing_direction: active.facing.east }); put(center, "minecraft:stone");
    const token = await attachment(pos, "scripted"), guardToken = await attachment(guard, "scripted");
    put(power, "minecraft:redstone_block"); await extended(piston, axis); await pause(12);
    const result = { token, guardToken, guard: snapshot(guard), ...details(pos, center, "scripted") };
    assert(blockAt(pos).isAir && result.drops === 1 && result.repairs.length === 1 && result.repairs[0].token === token,
      "Moving support attachment was not removed exactly once", result);
    assert(blockAt(guard).typeId === NS + "scripted" && blockAt(guard).permutation.getState("lothlorien:probe_token") === guardToken,
      "Attachment on stationary piston body was wrongly removed", result);
    return result;
  });
}

async function run(player, mode = "listed") {
  const dimension = player.dimension;
  const origin = { x: Math.floor(player.location.x) + 8, y: Math.floor(player.location.y) + 1, z: Math.floor(player.location.z) - 3 };
  const center = add(origin, { x: 3, y: 3, z: 3 });
  const volume = [];
  for (let x = 0; x < 7; x++) for (let y = 0; y < 7; y++) for (let z = 0; z < 7; z++) {
    const p = add(origin, { x, y, z });
    const block = dimension.getBlock(p);
    if (!block?.isAir) throw new Error(`Needs a loaded empty 7x7x7 area starting at ${key(origin)}; blocked at ${key(p)}`);
    volume.push(p);
  }
  if (dimension.getEntities({ location: center, maxDistance: 7 }).length) throw new Error("Move entities/items out of the test area first");
  active = { dimension, origin, center, volume, mode, cells: new Map(), results: [], traces: [], test: "setup" };
  world.setDynamicProperty(RESULT_PROPERTY, undefined);
  player.sendMessage(message("probe.started", key(origin)));
  try {
    await calibrate();
    const variants = mode === "original" ? ORIGINAL_VARIANTS : mode === "filters" ? FILTER_VARIANTS
      : mode === "compat" ? COMPAT_VARIANTS : mode === "diagnose" ? DIAGNOSTIC_VARIANTS : mode === "script" ? ["scripted", "vanilla-dust"] : LISTED_VARIANTS;
    if (mode === "script") await scriptedCases(center);
    else if (mode === "diagnose") await diagnose(center);
    else {
    const movingVariants = variants.filter(variant => variant.endsWith("movable"));
    for (const variant of variants) for (const [face, normal] of Object.entries(NORMAL)) {
      const pos = add(center, normal);
      const axisName = normal.x === 0 ? "east" : "south";
      const axis = NORMAL[axisName];
      for (const cause of (mode === "compat" ? ["push", "pull"] : ["remove", "push", "pull", "decoy"])) await test(`${variant}/${face}/${cause}`, async () => {
        const pistonPos = add(center, axis, cause === "pull" ? -2 : -1);
        const powerPos = add(center, axis, cause === "pull" ? -3 : -2);
        if (cause === "push" || cause === "pull") {
          put(pistonPos, cause === "pull" ? "minecraft:sticky_piston" : "minecraft:piston", { facing_direction: active.facing[axisName] });
          if (cause === "pull") { put(powerPos, "minecraft:redstone_block"); await extended(pistonPos, axis); }
        }
        put(center, "minecraft:stone");
        if (cause === "decoy") put(add(pos, axis), "minecraft:stone");
        probe(pos, variant, face);
        await pause(3);
        assert(blockAt(pos).typeId === NS + variant, "Baseline probe did not survive on stone");
        assert(itemCount() === 0, "Baseline unexpectedly produced an item");
        if (cause === "push") put(powerPos, "minecraft:redstone_block");
        else if (cause === "pull") put(powerPos, "minecraft:air");
        else put(center, "minecraft:air");
        if (cause === "push" || cause === "pull") {
          if (cause === "push") await extended(pistonPos, axis);
          else await settle(pistonPos, BlockPistonState.Retracted);
          if (blockAt(add(center, axis, cause === "pull" ? -1 : 1)).typeId !== "minecraft:stone") {
            throw new Inconclusive("Piston did not move the support");
          }
        } else await pause(12);
        const remaining = blockAt(pos).typeId;
        const drops = itemCount();
        const details = { remaining, drops, support: snapshot(center) };
        // Decoy must not count as the support selected by the mounting-face state.
        assert(remaining === "minecraft:air", `Attached block remained (${remaining}); drops=${drops}`);
        assert(drops === 1, `Expected one stick from native destruction, got ${drops}`);
        return details;
      });
    }
    for (const variant of variants) await test(`${variant}/direct-push`, async () => {
      const axis = NORMAL.east, piston = add(center, axis, -1), power = add(center, axis, -2), dest = add(center, axis);
      put(add(center, NORMAL.down), "minecraft:stone");
      put(add(dest, NORMAL.down), "minecraft:stone");
      probe(center, variant, "up");
      put(piston, "minecraft:piston", { facing_direction: active.facing.east });
      await pause(3);
      assert(blockAt(center).typeId === NS + variant, "Baseline direct-push probe missing");
      put(power, "minecraft:redstone_block");
      await extended(piston, axis);
      const result = { original: snapshot(center), destination: snapshot(dest), drops: itemCount() };
      if (variant.endsWith("movable")) {
        assert(result.destination.type === NS + variant, "Movable probe failed to reach supported destination");
        assert(result.destination.states["minecraft:block_face"] === "up", "Mounting state changed during movement");
        if (BOUND_VARIANTS.includes(variant)) assert(result.destination.states["lothlorien:probe_bound"] === true,
          "Mount binding state changed during direct movement");
        assert(result.drops === 0, "Movable probe dropped despite valid destination support");
      } else {
        assert(result.destination.type !== NS + variant && result.original.type !== NS + variant, "Popped probe remained/moved");
        assert(result.drops === 1, "Popped probe did not drop exactly once");
      }
      return result;
    });
    for (const movingVariant of movingVariants) await test(`${movingVariant}/slime-assembly`, async () => {
      const axis = NORMAL.east, piston = add(center, axis, -1), power = add(center, axis, -2);
      const pos = add(center, NORMAL.up), dest = add(pos, axis);
      put(center, "minecraft:slime");
      probe(pos, movingVariant, "up");
      put(piston, "minecraft:piston", { facing_direction: active.facing.east });
      await pause(3);
      assert(blockAt(pos).typeId === NS + movingVariant, "Baseline slime probe missing");
      put(power, "minecraft:redstone_block");
      await extended(piston, axis);
      const result = { destination: snapshot(dest), support: snapshot(add(center, axis)), drops: itemCount() };
      if (result.support.type !== "minecraft:slime") throw new Inconclusive("Slime support did not move");
      assert(result.destination.type === NS + movingVariant, "Attachment did not travel with slime and survive");
      assert(result.destination.states["minecraft:block_face"] === "up" && result.drops === 0, "State lost or spurious drop during assembly movement");
      if (BOUND_VARIANTS.includes(movingVariant)) assert(result.destination.states["lothlorien:probe_bound"] === true,
        "Mount binding state changed during assembly movement");
      return result;
    });
    if (mode === "filters") {
      // Previously verified native rule as a current-run engine/loot control.
      for (const cause of ["remove", "push", "pull"]) await test(`listed/control-${cause}`, async () => {
        const pos = add(center, NORMAL.up), axis = NORMAL.east;
        const piston = add(center, axis, cause === "pull" ? -2 : -1);
        const power = add(piston, axis, -1);
        if (cause !== "remove") {
          put(piston, cause === "pull" ? "minecraft:sticky_piston" : "minecraft:piston", { facing_direction: active.facing.east });
          if (cause === "pull") { put(power, "minecraft:redstone_block"); await extended(piston, axis); }
        }
        put(center, "minecraft:stone"); probe(pos, "listed", "up"); await pause(3);
        assert(blockAt(pos).typeId === NS + "listed" && itemCount() === 0, "Control baseline missing or dropped");
        if (cause === "remove") { put(center, "minecraft:air"); await pause(12); }
        else {
          put(power, cause === "push" ? "minecraft:redstone_block" : "minecraft:air");
          if (cause === "push") await extended(piston, axis); else await settle(piston, BlockPistonState.Retracted);
          if (blockAt(add(center, axis, cause === "push" ? 1 : -1)).typeId !== "minecraft:stone")
            throw new Inconclusive("Control support did not move");
        }
        assert(blockAt(pos).isAir && itemCount() === 1, "Explicit-list control did not pop with one stick");
        return { drops: itemCount() };
      });
    }
    if (mode === "filters" || mode === "compat") {
      const supports = mode === "compat" ? COMPAT_SUPPORTS : ["minecraft:stone", "minecraft:slime", ...FIXTURES, "minecraft:air"];
      const eligibilityVariants = mode === "compat" ? COMPAT_VARIANTS : ["constant", "negative"];
      for (const variant of eligibilityVariants) for (const support of supports)
        await test(`${variant}/eligibility-${support.split(":")[1]}`, async () => {
          const pos = add(center, NORMAL.up);
          // Contain fluid fixtures entirely inside the reserved volume.
          if (support === "minecraft:water" || support === "minecraft:lava")
            for (const face of ["down", "north", "south", "east", "west"]) put(add(center, NORMAL[face]), "minecraft:stone");
          put(center, support); probe(pos, variant, "up");
          // Observe lava loot before it burns; disappearance later is not proof
          // that native destruction failed to spawn the diagnostic stick.
          let observedDrops = 0;
          if (support === "minecraft:lava") {
            for (let tick = 0; tick < 12; tick++) {
              await pause(1);
              observedDrops = Math.max(observedDrops, itemCount());
            }
          } else await pause(12);
          const rejected = support === "minecraft:air" || support === "minecraft:water" || support === "minecraft:lava"
            || variant === "negative" && support === NS + "excluded"
            || mode === "compat" && (support === NS + "solid" || support === NS + "excluded");
          const baseline = snapshot(pos), drops = support === "minecraft:lava" ? observedDrops : itemCount();
          if (rejected) {
            if (support === "minecraft:lava" && baseline.type === "minecraft:air" && drops === 0)
              throw new Inconclusive("Probe vanished over lava, but no stick was observed before possible burning");
            assert(baseline.type === "minecraft:air" && drops === 1,
              `Expected invalid support to pop once; probe=${baseline.type}, drops=${drops}`);
          } else {
            assert(baseline.type === NS + variant && drops === 0, `Valid support rejected: ${support}; drops=${drops}`);
            put(center, "minecraft:air"); await pause(12);
            assert(blockAt(pos).isAir && itemCount() === 1, `Support ${support} removal did not pop once`);
          }
          return { support, rejected, baseline, drops, final: snapshot(pos), finalDrops: itemCount() };
        });
      for (const variant of (mode === "compat" ? ["hybrid_movable"] : ["constant_movable", "negative_movable"]))
        await test(`${variant}/unsupported-destination`, async () => {
          const axis = NORMAL.east, piston = add(center, axis, -1), power = add(piston, axis, -1), dest = add(center, axis);
          put(add(center, NORMAL.down), "minecraft:stone"); probe(center, variant, "up");
          put(piston, "minecraft:piston", { facing_direction: active.facing.east }); await pause(3);
          assert(blockAt(center).typeId === NS + variant && itemCount() === 0, "Destination-test baseline missing or dropped");
          put(power, "minecraft:redstone_block"); await extended(piston, axis);
          assert(HEADS.has(blockAt(center).typeId), "Original cell did not become piston head");
          assert(blockAt(dest).isAir && itemCount() === 1,
            `Unsupported destination retained ${blockAt(dest).typeId}; drops=${itemCount()}`);
          return { destination: snapshot(dest), drops: itemCount() };
        });
    }
    }
    await clean(false);
    const summary = { revision: mode === "script" ? 8 : mode === "diagnose" ? 6 : mode === "compat" ? 5 : mode === "filters" ? 4 : 3, mode, variants, date: mode === "script" ? "2026-10-09" : "2026-10-08", api: "2.8.0", origin, facing: active.facing,
      ...summarizeCases(active.results), results: active.results };
    world.setDynamicProperty(RESULT_PROPERTY, JSON.stringify(summary));
    console.log(`[support-probe] RESULTS ${JSON.stringify(summary)}`);
    logSummary(summary);
    showReport(player, summary);
  } finally { active = undefined; }
}

system.afterEvents.scriptEventReceive.subscribe(event => {
  if (event.id !== "lothlorien:support_probe") return;
  const player = event.sourceEntity;
  if (player?.typeId !== "minecraft:player") return;
  const command = event.message.trim();
  if (command === "tags") {
    if (active || tagAuditRunning) { player.sendMessage(message("probe.busy")); return; }
    auditTags(player).catch(error => console.warn(`[support-tags] ABORT ${error.stack || error.message}`));
    return;
  }
  if (command === "report" || command === "report all") {
    const raw = world.getDynamicProperty(RESULT_PROPERTY);
    if (typeof raw !== "string") { player.sendMessage(message("probe.empty")); return; }
    console.log(`[support-probe] RESULTS ${raw}`);
    const summary = JSON.parse(raw);
    logSummary(summary);
    // Creator Log can hide info-level output. Retrieval repeats every stored
    // verdict and error at the same visible level as the existing FAIL lines.
    for (const result of summary.results) console.warn(`[support-probe] ${caseStatus(result).toUpperCase()} ${result.label}: ${result.error || JSON.stringify(result)}${result.details ? "; details=" + JSON.stringify(result.details) : ""}`);
    showReport(player, summary, command === "report all");
    return;
  }
  if (active || tagAuditRunning) { player.sendMessage(message("probe.busy")); return; }
  run(player, ["original", "filters", "compat", "diagnose", "script"].includes(command) ? command : "listed").catch(error => {
    console.warn(`[support-probe] ABORT ${error.stack || error.message}`);
    player.sendMessage(message("probe.aborted"));
  });
});
