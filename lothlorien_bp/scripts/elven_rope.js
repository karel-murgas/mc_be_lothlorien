// Elven rope (Phase 17b): a stackable item that unrolls a rope on the side of a block, and the script that makes it
// climbable. Rope pieces are the block `lothlorien:elven_rope` (state `lothlorien:face`) and its structure-only twin
// `lothlorien:elven_rope_hanging` (state `minecraft:cardinal_direction`, same values: Bedrock rotates that state with a
// rotated structure piece, but not the custom `lothlorien:face`). Both are one rope to every rule below.
//   - Using the rope on the side of a block hangs pieces in the clicked cell, downwards first, then upwards, one per
//     item up to the stack. Using it on a piece extends that rope the same way (down from its bottom, then up).
//   - Breaking any piece breaks the whole rope: every piece drops where it was broken. Losing the wall behind any
//     piece does the same (checked around a broken block or an explosion, like the antler block).
//   - Climbing: see startRopeClimbing() and CLIMB in elven_rope_rules.js.
import { BlockPermutation, EquipmentSlot, GameMode, ItemStack, system, world } from "@minecraft/server";
import { brakes, CLIMB, columnBounds, dropStacks, isUnsupported, levitationStep, pieceOffset, planRope, wallOffset } from "./elven_rope_rules.js";
import { repeatedUse } from "./use_guard.js";

const ROPE_ID = "lothlorien:elven_rope";
const FACE_STATE = "lothlorien:face";
const HANGING_ID = "lothlorien:elven_rope_hanging";
const HANGING_STATE = "minecraft:cardinal_direction";
const ROPE_IDS = new Set([ROPE_ID, HANGING_ID]);
const HORIZONTAL = [[1, 0], [-1, 0], [0, 1], [0, -1]];

// the face a rope permutation hangs on, or undefined for any other block
const permFace = (perm) => (perm?.type.id === ROPE_ID ? perm.getState(FACE_STATE) : perm?.type.id === HANGING_ID ? perm.getState(HANGING_STATE) : undefined);
const faceOf = (block) => (block && ROPE_IDS.has(block.typeId) ? permFace(block.permutation) : undefined);

function hasWall(dimension, { x, y, z }, face) {
  const w = wallOffset(face);
  const wall = dimension.getBlock({ x: x + w.x, y, z: z + w.z });
  return !!wall && !isUnsupported({ isAir: wall.isAir, isLiquid: wall.isLiquid });
}

function useRope(player, block, blockFace) {
  const dimension = block.dimension;
  const slot = player.getComponent("equippable")?.getEquipmentSlot(EquipmentSlot.Mainhand);
  const count = slot?.amount ?? 0;
  if (count < 1) return;
  const clickedFace = faceOf(block);
  let { x, y: y0, z } = block.location;
  let face;
  let plan;
  const rowFree = (f) => (y) => {
    const cell = dimension.getBlock({ x, y, z });
    return !!cell && cell.isAir && hasWall(dimension, { x, y, z }, f);
  };
  if (clickedFace) { // extend: down from the bottom piece, then up from the top piece
    face = clickedFace;
    const { bottom, top } = columnBounds((y) => faceOf(dimension.getBlock({ x, y, z })) === face, y0);
    plan = planRope({ downFrom: bottom - 1, upFrom: top + 1, count, free: rowFree(face) });
  } else { // new rope in the cell beside the clicked side face
    face = String(blockFace).toLowerCase();
    const off = pieceOffset(face);
    if (!off) return; // top or bottom face: a rope hangs on the side of a block
    x += off.x;
    z += off.z;
    const free = rowFree(face);
    if (!free(y0)) return;
    plan = planRope({ downFrom: y0, upFrom: y0 + 1, count, free });
  }
  if (!plan.length) return;
  const permutation = BlockPermutation.resolve(ROPE_ID, { [FACE_STATE]: face });
  for (const y of plan) dimension.getBlock({ x, y, z }).setPermutation(permutation);
  if (player.getGameMode() !== GameMode.Creative) {
    if (plan.length >= count) slot.setItem(undefined);
    else slot.amount = count - plan.length;
  }
  try {
    dimension.playSound("dig.grass", { x: x + 0.5, y: plan[0], z: z + 0.5 });
  } catch {
    // sound is decoration
  }
}

// Removes every piece of the rope in column (x, z) that is connected to row y and drops all of them, plus one when
// the piece at y is already gone (`gone`), as stacks at row y.
export function dropWholeRope(dimension, { x, y, z }, face, { creative = false, gone = false } = {}) {
  const { bottom, top } = columnBounds((row) => faceOf(dimension.getBlock({ x, y: row, z })) === face, y);
  let total = gone ? 1 : 0;
  for (let row = bottom; row <= top; row++) {
    const piece = dimension.getBlock({ x, y: row, z });
    if (faceOf(piece) !== face) continue;
    piece.setType("minecraft:air");
    total++;
  }
  if (creative) return;
  for (const amount of dropStacks(total)) dimension.spawnItem(new ItemStack(ROPE_ID, amount), { x: x + 0.5, y: y + 0.5, z: z + 0.5 });
}

