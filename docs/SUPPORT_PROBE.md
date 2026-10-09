# Temporary support / piston experiment

Updated 2026-10-09; target Bedrock 1.26.52 / stable Script API 2.8.0.
Status: revision 8 is **game verified: 18/18 passed, zero failed or inconclusive**
(owner log received 2026-10-09). The controlled event/tick recipe is now in the
shared block/family/scripting skills. Revision 7 returned 11/18 before its
baseline correction. No unchanged repeat run is needed; production checks remain.
Revision 4 is game verified: **181 cases, 59 passed, 122 failed,
0 inconclusive**. Named supports and a positive `stone` tag worked; the tested
constant-true/negative descriptors failed survival. Bound listed hand placement
passed all six stone faces, dirt refusal and one-stick support-loss drops.
Revision 5 returned 55/78 passes. Revision 6 returned **55/63, eight failures,
zero inconclusive**: broad/split filters admitted a pickaxe-tagged head; both
movable probes missed destination validation until a neighbor update. Revision 3 passed
**51/51** explicit-list cases. Revision 2 had **4 passed, 72 failed,
0 inconclusive**; filters without a block list failed support loss. No production block
policy was changed. The owner permits Codex to maintain `.claude/` and wants
engine evidence before updating skills. Starstone's immovable policy may be
reconsidered after successful native survival/relocation and graph/index tests.

Use a disposable Creative world with cheats and the deployed Lothlorien packs.
Leave/re-enter the world after deployment. Fly into open air and run:

```mcfunction
/scriptevent lothlorien:support_probe
```

The runner reserves a **loaded, empty 7x7x7 volume**, starting eight blocks east,
one block above, and three blocks north of the player's floored position. It
refuses occupied/unavailable blocks and nearby entities. Stay nearby and keep
players/items out of that area. It temporarily creates a catch floor and piston
rigs, then clears them when it finishes. An interrupted run can leave a rig;
use a disposable world. Runtime errors are in the Content Log.

Revision 2 first calibrates all six piston rotations by observing the head's
actual extended position. The initial runner guessed east=5/south=3 and the
owner reported pistons facing their power blocks instead (2026-10-08).
Its nonmoving piston cases cannot establish support behavior. The revised
runner uses the measured mapping and checks the expected extended/retracted
state and head location. No hardcoded direction mapping is used.

Revision 3 runs **51 cases** by default with `listed` and `listed_movable`
probes: both explicitly require stone/slime on the saved mounting face, one
uses `popped`, the other `push_pull`. It retains the six direction calibrations.
The original comparison can be repeated with:

```mcfunction
/scriptevent lothlorien:support_probe original
```

The original mode runs **76 cases**, plus six calibration rotations:

- Three cloned antler definitions: `broad` (all six faces, no block list),
  `mounted` (native filter restricted per permutation to the saved mounting
  face), `movable` (same restriction, `push_pull` rather than `popped`).
- Each variant on all six faces, with support removed by script, pushed by a
  piston, pulled by a sticky piston, or removed while an unrelated neighbor
  remains. That last case establishes whether native survival honors the
  intended mounting face rather than accepting some other support.
- Direct piston push into a valid supported destination for each variant.
- Slime moves the support and movable attachment together.

These blocks have **no scripted survival handler**. Their custom component
only logs `onPlace` / `onBreak`; there is no piston repair subscription that
could disguise a native failure. The test script's piston subscriber only logs
state/attachment locations at the callback and 1, 2, 4, 8 ticks later. Native
destruction must drop exactly one stick from a diagnostic loot table; movement
must preserve the mounting state and drop none. A support-movement case fails
as **inconclusive**, separately from failures, if the piston did not actually
move the support. Summary JSON contains `revision: 3`, the selected `variants`, the calibrated `facing`
map, and separate `passed`, `failed`, `inconclusive` counts.

Read the summary and failing case IDs in chat. Repeat the persisted report with:

```mcfunction
/scriptevent lothlorien:support_probe report
```

The default report shows total pass/fail/inconclusive counts, support-loss totals
per variant, and **each direct-push/slime-assembly verdict** separately (seven
result lines for the original 76-case run). The complete chat listing is optional:

```mcfunction
/scriptevent lothlorien:support_probe report all
```

Both retrieval commands preserve existing saved results and repeat every verdict
and error at warning level in the Creator Log, including positive movement cases.
The report also prints `[support-probe] RESULTS` JSON to the Content Log.
Per-event traces and failures include developer details there. Results are saved
in world dynamic property `lothlorien:support_probe_results`; a new run clears
the previous summary. Report the **game version**, passed/total count, failed
IDs and failure reasons from the log. A few failing broad/decoy cases can still
support the narrower mounted-filter hypothesis; do not treat the aggregate
score as the entire verdict.

