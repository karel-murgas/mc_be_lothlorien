// Shape of an Elven village bridge as a plain block list (pure JS: no fs, no Node or Bedrock imports), shared by the village
// generator (tools/build_village.mjs) and, later, a runtime loop-closer that builds the same bridge between two facing exits.
//
// bridgeShape(length, offset, rise) -> { size: [w, h, length], cells, rails, connectors, walk }
//   length  cells along z (north end z = 0, south end z = length - 1), >= |offset| + 3
//   offset  sideways shift of the south exit relative to the north exit, in blocks (+ = east, - = west); the shift runs as a
//           45 degree diagonal, one block sideways per block forward, centred between two straight runs
//   rise    arch height in blocks (0.5 steps allowed): the deck climbs one half block (plank / bottom slab) per cell from both ends
// Local coordinates: x 0..w-1 (w = 5 + |offset|), y 0 = connector deck layer, z 0..length-1.
//   cells      [{x, y, z, kind}] kind: "plank" | "slab_bottom" | "slab_top" (supports the bottom slab above) | "air" (3 cells headroom)
//   rails      [{x, y, z, sides}] fence posts one above the deck on the outer edge; sides = connection sides ("north"|"south"|"west"|"east")
//              so the rail is one face-adjacent line (steps get an extra post, the diagonal gets outside corner posts);
//              the end rows link north / south to the neighbouring piece
//   connectors [{x, y: 0, z, facing}] the two exits, centre of the 3-wide walk
//   walk       [[x, y, z]] feet cells (3 wide per row) for light / reach checks
export function bridgeShape(length, offset, rise) {
  const sh = Math.abs(offset), W = 5 + sh, top = Math.round(2 * rise);
  if (length < sh + 3) throw new Error(`bridgeShape: length ${length} too short for offset ${offset}`);
  const z0 = Math.floor((length - 1 - sh) / 2); // first row of the diagonal
  const cx = (z) => Math.min(Math.max(z - z0, 0), sh); // west edge of the 5-wide deck in the unmirrored shape; z < 0 and z >= length extend the end rows
  const flip = offset < 0, mx = (x) => (flip ? W - 1 - x : x);
  const isDeck = (x, z) => x >= cx(z) && x <= cx(z) + 4;
  const kOf = (z) => Math.min(z, length - 1 - z, top);
  const layerOf = (k) => (k % 2 === 0 ? k / 2 : (k + 1) / 2);
  const cells = [], walk = [], rails = new Map(), forced = new Map(); // rails: "x,y,z" -> true (unmirrored coordinates)
  const rk = (x, y, z) => `${x},${y},${z}`;
  for (let z = 0; z < length; z++) {
    const k = kOf(z), L = layerOf(k);
    for (let x = cx(z); x <= cx(z) + 4; x++) {
      cells.push({ x: mx(x), y: L, z, kind: k % 2 === 0 ? "plank" : "slab_bottom" });
      if (k % 2 === 1) cells.push({ x: mx(x), y: L - 1, z, kind: "slab_top" });
      for (let h = 1; h <= 3; h++) cells.push({ x: mx(x), y: L + h, z, kind: "air" });
      if (x >= cx(z) + 1 && x <= cx(z) + 3) walk.push([mx(x), L + 1, z]);
      if (isDeck(x - 1, z) && isDeck(x + 1, z) && isDeck(x, z - 1) && isDeck(x, z + 1)) continue; // not on the edge
      rails.set(rk(x, L + 1, z), true);
      if (z === 0) forced.set(rk(x, L + 1, z), ["north"]);
      if (z === length - 1) forced.set(rk(x, L + 1, z), ["south"]);
    }
  }
  // diagonal: where the deck edge moves one block sideways, the two edge posts only touch at a corner; an extra post just outside
  // the deck (in the row it belongs to) makes the line face-adjacent (west edge: row z + 1; east edge: row z)
  for (let z = 0; z < length - 1; z++) {
    if (cx(z + 1) === cx(z)) continue;
    rails.set(rk(cx(z + 1) - 1, layerOf(kOf(z + 1)) + 1, z + 1), true); // west: the cell left of row z + 1's edge
    rails.set(rk(cx(z) + 5, layerOf(kOf(z)) + 1, z), true); // east: the cell right of row z's edge
  }
  // arch steps: where the rail rises one block between neighbouring rows, the lower post gets a post one block up
  for (const k of [...rails.keys()]) {
    const [x, y, z] = k.split(",").map(Number);
    for (const dz of [-1, 1]) if (rails.has(rk(x, y + 1, z + dz))) rails.set(rk(x, y + 1, z), true);
  }
  const out = [];
  for (const k of rails.keys()) {
    const [x, y, z] = k.split(",").map(Number), sides = [...(forced.get(k) ?? [])];
    const adj = [["north", 0, -1], ["south", 0, 1], ["west", -1, 0], ["east", 1, 0]];
    for (const [name, dx, dz] of adj) if (rails.has(rk(x + dx, y, z + dz)) && !sides.includes(name)) sides.push(name);
    const swap = { west: "east", east: "west" }; // mirrored shape: west and east swap
    out.push({ x: mx(x), y, z, sides: flip ? sides.map((s) => swap[s] ?? s) : sides });
  }
  const connectors = [{ x: mx(2), y: 0, z: 0, facing: "north" }, { x: mx(sh + 2), y: 0, z: length - 1, facing: "south" }];
  return { size: [W, layerOf(top) + 4, length], cells, rails: out, connectors, walk };
}
