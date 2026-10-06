// Giant Mallorn with a flet (Phase 5): a 4x4 trunk 30-38 high, a plank platform with a fence rim on
// level branches under the crown, a ladder up the north face of the trunk through a hole in the
// platform, and a loot chest. Pure (no Minecraft imports): tools/build_structures.mjs turns the result
// into a .mcstructure for world generation.
//
// Coordinates are relative to the north-west trunk cell at ground level: the trunk fills x,z 0..3,
// y 0 is the first block above the ground, roots go down to y -ROOT_DEPTH.
import { makeBuilder, makeRandom, DIRS8 } from "../lothlorien_bp/scripts/mallorn_tree.js";

export const ROOT_DEPTH = 5;
export const LADDER = { x: 0, z: -1 }; // ladder column: north face of the trunk, facing north
export const ROUND_LADDER = { x: 1, z: -1 }; // round trunk: the corner cell (0,0) is gone, so the ladder moves to the first face cell
// Leaf decay (trees.js) breaks a leaf more than 10 steps through leaves from Mallorn wood. Generated
// leaves farther than this are dropped, keeping a margin, so no crown thins out after generation.
export const LEAF_KEEP = 8;

const NS = "lothlorien";
export const B = {
  log: `${NS}:mallorn_log`,
  wood: `${NS}:mallorn_wood`, // bark on every face: the round trunk's foot above ground
  leaves: `${NS}:mallorn_leaves`,
  planks: `${NS}:mallorn_planks`,
  fence: `${NS}:mallorn_fence`,
  rope: `${NS}:elven_rope`, // Elven rope (Phase 17b) replaced the vanilla ladder
  chest: "minecraft:chest",
};
export const FLET_LOOT = "loot_tables/chests/mallorn_flet.json";

const key = (x, y, z) => `${x},${y},${z}`;
// The trunk's four corner cells; a round trunk leaves them out (12 cells instead of 16).
const isCorner = (x, z) => (x === 0 || x === 3) && (z === 0 || z === 3);
const fromCentre = (x, z) => Math.hypot(x + 0.5 - 2, z + 0.5 - 2);
// A branch leaves the trunk edge cell nearest its direction; straight N/S/E/W branches start from one of
// the two middle cells, so no branch runs up the ladder column (x 0 on the north face).
const startCell = (d, random) => (d > 0 ? 3 : d < 0 ? 0 : 1 + (random() < 0.5 ? 1 : 0));

