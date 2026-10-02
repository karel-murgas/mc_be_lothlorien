// Swans in the running game (Phase 15; rules in swan_rules.js). Their wariness follows the nearest player's Disharmony in
// deer.js (they are in WARY_TYPES), exactly like the deer. This file only judges natural spawns: the spawn rule lets
// swans spawn in any river (see swan_rules.js), and one that spawned where no Lothlorien biome is near is removed.
import { EntityInitializationCause, system, world } from "@minecraft/server";
import { SWAN_ID, nearBiome } from "./swan_rules.js";

// The spawn rule's herd event sets lothlorien:natural (/summon and eggs do not, so they always stay). The flag is cleared
// after the roll, so a swan is judged once and not again on every chunk load.
function judgeNaturalSpawn(swan, biome) {
  try {
    if (!swan.isValid || !swan.getProperty("lothlorien:natural")) return;
    swan.setProperty("lothlorien:natural", false);
    const { x, z } = swan.location;
    if (!nearBiome((dx, dz) => biome.at(swan.dimension, x + dx, z + dz), biome.id)) swan.remove();
  } catch {
    // unloaded meanwhile
  }
}

// biome = { id, at(dimension, x, z) -> surface biome id or undefined } (main.js supplies it).
export function startSwans(biome) {
  world.afterEvents.entitySpawn.subscribe(({ entity, cause }) => {
    try {
      if (cause === EntityInitializationCause.Loaded || entity.typeId !== SWAN_ID) return;
      // one tick later: the spawn event's property is surely applied by then
      system.runTimeout(() => judgeNaturalSpawn(entity, biome), 1);
    } catch {
      // entity gone
    }
  });
}
