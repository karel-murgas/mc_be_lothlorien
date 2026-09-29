import { world, system, BlockPermutation, EquipmentSlot, GameMode } from "@minecraft/server";

// Phase 3 custom block components for the Mallorn wood set.
// Stripping logs and merging slabs are world events (see bottom), not block components: a block
// component's onPlayerInteract swallows block placement against that block (logs could not be built on).
//   lothlorien:toggleable {block_state,..} open/close on interact (trapdoor, fence gate)
//   lothlorien:door {block_state,..}       same for the 2-part door, plus hinge choice on placement
//   lothlorien:button {ticks}              press: powered for `ticks`, then released
//   lothlorien:pressure_plate              powered while any entity stands in the block
//   lothlorien:redstone_toggle {..}        trapdoor/gate/door open while powered (edge-detected)

const NS = "lothlorien";
const CLICK = "random.click";

function mainhand(player) {
  return player?.getComponent("equippable")?.getEquipmentSlot(EquipmentSlot.Mainhand);
}

function consumeHeldItem(player) {
  if (player.getGameMode() === GameMode.Creative) return;
  const slot = mainhand(player);
  if (!slot?.hasItem()) return;
  if (slot.amount > 1) slot.amount -= 1;
  else slot.setItem(undefined);
}

function damageHeldTool(player) {
  if (player.getGameMode() === GameMode.Creative) return;
  const slot = mainhand(player);
  const item = slot?.getItem();
  const durability = item?.getComponent("durability");
  if (!durability) return;
  if (durability.damage + 1 >= durability.maxDurability) {
    slot.setItem(undefined);
    player.playSound("random.break");
  } else {
    durability.damage += 1;
    slot.setItem(item);
  }
}

function setState(block, name, value) {
  block.setPermutation(block.permutation.withState(name, value));
}

// Door hinge: a door already standing on the placer's left makes this one hinge right (double door).
const LEFT_OF_FACING = { north: [-1, 0], south: [1, 0], east: [0, -1], west: [0, 1] };

function isDoor(block) {
  return block?.typeId === `${NS}:mallorn_door`;
}

function setDoorOpen(block, openState, value) {
  for (const part of block.getParts()) setState(part, openState, value);
}

// The other half of a double door: the neighbouring door with the same facing and opposite hinge,
// on the side the hinge is not. Opening one opens both, like vanilla.
function doublePartner(block) {
  const perm = block.permutation;
  const left = LEFT_OF_FACING[perm.getState("minecraft:cardinal_direction")];
  if (!left) return undefined;
  const hingeRight = perm.getState(`${NS}:hinge_right`);
  const sign = hingeRight ? 1 : -1; // hinge right: partner is on the left
  const bottom = block.getParts()[0];
  const { x, y, z } = bottom.location;
  const other = block.dimension.getBlock({ x: x + sign * left[0], y, z: z + sign * left[1] });
  if (!isDoor(other)) return undefined;
  const p = other.permutation;
  const same = p.getState("minecraft:cardinal_direction") === perm.getState("minecraft:cardinal_direction");
  return same && p.getState(`${NS}:hinge_right`) !== hingeRight ? other : undefined;
}