// Options (both off = the original flet design; the defaults must keep producing the same trees per seed):
//   woven  the support branches run at floor level, through the platform, and the planks fill the gaps
//          between them; the branch ends still reach past the rim and carry the leaves
//   flet   false = a plain giant: the same tree without platform, ladder and chest (default true)
//   round  a rounder 4x4 trunk: the four corner cells are left out (12 cells). Branches start on the face cells
//          next to the missing corner, the ladder moves to x 1 (the corner x 0 has no trunk behind it), and the
//          the foot is rebuilt as a flare (roundFoot). Same seed = same height, floor, radius and branch directions.
//   lush   more foliage below the platform: longer low branches that always carry leaves, plus one or two
//          whorls of leafy level branches on the bare trunk
// Returns { height, floorY, blocks: Map<"x,y,z", { name, states, loot? }>, trimmed }.
export function buildFletMallorn(random, { woven = false, lush = false, flet = true, round = false } = {}) {
  const b = makeBuilder(random);
  const ladder = round ? ROUND_LADDER : LADDER;
  const TRUNK = [];
  for (let x = 0; x < 4; x++) for (let z = 0; z < 4; z++) if (!(round && isCorner(x, z))) TRUNK.push([x, z]);
  const isTrunk = (x, z) => x >= 0 && x <= 3 && z >= 0 && z <= 3 && !(round && isCorner(x, z));
  // Where a branch towards (dx, dz) leaves the trunk: [x, z] of the trunk cell it grows from (its first step is
  // along x). Round: a diagonal branch cannot start at the missing corner, so it starts on the face cell beside
  // it; a straight north branch keeps off the ladder column.
  const start = (dx, dz) => {
    const sx = startCell(dx, random);
    const sz = startCell(dz, random);
    if (!round) return [sx, sz];
    if (dx !== 0 && dz !== 0) return [sx, sz - dz];
    return dx === 0 && dz < 0 && sx === ladder.x ? [ladder.x + 1, sz] : [sx, sz];
  };
  const height = b.between([30, 38]);
  const floorY = height - b.between([9, 12]);
  const radius = 5.5 + random() * 1.5;

  // trunk, sunk into the ground so it stands on slopes; the top narrows to 2x2
  for (let y = -ROOT_DEPTH; y < height; y++) for (const [x, z] of TRUNK) b.addLog(x, y, z, "up");
  const top = 3 + Math.floor(random() * 3);
  for (let y = height; y < height + top; y++) for (const [x, z] of [[1, 1], [2, 1], [1, 2], [2, 2]]) b.addLog(x, y, z, "up");

  // buttress roots around the base. The round trunk has its own foot (roundFoot); the square one's slots are still
  // drawn, unused, so the rest of the tree stays the same for a seed.
  for (let i = 0; i < 4; i++) {
    const [ox, oz] = [[-1, 0], [4, 0], [0, -1], [0, 4]][i];
    for (let j = 0; j < 4; j++) {
      const x = ox === 0 ? j : ox, z = oz === 0 ? j : oz;
      if (x === LADDER.x && z === LADDER.z) continue;
      if (random() < 0.55) {
        const h = b.between([-1, 3]);
        if (!round) for (let y = -ROOT_DEPTH; y <= h; y++) b.addLog(x, y, z, "up");
      }
    }
  }
  if (round) roundFoot(b, makeRandom(Math.round(radius * 1e6) + height), flet ? ladder : undefined);

  // platform support: level branches just under the floor (woven: in it), poking out past its edge, leaves
  // hanging below
  // A plain giant (no flet) gets fewer of these branches, at different heights, tilted and sometimes bent.
  const branchY = woven ? floorY : floorY - 1;
  if (!flet) {
    b.shuffled().slice(0, 3 + Math.floor(random() * 4)).forEach(([dx, dz]) =>
      bentBranch(b, random, ...start(dx, dz), dx, dz, floorY + b.between([-4, 3]),
        Math.round(radius) - 1 + b.between([1, 3]), 0.2 + random() * 0.35, 2.4 + random() * 0.8));
  } else b.shuffled().slice(0, 6 + Math.floor(random() * 3)).forEach(([dx, dz]) => {
    let [x, z] = start(dx, dz);
    const len = Math.round(radius) - 1 + b.between([1, 3]);
    for (let i = 1; i <= len; i++) {
      const stepX = dx !== 0 && (dz === 0 || i % 2 === 1);
      if (stepX) x += dx; else z += dz;
      b.addLog(x, branchY, z, stepX ? "east" : "south");
    }
    b.blob(x, branchY - 1, z, 2.2 + random() * 0.8, 1.8, floorY - 5, 0.7);
  });

  // low branches on the bare trunk
  const low = 3 + Math.floor(random() * 3);
  for (let i = 0; i < low && floorY > 14; i++) {
    const [dx, dz] = DIRS8[Math.floor(random() * 8)];
    b.branch(...start(dx, dz), dx, dz, b.between([6, floorY - 8]), b.between([3, 6]), 0.3,
      random() < 0.5 ? 1.8 : 0);
  }

  // lush: whorls of level branches on the bare trunk, each with a leaf blob, and longer leafy low branches
  if (lush) {
    const whorls = floorY > 20 ? 2 : 1;
    for (let w = 0; w < whorls; w++) {
      const y = Math.round(6 + ((floorY - 10) * (w + 1)) / (whorls + 1)) + b.between([-1, 1]);
      b.shuffled().slice(0, 3 + Math.floor(random() * 3)).forEach(([dx, dz]) =>
        b.branch(...start(dx, dz), dx, dz, y, b.between([3, 6]), flet ? 0.2 : 0.35, 2.0 + random() * 0.8));
    }
    for (let i = 0, n = b.between([3, 5]); i < n; i++) {
      const [dx, dz] = DIRS8[Math.floor(random() * 8)];
      b.branch(...start(dx, dz), dx, dz, b.between([5, floorY - 6]), b.between([4, 7]), 0.35,
        1.8 + random() * 0.7);
    }
  }

  // crown: rising branches round the trunk, each with a leaf blob, a blob hugging the trunk, and a cap
  const rising = b.between([8, 11]);
  const dirs = b.shuffled();
  for (let i = 0; i < rising; i++) {
    const [dx, dz] = dirs[i % 8];
    b.branch(...start(dx, dz), dx, dz, b.between([floorY + (flet ? 4 : 1), height - 3]), b.between([5, 9]), 0.45,
      2.6 + random());
  }
  b.blob(2, height - 1, 2, 5.5, 3.5, floorY + 5, 1.0);
  b.blob(2, height + top, 2, 4.5, 3.5, height, 0.8);

  const tree = b.result(height + top);
  const blocks = new Map();
  for (const c of tree.leaves) blocks.set(key(c.x, c.y, c.z), { name: B.leaves, states: { [`${NS}:persistent`]: false } });
  for (const c of tree.logs) {
    blocks.set(key(c.x, c.y, c.z), c.face === "wood" ? { name: B.wood, states: {} } : { name: B.log, states: { "minecraft:block_face": c.face } });
  }

  // the flet: platform, rim, ladder and chest (a plain giant has none of them)
  if (flet) {
    // room to stand and to look out: no leaves from the floor to three blocks above it, well past the rim
    for (const [k, v] of blocks) {
      const [x, y, z] = k.split(",").map(Number);
      if (v.name === B.leaves && y > floorY && y <= floorY + 3 && fromCentre(x, z) <= radius + 4) blocks.delete(k);
    }

    // platform and rim (a rim cell has an 8-neighbour that is neither floor nor trunk, so the ring is 4-connected)
    const floor = new Set();
    const span = Math.ceil(radius) + 2;
    for (let x = -span; x <= span + 3; x++) {
      for (let z = -span; z <= span + 3; z++) if (!isTrunk(x, z) && fromCentre(x, z) <= radius) floor.add(`${x},${z}`);
    }
    const rim = new Set();
    for (const c of floor) {
      const [x, z] = c.split(",").map(Number);
      if (DIRS8.some(([dx, dz]) => !floor.has(`${x + dx},${z + dz}`) && !isTrunk(x + dx, z + dz))) rim.add(c);
    }
    for (const c of floor) {
      const [x, z] = c.split(",").map(Number);
      if (blocks.get(key(x, floorY, z))?.name !== B.log) blocks.set(key(x, floorY, z), { name: B.planks, states: {} });
    }
    const conn = { north: [0, -1], south: [0, 1], west: [-1, 0], east: [1, 0] };
    for (const c of rim) {
      const [x, z] = c.split(",").map(Number);
      const states = {};
      for (const [side, [dx, dz]] of Object.entries(conn)) states[`minecraft:connection_${side}`] = rim.has(`${x + dx},${z + dz}`);
      blocks.set(key(x, floorY + 1, z), { name: B.fence, states });
    }

    // rope from the ground through a hole in the floor; its column and the space in front stay clear
    for (let y = 0; y <= floorY + 3; y++) {
      const front = key(ladder.x, y, ladder.z - 1);
      if ([B.leaves, B.log, B.wood].includes(blocks.get(front)?.name)) blocks.delete(front);
      blocks.delete(key(ladder.x, y, ladder.z));
      if (y <= floorY) blocks.set(key(ladder.x, y, ladder.z), { name: B.rope, states: { [`${NS}:face`]: "north" } });
    }

    // loot chest against the east face of the trunk, opening away from it
    blocks.set(key(4, floorY + 1, 1), { name: B.chest, states: { "minecraft:cardinal_direction": "east" }, loot: FLET_LOOT });
  }

  return { height: height + top, floorY, radius, blocks, trimmed: trimFarLeaves(blocks) };
}

