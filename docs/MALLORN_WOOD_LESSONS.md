# Mallorn wood: lessons learnt (2026-09-30 .. 2026-10-01)

Mod-specific: what the owner wants from the Mallorn wood set and how we got there. General art and engine lessons
live in the shared skills (`.claude/skills/bedrock-art/references/generated-art.md`, `bedrock-block-families/references/families.md`).
Status of each asset: `GRAPHICS_TASKS.md` step 1. How the blocks are built: `TECHNICAL_NOTES.md` Phase 3.

## The owner's taste (apply to every remaining piece: gate, door, trapdoor, button, plate)

- **Quiet, decent beauty, not luxury.** "In Minecraft anything different from the regular shape already looks
  extraordinary." Start from the vanilla shape and change one or two things; do not invent a new object.
  Rejected as "too posh": gothic arches with hanging gold drops, gold collars, tall spires, stacked buds.
- **Gold budget: one or two small gold touches per object**, never three. The fence has exactly two: painted leaves and nothing
  else gold on the rails or cap.
- **Detail is painted into the texture, not added as boxes.** Leaves are pixels on the post, not planes sticking out.
- **Surfaces need life**: grain streaks and a knot or two; a post that is just vertical light/dark columns was "vertical lines".
- **Leaves** look like the falling-leaf particle (`textures/particle/mallorn_leaf.png`): diagonal, tip top-left, stalk bottom-right,
  4x5 texels, one per side, neighbouring sides at different heights.
- **Colours come from the planks' palette** (`PLANK` in `tools/make_mallorn_wood.py`). Gold on the silver set becomes silver on
  the heartwood set (the colour map swaps them). Small parts (rails, caps) wear a mid-tone strip of the main texture: the planks'
  top board row is almost white and made the first rails look white.
- **What was accepted**: bark with calm vertical light bands and two gold glints; cut end with a gold sap ring; long silver planks
  with very soft pegs; the fence (vanilla post + rails bent into an inverted V, small diamond cap on every post, painted leaves).

## How the owner likes to work

- **Show options side by side on one sheet**; the owner picks from pictures, not descriptions (bark: 3 sweeps before a pick).
- **Quick sketches, then the game.** Blockbench renders are good for shape; texture detail and cutouts are judged in game.
  The owner steers fast in small rounds ("I like the leaves, but ..."); keep each round small and re-render only what changed.
- AI concept art (`E:\AI`, Z-Image, pencil + watercolour prompts) gave ideas, but the owner's own idea won. Offer it, do not lead with it.
- Do not throw away rejected rounds: the first fence round is kept in `docs/art/fence_v1/`.
- The owner checks in game quickly and reports errors from the content log: always deploy, and bump geometry format versions
  with every new feature used (a `shelf` transform in a 1.21.0 file made the fence icons vanish).

## The two sets and the generators

- Logs/wood -> silver `mallorn_*` family; stripped logs/wood -> golden `mallorn_heartwood_*` family (owner's idea).
- **Draw only silver art.** `tools/make_mallorn_wood.py` draws every texture and makes the golden twins with `SILVER_TO_GOLD`
  (exact colour map for our palette; gold accents map to silver; a brightness fallback, silver anchors only, for anything else).
- `tools/make_heartwood_set.py` clones the silver block/item/recipe/loot files, renames ids and texture keys, shares geometry.
  New texture keys must be added to its `ID_RE` and `TEXTURES` (the fence post needed that). Re-run after every silver change;
  the test "two plank sets" fails when the clones drift.
- `tools/make_mallorn_fence.py` writes the fence and its icon geometry (bones and icon transforms are contracts; see its docstring).
- Icons of non-cube blocks go through `minecraft:item_visual` with an explicit gui pose (all confirmed in game 2026-10-01; buttons
  needed a second try: a 2x4x6 box with the long face east).

## Traps we hit in this mod

- Python on Windows writes CRLF; the block JSON is LF, the atlases, lang and `TECHNICAL_NOTES.md` are CRLF. Read and write with
  `newline=""` and keep each file's endings, or every line shows as changed (or a text replacement silently misses).
- Blockbench: rendering the same model path again reuses the old texture, and it keeps rendered PNGs open (write new names).
- Cube slopes: build them from end points (`seg()`), check the sign on a side view (the first try drew V dips).
- Refer to the owner with neutral pronouns in notes.
