// Pure helper for the falling-leaf effect (no Minecraft imports, so tests/run.mjs can import it).
// Given the topmost canopy block of a column, walk down through leaves and return the y of the
// first leaf whose underside is open air, i.e. where a leaf can visibly let go. `typeAt(y)` returns a
// block type id or undefined when unreadable. Returns undefined when the column has no such leaf.
export const MAX_CANOPY_DEPTH = 14;

export function leafUndersideY(topY, typeAt, isLeaf, maxDepth = MAX_CANOPY_DEPTH) {
  for (let y = topY; y > topY - maxDepth; y--) {
    const here = typeAt(y);
    if (here === undefined || !isLeaf(here)) return undefined;
    const below = typeAt(y - 1);
    if (below === undefined) return undefined;
    if (below === "minecraft:air") return y;
  }
  return undefined;
}
