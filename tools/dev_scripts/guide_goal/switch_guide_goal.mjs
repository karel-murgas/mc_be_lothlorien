// Switch the white deer's guide goal, or add/remove the in-game experiment groups (NOT shipped; see README.md here).
//
//   node mods/lothlorien/tools/dev_scripts/guide_goal/switch_guide_goal.mjs              show the current goal
//   node mods/lothlorien/tools/dev_scripts/guide_goal/switch_guide_goal.mjs leader       follow_target_leader (shipped)
//   node mods/lothlorien/tools/dev_scripts/guide_goal/switch_guide_goal.mjs follow_mob   fallback 1
//   node mods/lothlorien/tools/dev_scripts/guide_goal/switch_guide_goal.mjs target       fallback 2 (target + move_towards)
//   node mods/lothlorien/tools/dev_scripts/guide_goal/switch_guide_goal.mjs --experiment add lothlorien:test_* groups/events
//   node mods/lothlorien/tools/dev_scripts/guide_goal/switch_guide_goal.mjs --clean      remove them again
//
// It edits lothlorien_bp/entities/white_deer.json in place. A variant switch is meant to be committed; the experiment
// groups are not: tests/run.mjs fails while they are in the file, so deploy them with `.\mods deploy lothlorien --quick`
// and run `--clean` before committing (the pre-commit hook runs the quick verify only and would not stop them).
import { readFileSync, writeFileSync } from "node:fs";
import { ENTITY_FILE, VARIANTS, addExperiment, applyVariant, currentVariant, removeExperiment } from "./variants.mjs";

const arg = process.argv[2];
const file = JSON.parse(readFileSync(ENTITY_FILE, "utf8"));
const entity = file["minecraft:entity"];

if (!arg) {
  console.log(`guide goal: ${currentVariant(entity) ?? "none or mixed"}`);
  const tests = Object.keys(entity.events).filter((k) => k.startsWith("lothlorien:test_"));
  console.log(tests.length ? `experiment events present: ${tests.join(", ")}` : "no experiment groups");
  process.exit(0);
}
if (arg === "--experiment") addExperiment(removeExperiment(entity));
else if (arg === "--clean") removeExperiment(entity);
else if (VARIANTS[arg]) applyVariant(entity, arg);
else {
  console.error(`unknown argument ${arg}`);
  process.exit(1);
}
writeFileSync(ENTITY_FILE, JSON.stringify(file, null, 2) + "\n");
const deploy = arg === "--experiment" ? ".\\mods deploy lothlorien --quick (and --clean before committing)" : ".\\mods deploy lothlorien";
console.log(`white_deer.json: ${arg} applied; guide goal now ${currentVariant(entity)}. Next: ${deploy}.`);
