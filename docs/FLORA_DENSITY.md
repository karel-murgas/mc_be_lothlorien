# Flora density comparison

Date: 2026-10-04. Sources: current Lothlorien pack JSON and installed vanilla reference (1.26.52, including definitions introduced in 1.26.50). Static configuration analysis; not measured in generated worlds. No pack changes.

## Meaning of density

Numbers below are expected placement attempts per 16x16 chunk, before rejection, not successfully placed plants or percentage ground coverage. Multiply feature-rule iterations by scatter probability and nested scatter iterations. Noise zones are conditional; their area fractions are unknown. Features can spill across chunk borders. Vertical offsets, terrain, air-only replacement, survival rules and competing plants affect success. Tree aggregates also stop at their first failed child.

## Lothlorien ground plants

| Plant | Baseline attempts/chunk | Additional attempts when its noise zone is active |
| --- | ---: | ---: |
| Custom extra short grass | 60 | 0 |
| Inherited vanilla grass scatter (modern/nonlegacy generation) | 32 | 0 |
| Plain fern | 22 | 0 |
| Golden fern | 5 (10 x 1/2) | 0 |
| Elanor | 1 (3 x 1/3) | 8 (2 x 4) |
| Niphredil | 0.6 (3 x 1/5) | 8 (2 x 4) |
| Athelas | 0.5714 (4 x 1/7) | 5.3333 (8 x 2/3) |
| Western corn | 0.2143 (3 x 1/14) | 3.5 (7 x 1/2) |
| Total | 121.3857 | Up to 24.8333 extra |

Thus the expected ground-plant budget is 121.39 outside all zones, at most 146.22 where every zone is active. The biome-wide mean lies between these values; it cannot be computed from thresholds alone. Flower/herb/corn attempts specifically are 2.39 baseline, rising to 27.22 with all zones active. Golden fern is counted separately.

Lothlorien also inherits the generic flower scatter: 64 attempts with probability 1/32, or 2 expected attempts/chunk. Including that gives ground-plant totals of 123.39 to 148.22. Rare mushrooms, pumpkins, reeds and waterside firefly bushes are excluded from these totals.

Sources: `lothlorien_bp/feature_rules/*`, corresponding `lothlorien_bp/features/*`; vanilla `vanilla_1.21.60/feature_rules/overworld_after_surface_tall_grass_feature_rules.json`, `features/scatter_tall_grass_feature.json`; `vanilla_1.26.50/feature_rules/overworld_after_surface_flowers_feature_rules.json` and `vanilla_1.21.60/features/scatter_overworld_flower_feature.json`.

## Comparable vanilla biomes

| Biome | Exposed flower budget per chunk | Grass/other foliage |
| --- | ---: | --- |
| Forest | 2 generic flower attempts | Engine-defined legacy forest foliage; bush scatter also eligible |
| Birch forest | 96 wildflower attempts + 2 generic flower attempts | Engine-defined legacy forest foliage; bush scatter also eligible |
| Old-growth birch forest (`birch_forest_mutated`) | 96 wildflower attempts + 2 generic flower attempts | Engine-defined legacy forest foliage; bush scatter also eligible |
| Flower forest | 144 flower attempts | 32 generic grass attempts in nonlegacy generation, plus engine-defined flower-forest foliage |

Wildflowers: 3 x 1/2 x 64 = 96. Flower forest: 3 x 1/2 x 96 = 144. Generic flowers: 1/32 x 64 = 2. Birch wildflower filters require birch + forest and exclude hills, but do not exclude mutated. Old birch has `overworld_generation`, which the generic flower rule accepts.

Forest and birch tags exclude the modern generic grass rule; they call `minecraft:legacy:forest_foliage_feature` instead. Flower forest calls `minecraft:legacy:flower_forest_foliage_feature`. These engine-defined routines do not expose internal counts in the installed JSON. A rule with one iteration invoking such a routine does not mean one plant or one tree. Consequently no exact total forest/birch density ratio is justified by these files.

Sources: newest matching biome definitions in `vanilla_1.26.50/biomes`; `vanilla_1.21.70/feature_rules/birch_forest_before_surface_wildflowers_feature_rules.json` and `features/scatter_birch_forest_wildflowers_feature.json`; `vanilla_1.21.60/feature_rules/flower_forest_after_surface_flowers_feature_rules.json` and `features/scatter_flower_forest_flower_feature.json`; `vanilla_1.26.50/feature_rules/forest_first_foliage_feature.json`; `vanilla_1.18.0/feature_rules/flower_forest_first_foliage_feature.json`.

## Tree-associated ground cover

Lothlorien schedules 5 tree attempts/chunk. Its aggregate orders tree, blossoms (5 tries), leaf carpet (90 tries), then nectar blooms (8 tries in elevated positions). If every preceding child succeeds, this allows 25 blossom, 450 leaf-carpet and 40 elevated nectar-bloom attempts per chunk. Actual dispatch can be much lower because of tree failure and aggregate early-out. Nectar blooms are not ground flora.

Vanilla `vanilla_1.21.70/features/scatter_leaf_litter_feature.json` has 96 litter attempts per invocation, compared with our 90. Our footprint is gaussian +/-5 horizontally, vanilla +/-4. Our per-invocation litter budget is similar (94%), but vanilla tree frequency and wrapper conditions are needed before inferring a per-chunk ratio. Segmented cover states also make occupied-block counts differ from visible coverage.

## Interpretation and a fair in-game measurement

Lothlorien puts most of its ground-plant budget into grass and ferns (119 attempts/chunk including inherited grass). Its custom flowers/herbs are much less frequent than the explicit flower/wildflower scatters in flower forest and birch forests. Tree-associated carpet is a separate large budget and can dominate visual coverage. Attempts alone do not establish that the forest floor is denser or sparser overall.

For actual placement density, sample multiple fresh interior areas in each biome, away from borders and water. Use equal areas (for example ten 64x64 plots per biome), and report plant-bearing ground columns per 256 columns separately for grass, ferns, flowers/herbs, and litter/blossoms. Count lower halves of tall plants once; exclude canopy nectar blooms. Report segmented cover area separately from occupied cover blocks. Compare both all ground and eligible soil, with canopy/open-ground breakdowns, and summarize plot variation. These measurements have not been performed.
