# Lothlorien support motion

Accepted rollout: 2026-10-09, Bedrock 1.26.52 / stable server API 2.8.0.
Implementation commit: `Implement piston support survival and retire diagnostic probes`.
Verified probe source and engine results are archived in commit `852dc3b`;
the temporary blocks, commands, translations and experiment notes are retired.

All 23 supported production definitions use native `popped`: antlers, four lamps,
both wood sets' buttons/plates/doors, six soil plants/sprouts, Western corn,
both segmented covers, nectar blooms and both rope definitions. A stationary
attachment also breaks when its original support departs, even if valid support
replaces it. Existing named support lists and generic mounting eligibility remain
unchanged; other construction blocks retain their native movement policy.

`support_motion_service.js` keeps a local reverse support index and preserves
original relationships across tick-before-event ordering. Piston jobs capture
actual departure evidence, settle after at least ten samples and a stationary
piston, and release after forty samples. Unknown/moving cells retain history;
timeout witnesses reconcile on the next stable tick. Local generations prevent
duplicate drops after native destruction or fresh same-ID placement. Ordinary
edits reset history; unrelated attachments continue their scheduled recovery.

Covers use amount-conditioned native loot for all 1-4 segments. Each rope variant
uses the canonical rope item; whole-column teardown excludes a piece already
popped by the engine. Doors use native multiblock partner destruction and loot.
Lamp, nectar and heartwood generators automatically apply `configure_support.py`.
Use `tools/generate_ground_cover.py` for covers; other named generators write art
only. The configuration pass also maintains support policies and segment loot.

Validation: full verifier and regression suite pass; focused motion tests cover
ordering, replacement, concurrency, unknowns, timeout recovery and lifecycle.
Real-script rope tests cover both variants in survival, creative, explosion and
support teardown. The underlying owner engine probe passed 18/18; production
loot/rendering, doors, rapid motion, chunk reloads and scale remain game checks.
Cold attachments need placement or their first scheduled callback before motion
to retain unobserved valid-to-valid departures; cache capacity is 16,384 records.
