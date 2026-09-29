// Giant Mallorn with a flet (Phase 5): a 4x4 trunk 30-38 high, a plank platform with a fence rim on
// level branches under the crown, a ladder up the north face of the trunk through a hole in the
// platform, and a loot chest. Pure (no Minecraft imports): tools/build_structures.mjs turns the result
// into a .mcstructure for world generation.
//
// Coordinates are relative to the north-west trunk cell at ground level: the trunk fills x,z 0..3,
// y 0 is the first block above the ground, roots go down to y -ROOT_DEPTH.
import { makeBuilder, DIRS8 } from "../lothlorien_bp/scripts/mallorn_tree.js";

export const ROOT_DEPTH = 5;
export const LADDER = { x: 0, z: -1 }; // ladder column: north face of the trunk, facing north
// Leaf decay (trees.js) breaks a leaf more than 10 steps through leaves from Mallorn wood. Generated
// leaves farther than this are dropped, keeping a margin, so no crown thins out after generation.
export const LEAF_KEEP = 8;

const NS = "lothlorien";
export const B = {
  log: `${NS}:mallorn_log`,
  leaves: `${NS}:mallorn_leaves`,
  planks: `${NS}:mallorn_planks`,
  fence: `${NS}:mallorn_fence`,
  ladder: "minecraft:ladder",
  chest: "minecraft:chest",
};
export const FLET_LOOT = "loot_tables/chests/mallorn_flet.json";

const key = (x, y, z) => `${x},${y},${z}`;
const TRUNK = [];
for (let x = 0; x < 4; x++) for (let z = 0; z < 4; z++) TRUNK.push([x, z]);
const isTrunk = (x, z) => x >= 0 && x <= 3 && z >= 0 && z <= 3;
const fromCentre = (x, z) => Math.hypot(x + 0.5 - 2, z + 0.5 - 2);
// A branch leaves the trunk edge cell nearest its direction; straight N/S/E/W branches start from one of
// the two middle cells, so no branch runs up the ladder column (x 0 on the north face).
const startCell = (d, random) => (d > 0 ? 3 : d < 0 ? 0 : 1 + (random() < 0.5 ? 1 : 0));

// Options (both off = the original flet design; the defaults must keep producing the same trees per seed):
//   woven  the support branches run at floor level, through the platform, and the planks fill the gaps
//          between them; the branch ends still reach past the rim and carry the leaves
//   lush   more foliage below the platform: longer low branches that always carry leaves, plus one or two
//          whorls of leafy level branches on the bare trunk
// Returns { height, floorY, blocks: Map<"x,y,z", { name, states, loot? }>, trimmed }.
export function buildFletMallorn(random, { woven = false, lush = false } = {}) {
  const b = makeBuilder(random);
  const height = b.between([30, 38]);
  const floorY = height - b.between([9, 12]);
  const radius = 5.5 + random() * 1.5;

  // trunk, sunk into the ground so it stands on slopes; the top narrows to 2x2
  for (let y = -ROOT_DEPTH; y < height; y++) for (const [x, z] of TRUNK) b.addLog(x, y, z, "up");
  const top = 3 + Math.floor(random() * 3);
  for (let y = height; y < height + top; y++) for (const [x, z] of [[1, 1], [2, 1], [1, 2], [2, 2]]) b.addLog(x, y, z, "up");

  // buttress roots around the base
  for (let i = 0; i < 4; i++) {
    const [ox, oz] = [[-1, 0], [4, 0], [0, -1], [0, 4]][i];
    for (let j = 0; j < 4; j++) {
      const x = ox === 0 ? j : ox, z = oz === 0 ? j : oz;
      if (x === LADDER.x && z === LADDER.z) continue;
      if (random() < 0.55) {
        const h = b.between([-1, 3]);
        for (let y = -ROOT_DEPTH; y <= h; y++) b.addLog(x, y, z, "up");
      }
    }
  }

  // platform support: level branches just under the floor (woven: in it), poking out past its edge, leaves
  // hanging below
  const branchY = woven ? floorY : floorY - 1;
  b.shuffled().slice(0, 6 + Math.floor(random() * 3)).forEach(([dx, dz]) => {
    let x = startCell(dx, random), z = startCell(dz, random);
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
    b.branch(startCell(dx, random), startCell(dz, random), dx, dz, b.between([6, floorY - 8]), b.between([3, 6]), 0.3,
      random() < 0.5 ? 1.8 : 0);
  }

  // lush: whorls of level branches on the bare trunk, each with a leaf blob, and longer leafy low branches
  if (lush) {
    const whorls = floorY > 20 ? 2 : 1;
    for (let w = 0; w < whorls; w++) {
      const y = Math.round(6 + ((floorY - 10) * (w + 1)) / (whorls + 1)) + b.between([-1, 1]);
      b.shuffled().slice(0, 3 + Math.floor(random() * 3)).forEach(([dx, dz]) =>
        b.branch(startCell(dx, random), startCell(dz, random), dx, dz, y, b.between([3, 6]), 0.2, 2.0 + random() * 0.8));
    }
    for (let i = 0, n = b.between([3, 5]); i < n; i++) {
      const [dx, dz] = DIRS8[Math.floor(random() * 8)];
      b.branch(startCell(dx, random), startCell(dz, random), dx, dz, b.between([5, floorY - 6]), b.between([4, 7]), 0.35,
        1.8 + random() * 0.7);
    }
  }

  // crown: rising branches round the trunk, each with a leaf blob, a blob hugging the trunk, and a cap
  const rising = b.between([8, 11]);
  const dirs = b.shuffled();
  for (let i = 0; i < rising; i++) {
    const [dx, dz] = dirs[i % 8];
    b.branch(startCell(dx, random), startCell(dz, random), dx, dz, b.between([floorY + 4, height - 3]), b.between([5, 9]), 0.45,
      2.6 + random());
  }
  b.blob(2, height - 1, 2, 5.5, 3.5, floorY + 5, 1.0);
  b.blob(2, height + top, 2, 4.5, 3.5, height, 0.8);

  const tree = b.result(height + top);
  const blocks = new Map();
  for (const c of tree.leaves) blocks.set(key(c.x, c.y, c.z), { name: B.leaves, states: { [`${NS}:persistent`]: false } });
  for (const c of tree.logs) blocks.set(key(c.x, c.y, c.z), { name: B.log, states: { "minecraft:block_face": c.face } });

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

  // ladder from the ground through a hole in the floor; its column and the space in front stay clear
  for (let y = 0; y <= floorY + 3; y++) {
    const front = key(LADDER.x, y, LADDER.z - 1);
    if ([B.leaves, B.log].includes(blocks.get(front)?.name)) blocks.delete(front);
    blocks.delete(key(LADDER.x, y, LADDER.z));
    if (y <= floorY) blocks.set(key(LADDER.x, y, LADDER.z), { name: B.ladder, states: { facing_direction: 2 } });
  }

  // loot chest against the east face of the trunk, opening away from it
  blocks.set(key(4, floorY + 1, 1), { name: B.chest, states: { "minecraft:cardinal_direction": "east" }, loot: FLET_LOOT });

  return { height: height + top, floorY, radius, blocks, trimmed: trimFarLeaves(blocks) };
}

// Drops leaves more than LEAF_KEEP steps (through leaves) from a log; returns how many went.
function trimFarLeaves(blocks) {
  const dist = new Map();
  let frontier = [];
  for (const [k, v] of blocks) if (v.name === B.log) { dist.set(k, 0); frontier.push(k); }
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
