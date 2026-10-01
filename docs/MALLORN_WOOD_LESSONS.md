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
- Iteration sheets and scripts live in `temp/<feature>/` while working; when the feature is accepted, delete them and
  condense the notes to the final design and the owner's decisions (git keeps the rounds). Owner's rule, 2026-10-01.
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

- Python on Windows reads and writes cp1252 unless told otherwise: pass `encoding="utf-8"` (or run `python -X utf8`), or a
  text with `×`/`ó` fails to match and a rewrite corrupts the file. It also writes CRLF; the block JSON is LF, the atlases, lang and `TECHNICAL_NOTES.md` are CRLF. Read and write with
  `newline=""` and keep each file's endings, or every line shows as changed (or a text replacement silently misses).
- Blockbench: rendering the same model path again reuses the old texture, and it keeps rendered PNGs open (write new names).
- Cube slopes: build them from end points (`seg()`), check the sign on a side view (the first try drew V dips).
- `seg()` is right in both directions (rising to -z or +z; checked on side views 2026-10-01). A 2x2 rail frame seen from a
  camera slightly above can read as a V when it is a ^: judge the slope on a level side view, not on the front render.
- Gate (2026-10-01): 2x2 gate posts cannot carry the 4x5 leaf; they read leaf-free columns of the post texture. A leaf on
  the gate needs a 4-wide face (variant C's centre post), which splits in half when the gate opens.
- Refer to the owner with neutral pronouns in notes.

## Door (round 1, 2026-10-01)

- `tools/make_mallorn_door.py` draws the door as one 16x32 picture from hand-drawn pixel rows (kinds: rail, stile, panel,
  relief, leaf, gold, hole) and shades by rule (lit top-left edges, dark lower-right, one-texel cast shadow). Hand-drawn rows
  beat procedural shapes at this size: procedural branches came out as 1-texel stair-step rays, shaded "lobes" as clouds.
- Small carved details (leaves, midrib, gold) get fixed tones; the edge rule darkened most of their texels and greyed them out.
- Round 2 tried real depth (frame cubes, recessed panel, knob); the owner wants the vanilla door: flat, frame by colour
  (1-2 texels). Round 3 is back to one cube. Don't propose door depth again unless asked.
- Door accepted design (A4, 2026-10-01): half a mallorn per door (trunk at the free edge, no frame there), a loose
  arc of gold leaves over silver branches cut out against the sky, boards with roots below, 2-texel painted frame
  (outline + line) on the hinge, top and bottom edges. The owner liked the gold contrast and more cut-through.
- Painted relief reads as geometry: a field one shading height below its frame gets a lit line + cast shadow along
  the frame, which the owner saw as a 3-texel recess. Keep fields level with the frame on vanilla-flat blocks; relief
  only for small carved details (roots, mouldings, leaves).
- The owner tests in game and reports precisely (round 1 hinge side was right; round 2 mirrored the inside): trust
  that over a derivation. See `GRAPHICS_TASKS.md` "Door, round 3" and the shared note "Doors with cutouts".
- The owner reads a door by its frame, hinges and handle; plain silver on silver planks blended into the wall.
- A tree reads at 16 texels as a solid dome on a trunk; open branch-work and sky-specked leaf crowns read as rays,
  candelabras or hedges. A regular leaf grid reads as fish scales: nudge the leaves by a fixed pattern.
- Status and sheets: `GRAPHICS_TASKS.md` "Door, sketch round 1".
