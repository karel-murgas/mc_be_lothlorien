import { world, system, BlockPermutation, GameMode, EquipmentSlot } from "@minecraft/server";
import { makeRandom, buildSmallMallorn } from "./mallorn_tree.js";

// Phase 4: Mallorn sapling growth, bone meal, leaf decay, and the tree balance instruments.
//   lothlorien:sapling  random tick: stage 0 -> 1 -> grows a small Mallorn (needs light and room)
//   lothlorien:leaves   places as persistent (player-placed never decays); random tick: leaves with no
//                       Mallorn log/wood within LEAF_REACH steps through leaves break, with drops
// Tree shape: mallorn_tree.js. Balance: `node tests/tree_stats.mjs`, `/scriptevent lothlorien:treestats`.

const NS = "lothlorien";
const LEAVES = `${NS}:mallorn_leaves`;
const LOG = `${NS}:mallorn_log`;
const SAPLING = `${NS}:mallorn_sapling`;
const PERSISTENT = `${NS}:persistent`;
const STAGE = `${NS}:stage`;

const GROW_CHANCE = 1 / 7; // per random tick and stage, like vanilla saplings
const MIN_LIGHT = 9;
const BONE_MEAL_CHANCE = 0.45;
const LEAF_REACH = 6;
const NEIGHBOURS = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
const WOOD = new Set(["log", "wood", "stripped_log", "stripped_wood"].map((n) => `${NS}:mallorn_${n}`));
const SOFT_PLANTS = new Set(["minecraft:short_grass", "minecraft:tall_grass", "minecraft:fern", "minecraft:snow_layer", SAPLING]);

// --- growth ---------------------------------------------------------------------------------

function replaceable(block, allowLeaves) {
  if (!block) return false;
  if (block.isAir || SOFT_PLANTS.has(block.typeId)) return true;
  return allowLeaves && block.typeId === LEAVES;
}

// Grows a small Mallorn whose base cell is `base` (the sapling's cell). Returns false, changing
// nothing, when the trunk has no room or a chunk is unloaded.
export function growTree(base, seed) {
  const tree = buildSmallMallorn(makeRandom(seed ?? Math.floor(Math.random() * 4294967296)));
  const dim = base.dimension;
  const { x, y, z } = base.location;
  const at = (c) => dim.getBlock({ x: x + c.x, y: y + c.y, z: z + c.z });

  for (const c of tree.logs) {
    if (c.face === "up" && !replaceable(at(c), true)) return false;
  }
  const leaf = BlockPermutation.resolve(LEAVES, { [PERSISTENT]: false });
  for (const c of tree.leaves) {
    const b = at(c);
    if (b && replaceable(b, false) && b.typeId !== LEAVES) b.setPermutation(leaf);
  }
  for (const c of tree.logs) {
    const b = at(c);
    if (b && replaceable(b, true)) b.setPermutation(BlockPermutation.resolve(LOG, { "minecraft:block_face": c.face }));
  }
  return true;
}

function advance(block) {
  if (block.permutation.getState(STAGE) === 0) {
    block.setPermutation(block.permutation.withState(STAGE, 1));
    return;
  }
  growTree(block);
}

function lightAt(block) {
  try {
    return block.getLightLevel();
  } catch {
    return MIN_LIGHT; // do not block growth on an API failure
  }
}

// --- leaf decay -----------------------------------------------------------------------------

// Breadth-first through Mallorn leaves; unloaded neighbours count as connected so a chunk edge
// never strips a tree.
function connectedToWood(start) {
  const dim = start.dimension;
  const seen = new Set();
  let frontier = [start.location];
  seen.add(`${start.location.x},${start.location.y},${start.location.z}`);
  for (let step = 0; step < LEAF_REACH; step++) {
    const next = [];
    for (const p of frontier) {
      for (const [dx, dy, dz] of NEIGHBOURS) {
        const q = { x: p.x + dx, y: p.y + dy, z: p.z + dz };
        const k = `${q.x},${q.y},${q.z}`;
        if (seen.has(k)) continue;
        seen.add(k);
        const b = dim.getBlock(q);
        if (!b) return true;
        if (WOOD.has(b.typeId)) return true;
        if (b.typeId === LEAVES) next.push(q);
      }
    }
    if (next.length === 0) return false;
    frontier = next;
  }
  return false;
}

