// Deer antler block support rule. Pure, so tests/run.mjs can check it offline; antler.js wires it up.
//
// `minecraft:block_face` holds the face of the support block that was clicked, so the support lies on the
// opposite side of the antler: clicked top ("up") -> support below; clicked underside ("down") -> support above;
// clicked north face -> the block north of the support is the antler, so the support is to the antler's south.
const SUPPORT_OFFSET = {
  up: { x: 0, y: -1, z: 0 },
  down: { x: 0, y: 1, z: 0 },
  north: { x: 0, y: 0, z: 1 },
  south: { x: 0, y: 0, z: -1 },
  east: { x: -1, y: 0, z: 0 },
  west: { x: 1, y: 0, z: 0 },
};

export function supportOffset(face) {
  return SUPPORT_OFFSET[face];
}

// Like an item frame, the antler needs a block to hang on: air or liquid there means it falls off.
// `support` is { isAir, isLiquid } of the block, or undefined when it is not loaded (then keep the antler).
export function isUnsupported(support) {
  if (!support) return false;
  return support.isAir || support.isLiquid;
}
