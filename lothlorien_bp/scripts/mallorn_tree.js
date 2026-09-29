// Mallorn generators (Phase 4): small (1x1 trunk) and big (2x2 trunk). Pure: no Minecraft imports, so
// they run and can be measured under plain Node (tests/tree_stats.mjs). Coordinates are relative to the
// base cell: the sapling for a small tree, the north-west (min x, min z) sapling for a big one.

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
export const DIRS8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];

// Shared drawing helpers. Logs are { x, y, z, face } (`face` = minecraft:block_face: "up" for a trunk,
// "east"/"south" for a branch along x/z); leaves are { x, y, z }. Leaves never replace logs.
export function makeBuilder(random) {
  const logs = new Map();
  const leaves = new Map();
  const between = ([lo, hi]) => lo + Math.floor(random() * (hi - lo + 1));
  const shuffled = () => DIRS8.map((d) => [random(), d]).sort((a, b) => a[0] - b[0]).map((e) => e[1]);
  const addLog = (x, y, z, face) => logs.set(key(x, y, z), { x, y, z, face });
  const addLeaf = (x, y, z) => leaves.set(key(x, y, z), { x, y, z });

  const blob = (cx, cy, cz, rx, ry, minY, roughness) => {
    const ex = Math.ceil(rx), ey = Math.ceil(ry);
    for (let dx = -ex; dx <= ex; dx++) {
      for (let dy = -ey; dy <= ey; dy++) {
        for (let dz = -ex; dz <= ex; dz++) {
          const y = cy + dy;
          if (y < minY) continue;
          const d = (dx * dx + dz * dz) / (rx * rx) + (dy * dy) / (ry * ry);
          if (d > 1 + (random() - 0.5) * roughness) continue;
          addLeaf(cx + dx, y, cz + dz);
        }
      }
    }
  };

  // A branch leaves the trunk cell (sx,sz) towards (dx,dz); `rise` is the chance a step also goes up.
  // A diagonal branch alternates x and z steps. The leaf blob sits on its tip.
  const branch = (sx, sz, dx, dz, y0, len, rise, blobR) => {
    let x = sx, z = sz, y = y0;
    for (let i = 1; i <= len; i++) {
      const stepX = dx !== 0 && (dz === 0 || i % 2 === 1);
      if (stepX) x += dx; else z += dz;
      if (random() < rise) y += 1;
      addLog(x, y, z, stepX ? "east" : "south");
    }
    if (blobR > 0) blob(x, y + 1, z, blobR, blobR * 0.8, y - 2 + Math.floor(random() * 2), 0.7);
  };

  const result = (height) => {
    for (const k of logs.keys()) leaves.delete(k);
    return { height, logs: [...logs.values()], leaves: [...leaves.values()] };
  };
  return { between, shuffled, addLog, addLeaf, blob, branch, result };
}

const ARCHETYPES = [
  // height [min,max], crown radius, crown half-height, upper branches [min,max], branch length [min,max], leaf-blob radius
  { name: "slender", h: [9, 13], rx: 2.4, ry: 3.8, br: [1, 3], len: [2, 3], blob: 1.6 },
  { name: "round", h: [7, 11], rx: 3.4, ry: 3.2, br: [2, 4], len: [2, 4], blob: 2.0 },
  { name: "spreading", h: [6, 10], rx: 4.0, ry: 2.4, br: [3, 5], len: [3, 5], blob: 2.3 },
  { name: "tiered", h: [8, 13], rx: 2.8, ry: 2.6, br: [3, 5], len: [2, 4], blob: 2.1 },
  { name: "tall", h: [10, 13], rx: 3.0, ry: 4.2, br: [1, 3], len: [2, 4], blob: 1.9 },
];

