// Great Mallorn nut rules (Phase 12 gift). Pure (no @minecraft/server) so tests/run.mjs can check them offline;
// great_mallorn.js wires them to the game.
//
// The white deer's one gift: a Great Mallorn nut. Planted on soil it becomes a sprout that grows like a sapling
// (no bone meal) into one of the flet giants (platform, ladder, loot chest), placed from the same .mcstructure files as
// the worldgen giants. It will not grow while anything built stands where the tree would put a block.

export const NUT_ID = "lothlorien:great_mallorn_nut";
export const SPROUT_ID = "lothlorien:great_mallorn_sprout";
// The flet giants (tools/build_structures.mjs, CHOSEN round trees with a chest). Structure ids follow the file path
// structures/lothlorien/<name>.mcstructure.
export const FLET_TREES = ["lothlorien:mallorn_round_05", "lothlorien:mallorn_round_07"];

// Structure box (keep in step with tools/build_structures.mjs SIZE / SIZE_Y / TRUNK_AT and tools/flet_mallorn.mjs
// ROOT_DEPTH; a test compares them). The trunk fills cells TRUNK_AT..TRUNK_AT+3; the first cell above the ground is y ROOT_DEPTH.
export const SIZE = 40, SIZE_Y = 54, TRUNK_AT = 18, ROOT_DEPTH = 5;
// Structure cell of the jigsaw anchor (tools/build_structures.mjs ANCHOR_AT, in structure coordinates).
export const ANCHOR = { x: TRUNK_AT + 1, y: 0, z: TRUNK_AT + 1 };

// Growth like the Mallorn sapling: stage 0 -> 1 -> tree, each step with this chance per random tick, in light >= MIN_LIGHT.
export const GROW_CHANCE = 1 / 7;
export const MIN_LIGHT = 9;
// A blocked sprout tells players within BLOCKED_TELL_RADIUS at most once per BLOCKED_TELL_TICKS.
export const BLOCKED_TELL_RADIUS = 32;
export const BLOCKED_TELL_TICKS = 6000;

// Structure origin for a sprout at `at` (the block above the soil): the sprout lands in the trunk (cell TRUNK_AT + 1)
// and the ground level of the tree matches the soil.
export const treeOrigin = (at) => ({ x: at.x - TRUNK_AT - 1, y: at.y - ROOT_DEPTH, z: at.z - TRUNK_AT - 1 });

// Blocks the tree may overwrite: air, water, terrain, plants, leaves and untouched logs (a tree in a forest always
// reaches into its neighbours' crowns). Anything else (planks, stripped logs, stone bricks, glass, chests, torches,
// rails, farmland...) counts as built and stops the growth.
const NATURAL = new RegExp(
  "^minecraft:(" + [
    "air", "cave_air", "water", "flowing_water",
    "grass_block", "dirt", "coarse_dirt", "podzol", "mycelium", "mud", "dirt_with_roots", "rooted_dirt", "moss_block", "moss_carpet",
    "pale_moss_block", "pale_moss_carpet", "pale_hanging_moss", "clay", "gravel", "sand", "red_sand", "snow", "snow_layer", "ice",
    "stone", "granite", "diorite", "andesite", "deepslate", "tuff", "calcite", "dripstone_block", "[a-z_]+_ore",
    "short_grass", "tall_grass", "fern", "large_fern", "dead_bush", "bush", "firefly_bush", "short_dry_grass", "tall_dry_grass",
    "leaf_litter", "pink_petals", "wildflowers", "vine", "glow_lichen", "sweet_berry_bush", "brown_mushroom", "red_mushroom",
    "dandelion", "poppy", "blue_orchid", "allium", "azure_bluet", "[a-z_]+_tulip", "oxeye_daisy", "cornflower", "lily_of_the_valley",
    "sunflower", "lilac", "rose_bush", "peony", "torchflower", "pitcher_plant", "open_eyeblossom", "closed_eyeblossom",
    "cactus_flower", "seagrass", "kelp", "waterlily", "azalea", "flowering_azalea",
    "[a-z_]+_leaves", "[a-z_]+_sapling", "oak_log", "spruce_log", "birch_log", "jungle_log", "acacia_log", "dark_oak_log",
    "mangrove_log", "mangrove_roots", "muddy_mangrove_roots", "cherry_log", "pale_oak_log",
  ].join("|") + ")$|^lothlorien:(" + [
    "mallorn_leaves", "mallorn_log", "mallorn_wood", "mallorn_leaf_carpet", "mallorn_blossom", "mallorn_sapling", "athelas", "elanor",
    "niphredil", "golden_fern", "deer_antler", "great_mallorn_sprout",
  ].join("|") + ")$"
);
export const isNatural = (typeId) => NATURAL.test(typeId) && !typeId.includes("stripped");