Owner's revision-2 results (2026-10-08): all 72 support-loss cases failed with
the attachment remaining and zero drops. All three probes omitted
`block_filter`; the explicit support-list comparison was missing. Exact game
version was subsequently confirmed as **26.52**. The initial pasted Creator
Log showed warnings only, omitting calibration and positive cases. Subsequent
saved-result retrieval confirmed the following:

- `broad/direct-push` and `mounted/direct-push`: `popped` destroyed each probe,
  original cell became piston head, destination air, one stick each.
- `movable/direct-push`: reached the supported destination, retained mounting
  face `up` and cardinal direction `north`, zero drops.
- `movable/slime-assembly`: attachment and slime support both moved east,
  attachment retained those states, zero drops.
- Facing calibration: down=0, up=1, south=2, north=3, east=4, west=5.

All four movement cases passed; no case was inconclusive. This verifies those
movement outcomes, while all 72 no-list support-loss cases still failed.
Revision 3 logs a `[support-probe] SUMMARY` warning with totals and the measured
map; include that line with the results. Workspace knowledge commit:
`Record verified piston movement outcomes from revision 2`.

Report text repair, 2026-10-08: the owner saw raw `lothlorien.message.probe.*`
keys on retrieval. Probe chat entries had been generated in BP texts; moved them
to RP texts, matching normal client-visible chat translations. Offline regressions
now resolve actual generated RP strings and reject BP-only script message keys.
Corrected chat display still needs in-game confirmation after reload. No test
verdict is changed by this presentation fix; saved revision-1/2 reports remain readable.

Owner's revision-3 results (2026-10-08, same 26.52 session): all **51/51** cases
passed, with zero failures or inconclusive cases. Both listed policies passed
the 48 stone-support-loss cases across all six saved mounting faces, including
API removal, piston push, sticky pull and unrelated-neighbor decoys. Each loss
removed the attachment and dropped exactly one stick. The three direct-push /
slime-assembly cases passed popping or supported movement as intended. Facing
calibration was unchanged: down=0, up=1, south=2, north=3, east=4, west=5.
The log summary confirms the runner's assertions; no extra callback/index
behavior is inferred from it. Slime support loss was not tested.

Shared block, block-family and scripting skills now point to the verified recipe.
Workspace knowledge commit: `Bake verified explicit-list piston support recipe into skills`.
Actual soil types, generic supports, shape rules, production loot and device
indexes remain rollout checks, not reasons to repeat this successful matrix.

Native hand placement remains a separate UX acceptance check:

```mcfunction
/give @s lothlorien:support_probe_listed
```

Place it by hand on stone, break its stone support, and check whether it drops
one stick. The ordinary antler support script does not handle this test ID.
Also note whether hand placement onto unsupported blocks is refused. Do not
confuse the earlier omitted-list failures with failure of all native survival.

## On-demand tag inventory

```mcfunction
/scriptevent lothlorien:support_probe tags
```

This reads all registered default block permutations, 16 per tick, without
placing/removing blocks or accessing the saved support-test property. It works
in an ordinary occupied area; it does not need the rig's empty volume. Runtime
tag samples were supplied by the owner on 2026-10-08; full counts were omitted.
The Content Log's `[support-tags]` lines contain counts
for vanilla/modded types, all observed tags, untagged defaults, candidate-filter
gaps, unresolved IDs and sample building blocks. Send SUMMARY and vanilla gap /
sample lines to assess native support coverage. Defaults are not every state;
air/liquid/technical blocks in the missing lists are not automatically useful
support omissions. Aggregation lives in the shared block skill, copied to
`BP/scripts/support_tag_inventory.js` by the scratch generator.

Placement is programmatic with explicit face states. A successful run establishes
these native survival/movement cases, not hand-placement UX, arbitrary partial
supports, water/fire/commands from other mods, chunk recovery, production loot,
or Starstone cache migration. Follow-up acceptance tests must cover those.

Temporary files: `BP/scripts/support_probe.js`, `support_probe_rules.js` and `support_tag_inventory.js`, the one import in `main.js`,
`BP/blocks/support_probe_{broad,mounted,movable,listed,listed_movable}.json`,
`BP/loot_tables/blocks/support_probe.json`, and catalog entries
`lothlorien.message.probe.*` / `tile.lothlorien:support_probe_*.name`.
Scratch generator: `C:/mcmods/temp/piston-support/build_probes.py`.
It is not a production asset generator. Remove probe files/import/catalog entries
and rebuild localization after the owner reviews the results; clean the scratch
then and record the final evidence/decision and recovery commit.