const components = {
  "lothlorien:toggleable": {
    onPlayerInteract({ block, dimension }, { params }) {
      const next = !block.permutation.getState(params.block_state);
      setState(block, params.block_state, next);
      dimension.playSound(next ? params.enable_sound : params.disable_sound, block.center());
    },
  },

  "lothlorien:door": {
    beforeOnPlayerPlace(event) {
      const perm = event.permutationToPlace;
      const facing = perm.getState("minecraft:cardinal_direction");
      const left = LEFT_OF_FACING[facing];
      if (!left) return;
      const { x, y, z } = event.block.location;
      const leftBlock = event.block.dimension.getBlock({ x: x + left[0], y, z: z + left[1] });
      event.permutationToPlace = perm.withState(`${NS}:hinge_right`, isDoor(leftBlock));
    },
    onPlayerInteract({ block, dimension }, { params }) {
      const next = !block.permutation.getState(params.block_state);
      setDoorOpen(block, params.block_state, next);
      const partner = doublePartner(block);
      if (partner) setDoorOpen(partner, params.block_state, next);
      dimension.playSound(next ? params.enable_sound : params.disable_sound, block.center());
    },
  },

  // Redstone opening. The engine also sends redstone updates on placement and chunk load, so the
  // block stores the last power state it acted on and only reacts to a real change; open follows power.
  "lothlorien:redstone_toggle": {
    onRedstoneUpdate({ block, dimension, powerLevel }, { params }) {
      const parts = block.getParts?.() ?? [block];
      const powered = Math.max(powerLevel, ...parts.map((p) => p.getRedstonePower() ?? 0)) > 0;
      if (powered === block.permutation.getState(params.powered_state)) return;
      for (const part of parts) {
        part.setPermutation(
          part.permutation.withState(params.powered_state, powered).withState(params.open_state, powered)
        );
      }
      dimension.playSound(powered ? params.enable_sound : params.disable_sound, block.center());
    },
  },

  "lothlorien:button": {
    onPlayerInteract({ block, dimension }, { params }) {
      if (block.permutation.getState(`${NS}:powered`)) return;
      setState(block, `${NS}:powered`, true);
      dimension.playSound(CLICK, block.center(), { pitch: 0.6 });
      const { location } = block;
      const id = block.typeId;
      system.runTimeout(() => {
        const b = dimension.getBlock(location);
        if (b?.typeId !== id || !b.permutation.getState(`${NS}:powered`)) return;
        setState(b, `${NS}:powered`, false);
        dimension.playSound(CLICK, b.center(), { pitch: 0.5 });
      }, params.ticks ?? 30);
    },
  },

  "lothlorien:pressure_plate": {
    // minecraft:tick polls; the plate has no collision so step events are not relied on.
    onTick({ block, dimension }) {
      const { x, y, z } = block.location;
      const pressed = dimension
        .getEntities({ location: { x: x + 0.5, y: y + 0.5, z: z + 0.5 }, maxDistance: 1.5 })
        .some((e) => {
          const l = e.location;
          return l.x > x - 0.3 && l.x < x + 1.3 && l.z > z - 0.3 && l.z < z + 1.3 && l.y >= y - 0.1 && l.y < y + 0.6;
        });
      if (pressed === block.permutation.getState(`${NS}:powered`)) return;
      setState(block, `${NS}:powered`, pressed);
      dimension.playSound(CLICK, block.center(), { pitch: pressed ? 0.8 : 0.7 });
    },
  },
};

system.beforeEvents.startup.subscribe(({ blockComponentRegistry }) => {
  // literal ids, so the workspace verifier can match them against the block JSON
  blockComponentRegistry.registerCustomComponent("lothlorien:toggleable", components["lothlorien:toggleable"]);
  blockComponentRegistry.registerCustomComponent("lothlorien:door", components["lothlorien:door"]);
  blockComponentRegistry.registerCustomComponent("lothlorien:redstone_toggle", components["lothlorien:redstone_toggle"]);
  blockComponentRegistry.registerCustomComponent("lothlorien:button", components["lothlorien:button"]);
  blockComponentRegistry.registerCustomComponent("lothlorien:pressure_plate", components["lothlorien:pressure_plate"]);
});

// Buttons and plates have no support-loss handling of their own: when a block is broken, drop any
// of ours that were attached to it.
const ATTACHED_TO = {
  [`${NS}:mallorn_pressure_plate`]: () => [0, -1, 0],
  [`${NS}:mallorn_button`]: (perm) =>
    ({ up: [0, -1, 0], down: [0, 1, 0], north: [0, 0, 1], south: [0, 0, -1], west: [1, 0, 0], east: [-1, 0, 0] })[
      perm.getState("minecraft:block_face")
    ],
};
const NEIGHBOURS = [
  [0, 1, 0], [0, -1, 0], [1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1],
];

world.afterEvents.playerBreakBlock.subscribe(({ block, dimension }) => {
  const { x, y, z } = block.location;
  for (const [dx, dy, dz] of NEIGHBOURS) {
    const n = dimension.getBlock({ x: x + dx, y: y + dy, z: z + dz });
    const attached = n && ATTACHED_TO[n.typeId]?.(n.permutation);
    if (!attached) continue;
    if (n.location.x + attached[0] === x && n.location.y + attached[1] === y && n.location.z + attached[2] === z) {
      dimension.runCommand(`setblock ${n.location.x} ${n.location.y} ${n.location.z} air destroy`);
    }
  }
});

// --- Axe strips logs/wood; slabs merge. Done as world events so ordinary placement against these
// blocks is untouched.
const STRIPPED = {
  [`${NS}:mallorn_log`]: `${NS}:mallorn_stripped_log`,
  [`${NS}:mallorn_wood`]: `${NS}:mallorn_stripped_wood`,
};
const DOUBLE_SLAB = { [`${NS}:mallorn_slab`]: `${NS}:mallorn_double_slab` };
const FACE_OFFSET = {
  Up: [0, 1, 0], Down: [0, -1, 0], North: [0, 0, -1], South: [0, 0, 1], East: [1, 0, 0], West: [-1, 0, 0],
};

function mergeSlab(target, double, player) {
  system.run(() => {
    target.setPermutation(BlockPermutation.resolve(double));
    target.dimension.playSound("dig.wood", target.center());
    consumeHeldItem(player);
  });
}

