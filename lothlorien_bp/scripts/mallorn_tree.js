// Small Mallorn generator (Phase 4). Pure: no Minecraft imports, so it can be run and measured
// under plain Node (tests/tree_stats.mjs). Coordinates are relative to the sapling cell (0,0,0).
//
// Shape: a single-block trunk 8-11 high, a noisy ellipsoid crown around its top, and two short
// side branches each ending in a small leaf tuft. Leaves never replace logs.

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

// Returns { height, logs: [{x,y,z,face}], leaves: [{x,y,z}] }.
// `face` is the minecraft:block_face of the log: "up" for the trunk, "east"/"south" for branches.
export function buildSmallMallorn(random) {
  const height = 8 + Math.floor(random() * 4);
  const logs = new Map();
  const leaves = new Map();

  for (let y = 0; y < height; y++) logs.set(key(0, y, 0), { x: 0, y, z: 0, face: "up" });

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

  // crown
  blob(0, height - 1, 0, 3.0, 3.4, height - 5, 0.9);
  leaves.set(key(0, height, 0), { x: 0, y: height, z: 0 });
  leaves.set(key(0, height + 1, 0), { x: 0, y: height + 1, z: 0 });

  // two side branches on different sides
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const first = Math.floor(random() * 4);
  const chosen = [dirs[first], dirs[(first + 1 + Math.floor(random() * 3)) % 4]];
  for (const [dx, dz] of chosen) {
    const y = height - 4 + Math.floor(random() * 2);
    const len = 2 + Math.floor(random() * 3);
    const face = dx !== 0 ? "east" : "south";
    for (let i = 1; i <= len; i++) logs.set(key(dx * i, y, dz * i), { x: dx * i, y, z: dz * i, face });
    blob(dx * len, y + 1, dz * len, 1.9, 1.5, height - 5, 0.6);
  }

  for (const k of logs.keys()) leaves.delete(k);
  return { height, logs: [...logs.values()], leaves: [...leaves.values()] };
}
