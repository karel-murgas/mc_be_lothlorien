import { world, system, BlockPermutation, StructureRotation } from "@minecraft/server";

// Phase 5 curation instrument. `/scriptevent lothlorien:showcase [variant]` lays out the giant Mallorn
// structures (lothlorien:mallorn_<variant>_NN, made by tools/build_structures.mjs; no variant = all of
// them, one block of rows per variant) on a grid of 4 columns east and south of the player, with a sign
// in front of each ladder. Trees in unloaded chunks are retried every 2 s for 3 minutes, so fly along the
// grid and they appear. `/scriptevent lothlorien:showcase woven 3` places only woven 3, next to the player
// (a bare number means flet). A third word 90, 180 or 270 rotates it, to check how rotation treats the
// custom log and fence states (jigsaw worldgen may rotate pieces).
// Structure layout (keep in step with tools/build_structures.mjs): trunk NW cell at x/z TRUNK_AT, the
// first block above the ground at y ROOT_DEPTH.
const TRUNK_AT = 18;
const ROOT_DEPTH = 5;
const SPACING = 48;
const RETRY_TICKS = 40;
const GIVE_UP_TICKS = 3600;
const PASSABLE = /leaves|_log$|_wood$|grass$|fern|flower|sapling|carpet|bush|lilac|peony|rose|athelas|elanor|niphredil|corn/;
// keep in step with VARIANTS in tools/build_structures.mjs
const VARIANTS = ["flet", "woven", "plain"];

const structureId = (v, n) => `lothlorien:mallorn_${v}_${String(n).padStart(2, "0")}`;

function groundAbove(dimension, x, z) {
  let b = dimension.getTopmostBlock({ x, z });
  while (b && (b.isAir || PASSABLE.test(b.typeId))) b = b.below();
  return b ? b.y + 1 : undefined;
}

// Places variant v number n with its trunk's north-west cell at (x, z) on the ground; false if the area
// is not loaded.
function placeTree(dimension, v, n, x, z, rotation = StructureRotation.None) {
  try {
    const y = groundAbove(dimension, x + 1, z + 1);
    if (y === undefined) return false;
    world.structureManager.place(structureId(v, n), dimension, { x: x - TRUNK_AT, y: y - ROOT_DEPTH, z: z - TRUNK_AT }, { rotation });
    const sign = dimension.getBlock({ x, y, z: z - 4 });
    sign.setPermutation(BlockPermutation.resolve("minecraft:standing_sign", { ground_sign_direction: 8 }));
    sign.getComponent("minecraft:sign")?.setText(`Mallorn\n${v} ${n}`);
    return true;
  } catch {
    return false; // unloaded chunk
  }
}

export function handleShowcaseEvent(event, player) {
  if (event.id !== "lothlorien:showcase") return false;
  const dimension = player.dimension;
  const px = Math.floor(player.location.x), pz = Math.floor(player.location.z);
  const words = event.message.trim().split(/\s+/).filter(Boolean);
  const named = VARIANTS.includes(words[0]) ? words.shift() : undefined;
  const only = parseInt(words[0], 10);
  const rotation = { 90: StructureRotation.Rotate90, 180: StructureRotation.Rotate180, 270: StructureRotation.Rotate270 }[words[1]] ?? StructureRotation.None;
  if (only) {
    const v = named ?? "flet";
    const ok = world.structureManager.get(structureId(v, only)) && placeTree(dimension, v, only, px + 24, pz + 24, rotation);
    player.sendMessage(`[lothlorien] showcase: ${v} ${only} ${rotation} ${ok ? "placed 24 blocks SE" : "not placed (missing or unloaded)"}`);
    return true;
  }
  const pending = [];
  let row = 0;
  for (const v of named ? [named] : VARIANTS) {
    let i = 0;
    for (let n = 1; n <= 99; n++) {
      if (!world.structureManager.get(structureId(v, n))) continue; // the pack may hold only some numbers
      pending.push({ v, n, x: px + 24 + (i % 4) * SPACING, z: pz + 24 + (row + Math.floor(i / 4)) * SPACING });
      i++;
    }
    row += Math.ceil(i / 4);
  }
  if (!pending.length) {
    player.sendMessage("[lothlorien] showcase: no giant Mallorn structures in the pack");
    return true;
  }
  player.sendMessage(`[lothlorien] showcase: ${pending.length} giant Mallorns on a grid ${SPACING} apart, SE of here; fly along it`);
  const start = system.currentTick;
  const job = system.runInterval(() => {
    for (let i = pending.length - 1; i >= 0; i--) {
      const p = pending[i];
      if (placeTree(dimension, p.v, p.n, p.x, p.z)) pending.splice(i, 1);
    }
    if (!pending.length || system.currentTick - start > GIVE_UP_TICKS) {
      system.clearRun(job);
      player.sendMessage(`[lothlorien] showcase: done${pending.length ? `; not loaded in time: ${pending.map((p) => `${p.v} ${p.n}`).join(", ")}` : ""}`);
    }
  }, RETRY_TICKS);
  return true;
}
