// Elven Warden rules (design: docs/mobs/elven_warden.md). Pure (no @minecraft/server) so tests/run.mjs can check them
// offline; elven_warden.js wires them to the game.
//
// The warden is a bow-armed defender (entities/elven_warden.json). Two kinds exist: natural spawns (spawn rule, thinned
// below) and village wardens (placed by the village structure pieces, persistent through the group
// `lothlorien:village_warden`, tools/build_village.mjs). Neither kind drops anything or gives XP.

export const WARDEN_ID = "lothlorien:elven_warden";
export const WARDEN_FAMILY = "lothlorien_warden";
export const VILLAGE_GROUP = "lothlorien:village_warden";
export const BOW_ID = "minecraft:bow";

// ---- Natural spawns by depth: THE place to tune how often wardens are met. ----
// spawn_rules/elven_warden.json has two conditions (ground in the biome, weight SPAWN_WEIGHT_GROUND; mallorn-plank decks,
// weight SPAWN_WEIGHT_DECK; a test keeps the numbers equal). Natural spawns fire the herd event lothlorien:spawn_natural,
// which sets the property lothlorien:natural; elven_warden.js then keeps each warden with the chance below and removes
// the rest. /summon and spawn eggs never set the flag, so they always stay.
export const SPAWN_WEIGHT_GROUND = 8;
export const SPAWN_WEIGHT_DECK = 8;
export const SPAWN_KEEP_EDGE = 1; // depth level 1 (border within the first ring, <= 16 blocks)
export const SPAWN_KEEP_DECK = 1; // standing on a mallorn plank deck, at any depth inside the biome
export const SPAWN_KEEP_INNER = 0.3; // depth level 2 and 3 (inner forest, heart) off the decks
export const DECK_BLOCKS = new Set(["lothlorien:mallorn_planks", "lothlorien:mallorn_heartwood_planks"]);

// level: 0 outside, 1 edge, 2 inner, 3 heart (scripts/depth.js); onDeck: the block under the feet is a deck block.
export function spawnKeepChance(level, onDeck) {
  if (!(level >= 1)) return 0; // outside the biome (the spawn rule never asks for it)
  if (onDeck) return SPAWN_KEEP_DECK;
  return level <= 1 ? SPAWN_KEEP_EDGE : SPAWN_KEEP_INNER;
}
// `roll` is uniform in [0, 1) (Math.random() in the game).
export const keepNaturalSpawn = (level, onDeck, roll) => roll < spawnKeepChance(level, onDeck);

// ---- Friendly fire ----
// A warden's arrow hits whoever stands in the line (as skeleton arrows hit zombies). elven_warden.js cancels the damage
// (world.beforeEvents.entityHurt) when this returns true. Wardens never hurt other wardens, Lothlorien's own creatures,
// vanilla animals, or a player who has not hurt a warden within PROVOKE_MS. A Hated player (harmony band, tag
// lothlorien_hated) is never shielded: the wardens shoot such a player on sight.
// Villagers and golems in the line are accepted.
export const PROVOKE_MS = 60000;
export const SHIELDED_FAMILIES = ["animal", WARDEN_FAMILY];
export const PLAYER_ID = "minecraft:player";

// A hit on a warden after more than PROVOKE_MS without one starts a new fight (one harmony cost per fight).
export const isNewFight = (sinceProvokedMs) => sinceProvokedMs === undefined || sinceProvokedMs > PROVOKE_MS;

// victim: { typeId, families: string[] }; sinceProvokedMs: ms since this player last hurt a warden (undefined = never);
// hated: the victim is a player with the lothlorien_hated tag
export function isFriendlyFire({ shooterId, victim, sinceProvokedMs, hated = false }) {
  if (shooterId !== WARDEN_ID) return false;
  if (victim.typeId === PLAYER_ID) return !(hated || (sinceProvokedMs !== undefined && sinceProvokedMs <= PROVOKE_MS));
  if (victim.typeId.startsWith("lothlorien:")) return true;
  return victim.families.some((f) => SHIELDED_FAMILIES.includes(f));
}
