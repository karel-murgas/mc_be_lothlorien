import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createSupportMotionService } from "../lothlorien_bp/scripts/support_motion_service.js";
import { SUPPORT_POLICIES } from "../lothlorien_bp/scripts/support_policies.js";

const key = p => `${p.x},${p.y},${p.z}`;
const P = { x: 0, y: 0, z: 0 }, S = { x: 1, y: 0, z: 0 }, A = { x: 1, y: 1, z: 0 };
function rig(options = {}) {
  let tick = 0;
  const cells = new Map(), scheduled = [], drops = [], gone = [], settled = [], errors = [];
  const dimension = { id: "test" }, piston = { isMoving: true, getAttachedBlocksLocations: () => [S] };
  const put = (p, type, support = S, face = "up") => {
    const block = { typeId: type, location: { ...p }, dimension, support, face,
      isAir: type === "minecraft:air", isLiquid: type === "minecraft:water", getComponent: () => piston };
    cells.set(key(p), block); return block;
  };
  const read = (d, p) => cells.get(key(p));
  const service = createSupportMotionService({ now: () => tick,
    schedule: (fn, delay) => scheduled.push({ at: tick + delay, fn }), read,
    describe: b => b?.typeId === "attachment" ? { identity: `${b.typeId}|${b.face}`,
      supports: [{ position: b.support, valid: s => !s.isAir && !s.isLiquid }] } : undefined,
    remove: (b, r, reason) => { drops.push(reason); put(b.location, "minecraft:air"); },
    onGone: (d, r) => gone.push(r.position), onSettled: (d, p) => settled.push(p),
    warn: e => errors.push(e), ...options });
  const advance = n => { for (let i = 0; i < n; i++) {
    tick++; const due = scheduled.filter(s => s.at <= tick);
    for (const job of due) { scheduled.splice(scheduled.indexOf(job), 1); job.fn(); }
  } };
  put(P, "minecraft:piston"); put(S, "minecraft:stone");
  const attachment = put(A, "attachment"); service.observe(attachment);
  const activate = () => service.onPiston({ dimension, position: P, axis: { x: 1, y: 0, z: 0 }, isExpanding: true, piston });
  const finish = () => { piston.isMoving = false; advance(12); };
  return { put, service, activate, finish, advance, cells, drops, gone, settled, errors, dimension, attachment, piston };
}

// Preserve the old support when a scheduled callback precedes pistonActivate.
{
  const r = rig(); r.put(S, "minecraft:piston_arm_collision"); r.service.observe(r.attachment);
  r.activate(); r.finish(); assert.deepEqual(r.drops, ["support-departed"]);
}
// A moving placeholder witnesses even a same-type replacement.
{
  const r = rig(); r.put(S, "minecraft:moving_block"); r.activate();
  r.put(S, "minecraft:stone"); r.finish(); assert.equal(r.drops.length, 1);
}
// A stationary neighbouring piston body is not evidence of support departure.
{
  const r = rig(); r.activate(); r.finish(); assert.equal(r.drops.length, 0);
}
// Two local piston jobs share one relationship and cannot duplicate drops.
{
  const r = rig(); r.put(S, "minecraft:moving_block"); r.activate(); r.activate();
  r.put(S, "minecraft:stone"); r.finish(); assert.equal(r.drops.length, 1);
}
// A motion elsewhere does not suspend current invalid-support recovery.
{
  const r = rig(); r.activate(); const far = { x: 100, y: 1, z: 0 }, soil = { x: 100, y: 0, z: 0 };
  r.put(soil, "minecraft:stone"); const b = r.put(far, "attachment", soil); r.service.observe(b);
  r.put(soil, "minecraft:air"); r.service.observe(b); r.advance(3);
  assert.deepEqual(r.drops, ["invalid-support"]); r.finish(); assert.equal(r.drops.length, 1);
}
// An ordinary support edit becomes the baseline, rather than contaminating a later job.
{
  const r = rig(); r.put(S, "minecraft:dirt"); r.service.observe(r.attachment); r.advance(3);
  r.activate(); r.finish(); assert.equal(r.drops.length, 0);
}
// Native destruction retires a relationship; callbacks cannot destroy a replacement generation.
{
  const r = rig(); r.put(S, "minecraft:moving_block"); r.activate();
  r.service.invalidate(r.dimension, A); r.put(S, "minecraft:stone");
  r.service.observe(r.put(A, "attachment"), { reset: true }); r.finish(); assert.equal(r.drops.length, 0);
}
{
  const r = rig(); r.activate(); r.put(A, "minecraft:air"); r.finish();
  assert.equal(r.drops.length, 0); assert.equal(r.gone.length, 1);
}
// Unloaded support cells are unknown; an unresolved piston times out without destruction.
{
  const r = rig(); r.cells.delete(key(S)); r.service.observe(r.attachment); r.activate(); r.advance(45);
  assert.equal(r.drops.length, 0); assert.equal(r.settled.length, 0);
}
// Callback failure cannot leave the remaining job records locked forever.
// Known departure remains actionable after a timeout until local reads settle.
{
  const r = rig(); r.put(S, "minecraft:moving_block"); r.activate(); r.advance(45);
  r.service.observe(r.attachment); assert.equal(r.drops.length, 0);
  r.put(S, "minecraft:stone"); r.service.observe(r.attachment);
  assert.deepEqual(r.drops, ["deferred-support-departed"]);
  r.piston.isMoving = false; r.activate(); r.finish(); assert.equal(r.drops.length, 1);
}
// A settling job with an unloaded support preserves its original relationship.
{
  const r = rig(); r.activate(); r.cells.delete(key(S)); r.finish();
  r.put(S, "minecraft:piston_arm_collision"); r.service.observe(r.attachment);
  r.activate(); r.finish(); assert.deepEqual(r.drops, ["support-departed"]);
}
// Reset with a moving support must preserve the old known support as well.
{
  const r = rig(); r.put(S, "minecraft:moving_block");
  r.service.observe(r.attachment, { reset: true }); r.activate();
  r.put(S, "minecraft:stone"); r.finish(); assert.equal(r.drops.length, 1);
}
{
  const r = rig({ remove: () => { throw new Error("device cleanup failed"); } });
  r.put(S, "minecraft:moving_block"); r.activate(); r.put(S, "minecraft:stone"); r.finish();
  assert.equal(r.errors.length, 1); assert.equal(r.settled.length, 1);
}
for (const [id, policy] of Object.entries(SUPPORT_POLICIES)) {
  const block = JSON.parse(readFileSync(new URL(`../lothlorien_bp/blocks/${id.split(":")[1]}.json`, import.meta.url)))["minecraft:block"];
  assert.equal(block.components["minecraft:movable"].movement_type, "popped", id);
  assert.ok(block.components["lothlorien:motion_support"], id);
  assert.ok(block.components["minecraft:tick"].looping, id);
  if (policy.allowed) assert.deepEqual(policy.allowed, block.components["minecraft:placement_filter"].conditions[0].block_filter);
}
for (const name of ["mallorn_leaf_carpet", "mallorn_blossom"]) for (let amount = 1; amount <= 4; amount++) {
  const suffix = amount === 1 ? "" : `_${amount}`;
  const loot = JSON.parse(readFileSync(new URL(`../lothlorien_bp/loot_tables/blocks/${name}${suffix}.json`, import.meta.url)));
  assert.equal(loot.pools[0].entries[0].functions[0].count, amount);
}
console.log("ok   production support motion: ordering, identical replacements, concurrent jobs, ordinary edits, cold/unloaded cells, lifecycle, callbacks and real loot");