## Owner follow-up and verified revision 4

2026-10-08, same 26.52 target. Owner manually placed `listed`: dirt was refused,
and **only the underside of stone** accepted placement. Breaking its stone
support dropped a stick. The underside was explicitly confirmed, so do not
describe this as successful floor placement or all-face hand UX. Default-face
validation before clicked-face assignment is an inference pending logs.

Runtime samples confirm no tags on glass, white wool, slime and honey; the
untagged list includes glowstone/sea lantern/froglights too. Oak planks and
chest use `minecraft:is_axe_item_destructible`, which supersedes the older
official `hatchet` spelling for those observed blocks. Both Lothlorien planks
carry `wood` plus the actual axe tag. Many of our plants/decorations are
untagged. SUMMARY/TAG rows were not pasted, so global totals remain unknown.
The inventory candidate now includes axe. A positive tag union cannot alone
cover all these ordinary vanilla supports.

The completed revision-4 comparison remains available explicitly:

```mcfunction
/scriptevent lothlorien:support_probe filters
```

It runs **181 cases**, plus six piston calibration rotations before the
cases. Use the same empty loaded 7x7x7 volume and remain nearby; allow several
minutes. Four broader variants use `constant`/`constant_movable` (`tags: "1"`)
and `negative`/`negative_movable` (exclude `lothlorien:probe_no_support`).
`tagged` positively requires the observed `stone` tag; `listed_bound` uses the
known stone/slime list. All six variants set strict saved-face filters after
binding. There is **no scripted survival/removal**.

The automatic matrix sets `lothlorien:probe_bound: true` explicitly. Its player
placement callback was separately hand verified: the item default starts unbound,
allows all faces, then `beforeOnPlayerPlace` stores the actual clicked face and
enables its strict native filter. The verified hand probe was:

```mcfunction
/give @s lothlorien:support_probe_listed_bound
```

The owner confirmed top, underside and all four stone walls accepted placement,
dirt was refused, and breaking each selected support dropped exactly one stick.
This result supersedes the original listed probe's underside-only limitation.
The inferred engine ordering itself was not established by event logs.

Matrix cases: 144 support losses (six variants x six faces x four causes), six
supported direct pushes, two slime assemblies, three original listed controls,
24 support-eligibility cases (12 support types for constant/negative), and two
unsupported destinations. Eligibility covers stone/slime, glass, wool, honey,
oak planks, chest, a full-cube untagged custom fixture, an excluded tagged cube,
air/water/lava. Fluid fixtures are enclosed by stone within the reserved area.
Fixtures drop nothing; attachments retain the one-stick diagnostic loot.

Owner summary: **181 total, 59 passed, 122 failed, zero inconclusive**. Both
`tagged` and `listed_bound` passed their 24 support losses. Constant/negative
variants (including movable) failed all 96 support losses, all 24 eligibility
cases and both unsupported destinations. The other 11 movement/control cases
passed. Negative eligibility even retained the explicitly excluded fixture;
exact query evaluation was not established. Do not call every negative query
or the exact inspected third-party templates broken from this narrower test.

`report` retrieves the latest saved run; default/original/filters modes retain
the earlier comparisons. No need to repeat revision 4 for the next hypothesis.

Additional temporary files: `support_probe_{constant,constant_movable,negative,negative_movable,tagged,listed_bound,solid,excluded}.json`
and `loot_tables/blocks/support_probe_empty.json`, plus their localized names.
The placement callback lives in the existing temporary probe script. No
production support handler or block policy changed.

## Verified revision 5: positive tags plus vanilla exceptions

```mcfunction
/scriptevent lothlorien:support_probe compat
```

**78 cases**, plus six calibration rotations, in the same empty loaded rig.
Two bound variants use `popped` / `push_pull`. They combine positive `stone`,
`wood`, runtime pickaxe/axe/shovel tags with eleven named untagged vanilla
exceptions: glass, white/red wool, red stained glass, slime, honey, glowstone,
sea lantern and three froglights. Exceptions are representative, not a complete
vanilla support policy. Tool/material tags are not a full-face geometry test.

Cases: 24 six-face stone push/pull losses; two supported direct pushes; one
slime assembly; one unsupported destination; 25 eligibility/removal tests per
variant. Actual Mallorn and heartwood planks must qualify **only through tags**.
Untagged custom solid/excluded fixtures, air and liquids must be rejected;
dirt/grass, oak/chest, deepslate/ice and all selected vanilla exceptions must
survive and then pop once on removal. Loot remains one diagnostic stick.
Lava loot is observed every tick before burning; if the attachment disappears
but no stick can be observed, that loot assertion is inconclusive.