// The block at `location` was broken or blown up: pieces beside it that hung on it lose their wall and drop
function checkWalls(dimension, { x, y, z }) {
  for (const [dx, dz] of HORIZONTAL) {
    try {
      const cell = dimension.getBlock({ x: x + dx, y, z: z + dz });
      const face = faceOf(cell);
      if (!face) continue;
      const w = wallOffset(face);
      if (cell.location.x + w.x !== x || cell.location.z + w.z !== z) continue;
      if (hasWall(dimension, cell.location, face)) continue;
      dropWholeRope(dimension, cell.location, face);
    } catch {
      // chunk unloaded meanwhile
    }
  }
}

system.beforeEvents.startup.subscribe(({ itemComponentRegistry }) => {
  itemComponentRegistry.registerCustomComponent("lothlorien:rope", {
    onUseOn({ source, block, blockFace }) {
      try {
        if (repeatedUse(source, "elven_rope")) return;
        useRope(source, block, blockFace);
      } catch {
        // block or player gone meanwhile
      }
    },
  });
});

// Breaking a piece breaks the whole rope: the piece is already gone, the rest is removed and everything drops here
world.afterEvents.playerBreakBlock.subscribe(({ block, brokenBlockPermutation, player }) => {
  try {
    if (ROPE_IDS.has(brokenBlockPermutation.type.id)) {
      const creative = player.getGameMode() === GameMode.Creative;
      dropWholeRope(block.dimension, block.location, permFace(brokenBlockPermutation), { creative });
    }
    checkWalls(block.dimension, block.location);
  } catch {
    // chunk unloaded meanwhile
  }
});
world.afterEvents.blockExplode.subscribe(({ block, dimension, explodedBlockPermutation }) => {
  try {
    if (ROPE_IDS.has(explodedBlockPermutation?.type.id)) {
      dropWholeRope(dimension, block.location, permFace(explodedBlockPermutation));
    }
    checkWalls(dimension, block.location);
  } catch {
    // chunk unloaded meanwhile
  }
});

// WORKAROUND (docs/workarounds.md in the workspace; re-check after every game update): no component makes a custom block
// climbable (1.26.52). Remove this when one exists.
// Climbing, by script (a custom block cannot be climbable): in a rope cell Jump or forward climbs (levitation), crouch
// holds your height, and otherwise you sink slowly (slow falling).
// Jump or walking forward climbs (the movement vector's y is positive forward). Returns the climb speed in blocks per
// tick, or 0.
export function climbSpeed(player) {
  const { inputInfo } = player;
  if (inputInfo.getButtonState("Jump") === "Pressed") return CLIMB.jumpSpeed / 20;
  return inputInfo.getMovementVector().y > CLIMB.forwardThreshold ? CLIMB.forwardSpeed / 20 : 0;
}
export function inRope(player) {
  const { x, y, z } = player.location;
  const cx = Math.floor(x);
  const cz = Math.floor(z);
  return [Math.floor(y), Math.floor(y + 1)].some((cy) => ROPE_IDS.has(player.dimension.getBlock({ x: cx, y: cy, z: cz })?.typeId));
}

// player id -> { v: modelled vertical speed while climbing (see levitationStep), else null;
//                y: last height; holdY: height where crouching began, or undefined }
const climbing = new Map();
const CLIMB_EFFECTS = ["levitation", "slow_falling"];

export function startRopeClimbing() {
  system.runInterval(() => {
    for (const player of world.getPlayers()) {
      try {
        if (!inRope(player)) {
          if (climbing.delete(player.id)) for (const effect of CLIMB_EFFECTS) player.removeEffect(effect);
          continue;
        }
        const y = player.location.y;
        const last = climbing.get(player.id);
        if (player.isSneaking) {
          // A custom block has no ladder's built-in crouch grip. Hold the first crouched height without changing
          // horizontal movement or the direction the player is facing.
          const holdY = last?.holdY ?? y;
          player.removeEffect("levitation");
          player.removeEffect("slow_falling");
          player.teleport({ x: player.location.x, y: holdY, z: player.location.z });
          climbing.set(player.id, { v: null, y: holdY, holdY });
          continue;
        }
        const target = climbSpeed(player);
        let v = null;
        let level; // levitation amplifier this tick, or undefined for none
        if (target > 0) {
          // climbing: levitation alone (it replaces gravity, slow falling would only add an icon). Start from the real
          // speed, then follow the model (the level each tick steers it to the target).
          const step = levitationStep(last?.v ?? player.getVelocity().y, target);
          v = step.v;
          level = step.amplifier;
          player.removeEffect("slow_falling");
        } else {
          // sliding down: slow falling, braked by a tick of levitation when faster than a ladder
          player.addEffect("slow_falling", CLIMB.effectTicks, { amplifier: 0, showParticles: false });
          if (last && brakes(y - last.y, CLIMB.downSpeed / 20)) level = 0;
        }
        climbing.set(player.id, { v, y });
        player.removeEffect("levitation"); // a lower level would not replace a higher one still running
        if (level !== undefined) player.addEffect("levitation", CLIMB.effectTicks, { amplifier: level, showParticles: false });
      } catch {
        // player gone or chunk unloaded this tick
      }
    }
  }, 1);
}