world.beforeEvents.playerInteractWithBlock.subscribe((event) => {
  const { block, player, itemStack, blockFace, faceLocation } = event;
  if (!itemStack) return;

  const stripped = STRIPPED[block.typeId];
  if (stripped && itemStack.typeId.endsWith("_axe")) {
    event.cancel = true;
    system.run(() => {
      const face = block.permutation.getState("minecraft:block_face");
      block.setPermutation(
        BlockPermutation.resolve(stripped, face === undefined ? {} : { "minecraft:block_face": face })
      );
      block.dimension.playSound("use.wood", block.center());
      damageHeldTool(player);
    });
    return;
  }

  const double = DOUBLE_SLAB[itemStack.typeId];
  if (!double) return;
  const side = blockFace !== "Up" && blockFace !== "Down";

  // 1. Clicking the slab itself: top of a bottom slab, underside of a top slab, or the matching half of a side face.
  if (block.typeId === itemStack.typeId) {
    const half = block.permutation.getState("minecraft:vertical_half");
    const upper = faceLocation.y >= 0.5;
    const merges =
      half === "bottom" ? blockFace === "Up" || (side && upper) : blockFace === "Down" || (side && !upper);
    if (merges) {
      event.cancel = true;
      mergeSlab(block, double, player);
    }
    return;
  }

  // 2. Clicking a neighbouring block whose face points into a cell that already holds a slab: the
  //    new slab would take the half chosen by the click; if that half is empty, merge.
  const [dx, dy, dz] = FACE_OFFSET[blockFace];
  const { x, y, z } = block.location;
  const target = block.dimension.getBlock({ x: x + dx, y: y + dy, z: z + dz });
  if (target?.typeId !== itemStack.typeId) return;
  const wanted = blockFace === "Up" ? "bottom" : blockFace === "Down" ? "top" : faceLocation.y >= 0.5 ? "top" : "bottom";
  if (wanted !== target.permutation.getState("minecraft:vertical_half")) {
    event.cancel = true;
    mergeSlab(target, double, player);
  }
});

// --- Stair corners. The shape is computed here with the Java-edition rules, so left/right and
// inner/outer are ours and match the geometry (the engine's minecraft:corner state did not).
const STAIRS = `${NS}:mallorn_stairs`;
const DIR_OFFSET = { north: [0, -1], south: [0, 1], east: [1, 0], west: [-1, 0] };
const COUNTER_CLOCKWISE = { north: "west", west: "south", south: "east", east: "north" };
const OPPOSITE = { north: "south", south: "north", east: "west", west: "east" };

function stairAt(block, dir) {
  const [dx, dz] = DIR_OFFSET[dir];
  const { x, y, z } = block.location;
  const other = block.dimension.getBlock({ x: x + dx, y, z: z + dz });
  return stairInfo(other);
}

function stairInfo(block) {
  if (block?.typeId !== STAIRS) return undefined;
  return {
    facing: block.permutation.getState("minecraft:cardinal_direction"),
    half: block.permutation.getState("minecraft:vertical_half"),
  };
}

const isNorthSouth = (dir) => dir === "north" || dir === "south";

function stairShape(block) {
  const self = stairInfo(block);
  const identical = (o) => o && o.facing === self.facing && o.half === self.half;
  const front = stairAt(block, self.facing);
  if (front && front.half === self.half && isNorthSouth(front.facing) !== isNorthSouth(self.facing)) {
    if (!identical(stairAt(block, OPPOSITE[front.facing]))) {
      return front.facing === COUNTER_CLOCKWISE[self.facing] ? "outer_left" : "outer_right";
    }
  }
  const back = stairAt(block, OPPOSITE[self.facing]);
  if (back && back.half === self.half && isNorthSouth(back.facing) !== isNorthSouth(self.facing)) {
    if (!identical(stairAt(block, back.facing))) {
      return back.facing === COUNTER_CLOCKWISE[self.facing] ? "inner_left" : "inner_right";
    }
  }
  return "straight";
}

function refreshStair(block) {
  if (!stairInfo(block)) return;
  const shape = stairShape(block);
  if (block.permutation.getState(`${NS}:shape`) !== shape) setState(block, `${NS}:shape`, shape);
}

function refreshStairsAround(block) {
  refreshStair(block);
  for (const [dx, dz] of Object.values(DIR_OFFSET)) {
    const { x, y, z } = block.location;
    refreshStair(block.dimension.getBlock({ x: x + dx, y, z: z + dz }));
  }
}

world.afterEvents.playerPlaceBlock.subscribe(({ block }) => {
  if (block.typeId === STAIRS) refreshStairsAround(block);
});

world.afterEvents.playerBreakBlock.subscribe(({ block }) => refreshStairsAround(block));