Owner supplied **55 passed, 23 failed, zero inconclusive**. All twelve support
pushes failed, all twelve pulls passed; both policies passed 20 accepted-support
removal cases, including actual mod planks through tags only. Own supported
movement passed three cases; unsupported movement retained the attachment.
Ten initial-invalid API placements retained probes, but `setPermutation`
bypasses ordinary admission and no later support change was made in those
cases. Do not infer that the hybrid permits invalid hand placement. The same
limitation applies to revision 4's initially invalid fixtures.
New temporary definitions are `support_probe_hybrid{,_movable}.json`. Hand
placement with this hybrid filter and production loot remain separate checks.

## Verified revision 6: isolate tags, head support and missing updates

```mcfunction
/scriptevent lothlorien:support_probe diagnose
```

**63 cases**, plus six calibration rotations, same loaded empty 7x7x7 volume.
Five popped definitions: original `tagged` stone-only control; `mixed_control`
stone tag plus the same eleven exceptions; original `hybrid`; `split` with five
individual single-tag descriptors plus the exceptions; `material` with positive
stone/wood/dirt/grass tags and the exceptions plus chest/deepslate/ice by name.
The latter three accept actual Mallorn planks through tags only.

36 removal/push/pull cases use stone for every variant, glass for all except
tagged, and actual Mallorn planks for hybrid/split/material (floor attachment).
25 replacement cases start on valid stone then replace it with air, water,
lava or either custom fixture. This tests an actual support-change event.
The remaining two cases compare `listed_movable`/`hybrid_movable` unsupported
destinations after settling plus 20 ticks. If retained, a forced support
stone-to-air update is observed separately; it cannot turn the native verdict
into a pass. No production recovery is installed.

Each failed case includes actual remaining/support states and runtime tags.
Lava drops are observed before possible burning. Send SUMMARY plus the complete
FAIL/INCONCLUSIVE lines including `details`. Successful case details can be
retrieved with `report`; the old modes remain available.
Additional definitions: `support_probe_{mixed_control,split,material}.json`.

Owner supplied 55 passed / eight failed / zero inconclusive. Tagged 3/3,
mixed-control 6/6 and material 9/9 losses passed. Hybrid/split each passed six
removal/pull losses and failed three pushes. All **25/25** invalid replacements
passed. The six push failures logged `minecraft:piston_arm_collision` facing4
with **only `minecraft:is_pickaxe_item_destructible`**, so the broad/split
filters accepted the replacement head. Their queries did not reject air/liquids
incorrectly in the valid-to-invalid tests.

Both moving probes stayed unsupported over air after settling plus 20 ticks;
forced support stone-to-air update then popped once. Keep native failure and
forced recovery distinct. A later tick/event repair needs an actual prototype.

The owner also reports vanilla dust breaks when its original support moves,
even with valid replacement, while fresh dust/frames can use a piston head.
This is owner-observed vanilla behavior, not a vanilla control run by revision6.
The next script experiment should preserve head eligibility and capture support
departure instead of relying solely on the final support. Periodic recovery
alone misses that valid-to-valid history. Test source/destination event timing
and allowed traveling attachments separately. No production rollout was made.

Do not commit unrelated village work currently changing in this repository.
The test's localized chat and hidden block names go through the existing catalog.

## Revision 7: script prototype, partial game success

```mcfunction
/scriptevent lothlorien:support_probe script
```

The script matrix contains **18 cases**, plus six piston calibration rotations.
Use the same disposable world and loaded empty 7x7x7 volume. Leave/re-enter
after deployment, stay nearby and keep the rig clear. No Beta API toggle is
needed. Send SUMMARY and complete FAIL/INCONCLUSIVE lines; for motion failures
also include `[support-script] MOTION` or ERROR lines. Saved case details remain
available through `report all` until another run overwrites them.

Four vanilla dust controls test support departure with a head, dirt or an
identical stone replacing it, and fresh support on an upward head followed by
retraction. Fourteen scripted cases cover those three replacements (head
replacement on all six mounting faces), fresh head support/retraction, sticky
support pull, supported and unsupported own movement, intact slime assembly,
and a stationary attachment on the piston body that must survive nearby motion.
These are instrumented dust controls; frames are not included.

