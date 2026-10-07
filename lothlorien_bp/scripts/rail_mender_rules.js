// Rail mender rules. Pure, so tests/run.mjs can check them offline; rail_mender.js wires them up.
//
// Bedrock sometimes drops one fence link between two structure pieces placed one after the other (the template states
// are right, the engine overwrites one). The mender only ever turns a link ON, and only toward a block that is one of
// our own fences (the engine links those two always; `only_fences` and the shared `has_fence_connections` tag).
export const MENDER_ID = "lothlorien:rail_mender";
export const FENCE_IDS = ["lothlorien:mallorn_fence", "lothlorien:mallorn_heartwood_fence"];
export const LINKS = [
  { state: "minecraft:connection_north", dx: 0, dz: -1 },
  { state: "minecraft:connection_south", dx: 0, dz: 1 },
  { state: "minecraft:connection_east", dx: 1, dz: 0 },
  { state: "minecraft:connection_west", dx: -1, dz: 0 },
];
// Box scanned around the marker: bigger than the largest rail piece (central tree 33 x 33), covering both tower levels.
export const SCAN = { radius: 17, below: 3, above: 14 };
export const MAX_WAIT_TICKS = 600; // give up after 30 s of unloaded corners; the marker stays and fires again next load
export const RETRY_TICKS = 40;
export const START_DELAY_TICKS = 40;

export const isFence = (typeId) => FENCE_IDS.includes(typeId);

// States to switch on for the fence at `pos`. `typeAt(x, y, z)` gives the block type id or undefined when unloaded;
// `stateOf(state)` the current value of that link on this fence.
export function missingLinks(pos, typeAt, stateOf) {
  const out = [];
  for (const l of LINKS) {
    if (stateOf(l.state) === true) continue;
    if (isFence(typeAt(pos.x + l.dx, pos.y, pos.z + l.dz))) out.push(l.state);
  }
  return out;
}

// The two opposite corners of the scan box around a marker position, rounded to block coordinates.
export function scanBox(p) {
  const x = Math.floor(p.x), y = Math.floor(p.y), z = Math.floor(p.z);
  return {
    from: { x: x - SCAN.radius, y: y - SCAN.below, z: z - SCAN.radius },
    to: { x: x + SCAN.radius, y: y + SCAN.above, z: z + SCAN.radius },
  };
}
