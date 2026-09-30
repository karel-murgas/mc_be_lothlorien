// DEV ONLY, not part of the pack. In-game tree helpers removed from lothlorien_bp/scripts/trees.js
// (recover: git show dc1182e:lothlorien_bp/scripts/trees.js). To use: copy into lothlorien_bp/scripts/,
// import handleTreeScriptEvent in main.js and call it from onScriptEvent; remove before committing.
//   /scriptevent lothlorien:treecount [radius]   /scriptevent lothlorien:grow [n] | growbig [n]
//   /scriptevent lothlorien:treestats [n]
import { system } from "@minecraft/server";
import { makeRandom, buildSmallMallorn, buildBigMallorn } from "./mallorn_tree.js";
import { growTree } from "./trees.js"; // growTree is exported by the pack's trees.js
const NS = "lothlorien";
const LEAVES = `${NS}:mallorn_leaves`;
const WOOD = new Set(["log", "wood", "stripped_log", "stripped_wood"].map((n) => `${NS}:mallorn_${n}`));

// `/scriptevent lothlorien:treecount [radius]` (default 64, max 160) counts the Mallorns in the loaded
// Lothlorien columns around the player: trunk bases (a log standing on ground), 2x2 trunks counted once,
// canopy cover, and trees per 16x16 chunk of biome. Spread over ticks with runJob, so it takes a moment.
const BIOME = "lothlorien:lothlorien";

function countTrees(player, radius) {
  const dim = player.dimension;
  const px = Math.floor(player.location.x), pz = Math.floor(player.location.z);
  system.runJob(
    (function* () {
      const bases = new Set();
      let columns = 0, canopy = 0;
      for (let dx = -radius; dx <= radius; dx++) {
        for (let dz = -radius; dz <= radius; dz++) {
          const x = px + dx, z = pz + dz;
          let b;
          try {
            b = dim.getTopmostBlock({ x, z });
            if (!b || dim.getBiome(b.location).id !== BIOME) continue;
          } catch {
            continue; // unloaded
          }
          columns++;
          if (b.typeId === LEAVES) canopy++;
          for (let i = 0; i < 40 && b && (b.typeId === LEAVES || WOOD.has(b.typeId) || b.isAir); i++) b = b.below();
          if (b && WOOD.has(b.above()?.typeId)) bases.add(`${x},${z}`);
        }
        yield;
      }
      let trees = 0, mega = 0;
      for (const k of bases) {
        const [x, z] = k.split(",").map(Number);
        if (bases.has(`${x - 1},${z}`) || bases.has(`${x},${z - 1}`) || bases.has(`${x - 1},${z - 1}`)) continue;
        trees++;
        if (bases.has(`${x + 1},${z}`) && bases.has(`${x},${z + 1}`)) mega++;
      }
      const chunks = columns / 256;
      player.sendMessage(
        chunks < 1
          ? `[lothlorien] treecount r${radius}: only ${columns} Lothlorien columns loaded here`
          : `[lothlorien] treecount r${radius}: ${chunks.toFixed(1)} chunks of biome, ${trees} trees ` +
              `(${mega} 2x2) = ${(trees / chunks).toFixed(1)} per chunk, canopy cover ${Math.round((100 * canopy) / columns)}%`
      );
    })()
  );
}

// --- instruments ----------------------------------------------------------------------------

// `/scriptevent lothlorien:grow [n]` (or `growbig`, 2x2 trunks, 14 apart) grows n trees (default 20) on a 5-wide grid of the surface
// starting at the player, 7 blocks apart, for the "cut down 20 trees" balance test.
// `/scriptevent lothlorien:treestats [n]` reports the generator's average size and expected acorns.
export function handleTreeScriptEvent(event, player) {
  if (event.id === "lothlorien:treecount") {
    countTrees(player, Math.max(16, Math.min(160, parseInt(event.message, 10) || 64)));
    return true;
  }
  const n = Math.max(1, Math.min(60, parseInt(event.message, 10) || 20));
  if (event.id === "lothlorien:grow" || event.id === "lothlorien:growbig") {
    const big = event.id === "lothlorien:growbig";
    const gap = big ? 14 : 7;
    const px = Math.floor(player.location.x), pz = Math.floor(player.location.z);
    let grown = 0;
    for (let i = 0; i < n; i++) {
      let top;
      try {
        top = player.dimension.getTopmostBlock({ x: px + 3 + (i % 5) * gap, z: pz + 3 + Math.floor(i / 5) * gap });
      } catch {
        continue;
      }
      const above = top?.above();
      if (above && growTree(above, undefined, big)) grown++;
    }
    player.sendMessage(`[lothlorien] grew ${grown}/${n} ${big ? "big " : ""}Mallorns`);
    return true;
  }
  if (event.id === "lothlorien:treestats") {
    for (const [name, build] of [["small", buildSmallMallorn], ["big", buildBigMallorn]]) {
      const m = Math.min(n, name === "big" ? 20 : n);
      let logs = 0, leaves = 0;
      for (let i = 0; i < m; i++) {
        const t = build(makeRandom(Math.floor(Math.random() * 4294967296)));
        logs += t.logs.length;
        leaves += t.leaves.length;
      }
      player.sendMessage(
        `[lothlorien] ${m} ${name}: avg ${(logs / m).toFixed(0)} logs (${((logs / m) * 4).toFixed(0)} planks), ` +
          `${(leaves / m).toFixed(0)} leaves; acorns at 2% per leaf: ${((leaves / m) * 0.02).toFixed(1)} if all leaves drop`
      );
    }
    return true;
  }
  return false;
}