// --- components -----------------------------------------------------------------------------

system.beforeEvents.startup.subscribe(({ blockComponentRegistry }) => {
  blockComponentRegistry.registerCustomComponent("lothlorien:sapling", {
    onRandomTick({ block }) {
      if (Math.random() >= GROW_CHANCE || lightAt(block) < MIN_LIGHT) return;
      advance(block);
    },
  });
  blockComponentRegistry.registerCustomComponent("lothlorien:leaves", {
    beforeOnPlayerPlace(event) {
      event.permutationToPlace = event.permutationToPlace.withState(PERSISTENT, true);
    },
    onRandomTick({ block, dimension }) {
      if (block.permutation.getState(PERSISTENT) || connectedToWood(block)) return;
      const { x, y, z } = block.location;
      dimension.runCommand(`setblock ${x} ${y} ${z} air destroy`);
    },
  });
});

// --- bone meal ------------------------------------------------------------------------------

world.beforeEvents.playerInteractWithBlock.subscribe((event) => {
  const { block, player, itemStack } = event;
  if (block.typeId !== SAPLING || itemStack?.typeId !== "minecraft:bone_meal") return;
  const { location, dimension } = block;
  // read-only in the before event: cancel, then do the work next tick
  event.cancel = true;
  system.run(() => {
    const b = dimension.getBlock(location);
    if (b?.typeId !== SAPLING) return;
    if (player.getGameMode() !== GameMode.Creative) {
      const slot = player.getComponent("equippable")?.getEquipmentSlot(EquipmentSlot.Mainhand);
      if (slot?.hasItem()) {
        if (slot.amount > 1) slot.amount -= 1;
        else slot.setItem(undefined);
      }
    }
    dimension.spawnParticle("minecraft:crop_growth_emitter", { x: location.x + 0.5, y: location.y + 0.5, z: location.z + 0.5 });
    if (Math.random() < BONE_MEAL_CHANCE) advance(b);
  });
});

// --- instruments ----------------------------------------------------------------------------

// `/scriptevent lothlorien:grow [n]` grows n trees (default 20) on a 5-wide grid of the surface
// starting at the player, 7 blocks apart, for the "cut down 20 trees" balance test.
// `/scriptevent lothlorien:treestats [n]` reports the generator's average size and expected acorns.
export function handleTreeScriptEvent(event, player) {
  const n = Math.max(1, Math.min(60, parseInt(event.message, 10) || 20));
  if (event.id === "lothlorien:grow") {
    const px = Math.floor(player.location.x), pz = Math.floor(player.location.z);
    let grown = 0;
    for (let i = 0; i < n; i++) {
      let top;
      try {
        top = player.dimension.getTopmostBlock({ x: px + 3 + (i % 5) * 7, z: pz + 3 + Math.floor(i / 5) * 7 });
      } catch {
        continue;
      }
      const above = top?.above();
      if (above && growTree(above)) grown++;
    }
    player.sendMessage(`[lothlorien] grew ${grown}/${n} Mallorns`);
    return true;
  }
  if (event.id === "lothlorien:treestats") {
    let logs = 0, leaves = 0;
    for (let i = 0; i < n; i++) {
      const t = buildSmallMallorn(makeRandom(Math.floor(Math.random() * 4294967296)));
      logs += t.logs.length;
      leaves += t.leaves.length;
    }
    player.sendMessage(
      `[lothlorien] ${n} trees: avg ${(logs / n).toFixed(1)} logs (${((logs / n) * 4).toFixed(0)} planks), ` +
        `${(leaves / n).toFixed(0)} leaves; acorns at 2% per leaf: ${((leaves / n) * 0.02).toFixed(1)} if all leaves drop`
    );
    return true;
  }
  return false;
}