// Small Mallorn. Straight trunk; 3-5 level branches at one height just under the crown (a base for a
// platform), 0-3 short branches lower down, rising branches through the crown.
export function buildSmallMallorn(random) {
  const A = ARCHETYPES[Math.floor(random() * ARCHETYPES.length)];
  const b = makeBuilder(random);
  const height = b.between(A.h);
  for (let y = 0; y < height; y++) b.addLog(0, y, 0, "up");

  const off = () => (random() < 0.5 ? 0 : Math.round((random() - 0.5) * 2));
  const crownY = height - 1 + Math.round((random() - 0.5) * 2);
  const crownMin = height - 3 - Math.floor(random() * 3);
  b.blob(off(), crownY, off(), A.rx * (0.85 + random() * 0.3), A.ry * (0.85 + random() * 0.3), crownMin, 1.1);
  b.addLeaf(0, height, 0);
  if (random() < 0.7) b.addLeaf(0, height + 1, 0);

  const floorY = Math.max(2, height - 4);
  b.shuffled().slice(0, 3 + Math.floor(random() * 3)).forEach(([dx, dz]) =>
    b.branch(0, 0, dx, dz, floorY, b.between([2, 4]), 0, A.blob * 0.8));

  const low = Math.floor(random() * 4);
  for (let i = 0; i < low && floorY > 3; i++) {
    const [dx, dz] = DIRS8[Math.floor(random() * 8)];
    b.branch(0, 0, dx, dz, 2 + Math.floor(random() * (floorY - 2)), b.between([1, 3]), 0.3, random() < 0.5 ? 1.2 : 0);
  }

  const upper = b.between(A.br);
  for (let i = 0; i < upper; i++) {
    const [dx, dz] = DIRS8[Math.floor(random() * 8)];
    const y = floorY + 1 + Math.floor(random() * Math.max(1, height - 1 - floorY));
    b.branch(0, 0, dx, dz, Math.min(y, height - 1), b.between(A.len), 0.4, A.blob * (0.75 + random() * 0.5));
  }
  return b.result(height);
}

// Big Mallorn: 2x2 trunk on cells (0..1, 0..1), 15-24 high, flared roots, a wide crown of several
// blobs, a ring of 5-8 level platform branches (3-7 long) under the crown, low branches, rising upper branches.
export function buildBigMallorn(random) {
  const b = makeBuilder(random);
  const height = b.between([15, 24]);
  for (let y = 0; y < height; y++) for (const [x, z] of [[0, 0], [1, 0], [0, 1], [1, 1]]) b.addLog(x, y, z, "up");

  for (const [x, z] of [[-1, 0], [-1, 1], [2, 0], [2, 1], [0, -1], [1, -1], [0, 2], [1, 2]]) {
    if (random() < 0.5) b.addLog(x, 0, z, "up");
  }

  // crown: a big central blob plus 3-5 satellites, and a cap
  const rx = 4.6 + random() * 1.6, ry = 4.4 + random() * 1.6;
  const crownMin = height - 6 - Math.floor(random() * 3);
  b.blob(0, height - 1, 0, rx, ry, crownMin, 1.2);
  const sats = 3 + Math.floor(random() * 3);
  for (let i = 0; i < sats; i++) {
    const a = random() * Math.PI * 2, r = rx * (0.6 + random() * 0.4);
    b.blob(Math.round(Math.cos(a) * r), height - 2 + Math.floor(random() * 3), Math.round(Math.sin(a) * r),
      2.6 + random() * 1.6, 2.2 + random() * 1.4, crownMin - Math.floor(random() * 2), 1.0);
  }
  b.blob(0, height + 2, 0, 3, 2.4, crownMin, 0.8);

  // a branch grows from the corner/edge cell of the 2x2 nearest its direction
  const start = (d) => (d > 0 ? 1 : 0);
  const floorY = Math.max(4, height - 7);
  b.shuffled().slice(0, 5 + Math.floor(random() * 4)).forEach(([dx, dz]) =>
    b.branch(start(dx), start(dz), dx, dz, floorY, b.between([3, 7]), 0, 2.6 + random() * 1.2));

  const low = 2 + Math.floor(random() * 4);
  for (let i = 0; i < low; i++) {
    const [dx, dz] = DIRS8[Math.floor(random() * 8)];
    b.branch(start(dx), start(dz), dx, dz, 3 + Math.floor(random() * (floorY - 3)), b.between([2, 5]), 0.3, random() < 0.5 ? 1.6 : 0);
  }

  const upper = b.between([3, 6]);
  for (let i = 0; i < upper; i++) {
    const [dx, dz] = DIRS8[Math.floor(random() * 8)];
    const y = floorY + 1 + Math.floor(random() * Math.max(1, height - 1 - floorY));
    b.branch(start(dx), start(dz), dx, dz, Math.min(y, height - 1), b.between([3, 5]), 0.4, 2.2 + random() * 1.2);
  }
  return b.result(height);
}