// ---- The gift spot the white deer leads to ----
// Candidates sit on rings GIFT_MIN..GIFT_MAX blocks from the deer (GIFT_RINGS x GIFT_HEADINGS), all loaded at the default
// simulation distance (4 chunks) whatever the player's own setting, so every player gets the same walk.
// Towards the heart: the biome is sampled on a grid (BORDER_STEP) over everything loaded within BORDER_SCAN of the deer; samples
// of another biome are the known border. The spot farthest from any known border wins (owner, 2026-09-30: the first rule,
// "farthest ring first, then depth", led to the edge, because a far spot at the edge beat a nearer one deeper in, and the depth
// probe of a far spot ran into unloaded chunks). Spots within SCORE_SLACK of the best score count as equal; among them the
// longest walk wins. With no border in sight at all (deep in the heart) every spot ties and the longest walk wins.
export const GIFT_RINGS = [56, 52, 48, 44, 40, 36];
export const GIFT_HEADINGS = 16;
export const BORDER_SCAN = 96;
export const BORDER_STEP = 8;
export const SCORE_SLACK = 8;

// Candidates as one list, farthest ring first: [{ x, z, ring }].
export function giftCandidates(x, z, startAngle = 0) {
  return GIFT_RINGS.flatMap((r) =>
    Array.from({ length: GIFT_HEADINGS }, (_, i) => {
      const a = startAngle + (i * 2 * Math.PI) / GIFT_HEADINGS;
      return { x: Math.floor(x + Math.cos(a) * r), z: Math.floor(z + Math.sin(a) * r), ring: r };
    })
  );
}

// Grid points for the border scan around (x, z), inside the BORDER_SCAN circle: [{ x, z }].
export function borderGrid(x, z) {
  const out = [];
  const n = Math.floor(BORDER_SCAN / BORDER_STEP);
  for (let i = -n; i <= n; i++) {
    for (let j = -n; j <= n; j++) {
      if (Math.hypot(i, j) * BORDER_STEP <= BORDER_SCAN) out.push({ x: Math.floor(x) + i * BORDER_STEP, z: Math.floor(z) + j * BORDER_STEP });
    }
  }
  return out;
}

// candidates: [{ x, z, ring, y, inside }] (y = feet height or undefined, inside = the spot's own biome is Lothlorien);
// border: [{ x, z }] known points of another biome. Returns the chosen candidate or undefined.
export function pickGiftSpot(candidates, border) {
  const scored = candidates
    .filter((c) => c.inside && c.y !== undefined)
    .map((c) => ({ c, score: border.reduce((m, b) => Math.min(m, Math.hypot(c.x - b.x, c.z - b.z)), Infinity) }));
  if (!scored.length) return undefined;
  const top = Math.max(...scored.map((s) => s.score));
  const near = scored.filter((s) => (top === Infinity ? s.score === Infinity : s.score >= top - SCORE_SLACK));
  let best;
  for (const s of near) if (!best || s.c.ring > best.c.ring || (s.c.ring === best.c.ring && s.score > best.score)) best = s;
  return best.c;
}
