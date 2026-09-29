// Small Mallorn generator (Phase 4). Pure: no Minecraft imports, so it can be run and measured
// under plain Node (tests/tree_stats.mjs). Coordinates are relative to the sapling cell (0,0,0).
//
// Shape: every tree first draws an archetype (slender, round, spreading, tiered, leaning) that sets
// height, crown size and branch habit. The trunk may lean; 2-6 branches leave at random heights in any
// of 8 directions, rise as they go and each carries its own leaf blob; the crown is a main blob plus
// off-centre blobs. Bottoms of crowns come out uneven because every blob has its own lowest layer.
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
  // height [min,max], crown radius, crown half-height, branches [min,max], branch length [min,max], lean chance
  { name: "slender", h: [10, 15], rx: 2.4, ry: 3.8, br: [2, 4], len: [2, 3], blob: 1.6, lean: 0.4 },
  { name: "round", h: [7, 11], rx: 3.4, ry: 3.2, br: [3, 5], len: [2, 4], blob: 2.0, lean: 0.3 },
  { name: "spreading", h: [6, 10], rx: 4.0, ry: 2.4, br: [4, 6], len: [3, 5], blob: 2.3, lean: 0.5 },
  { name: "tiered", h: [9, 14], rx: 2.8, ry: 2.6, br: [4, 6], len: [2, 4], blob: 2.1, lean: 0.2 },
  { name: "leaning", h: [8, 13], rx: 3.0, ry: 3.0, br: [2, 5], len: [2, 4], blob: 1.9, lean: 1.0 },
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

  // trunk, possibly leaning: one or two sideways shifts at random heights (each shift adds a joining log)
  let tx = 0, tz = 0;
  const shifts = new Set();
  if (random() < A.lean) {
    const n = 1 + Math.floor(random() * 2);
    for (let i = 0; i < n; i++) shifts.add(2 + Math.floor(random() * Math.max(1, height - 4)));
  }
  const lean = DIRS8[Math.floor(random() * 4)];
  const trunk = []; // trunk column position per height
  for (let y = 0; y < height; y++) {
    if (shifts.has(y)) {
      const face = lean[0] !== 0 ? "east" : "south";
      logs.set(key(tx + lean[0], y, tz + lean[1]), { x: tx + lean[0], y, z: tz + lean[1], face });
      tx += lean[0]; tz += lean[1];
    }
    trunk.push([tx, tz]);
    logs.set(key(tx, y, tz), { x: tx, y, z: tz, face: "up" });
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

  // branches: any of 8 directions, each rising as it goes; tiered trees space them over the whole trunk
  const count = between(A.br);
  const lowest = Math.max(2, Math.floor(height * (A.name === "tiered" ? 0.35 : 0.5)));
  for (let b = 0; b < count; b++) {
    const [dx, dz] = DIRS8[Math.floor(random() * 8)];
    const t = A.name === "tiered" ? b / Math.max(1, count - 1) : random();
    let y = lowest + Math.floor(t * (height - 1 - lowest));
    let [x, z] = trunk[Math.min(y, height - 1)];
    const len = between(A.len);
    for (let i = 1; i <= len; i++) {
      // a diagonal branch alternates x and z steps
      const stepX = dx !== 0 && (dz === 0 || i % 2 === 1);
      if (stepX) x += dx; else z += dz;
      if (random() < 0.4) y += 1;
      logs.set(key(x, y, z), { x, y, z, face: stepX ? "east" : "south" });
    }
    const r = A.blob * (0.75 + random() * 0.5);
    blob(x, y + 1, z, r, r * 0.8, y - 2 + Math.floor(random() * 2), 0.7);
  }

  for (const k of logs.keys()) leaves.delete(k);
  return { height, logs: [...logs.values()], leaves: [...leaves.values()] };
}
