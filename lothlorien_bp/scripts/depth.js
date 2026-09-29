// Depth inside Lothlorien: how far the player is from the nearest border. Biome data cannot
// say this, so rings of surface points around the player are probed and the first ring
// holding a foreign biome bounds the border distance. Pure (no @minecraft/server) so that
// tests/run.mjs can check it offline; main.js supplies the in-game sampler.

export const DEPTH_RADII = [8, 16, 24, 32, 40];
// Border within EDGE_LIMIT = edge, within INNER_LIMIT = inner, farther = heart.
export const EDGE_LIMIT = 16;
export const INNER_LIMIT = 40;
// Max arc between neighbouring probes of a ring, so narrow tongues of foreign biome are
// not missed on the outer rings.
export const PROBE_SPACING = 10;
export const DEPTH_NAMES = ["outside", "edge", "inner", "heart"];

export function ringOffsets(r) {
  const n = Math.max(8, Math.ceil((2 * Math.PI * r) / PROBE_SPACING));
  const offsets = [];
  for (let i = 0; i < n; i++) {
    const a = (2 * Math.PI * i) / n;
    offsets.push([Math.round(r * Math.cos(a)), Math.round(r * Math.sin(a))]);
  }
  return offsets;
}

export function probeCount() {
  return 1 + DEPTH_RADII.reduce((sum, r) => sum + ringOffsets(r).length, 0);
}

function levelFor(borderDistance) {
  return borderDistance <= EDGE_LIMIT ? 1 : borderDistance <= INNER_LIMIT ? 2 : 3;
}

// sample(dx, dz) returns the biome id at that surface offset, or undefined when it cannot be
// read (unloaded chunk). `transparent` ids (rivers) count as inside the biome.
// Returns { level, distance, beyond, complete }: distance is the radius of the first ring with
// a foreign point (Infinity if none; the border is then farther than `beyond`). An unreadable probe stops the search, because the border
// could be exactly there; the level is then the lowest one still certain and complete=false.
export function estimateDepth(sample, biomeId, transparent) {
  const outside = { level: 0, distance: 0, complete: true };
  const here = sample(0, 0);
  if (here !== biomeId && !transparent.has(here)) return outside;
  // Standing in a river counts only if Lothlorien is seen before the first foreign ring.
  let sawBiome = here === biomeId;
  let lastClean = 0;
  for (const r of DEPTH_RADII) {
    let foreign = false, unknown = false;
    for (const [dx, dz] of ringOffsets(r)) {
      const id = sample(dx, dz);
      if (id === undefined) unknown = true;
      else if (id === biomeId) sawBiome = true;
      else if (!transparent.has(id)) foreign = true;
    }
    if (foreign) return sawBiome ? { level: levelFor(r), distance: r, complete: true } : outside;
    if (unknown) return sawBiome ? { level: levelFor(lastClean + 1), distance: Infinity, beyond: lastClean, complete: false } : { ...outside, complete: false };
    lastClean = r;
  }
  return sawBiome ? { level: 3, distance: Infinity, beyond: lastClean, complete: true } : outside;
}
