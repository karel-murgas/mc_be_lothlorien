// White deer guide goal: the three candidate ways for the deer to follow the guide beacon (NOT shipped; tools only).
// The shipped choice lives in ONE place: the `lothlorien:state_guiding` group of lothlorien_bp/entities/white_deer.json.
// `switch_guide_goal.mjs` rewrites that group from these definitions, and adds or removes the experiment groups.
// Ranking and reasons: .claude/skills/bedrock-mobs/references/pathfinding.md. Field names checked against the official
// goal pages (2026-09-30); nothing here has been run in game.

export const ENTITY_FILE = new URL("../../../lothlorien_bp/entities/white_deer.json", import.meta.url);
export const GUIDING = "lothlorien:state_guiding";

// Production filter: the invisible helper entity (entities/guide_beacon.json).
export const BEACON_FILTER = { test: "is_family", subject: "other", value: "lothlorien_guide_beacon" };
// Experiment filter: any entity tagged `guide_beacon` (an armor stand you can see, a pig, or a real beacon).
export const TEST_FILTER = { test: "has_tag", subject: "other", value: "guide_beacon" };

// Each variant returns the goal components for one filter. Priority 2: below panic (1), above avoid (4).
export const VARIANTS = {
  // 1. Top-ranked. Format >= 1.26.20 (white_deer.json is 1.26.50).
  leader: (filter) => ({
    "minecraft:behavior.follow_target_leader": {
      priority: 2,
      leader_filters: filter,
      follow_distance: 1,
      within_radius: 24,
      speed_multiplier: 1.0,
      always_look_for_leader: true,
      search_cooldown: 5,
    },
  }),
  // 2. Fallback: parrot-style following. The docs say it follows "Mobs": the beacon may not count as one.
  follow_mob: (filter) => ({
    "minecraft:behavior.follow_mob": {
      priority: 2,
      search_range: 24,
      stop_distance: 1,
      speed_multiplier: 1.0,
      filters: filter,
    },
  }),
  // 3. Fallback: the beacon as an attack target (no attack goal, so no hitting); iron-golem style approach.
  target: (filter) => ({
    "minecraft:behavior.nearest_attackable_target": {
      priority: 3,
      entity_types: [{ filters: filter, max_dist: 24 }],
      must_see: false,
      must_reach: false,
      reselect_targets: true,
      scan_interval: 5,
      within_radius: 24,
    },
    "minecraft:behavior.move_towards_target": {
      priority: 2,
      speed_multiplier: 1.0,
      within_radius: 1,
    },
  }),
};

export const GOAL_KEYS = [...new Set(Object.values(VARIANTS).flatMap((v) => Object.keys(v(BEACON_FILTER))))];

// Which variant the guiding group uses now (undefined if none or a mix).
export function currentVariant(entity) {
  const group = entity.component_groups[GUIDING];
  const keys = Object.keys(group).filter((k) => GOAL_KEYS.includes(k)).sort();
  return Object.keys(VARIANTS).find((name) => {
    const want = Object.keys(VARIANTS[name](BEACON_FILTER)).sort();
    return want.length === keys.length && want.every((k, i) => k === keys[i]);
  });
}

// Replace the goal in the guiding group, keep everything else (the wolf/monster avoid goal). Mutates and returns entity.
export function applyVariant(entity, name) {
  if (!VARIANTS[name]) throw new Error(`unknown variant ${name}; one of ${Object.keys(VARIANTS).join(", ")}`);
  const group = entity.component_groups[GUIDING];
  for (const k of GOAL_KEYS) delete group[k];
  Object.assign(group, VARIANTS[name](BEACON_FILTER));
  return entity;
}

// Experiment: one group and one event per variant (`lothlorien:test_<name>`), filtered by the `guide_beacon` tag, plus
// `lothlorien:test_off`. They sit next to the wariness states (never removed by them), so deer.js does not disturb them.
const testGroup = (name) => `lothlorien:test_${name}`;
export function addExperiment(entity) {
  const names = Object.keys(VARIANTS);
  for (const name of names) {
    entity.component_groups[testGroup(name)] = VARIANTS[name](TEST_FILTER);
    entity.events[testGroup(name)] = {
      remove: { component_groups: names.map(testGroup) },
      add: { component_groups: [testGroup(name)] },
    };
  }
  entity.events["lothlorien:test_off"] = { remove: { component_groups: names.map(testGroup) } };
  return entity;
}

export function removeExperiment(entity) {
  for (const table of [entity.component_groups, entity.events]) {
    for (const k of Object.keys(table)) if (k.startsWith("lothlorien:test_")) delete table[k];
  }
  return entity;
}
