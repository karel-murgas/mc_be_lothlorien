// Replaces village wardens that loaded with engine-default attributes (see warden_replace_rules.js). Event-driven: it looks at
// each warden once when it spawns or loads (a structure-placed warden may fire either event; the check is idempotent). A wrong
// one is replaced by a fresh spawn at the same spot with the spawn event that adds the persistent + home group, then removed.
// The fresh warden has movement 0.25, so it never matches again.
import { system, world } from "@minecraft/server";
import { WARDEN_ID, VILLAGE_GROUP } from "./elven_warden_rules.js";
import { needsReplacement } from "./warden_replace_rules.js";

const done = new Set(); // ids of wardens already handled (or being replaced)

function check(entity) {
  try {
    if (!entity.isValid || entity.typeId !== WARDEN_ID || done.has(entity.id)) return;
    const movement = entity.getComponent("minecraft:movement")?.currentValue;
    if (!needsReplacement(movement)) return;
    done.add(entity.id);
    const dimension = entity.dimension, location = entity.location, yaw = entity.getRotation().y, name = entity.nameTag;
    const fresh = dimension.spawnEntity(WARDEN_ID, location, { spawnEvent: VILLAGE_GROUP, initialRotation: yaw });
    if (name) fresh.nameTag = name;
    entity.remove();
    console.warn(`[lothlorien] warden replace: structure warden with movement ${movement} replaced at ${location.x.toFixed(1)},${location.y.toFixed(1)},${location.z.toFixed(1)}`);
  } catch {
    // unloaded or gone meanwhile: the next load checks again
  }
}

// One tick later: attributes are surely applied, and the writes run outside any read-only context.
const later = (entity) => system.runTimeout(() => check(entity), 1);

world.afterEvents.worldLoad.subscribe(() => {
  world.afterEvents.entitySpawn.subscribe(({ entity }) => later(entity));
  world.afterEvents.entityLoad.subscribe(({ entity }) => later(entity));
});
