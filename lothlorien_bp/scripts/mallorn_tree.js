// Small Mallorn generator (Phase 4). Pure: no Minecraft imports, so it can be run and measured
// under plain Node (tests/tree_stats.mjs). Coordinates are relative to the sapling cell (0,0,0).
//
// Shape: every tree first draws an archetype (slender, round, spreading, tiered, tall) that sets height
// (6-13), crown size and branch habit. Straight trunk; 3-5 level branches at one height just under the
// crown (a base for a platform), 0-3 short branches lower down, and rising branches through the crown,
// each with a leaf blob. The crown is a main blob plus off-centre blobs, so bottoms come out uneven.
// Leaves never replace logs.

export function makeRandom(seed) {
  // mulberry32
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const key = (x, y, z) => `${x},${y},${z}`;

const ARCHETYPES = [
  // height [min,max], crown radius, crown half-height, upper branches [min,max], branch length [min,max], leaf-blob radius
  { name: "slender", h: [9, 13], rx: 2.4, ry: 3.8, br: [1, 3], len: [2, 3], blob: 1.6 },
  { name: "round", h: [7, 11], rx: 3.4, ry: 3.2, br: [2, 4], len: [2, 4], blob: 2.0 },
  { name: "spreading", h: [6, 10], rx: 4.0, ry: 2.4, br: [3, 5], len: [3, 5], blob: 2.3 },
  { name: "tiered", h: [8, 13], rx: 2.8, ry: 2.6, br: [3, 5], len: [2, 4], blob: 2.1 },
  { name: "tall", h: [10, 13], rx: 3.0, ry: 4.2, br: [1, 3], len: [2, 4], blob: 1.9 },
];

const DIRS8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];

// Returns { height, logs: [{x,y,z,face}], leaves: [{x,y,z}] }.
// `face` is the minecraft:block_face of the log: "up" for the trunk, "east"/"south" for branches.
export function buildSmallMallorn(random) {
  const A = ARCHETYPES[Math.floor(random() * ARCHETYPES.length)];
  const between = ([lo, hi]) => lo + Math.floor(random() * (hi - lo + 1));
  const height = between(A.h);
  const logs = new Map();
  const leaves = new Map();

  // straight trunk
  const trunk = [];
  for (let y = 0; y < height; y++) {
    trunk.push([0, 0]);
    logs.set(key(0, y, 0), { x: 0, y, z: 0, face: "up" });
  }

  const blob = (cx, cy, cz, rx, ry, minY, roughness) => {
    const ex = Math.ceil(rx), ey = Math.ceil(ry);
    for (let dx = -ex; dx <= ex; dx++) {
      for (let dy = -ey; dy <= ey; dy++) {
        for (let dz = -ex; dz <= ex; dz++) {
          const y = cy + dy;
          if (y < minY) continue;
          const d = (dx * dx + dz * dz) / (rx * rx) + (dy * dy) / (ry * ry);
          if (d > 1 + (random() - 0.5) * roughness) continue;
          leaves.set(key(cx + dx, y, cz + dz), { x: cx + dx, y, z: cz + dz });
        }
      }
    }
  };

  // crown: main blob on the trunk top, sometimes pushed off-centre, plus a cap
  const [topX, topZ] = trunk[height - 1];
  const off = () => (random() < 0.5 ? 0 : Math.round((random() - 0.5) * 2));
  const crownY = height - 1 + Math.round((random() - 0.5) * 2);
  const crownMin = height - 3 - Math.floor(random() * 3);
  blob(topX + off(), crownY, topZ + off(), A.rx * (0.85 + random() * 0.3), A.ry * (0.85 + random() * 0.3), crownMin, 1.1);
  leaves.set(key(topX, height, topZ), { x: topX, y: height, z: topZ });
  if (random() < 0.7) leaves.set(key(topX, height + 1, topZ), { x: topX, y: height + 1, z: topZ });

  // Branches leave the trunk at (0,0) and are drawn by one helper. `rise` is the chance a step also goes up.
  const branch = (dx, dz, y0, len, rise, blobR) => {
    let x = 0, z = 0, y = y0;
    for (let i = 1; i <= len; i++) {
      // a diagonal branch alternates x and z steps
      const stepX = dx !== 0 && (dz === 0 || i % 2 === 1);
      if (stepX) x += dx; else z += dz;
      if (random() < rise) y += 1;
      logs.set(key(x, y, z), { x, y, z, face: stepX ? "east" : "south" });
    }
    if (blobR > 0) blob(x, y + 1, z, blobR, blobR * 0.8, y - 2 + Math.floor(random() * 2), 0.7);
  };
  const shuffled = () => DIRS8.map((d) => [random(), d]).sort((a, b) => a[0] - b[0]).map((e) => e[1]);

  // platform level: 3-5 branches in different directions, all at one height and level (no rise), just below
  // the crown, so together they form a base a player can build a platform on
  const floorY = Math.max(2, height - 4);
  const platform = 3 + Math.floor(random() * 3);
  shuffled().slice(0, platform).forEach(([dx, dz]) => branch(dx, dz, floorY, between([2, 4]), 0, A.blob * 0.8));

  // a few bare-ish side branches lower down the trunk, at random heights
  const low = Math.floor(random() * 4);
  for (let i = 0; i < low && floorY > 3; i++) {
    const [dx, dz] = DIRS8[Math.floor(random() * 8)];
    branch(dx, dz, 2 + Math.floor(random() * (floorY - 2)), between([1, 3]), 0.3, random() < 0.5 ? 1.2 : 0);
  }

  // upper branches through the crown, rising
  const upper = between(A.br);
  for (let i = 0; i < upper; i++) {
    const [dx, dz] = DIRS8[Math.floor(random() * 8)];
    const y = floorY + 1 + Math.floor(random() * Math.max(1, height - 1 - floorY));
    branch(dx, dz, Math.min(y, height - 1), between(A.len), 0.4, A.blob * (0.75 + random() * 0.5));
  }

  for (const k of logs.keys()) leaves.delete(k);
  return { height, logs: [...logs.values()], leaves: [...leaves.values()] };
}