The scripted block has a face-only native placement filter, `push_pull`, a
scheduled tick every two ticks, and one-stick diagnostic loot. It uses the
existing saved-face binding callback. Its separate placement check accepts
non-air, non-liquid supports including heads; generic geometry eligibility is
not investigated here. Survival scripting operates **only inside the active
script-mode rig**. Giving this hidden probe by hand elsewhere does not enable
support repair. No production decoration, Starstone or loot policy changed.

Real scheduled block callbacks remember each attachment's token, face, location
and selected support before motion. An unwarmed record makes the case
inconclusive; the test runner does not seed that record. The piston event samples
motion immediately and once per tick until settled (minimum nine ticks, maximum
40). A moving placeholder, a newly occupying head or an observed type change
at an affected support is departure evidence. Reported positions and their
one-block neighbors are candidates only: proximity cannot justify removal.

After settling, a stationary attachment whose support departed is destroyed
once even if a valid block replaced it. A relocated attachment is checked at
its actual destination; a supported relocation or intact assembly survives.
Current invalid support also has scheduled-tick recovery. Removal uses
`setblock ... air destroy` and rechecks type/token/face, preserving diagnostic
loot and avoiding duplicate script/native drops. Case cleanup invalidates
pending jobs before changing the rig.

Offline tests pass for departure history, allowed relocation, stationary guards,
unknown support and stale jobs, plus existing probe/report boundary tests.
These do not prove engine event timing. Identical replacement requires observing
the intermediate motion; a missed transition must fail the game case.
The prototype handles controlled single operations with a small
token space, not persistence, reloads, rapid pulses, concurrent pistons or a
production attachment index. Those and actual mod loot/callbacks require later
checks if this experiment succeeds. Do not bake this candidate into a verified
production recipe before successful game results and rollout checks.

Owner result received 2026-10-09: **18 total, 11 passed, seven failed, zero
inconclusive**. All four vanilla controls passed. Scripted dirt and identical
stone replacement passed with `support-departed` and one stick, witnessing
`moving_block` at sample zero. Fresh head/retraction and sticky support pull
passed through `tick-invalid`; supported own movement and slime assembly
survived, unsupported own movement dropped once with `destination-invalid`.
All six single-block head departures failed, plus the stationary-guard case's
primary removal. Its guard remained present; that failed case does not yet
establish correct detachment plus guard survival together. Motion logs saw the
head immediately but had zero departure witnesses. Other rail/warden logs are
separate village behavior and not support-probe verdicts.

## Revision 8: preserve the support baseline, game verified

Same command and same 18 cases. The prototype previously refreshed its record
on every scheduled tick, so a tick observing the new head before the piston
after-event could replace the remembered stone support. A new offline regression
reproduces that failure, then passes with the fix. This callback ordering is a
diagnosis consistent with the seven failures, not proven by revision 7's logs;
those logs did not include the cached record.

Ticks now preserve each token's established location/face/support baseline until
a settled piston event explicitly reconciles it. They store the latest valid
observation separately. A new attachment initially on a head establishes a head
baseline and remains eligible. Successful movement refreshes its baseline to
the actual destination. `MOTION.tracked` includes cached and latest observed
support types for diagnosis.
Regressions include pre-event tick ordering, fresh head survival, a stationary
guard and a supported destination tick before event delivery. Piston-specific
regressions pass. At revision-8 deployment, full `mods verify` failed three unrelated village-loop
regressions in separately modified village code (loop marker counts, close
partner search and consumed exits); pack checks have no errors. The log is in
`temp/piston-support/revision8-verify.log`. Deployment uses the quick pack checks;
production rollout remains pending.

Owner result received 2026-10-09: **18 total, 18 passed, zero failed, zero
inconclusive**. All six head-departure cases log the cached stone baseline and
a new head witness at sample zero, followed by one `support-departed` drop.
The stationary guard case now removes only the moving-support attachment;
the piston-body guard survives. Dirt and identical stone replacement witness
`moving_block` at sample zero and detach once. Fresh head retraction and
sticky support pull also detach through event jobs; unsupported own movement
uses `destination-invalid`. Supported direct movement and slime assembly
survive without repairs or drops. Every supplied motion logs ten samples.
All four vanilla dust controls passed again.

These logs verify the corrected behavior and preserved baseline, not the exact
tick-before-event ordering hypothesized for the earlier failures. The reusable
tested recipe is `.claude/skills/bedrock-blocks/references/support-motion-script.md`.
Next acceptance uses an actual production attachment with its real loot and
callbacks, then rapid/concurrent movement and reload/index recovery. Keep the
prototype and regression sources until that adaptation is reviewed. Starstone
requires separate network/power/index/cache checks before changing its policy.
