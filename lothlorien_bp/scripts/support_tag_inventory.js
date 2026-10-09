// Pure aggregation for an on-demand BlockTypes/BlockPermutation.getTags audit.
// Inspect default permutations; this does not prove tags for every block state.
export const CANDIDATE_SUPPORT_TAGS = [
  "stone", "wood", "log", "metal", "dirt", "grass", "gravel", "sand", "snow", "trapdoors",
  "minecraft:is_pickaxe_item_destructible", "minecraft:is_axe_item_destructible",
  "minecraft:is_hatchet_item_destructible", // Older official list; runtime examples use axe on 26.52.
  "minecraft:is_shovel_item_destructible", "minecraft:is_hoe_item_destructible",
  "minecraft:is_shears_item_destructible", "minecraft:is_sword_item_destructible",
  "minecraft:is_mace_item_destructible", "minecraft:is_item_tier_destructible",
];
export function summarizeTagInventory(records) {
  const wanted = new Set(CANDIDATE_SUPPORT_TAGS);
  const tags = new Map();
  const groups = Object.fromEntries(["vanilla", "modded"].map(name => [name,
    { total: 0, resolved: 0, unresolved: [], untagged: [], uncovered: [] }]));
  for (const record of records) {
    const name = record.id.startsWith("minecraft:") ? "vanilla" : "modded";
    const group = groups[name];
    group.total++;
    if (record.error !== undefined) { group.unresolved.push({ id: record.id, error: record.error }); continue; }
    group.resolved++;
    const unique = [...new Set(record.tags)];
    if (!unique.length) group.untagged.push(record.id);
    if (!unique.some(tag => wanted.has(tag))) group.uncovered.push(record.id);
    for (const tag of unique) {
      if (!tags.has(tag)) tags.set(tag, { vanilla: 0, modded: 0 });
      tags.get(tag)[name]++;
    }
  }
  for (const group of Object.values(groups)) {
    group.untagged.sort(); group.uncovered.sort();
  }
  return { ...groups, tags: Object.fromEntries([...tags].sort(([a], [b]) => a.localeCompare(b))) };
}
