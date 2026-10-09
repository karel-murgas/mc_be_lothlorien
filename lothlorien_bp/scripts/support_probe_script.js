// TEMPORARY proof of support-motion handling. Not a production support service.
// Only the caller's active reserved rig is eligible for indexing or mutation.
export function createSupportScriptPrototype({ context, pause, normals, inside, warn }) {
  const ID = "lothlorien:support_probe_scripted";
  const TOKEN = "lothlorien:probe_token";
  const HEADS = new Set(["minecraft:piston_arm_collision", "minecraft:sticky_piston_arm_collision"]);
  const key = p => `${p.x},${p.y},${p.z}`;
  const add = (p, d, n = 1) => ({ x: p.x + d.x * n, y: p.y + d.y * n, z: p.z + d.z * n });
  let records = new Map(), repairs = [], motions = [], generation = 0, running = 0;
  function read(ctx, p) {
    if (!inside(p, ctx.origin)) return undefined;
    try { return ctx.dimension.getBlock(p); } catch { return undefined; }
  }
  function supportPosition(block) {
    const normal = normals[block.permutation.getState("minecraft:block_face")];
    return normal ? add(block.location, normal, -1) : undefined;
  }
  function same(block, record) {
    return block?.typeId === ID && block.permutation.getState(TOKEN) === record.token
      && block.permutation.getState("minecraft:block_face") === record.face;
  }
  function remember(ctx, block, reconciled = false) {
    const support = supportPosition(block);
    if (!support) return;
    const supporting = read(ctx, support);
    if (!supporting || supporting.typeId === "minecraft:moving_block") return;
    const token = block.permutation.getState(TOKEN);
    const previous = records.get(token);
    const observed = { position: { ...block.location }, supportType: supporting.typeId };
    // A scheduled callback can observe the engine's changed cells before the
    // piston after-event is delivered. Preserve the established relationship
    // until that event reconciles it; periodic refresh must not erase history.
    if (previous && !reconciled) { previous.lastObserved = observed; return; }
    records.set(token, {
      token, face: block.permutation.getState("minecraft:block_face"),
      position: { ...block.location }, support, supportType: supporting.typeId,
      lastObserved: observed,
    });
  }
  function validity(ctx, block) {
    const support = supportPosition(block);
    const supporting = support && read(ctx, support);
    if (!supporting || supporting.typeId === "minecraft:moving_block") return "unknown";
    return supporting.isAir || supporting.isLiquid ? "invalid" : "valid";
  }
  function remove(ctx, block, record, reason) {
    // Re-read immediately before mutation. Native popping or a replacement
    // must not produce a second drop, even if multiple jobs reference it.
    const current = read(ctx, block.location);
    if (!same(current, record)) return;
    const p = current.location;
    ctx.dimension.runCommand(`setblock ${p.x} ${p.y} ${p.z} air destroy`);
    records.delete(record.token);
    const entry = { reason, token: record.token, position: { ...p } };
    repairs.push(entry);
    warn(`[support-script] DROP ${JSON.stringify(entry)}`);
  }
  function onTick({ block }) {
    const ctx = context();
    if (!ctx || block.typeId !== ID || block.dimension.id !== ctx.dimension.id || !inside(block.location, ctx.origin)) return;
    // Do not overwrite the pre-motion relationship or interpret moving cells
    // as absent support while a piston is still being observed.
    if (running) return;
    const previous = { token: block.permutation.getState(TOKEN), face: block.permutation.getState("minecraft:block_face") };
    if (validity(ctx, block) === "invalid") remove(ctx, block, previous, "tick-invalid");
    else remember(ctx, block);
  }
  async function onPiston(event) {
    const ctx = context();
    if (!ctx || event.dimension.id !== ctx.dimension.id || !inside(event.block.location, ctx.origin) || !records.size) return;
    const dir = Object.keys(normals).find(face => ctx.facing?.[face] === event.block.permutation.getState("facing_direction"));
    if (!dir) { warn("[support-script] INCONCLUSIVE missing calibrated piston direction"); return; }
    const axis = normals[dir], delta = event.isExpanding ? axis : { x: -axis.x, y: -axis.y, z: -axis.z };
    const origin = { ...event.block.location }, head = add(origin, axis);
    const frozen = [...records.values()].map(r => ({ ...r, position: { ...r.position }, support: { ...r.support } }));
    const epoch = generation, departed = new Set(), witnesses = [], candidates = new Set([key(head)]);
    const motion = { expanding: event.isExpanding, piston: origin, tracked: frozen,
      samples: 0, firstAttached: [], lastAttached: [], witnesses };
    motions.push(motion); running++;
    function sample() {
      const piston = read(ctx, origin)?.getComponent("minecraft:piston");
      let locations = [];
      try { locations = piston?.getAttachedBlocksLocations().map(p => ({ ...p })) || []; } catch { /* timing is diagnostic */ }
      const attached = locations.map(position => ({ position, type: read(ctx, position)?.typeId || "unavailable" }));
      if (!motion.samples) motion.firstAttached = attached;
      motion.lastAttached = attached; motion.samples++;
      for (const p of locations) for (const n of [-1, 0, 1]) candidates.add(key(add(p, delta, n)));
      for (const record of frozen) {
        if (departed.has(record.token)) continue;
        const current = read(ctx, record.support);
        if (!current) continue;
        // A broad candidate set alone never proves departure. Require an
        // observed moving placeholder, a new head in this piston's head cell,
        // or an actual type change at a reported candidate support position.
        const moving = current.typeId === "minecraft:moving_block";
        const newHead = key(record.support) === key(head) && HEADS.has(current.typeId) && !HEADS.has(record.supportType);
        const changed = candidates.has(key(record.support)) && current.typeId !== record.supportType;
        if (moving || newHead || changed) {
          departed.add(record.token);
          witnesses.push({ token: record.token, support: record.support, before: record.supportType, during: current.typeId, sample: motion.samples - 1 });
        }
      }
      return piston;
    }
    try {
      let settled = false;
      for (let tick = 0; tick < 40; tick++) {
        if (context() !== ctx || generation !== epoch) return;
        const piston = sample();
        if (tick >= 9 && piston && !piston.isMoving) { settled = true; break; }
        await pause(1);
      }
      if (!settled) {
        motion.unsettled = true;
        warn(`[support-script] INCONCLUSIVE piston did not settle ${JSON.stringify(motion)}`);
        return;
      }
      for (const record of frozen) {
        const original = read(ctx, record.position), destination = read(ctx, add(record.position, delta));
        if (same(original, record)) {
          if (departed.has(record.token)) remove(ctx, original, record, "support-departed");
          else if (validity(ctx, original) === "invalid") remove(ctx, original, record, "settled-invalid");
          else remember(ctx, original, true);
        } else if (same(destination, record)) {
          // This prototype deliberately allows intact supported relocation.
          // Departure of the old support does not destroy an allowed assembly.
          if (validity(ctx, destination) === "invalid") remove(ctx, destination, record, "destination-invalid");
          else remember(ctx, destination, true);
        } else {
          // Native destruction is not a script drop. Unknown destinations are
          // left for current-location ticks, rather than clearing guessed cells.
          records.delete(record.token);
        }
      }
      warn(`[support-script] MOTION ${JSON.stringify(motion)}`);
    } catch (error) {
      motion.error = String(error.message || error);
      warn(`[support-script] ERROR ${motion.error}`);
    } finally { if (generation === epoch) running--; }
  }
  return {
    onTick, onPiston,
    reset() { generation++; running = 0; records = new Map(); repairs = []; motions = []; },
    has(token) { return records.has(token); },
    report() { return { repairs: [...repairs], motions: [...motions], running }; },
  };
}