// The foot of a round trunk (cells 0..3, centre 1.5, 1.5): the trunk is every cell within 1.9 of the centre (the 12-cell
// shape). Round it off with a flare, the way a real trunk meets the ground:
// Above ground it is mallorn_wood (bark on every face); below ground, logs.
//  - a skirt hugging the trunk, 2 high, widest at ground level, uneven round the trunk (it fills the cut corners
//    where it is wide), and
//  - 5-7 buttress ridges fanning out in jittered directions, 1-3 cells beyond the trunk and up to 4 high at the
//    trunk. A ridge narrows and drops with every step out, so it leaves the ground as a tapering spur, not a column.
// Below ground the ground-level footprint goes down ROOT_DEPTH as anchor. `ladder` (flet trees) keeps its column
// and the cell in front of it free. rng is private to the foot, so it cannot disturb the tree's own sequence.
function roundFoot(b, rng, ladder) {
  const R0 = 1.9, C = 1.5;
  const lobes = [];
  const n = 5 + Math.floor(rng() * 3);
  for (let i = 0; i < n; i++) {
    const reach = 1 + rng() * 2;
    lobes.push({
      angle: ((i + (rng() - 0.5) * 0.7) * 2 * Math.PI) / n,
      reach, // cells beyond the trunk at ground level
      high: reach > 2.2 ? 2 + Math.floor(rng() * 2) : 3 + Math.floor(rng() * 2), // longer ridges stay lower
      wide: 0.5 + rng() * 0.4, // half-width at the trunk
    });
  }
  const skirt = 0.5 + rng() * 0.4, skirtPhase = rng() * 2 * Math.PI;
  const inFoot = (x, z, y) => {
    const dx = x - C, dz = z - C, d = Math.hypot(dx, dz), th = Math.atan2(dz, dx);
    if (d <= R0) return true;
    if (y < 2 && d <= R0 + skirt * (0.55 + 0.45 * Math.sin(3 * th + skirtPhase)) * (1 - y / 2) + 0.15) return true;
    for (const l of lobes) {
      const along = d * Math.cos(th - l.angle), across = Math.abs(d * Math.sin(th - l.angle));
      if (along <= 0 || y >= l.high) continue;
      const reachY = l.reach * (1 - y / l.high); // shorter with height
      const t = Math.max(0, (along - R0) / reachY);
      if (t <= 1 && across <= l.wide * (1 - 0.6 * t) + 0.1) return true;
    }
    return false;
  };
  for (let x = -7; x <= 10; x++) {
    for (let z = -7; z <= 10; z++) {
      if (ladder && x === ladder.x && z <= ladder.z && z >= ladder.z - 1) { // ladder column and the cell in front
        for (let y = -ROOT_DEPTH; y < 0; y++) if (inFoot(x, z, 0)) b.addLog(x, y, z, "up");
        continue;
      }
      for (let y = 0; y < 4; y++) if (inFoot(x, z, y)) b.addLog(x, y, z, "wood"); // bark on top too, not log rings
      if (inFoot(x, z, 0)) for (let y = -ROOT_DEPTH; y < 0; y++) b.addLog(x, y, z, "up");
    }
  }
}

