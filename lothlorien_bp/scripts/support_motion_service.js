// Revision-8 support history, adapted to local production indexing. No world scans.
const MOVING = "minecraft:moving_block";
const HEADS = new Set(["minecraft:piston_arm_collision", "minecraft:sticky_piston_arm_collision"]);
const key = p => `${p.x},${p.y},${p.z}`;
const add = (p, a, n = 1) => ({ x: p.x + a.x * n, y: p.y + a.y * n, z: p.z + a.z * n });
const NEIGHBOURS = [{ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }, { x: -1, y: 0, z: 0 },
  { x: 0, y: 1, z: 0 }, { x: 0, y: -1, z: 0 }, { x: 0, y: 0, z: 1 }, { x: 0, y: 0, z: -1 }];

export function createSupportMotionService({ now, schedule, describe, read, remove,
  onGone = () => {}, onMove = () => {}, onSettled = () => {},
  warn = message => console.warn(message), maxRecords = 16384 }) {
  const records = new Map(), bySupport = new Map();
  const address = (dim, p) => `${dim.id}|${key(p)}`;
  function forget(record) {
    if (records.get(record.key) !== record) return;
    records.delete(record.key);
    for (const support of record.supports) {
      const k = address(record.dimension, support.position), set = bySupport.get(k);
      set?.delete(record);
      if (!set?.size) bySupport.delete(k);
    }
  }
  function snapshot(block) {
    const info = describe(block);
    if (!info) return undefined;
    return { ...info, dimension: block.dimension, position: { ...block.location },
      supports: (info.supports || []).map(s => ({ ...s, position: { ...s.position },
        type: read(block.dimension, s.position)?.typeId })) };
  }
  function matches(block, record) { return !!block && describe(block)?.identity === record.identity; }
  function validity(block) {
    const info = describe(block);
    if (!info) return undefined;
    let unknown = false, invalid = false;
    for (const support of info.supports || []) {
      const current = read(block.dimension, support.position);
      if (!current || current.typeId === MOVING) { unknown = true; continue; }
      const valid = support.valid(current);
      if (valid === false) invalid = true;
      if (valid === undefined) unknown = true;
    }
    return unknown ? undefined : !invalid;
  }
  function destroy(record, block, reason) {
    if (records.get(record.key) !== record || !matches(read(record.dimension, block.location), record)) return;
    // Invalidate before callbacks: overlapping piston jobs cannot duplicate loot.
    forget(record);
    remove(block, record, reason);
  }
  function observe(block, { reset = false } = {}) {
    const incoming = snapshot(block);
    if (!incoming) return;
    const k = address(block.dimension, block.location), previous = records.get(k);
    // Reject an unknown replacement baseline BEFORE retiring known history.
    // This also covers reset/adoption after settlement and deferred refresh.
    if (incoming.supports.some(s => !s.type || s.type === MOVING)) {
      if (previous) previous.seen = now();
      return;
    }
    // A timed-out job's witnessed departure must be reconciled before a later
    // ordinary refresh can adopt the replacement or another motion can use it.
    if (previous && !reset && previous.identity === incoming.identity &&
        !previous.pending && previous.departed && !previous.movable) {
      if (validity(block) !== undefined) destroy(previous, block, "deferred-support-departed");
      return;
    }
    if (previous && !reset && previous.identity === incoming.identity) {
      previous.seen = now();
      if (previous.pending) return;
      // A changed support observed before pistonActivate must not replace history.
      // Ordinary edits settle after a short deferred window; pistonActivate locks it.
      if (incoming.supports.some((s, i) => s.type !== previous.supports[i]?.type)) {
        if (!previous.refreshQueued) {
          previous.refreshQueued = true;
          schedule(() => {
            previous.refreshQueued = false;
            if (records.get(k) !== previous || previous.pending) return;
            const current = read(previous.dimension, previous.position);
            if (!matches(current, previous)) { forget(previous); return; }
            if (validity(current) === false) destroy(previous, current, "invalid-support");
            else observe(current, { reset: true });
          }, 3);
        }
        return;
      }
      if (validity(block) === false) destroy(previous, block, "invalid-support");
      return;
    }
    if (previous) forget(previous);
    const record = { ...incoming, key: k, seen: now(), pending: 0, departed: false };
    records.set(k, record);
    for (const support of record.supports) {
      const sk = address(record.dimension, support.position);
      if (!bySupport.has(sk)) bySupport.set(sk, new Set());
      bySupport.get(sk).add(record);
    }
    while (records.size > maxRecords) forget(records.values().next().value);
    if (validity(block) === false) destroy(record, block, "invalid-support");
  }
  function invalidate(dimension, position) {
    const record = records.get(address(dimension, position));
    if (record) forget(record);
  }
  function resetAround(dimension, position) {
    // Explicit non-piston edits retire old relationships immediately. Never reset
    // a relationship already captured by a running local piston job.
    for (const record of [...(bySupport.get(address(dimension, position)) || [])]) {
      if (record.pending) continue;
      const block = read(dimension, record.position);
      if (!matches(block, record)) forget(record);
      else observe(block, { reset: true });
    }
  }
  function onPiston({ dimension, position, axis, isExpanding, piston }) {
    if (!axis) return;
    const delta = isExpanding ? axis : add({ x: 0, y: 0, z: 0 }, axis, -1);
    const head = add(position, axis), candidates = new Map(), frozen = new Set();
    function candidate(p) {
      const k = key(p);
      if (candidates.has(k)) return;
      candidates.set(k, { ...p });
      // Discover only the event's cells and immediate attachment neighbours.
      // Scheduled ticks normally warm them before this fallback is needed.
      for (const off of NEIGHBOURS) {
        const nearby = read(dimension, add(p, off));
        if (nearby && describe(nearby)) observe(nearby);
      }
      for (const record of bySupport.get(address(dimension, p)) || []) {
        if (!frozen.has(record)) { frozen.add(record); record.pending++; }
      }
      const at = records.get(address(dimension, p));
      if (at && !frozen.has(at)) { frozen.add(at); at.pending++; }
    }
    candidate(head);
    let samples = 0;
    function sample() {
      let currentPiston;
      try { currentPiston = read(dimension, position)?.getComponent("minecraft:piston") || piston; } catch { /* unloaded */ }
      let attached = [];
      try { attached = currentPiston?.getAttachedBlocksLocations() || []; } catch { /* moving/unloaded */ }
      for (const p of attached) for (const n of [-1, 0, 1]) candidate(add(p, delta, n));
      for (const record of frozen) for (const support of record.supports) {
        const current = read(dimension, support.position);
        if (!current) continue;
        const moving = current.typeId === MOVING;
        const newHead = key(support.position) === key(head) && HEADS.has(current.typeId) && !HEADS.has(support.type);
        const changed = candidates.has(key(support.position)) && support.type && current.typeId !== support.type;
        if (moving || newHead || changed) record.departed = true;
      }
      samples++;
      return currentPiston;
    }
    function finish() {
      for (const record of frozen) {
        record.pending--;
        if (record.pending || records.get(record.key) !== record) continue;
        try {
        const original = read(dimension, record.position), destination = read(dimension, add(record.position, delta));
        if (matches(original, record)) {
          if (record.departed) destroy(record, original, "support-departed");
          else if (validity(original) === false) destroy(record, original, "invalid-support");
          else observe(original, { reset: true });
        } else if (record.movable && matches(destination, record)) {
          forget(record);
          onMove(destination, record, { ...destination.location });
          observe(destination, { reset: true });
          const moved = records.get(address(dimension, destination.location));
          if (moved && validity(destination) === false) destroy(moved, destination, "destination-invalid");
        } else if (original) { forget(record); onGone(dimension, record); }
        // Unloaded original is unknown: retain history for scheduled recovery.
        } catch (error) { warn(`[support-motion] reconciliation: ${error}`); }
      }
      try { onSettled(dimension, [...candidates.values()]); }
      catch (error) { warn(`[support-motion] settled callback: ${error}`); }
    }
    function step() {
      const current = sample();
      let moving = true;
      try { moving = !current || current.isMoving; } catch { /* unloaded */ }
      if (samples >= 10 && !moving) { finish(); return; }
      if (samples >= 40) {
        // Do not interpret unresolved moving cells as destroyed/settled blocks.
        for (const record of frozen) record.pending--;
        return;
      }
      schedule(step, 1);
    }
    step(); // Sample zero must capture moving_block before it disappears.
  }
  function isPending(dimension, position) {
    const record = records.get(address(dimension, position));
    return !!record && (record.pending > 0 || (record.departed && matches(read(dimension, position), record)));
  }
  return { observe, invalidate, resetAround, onPiston, isPending, size: () => records.size };
}
