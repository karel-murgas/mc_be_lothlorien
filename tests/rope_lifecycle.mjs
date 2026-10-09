// Exercise real rope removal/event callbacks with an offline engine substitute.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as rules from "../lothlorien_bp/scripts/elven_rope_rules.js";

const breaks = [], explosions = [];
globalThis.__ropeLifecycle = { ...rules,
  BlockPermutation: {}, EquipmentSlot: {}, GameMode: { Creative: "creative" },
  ItemStack: class { constructor(typeId, amount) { this.typeId = typeId; this.amount = amount; } },
  repeatedUse: () => false,
  system: { beforeEvents: { startup: { subscribe() {} } } },
  world: { afterEvents: { playerBreakBlock: { subscribe(fn) { breaks.push(fn); } },
    blockExplode: { subscribe(fn) { explosions.push(fn); } } } },
};
const src = readFileSync(new URL("../lothlorien_bp/scripts/elven_rope.js", import.meta.url), "utf8")
  .replace(/^import \{([^}]+)\} from "[^"]+";/gm, "const {$1} = globalThis.__ropeLifecycle;");
const { dropWholeRope } = await import(`data:text/javascript;base64,${Buffer.from(src).toString("base64")}`);
delete globalThis.__ropeLifecycle;

function rope(typeId = "lothlorien:elven_rope") {
  const cells = new Map(), items = [];
  const permutation = (id, face = "north") => ({ type: { id }, getState: () => face });
  const dimension = { getBlock(p) { return cells.get(`${p.x},${p.y},${p.z}`); },
    spawnItem(stack) { items.push(stack); } };
  for (let y = 0; y <= 2; y++) {
    const block = { typeId, location: { x: 0, y, z: 0 }, dimension, permutation: permutation(typeId),
      setType(id) { this.typeId = id; this.permutation = permutation(id); } };
    cells.set(`0,${y},0`, block);
  }
  const center = cells.get("0,1,0"), before = center.permutation;
  const nativePop = () => { center.setType("minecraft:air"); items.push({ typeId: "lothlorien:elven_rope", amount: 1 }); };
  const count = () => items.reduce((sum, stack) => sum + stack.amount, 0);
  const empty = () => [...cells.values()].every(b => b.typeId === "minecraft:air");
  return { center, before, nativePop, dimension, count, empty };
}
for (const id of ["lothlorien:elven_rope", "lothlorien:elven_rope_hanging"]) {
  {
    const r = rope(id); r.nativePop();
    for (const fn of breaks) fn({ block: r.center, brokenBlockPermutation: r.before, player: { getGameMode: () => "survival" } });
    assert.equal(r.count(), 3, `${id}: native broken piece plus two remaining pieces`);
    assert.ok(r.empty());
  }
  {
    const r = rope(id); r.center.setType("minecraft:air");
    for (const fn of breaks) fn({ block: r.center, brokenBlockPermutation: r.before, player: { getGameMode: () => "creative" } });
    assert.equal(r.count(), 0, `${id}: creative removes every piece without loot`);
    assert.ok(r.empty());
  }
  {
    const r = rope(id); r.nativePop();
    for (const fn of explosions) fn({ block: r.center, dimension: r.dimension, explodedBlockPermutation: r.before });
    assert.equal(r.count(), 3, `${id}: explosion callback does not repeat native piece loot`);
    assert.ok(r.empty());
  }
  {
    const r = rope(id);
    dropWholeRope(r.dimension, r.center.location, "north");
    dropWholeRope(r.dimension, r.center.location, "north");
    assert.equal(r.count(), 3, `${id}: supported column detachment is idempotent`);
    assert.ok(r.empty());
  }
}
console.log("ok   production rope lifecycle: survival, creative, explosion, support teardown and both block variants");
