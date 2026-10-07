// Rail mender: village pieces carry one invisible `lothlorien:rail_mender` entity. When the entity loads (the piece's
// chunk loads next to a player) it waits until the whole box is loaded, switches on every fence link the engine dropped
// (rail_mender_rules.js) and removes itself, so each piece is mended once. If the box never loads in 30 s the marker stays
// and tries again the next time it loads. Whether Bedrock places structure entities in jigsaw pieces is checked in game.
import { BlockVolume, system, world } from "@minecraft/server";
import { FENCE_IDS, MAX_WAIT_TICKS, MENDER_ID, RETRY_TICKS, START_DELAY_TICKS, missingLinks, scanBox } from "./rail_mender_rules.js";

const busy = new Set();

function boxLoaded(dimension, box) {
  const ys = [box.from.y, box.to.y];
  for (const x of [box.from.x, box.to.x]) for (const z of [box.from.z, box.to.z]) for (const y of ys) {
    if (!dimension.isChunkLoaded({ x, y, z })) return false;
  }
  return true;
}

function* mend(entity, dimension, box) {
  let fixed = 0;
  const typeAt = (x, y, z) => dimension.getBlock({ x, y, z })?.typeId;
  for (const loc of dimension.getBlocks(new BlockVolume(box.from, box.to), { includeTypes: FENCE_IDS }, true).getBlockLocationIterator()) {
    const block = dimension.getBlock(loc);
    if (block) {
      const perm = block.permutation;
      const on = missingLinks(loc, typeAt, (s) => perm.getState(s));
      if (on.length) {
        let next = perm;
        for (const s of on) next = next.withState(s, true);
        block.setPermutation(next);
        fixed++;
      }
    }
    yield;
  }
  if (entity.isValid) entity.remove();
  if (fixed) console.warn(`[lothlorien] rail mender: ${fixed} fence link(s) repaired`);
}

function attempt(entity, waited) {
  try {
    if (!entity.isValid) return busy.delete(entity.id);
    const box = scanBox(entity.location);
    const dimension = entity.dimension;
    if (boxLoaded(dimension, box)) {
      busy.delete(entity.id);
      system.runJob(mend(entity, dimension, box));
    } else if (waited >= MAX_WAIT_TICKS) {
      busy.delete(entity.id);
    } else {
      system.runTimeout(() => attempt(entity, waited + RETRY_TICKS), RETRY_TICKS);
    }
  } catch (e) {
    busy.delete(entity.id);
    console.warn(`[lothlorien] rail mender: ${e}`);
  }
}

function onMarker(entity) {
  if (!entity || entity.typeId !== MENDER_ID || busy.has(entity.id)) return;
  busy.add(entity.id);
  system.runTimeout(() => attempt(entity, 0), START_DELAY_TICKS);
}

world.afterEvents.entityLoad.subscribe(({ entity }) => onMarker(entity));
world.afterEvents.entitySpawn.subscribe(({ entity }) => onMarker(entity));