// A branch that rises with chance `rise` per step and may turn 45 degrees once or twice on the way (never
// back towards the trunk); leaves grow along its top and a leaf blob sits on its tip.
function bentBranch(b, random, sx, sz, dx, dz, y0, len, rise, blobR) {
  const RING = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]]; // 45 degrees apart
  const r0 = RING.findIndex(([ex, ez]) => ex === dx && ez === dz);
  let x = sx, z = sz, y = y0, r = r0;
  for (let i = 1; i <= len; i++) {
    if (i > 2 && random() < 0.18) {
      const next = (r + (random() < 0.5 ? 1 : 7)) % 8;
      if ([0, 1, 7].includes((next - r0 + 8) % 8)) r = next; // at most 45 degrees off the first direction
    }
    const [cx, cz] = RING[r];
    const stepX = cx !== 0 && (cz === 0 || i % 2 === 1);
    if (stepX) x += cx; else z += cz;
    if (random() < rise) y += 1;
    b.addLog(x, y, z, stepX ? "east" : "south");
    // leaves along the top of the branch: a leaf on most steps, now and then a small tuft
    if (i > 1 && random() < 0.7) b.addLeaf(x, y + 1, z);
    if (i > 2 && random() < 0.25) b.blob(x, y + 1, z, 1.4, 1.2, y + 1, 0.5);
  }
  b.blob(x, y + 1, z, blobR, blobR * 0.8, y - 2, 0.8);
}

// Drops leaves more than LEAF_KEEP steps (through leaves) from a log; returns how many went.
export function trimFarLeaves(blocks) {
  const dist = new Map();
  let frontier = [];
  for (const [k, v] of blocks) if (v.name === B.log || v.name === B.wood) { dist.set(k, 0); frontier.push(k); }
  for (let d = 1; d <= LEAF_KEEP && frontier.length; d++) {
    const next = [];
    for (const k of frontier) {
      const [x, y, z] = k.split(",").map(Number);
      for (const [dx, dy, dz] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) {
        const n = key(x + dx, y + dy, z + dz);
        if (dist.has(n) || blocks.get(n)?.name !== B.leaves) continue;
        dist.set(n, d);
        next.push(n);
      }
    }
    frontier = next;
  }
  let trimmed = 0;
  for (const [k, v] of blocks) if (v.name === B.leaves && !dist.has(k)) { blocks.delete(k); trimmed++; }
  return trimmed;
}
