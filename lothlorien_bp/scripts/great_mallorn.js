// Great Mallorn nut in the running game (rules and numbers in great_mallorn_rules.js).
//   lothlorien:great_sprout  random tick: stage 0 -> 1 -> a flet giant (structure) grows around the sprout, if the light
//                            is enough and nothing built stands where the tree would put a block
// Planting it warns the player about the space it needs; bone meal does nothing on it (and says so).
import { world, system } from "@minecraft/server";
import { repeatedUse } from "./use_guard.js";
import {
  ANCHOR, BLOCKED_TELL_RADIUS, BLOCKED_TELL_TICKS, FLET_TREES, GROW_CHANCE, MIN_LIGHT, SIZE, SIZE_Y, SPROUT_ID, isNatural, treeOrigin,
} from "./great_mallorn_rules.js";

const STAGE = "lothlorien:stage";
const cellsOf = new Map(); // structure id -> [{x, y, z}] cells the tree fills (read once per session)
const growing = new Set(); // "dim|x,y,z" of sprouts with a growth check running
const toldAt = new Map(); // same key -> tick of the last "blocked" message

const keyOf = (block) => `${block.dimension.id}|${block.x},${block.y},${block.z}`;

// The filled cells of a structure, collected in job steps (the box is 40 x 54 x 40).
function* readCells(id) {
  if (cellsOf.has(id)) return cellsOf.get(id);
  const structure = world.structureManager.get(id);
  if (!structure) return undefined;
  const cells = [];
  for (let x = 0; x < SIZE; x++) {
    for (let y = 0; y < SIZE_Y; y++) {
      for (let z = 0; z < SIZE; z++) {
        const p = structure.getBlockPermutation({ x, y, z });
        if (p && p.type.id !== "minecraft:structure_void") cells.push({ x, y, z });
      }
    }
    yield;
  }
  cellsOf.set(id, cells);
  return cells;
}

function tellBlocked(block, obstacle) {
  const key = keyOf(block);
  const now = system.currentTick;
  if (now - (toldAt.get(key) ?? -BLOCKED_TELL_TICKS) < BLOCKED_TELL_TICKS) return;
  toldAt.set(key, now);
  const name = obstacle.typeId.replace(/^minecraft:/, "").replace(/_/g, " ");
  for (const player of block.dimension.getPlayers({ location: block.location, maxDistance: BLOCKED_TELL_RADIUS })) {
    player.sendMessage(`§6The Great Mallorn sprout at ${block.x} ${block.y} ${block.z} cannot grow: ${name} at ` +
      `${obstacle.x} ${obstacle.y} ${obstacle.z} stands in the way of the tree.`);
  }
}

// Check the tree's space and place it. Runs as a job; the sprout may be gone or changed by the time it finishes.
function* grow(dimension, at) {
  const id = FLET_TREES[Math.floor(Math.random() * FLET_TREES.length)];
  const cells = yield* readCells(id);
  if (!cells) return;
  const origin = treeOrigin(at);
  let n = 0;
  for (const c of cells) {
    const b = dimension.getBlock({ x: origin.x + c.x, y: origin.y + c.y, z: origin.z + c.z });
    if (!b) return; // part of the tree's space is not loaded: try again on a later tick
    if (!isNatural(b.typeId)) {
      const sprout = dimension.getBlock(at);
      if (sprout?.typeId === SPROUT_ID) tellBlocked(sprout, b);
      return;
    }
    if (++n % 400 === 0) yield;
  }
  const sprout = dimension.getBlock(at);
  if (sprout?.typeId !== SPROUT_ID) return;
  world.structureManager.place(id, dimension, origin);
  // the worldgen anchor (a jigsaw block in the bottom trunk cell) is only for jigsaw placement: make it wood
  const anchor = dimension.getBlock({ x: origin.x + ANCHOR.x, y: origin.y + ANCHOR.y, z: origin.z + ANCHOR.z });
  if (anchor?.typeId === "minecraft:jigsaw") anchor.setType("lothlorien:mallorn_wood");
  dimension.spawnParticle("minecraft:totem_particle", { x: at.x + 0.5, y: at.y + 1, z: at.z + 0.5 });
}

function tryGrow(block) {
  const key = keyOf(block);
  if (growing.has(key)) return;
  growing.add(key);
  const dimension = block.dimension;
  const at = { x: block.x, y: block.y, z: block.z };
  system.runJob(
    (function* () {
      try {
        yield* grow(dimension, at);
      } catch {
        // unloaded meanwhile or the structure could not be placed: a later tick tries again
      } finally {
        growing.delete(key);
      }
    })()
  );
}

function lightAt(block) {
  try {
    return block.getLightLevel();
  } catch {
    return MIN_LIGHT;
  }
}

system.beforeEvents.startup.subscribe(({ blockComponentRegistry }) => {
  blockComponentRegistry.registerCustomComponent("lothlorien:great_sprout", {
    onRandomTick({ block }) {
      if (Math.random() >= GROW_CHANCE || lightAt(block) < MIN_LIGHT) return;
      if (block.permutation.getState(STAGE) === 0) block.setPermutation(block.permutation.withState(STAGE, 1));
      else tryGrow(block);
    },
  });
});

world.afterEvents.playerPlaceBlock.subscribe(({ block, player }) => {
  if (block.typeId !== SPROUT_ID) return;
  player.sendMessage("§6The Great Mallorn nut will grow into a giant Mallorn with a flet: about 40 blocks wide and " +
    "50 high, roots 5 deep. It needs light, and it will not grow while anything built stands in that space. " +
    "Break the sprout to get the nut back.");
});

// Vanilla bone meal does nothing on a custom block; say why instead of letting it look broken.
world.beforeEvents.playerInteractWithBlock.subscribe((event) => {
  const { block, player, itemStack } = event;
  if (block.typeId !== SPROUT_ID || itemStack?.typeId !== "minecraft:bone_meal") return;
  event.cancel = true;
  if (repeatedUse(player, "great_sprout")) return;
  system.run(() => player.onScreenDisplay.setActionBar("§7A Great Mallorn will not be hurried."));
});
