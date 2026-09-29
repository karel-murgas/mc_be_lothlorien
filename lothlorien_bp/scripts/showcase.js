import { world, system, BlockPermutation } from "@minecraft/server";

// Phase 5 curation instrument. `/scriptevent lothlorien:showcase` lays out every giant Mallorn structure
// (lothlorien:mallorn_flet_NN, made by tools/build_structures.mjs) on a grid of 4 columns east and south
// of the player, with a numbered sign in front of each ladder. Trees in unloaded chunks are retried every
// 2 s for 3 minutes, so fly along the grid and they appear. `/scriptevent lothlorien:showcase 3` places
// only number 3, next to the player.
// Structure layout (keep in step with tools/build_structures.mjs): trunk NW cell at x/z TRUNK_AT, the
// first block above the ground at y ROOT_DEPTH.
const TRUNK_AT = 18;
const ROOT_DEPTH = 5;
const SPACING = 48;
const RETRY_TICKS = 40;
const GIVE_UP_TICKS = 3600;
const PASSABLE = /leaves|_log$|_wood$|grass$|fern|flower|sapling|carpet|bush|lilac|peony|rose|athelas|elanor|niphredil|corn/;

const structureId = (n) => `lothlorien:mallorn_flet_${String(n).padStart(2, "0")}`;

function groundAbove(dimension, x, z) {
  let b = dimension.getTopmostBlock({ x, z });
  while (b && (b.isAir || PASSABLE.test(b.typeId))) b = b.below();
  return b ? b.y + 1 : undefined;
}

// Places tree n with its trunk's north-west cell at (x, z) on the ground; false if the area is not loaded.
function placeTree(dimension, n, x, z) {
  try {
    const y = groundAbove(dimension, x + 1, z + 1);
    if (y === undefined) return false;
    world.structureManager.place(structureId(n), dimension, { x: x - TRUNK_AT, y: y - ROOT_DEPTH, z: z - TRUNK_AT });
    const sign = dimension.getBlock({ x, y, z: z - 4 });
    sign.setPermutation(BlockPermutation.resolve("minecraft:standing_sign", { ground_sign_direction: 8 }));
    sign.getComponent("minecraft:sign")?.setText(`Mallorn\nflet ${n}`);
    return true;
  } catch {
    return false; // unloaded chunk
  }
}

export function handleShowcaseEvent(event, player) {
  if (event.id !== "lothlorien:showcase") return false;
  const dimension = player.dimension;
  const px = Math.floor(player.location.x), pz = Math.floor(player.location.z);
  const available = [];
  for (let n = 1; n <= 99 && world.structureManager.get(structureId(n)); n++) available.push(n);
  if (!available.length) {
    player.sendMessage("[lothlorien] showcase: no lothlorien:mallorn_flet_NN structures in the pack");
    return true;
  }
  const only = parseInt(event.message, 10);
  if (only) {
    const ok = available.includes(only) && placeTree(dimension, only, px + 24, pz + 24);
    player.sendMessage(`[lothlorien] showcase: flet ${only} ${ok ? "placed 24 blocks SE" : "not placed (missing or unloaded)"}`);
    return true;
  }
  const pending = available.map((n, i) => ({ n, x: px + 24 + (i % 4) * SPACING, z: pz + 24 + Math.floor(i / 4) * SPACING }));
  player.sendMessage(`[lothlorien] showcase: ${pending.length} flet Mallorns on a grid ${SPACING} apart, SE of here; fly along it`);
  const start = system.currentTick;
  const job = system.runInterval(() => {
    for (let i = pending.length - 1; i >= 0; i--) {
      if (placeTree(dimension, pending[i].n, pending[i].x, pending[i].z)) pending.splice(i, 1);
    }
    if (!pending.length || system.currentTick - start > GIVE_UP_TICKS) {
      system.clearRun(job);
      player.sendMessage(`[lothlorien] showcase: done${pending.length ? `; not loaded in time: ${pending.map((p) => p.n).join(", ")}` : ""}`);
    }
  }, RETRY_TICKS);
  return true;
}
