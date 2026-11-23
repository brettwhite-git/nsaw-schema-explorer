# DESIGN.md — The Warehouse, Drawn: design system (v1)

Source of truth for how the product looks and behaves. Code follows this file. Change a rule here in the same commit as the code that implements it. Last updated 2026-11-21.
Tokens live in `tokens.json` (machine-readable). Section 1 below is generated from it. Do not hand-edit hex values here.

The product is a hand-inked, explorable field manual that teaches data warehousing and NetSuite Analytics Warehouse. Ink on paper. The dark night-ocean theme is the default, light is the alternate theme. Everything is code-drawn SVG or canvas: no generated images, and no 3D library (the isometric engine `ink/iso.ts` projects 3D parts into SVG ink and is kept for chapter 5; the entry piece is the flat climbing section, 6a). The method is the `ink-and-thread` skill; its `drawing-rules.md` is the parent of this file.

**Identity.** Variant C Proof (chosen 2026-11-20): off-white / deep-ocean ink / amber on light, the decks' night ocean on dark. Dark is the default look; light is the alternate (toggle, persisted, no flash on load). The lab at `lab/identity/` is kept as history.

## Canvases

| Level | What | Link |
|---|---|---|
| Home | Index of design work | none yet |
| L1 | Journeys | none yet |
| L2 | State model | none yet |
| L3 | Design system (tokens, components) | none yet. Working prototype: `lab/identity/index.html` (dev server, `/lab/identity/index.html`) |
| L4 | Screens | none yet |

## 0. Keeping design, canvas and code in sync

Pointer: follow skill `design-sync-loop` (findings, labels, board badges, version log).
- Labels: **Bug** (code only), **Design change** (code + this file + section 7 line + canvas board), **Gap** (this file + new board).
- Badges: Shipped · asset NN / Pending build / Design only / Drift / Legacy.
- Gate: a change is not done until every affected board badge is right.
- Check command: `node scripts/design-check.mjs` (contrast, type floor, hex-in-components, clipping probes). It must exit 0. The script does not exist yet; until it does, run the probes listed in section 0a by hand.

## 0a. Taste principles

Each principle has a TEST. A principle with no test is a wish. Delete it or write the test.

| # | Principle | Test (who or what checks it) |
|---|---|---|
| 1 | Ink on paper. Lines, never ink fills. Solid objects are paper-2 with a hatched edge. | No drawn shape has a solid `fill` other than the paper colours (`--paper`, `--paper-2`). Probe: in a figure, every element with a non-`none` fill is `.paper`, `.hole`, `.dot` (stipple, r ≤ 0.8), `.knot` (r ≤ 2.5) or text. |
| 2 | One accent per figure state. | Probe: elements in accent colour inside one figure all share one focus id (the lit tag and its thread). Count of distinct focus ids ≤ 1. A second accent is a defect. |
| 3 | Drawn, sewn or written in. Never faded, never wiped. | Probe: draw-in animations animate only `stroke-dashoffset`, `clip-path` (label write-in), or `opacity` on dots, paper and text blocks. No `transform`, no `filter` animation on drawings. |
| 4 | Nothing loops. | Probe: `document.getAnimations().filter(a => a.effect.getComputedTiming().iterations === Infinity).length === 0`. |
| 5 | Same seed, same drawing. | grep: every `gen.*` / `rough` call carries a literal `seed`; no `Math.random` in drawing code. |
| 6 | The tie says where the fact came from, quietly (provenance). | Atlas and chapters: every relationship uses exactly one of solid ink line (explicit), stitched thread (inferred), pencil (illustrative). Entry scenes (style C): ties are string or slips with one legend line and a source mark, never arrows; invented ties are light pencil. |
| 7 | Layers differ by form, not colour. | Probe: the four layer tags in `.layers` differ in shape, weight and hatch while using the same `color`. |
| 8 | Reduced motion shows the finished drawing. | Probe: with `?reduced=1` or the OS setting, `document.getAnimations().length === 0` and `.undrawn` count is 0 after load. |
| 9 | Illustrative things say so. | Any figure with made-up shapes or numbers carries the word "illustration" in its header. |

## 1. Tokens (generated from tokens.json)

### 1.1 Materials

| Token | Light (alternate) | Dark (default) | Role |
|---|---|---|---|
| paper | `#F6F5F0` off-white | `#101F26` the decks' night-ocean | page and sheet |
| paper-2 | `#FCFBF8` | `#172B34` | tag paper, a step lighter than the page |
| ink | `#12303D` | `#D8E6EB` | lines, headings, body |
| ink-2 | `#4D6671` | `#8FB5C3` the decks' light ocean, lifted | secondary text, labels, callouts |
| pencil | `#8AA0A9` | `#6C8791` | illustrative lines only, never text |
| accent | `#A85A00` amber | `#F6AE4E` the decks' amber | the one focus |
| hair | `rgba(18,48,61,.16)` | `rgba(216,230,235,.15)` | hairline rules |
| edge | `rgba(18,48,61,.32)` | `rgba(216,230,235,.30)` | sheet border, control borders |
| paper texture | `/paper/paper-c-light.webp` | `/paper/paper-c-dark.webp` | 512 px periodic tile, `multiply` in light, `screen` in dark |
| serif | Georgia (Gelasio fallback) | same | titles, body, callouts |

Mono is JetBrains Mono, handwriting is Caveat (via WrittenInk glyph data, `public/fonts/caveat-glyphs.json`). CSS custom properties for all of these are generated from `tokens.json` by `npm run tokens` into `styles/tokens.generated.css`: dark on `:root`, light under `[data-theme="light"]`.
Sage `#759C6C` from the decks is not used: end results are not a colour here, they are a position.

- **Thread.** Dashed, round caps, 1.2 px, dash 4.5 gap 5, ink at 50%. Focused thread = accent at 95%. Thread ends sit on a tag edge with a 2.3 px knot.
- **Pencil.** `--pencil` stroke, 1.1 to 1.5 px, rough.js roughness 0.9, run through the seeded grain filter `#pencil-f` (fractal noise, seed 4). Always lighter and greyer than ink. Never on text.
- **Ink.** Lines at their token colour with no opacity trick, except thread (50%) and dimmed (30%) states.

### 1.2 Line weights

| Name | px | Use |
|---|---|---|
| hairline | 0.6 | hatching, grid, leaders, derived outline |
| light | 0.8 | source tag outline |
| standard | 1.1 | semantic tag outline, patch outlines, inner edges |
| heavy | 1.6 | warehouse tag outline, slab silhouette (at most one emphasised outline per drawing) |
| subject | 2.0 | entry scenes (staffed building): the one thing being talked about; support 1.1 and background 0.6 (dimmed) complete the three levels (section 6b) |

Rough.js: `roughness` 0.35, `bowing` 0.4, `disableMultiStroke: true`, fixed `seed` per shape. Pencil only: roughness 0.9, bowing 0.6. Roughness above 0.6 is a defect (the owner wants plotter precision with a trace of hand).

### 1.3 Hatching

Parallel hairlines (0.6 px), 3.6 px apart inside a tag band (bottom 7 px), 5 px apart in a free patch, clipped to the shape. Angles are counter-clockwise from horizontal: 0, 45, 135. Stipple: dots r 0.7, 3.4 to 5 px grid, rows offset, jitter from a fixed seed. Never a solid fill. A slab's shadow face hatches at 45 degrees, 3.6 px.

### 1.4 Type scale

| Style | Spec | Use |
|---|---|---|
| title | serif, 32 px, line 1.08, weight 700, tracking -0.01em | chapter title; 28 px below 560 px width |
| body | serif 400, 16 px, line 1.62 | paragraphs |
| callout | serif italic 14 px (text), 13 px (in figures); the letter in parentheses | `(a)`, `(b)`: leader plus letter, ink-2 colour |
| label | JetBrains Mono 500, 11 px, uppercase, tracking 0.12em | table names, label rows, tags (10 px in small layer tags) |
| header | JetBrains Mono 500, 10.5 px, uppercase, tracking 0.14em | figure headers |
| caption | JetBrains Mono 400, 10.5 px | captions, spec lines (floor 10 px) |
| hand | Caveat via WrittenInk, 22 px, line 1.2, ink-2 | margin notes |
| presenting | entry scenes on the 1200-wide stage: narration serif italic 26, plaque 16 over 13 mono, primary label serif 600 26 (floor 22), secondary mono 16 (floor 13), pinned note 19 | the owner presents live; the 10 px floor does not apply (section 6b) |

Text floor is 10 px. Table names are UPPERCASE mono; column and field names keep their source case. Semantic-layer names are set in the serif, derived names in serif italic.

### 1.5 Contrast pairs (checked)

Ratios computed on 2026-11-20. Light, paper / paper-2: ink-2 5.57 / 5.87, accent 4.66 / 4.92. Dark: ink 13.19, ink-2 7.68 / 6.68, accent 8.89 / 7.74. Pencil is 2.5 (light) and 4.42 (dark): it is a line colour for illustrative marks, never text, so the 3:1 non-text rule is waived with a floor of 2.5. Every pair is in `tokens.json` `pairs`.

Rules:
- Components reference semantic tokens only. A hex value in a component file is a defect.
- Text is ≥ 10 px. Every text pair in `tokens.json` passes AA (4.5:1).
- Hit areas: a tag is ≥ 30 px tall plus a 6 px transparent hit margin; chrome buttons ≥ 32 px.

### 1.6 Layers: four data layers without four colours

Position, weight, hatch and shape carry the layer. Colour does not. All four use the same ink.

| Rank | Layer | Shape | Outline | Hatch | Name set in | Position |
|---|---|---|---|---|---|---|
| 1 | NetSuite source | plain rectangle | 0.8 | 0 degrees | mono, source case | left in a flow, bottom in a stack |
| 2 | Warehouse | punched tag (chamfered left corners, one punch hole) | 1.6 | 45 degrees | mono UPPERCASE | centre / second |
| 3 | Semantic model | pill (fully round ends) | 1.1 | 135 degrees | serif | right / third |
| 4 | Derived | double hexagon (two 0.6 outlines, 3 px apart) | 0.6 + 0.6 | stipple | serif italic | last, apart from the stack |

Reading order is left to right, bottom to top. Accent never marks a layer; it marks the current focus (section 0a, rule 2). Reuse in the existing explorer's graph and detail panel is a later migration.

### 1.7 Provenance: how a line was drawn

| Line | Means | Style |
|---|---|---|
| solid ink line | explicit in the data (a mapping that is in the CSV or ontology) | 1.1 px, ink |
| stitched thread | inferred by a rule (for example `inferRecordType`) | dashed thread, see 1.1 |
| pencil | illustrative: a sketch to explain, not data | pencil, see 1.1 |

This is a site-wide drawing rule. A relationship with no provenance line is a defect. A legend appears wherever more than one style is on screen.
**The entry piece (2026-11-21, section 6b) keeps three styles but demotes them to a legend line and a source mark (replaces "pencil = documented").** Ink: in the lineage data. Ink with a SOURCE MARK (a small open ring on the line): stated in Oracle's documentation, not visible in the lineage data. Pencil: invented for the example (the order, the go-live date, the slips, the outside systems). The stitched thread (inferred by a rule) stays the rule for the Atlas and the chapters; a scene that needs it says so. The source mark helper is drawn by the shared legend (`figures/scenes/shared/stageview.ts`) and is used from scene 2 on; scenes 0 and 1 draw nothing from documentation.

## 2. Page contract

1. Frame: a sheet of paper (`--paper` plus the texture tile), 1 px hairline border (`--edge`), 22 px padding (16 px below 560 px). Figures have no boxes or shadows of their own.
2. Header: mono label row (chapter, topic, table name, grain) above a serif title.
3. Controls: mono 11 px uppercase buttons, 32 px tall, 1 px border; the active one gets a 2 px inset underline in ink. No accent on chrome.
4. Main area: one column of blocks at 22 px gap; blocks are header, figure, one-line caption.
5. Card: not used. Use a hairline rule and spacing.
6. Tables: hairline rules (1 px, `--hair`), mono for names, serif for prose cells.
7. Words: "explicit", "inferred", "illustrative" (provenance); "source", "warehouse", "semantic", "derived" (layers); "grain" for the level of one row. One word per idea.
8. Anti-slop (each testable by grep or review): no gradients, no drop shadows (a hatched offset edge on an object is shade, not a shadow), no emoji, no stock icons, no ink fills (principle 1), no rounded-corner cards with shadows, no glow, no second accent, no 3D library or WebGL (isometric ink drawn by `ink/iso.ts` is allowed), no generated imagery.
9. Responsive: figures measure their box and rebuild (never scale a drawn figure with `viewBox`); tags keep 11 px text down to 280 px; a callout drops its phrase and keeps its letter when it would touch a tag.

10. Chapter pages (a figure beside scrolling copy) exceed the normal page measure: the shell grows to 1480 px, the copy column is 340 to 440 px, and the figure column is the larger one, 620 to 780 px (about 740 px at a 1440 viewport). Two columns are shown only while the figure column can stay at 620 px or more (viewport above 1130 px); below that the figure is pinned above the copy. The figure rebuilds to its column: at 690 px and up its tag labels are 12 px, between 600 and 690 px 11 px, and only below 600 px the 10 px small-tag size. Table and caption text in a figure never goes below 10 px. Dense states get more air between slots, not smaller text.
11. Figures below 540 px (phones) are rebuilt as one tall column, never scaled. The figure stays pinned in a window (at most 50% of the viewport height, 420 px) that pans to what the current step adds (a jump, not an animation, under reduced motion). Two things are always present: a locator in the window's top-right corner (a hairline outline of the whole drawing, the current window marked in ink, one tick per step), and a full-screen sheet. Tapping the figure (outside a tag), or Enter on the locator, opens the sheet: the whole drawing at the current step, pannable, zoomable (buttons, pinch, Ctrl+wheel), with a 44 px close control; focus is trapped inside while it is open and restored on close, Escape closes, page scroll is locked, nothing animates.

### 2.1 Motion

- Things are drawn in: stroke reveal by `stroke-dashoffset` on `pathLength=1` paths, 0.5 to 1.8 s, ease `cubic-bezier(.42,.05,.4,1)`. Order is the order a hand would use: frame, then threads, then the tag each thread reaches, then labels, then callouts.
- Thread is sewn one whole stitch at a time: a mask reveal with `steps(n)` easing, n = length / 9.5 px.
- Labels are written in by a clip that opens left to right (460 ms). Text blocks get one light opacity fade of 320 ms, `cubic-bezier(.23,1,.32,1)`, no movement, no per-word stagger.
- Hover and focus responses ≤ 180 ms (160 ms in the lab). A lit tag takes the accent; its thread turns accent; the rest drop to 30%. At rest the fact tag is the one accent.
- A figure draws in once, when 35% of it is on screen, and has a replay control.
- Nothing loops forever. No idle drift in v1.
- Reduced motion (OS setting, `?reduced=1`, or the lab checkbox): the finished drawing at once, interactions kept, no animations at all.
- Only `stroke-dashoffset`, `clip-path` and `opacity` animate on drawings; `transform` only for physical things (none in v1).

### 2.2 Sound

Optional, later. If added: short recorded clips (not synthesis), one voice per family; only on a stroke or stitch the user caused, never on hover, scroll or auto-rotation; drop newcomers within 1.5 s; muted under reduced motion; the user confirms by ear. v1 ships silent.

## 3. Component: Sewn figure (star schema)

- **Anatomy, in fixed order:** header (FIG. n / title, "illustration" when made up), drawing, caption.
- **Size:** fills its column (280 to 620 px wide), height 300 to 360 px; the drawing is centred with even margins (≥ 8 px).
- **Content:** fact tag at the centre, dimension tags on a 2 x 2 grid around it, one thread per relationship, a callout `(a)` with a leader to the fact tag. All tags use the warehouse layer form (1.6).
- **Subject-area star, what is drawn (Atlas):** the centre is the fact that best matches the subject area's name (at least half the name's words in the table name), preferring the finest grain: the `_LINES_F` table over its header `_F` when both exist; `_SEC` twins are never the centre. With no fact, the figure says so and draws no star. Dimensions are split in two. *Universal* dimensions are those used by 90% or more of all subject areas (location, department, day, currency and so on); they are drawn as ONE bundled tag, "+ N shared by every area", that expands in place to the list and collapses again. The rest are ranked by how many presentation columns of THIS subject area they feed (needs `columns.json`, loaded on subject-area pages; without it, by how many subject areas share them), the top 8 are drawn, and the figure says how many are not drawn and how they were ranked.
- **Acceptance (measurable):**
  - Min font ≥ 10 px; table labels 11 px mono uppercase.
  - Thread endpoints coincide with tag edges (≤ 1 px), each with a knot.
  - Exactly one accent focus at any time (rest: the fact tag; hover or focus: the lit tag and its thread).
  - Tags are keyboard-focusable (`tabindex=0`), focus equals hover.
  - Contrast pairs: ink-2 on paper-2 ≥ 4.5:1; accent on paper-2 ≥ 4.5:1 (in `tokens.json`).
  - No fills other than paper (principle 1). No looping animation (principle 4).
  - Motion: draw-in per 2.1; reduced motion shows the finished figure with zero animations.
- **States:** drawing in, at rest, a tag lit, reduced.
- **Board:** L3 not drawn yet. Badge: Design only (prototype in `lab/identity/`).

## 4. Component: Layer tag

- **Anatomy, in fixed order:** paper, hatch band (bottom 7 px, clipped to the shape), outline (rough, seeded), punch hole (warehouse only), label.
- **Size:** 30 to 40 px tall; width = label length x 7.9 px + 36 px (mono 11 px with tracking), or label width + 24 px (serif).
- **Acceptance (measurable):**
  - Shape, weight, hatch and label face follow table 1.6 exactly.
  - Four layer tags drawn together share one `color`.
  - Hatch spacing 3.4 to 3.6 px, hairline 0.6.
  - Seed is a literal, unique per tag.
- **States:** at rest, lit (accent outline and label), dimmed (30%), keyboard focus (outline 2.2 px).
- **Board:** L3 not drawn yet. Badge: Design only.

## 5. Component: Provenance legend

_Entry piece (2026-11-21): the legend is ONE quiet line along the foot of the stage with three samples: ink "in the lineage data", ink with a source mark "in Oracle's documentation", pencil "invented for the example", and the one illustration note at its right. It is shared furniture (section 6b), always shown once scene 0 has pinned the questions. The three rows below remain the Atlas legend._

- **Anatomy, in fixed order:** sample line (84 x 22), mono label (EXPLICIT, INFERRED, ILLUSTRATIVE), one serif line of meaning.
- **Acceptance (measurable):**
  - Three rows, in that order, each sample drawn with the real style (not an icon).
  - Pencil sample is visibly lighter and greyer than the ink sample (pencil/paper contrast ≤ ink/paper contrast ÷ 2.5).
  - No accent.
- **States:** drawing in (each row 450 ms apart), at rest.
- **Board:** L3 not drawn yet. Badge: Design only.

## 6. Component: Margin note

- **Anatomy, in fixed order:** one to three lines of Caveat written by WrittenInk, ink-2, tilt ≤ 1.2 degrees per line (fixed by seed).
- **Acceptance (measurable):**
  - Written letter by letter (pen mask along the centre-line), never wiped or faded; reduced motion: finished.
  - Words stay readable to assistive tech (`role="img"`, `aria-label` with the text).
  - Glyph data covers every character used; re-run `make-written-glyphs.mjs` when copy adds one (a missing glyph leaves a gap and warns in the console).
  - No accent.
- **States:** writing, at rest.
- **Board:** L3 not drawn yet. Badge: Design only.

## 6a. Component: Entry section (climbing camera)

The site's entry piece (`/`, `figures/section/`, page `site/Entry.tsx`, copy `content/entry.ts`): the side-on section of NetSuite Data Intelligence, drawn tall in world coordinates, and a camera that climbs it as the page scrolls. It replaces the withdrawn isometric cutaway (decisions log, 2026-11-20); the isometric engine `ink/iso.ts` is kept for chapter 5.

- **World.** Ground at y = 0, four bands climbing into negative y: NetSuite, ingestion, warehouse, model; each BW 380 by BH 200. Between bands is a riser of RISER 120 (0.6 of a band; the rule is at least 0.45) where the order line and the rows travel. The two doors stand on the right edge, door one in the warehouse band, door two in the model band. Check: `tests/section.test.ts` asserts the proportions.
- **Camera is a pure function of progress.** `cameraAt(p, stage)` eases between keyframes (`model.ts`): ground, band 0 to 3 (one band fills most of the stage), the doors beat (both doors and the two bands they open from), the whole section. Same p, same camera, in either direction. Check: forward, backward and shuffled evaluation are equal; the climb never reverses up to the model band; no jump larger than 6 screen px per 0.05% of progress. Scroll track is 8 viewport heights.
- **Assembly (the payoff of "put together").** In the last pan the risers CLOSE: every band slides down to meet the one below, the risers squeeze to a thin SEAM (10 units) and the doors travel with their bands, so the five parts settle into one assembled section about 0.7 of its open height. Closing is a pure function of progress (`closeAt`, eased over the last pan; reversible). The assembled section is drawn at the largest scale that keeps room for the numbered entries (`fitScale`, `entryMargin`: 330 px each side on wide stages, 214 on tablets, balloons only on phones), centred with equal margins. Each entry is a numbered balloon with a short leader, then the part's name, its one-line verified claim and its count, beside the band it names (the two doors split the verified doors claim). The band names (22 units, serif) are drawn inside the assembled section and are readable only there (`names` level of detail). Check: `tests/section.test.ts` asserts every band and the doors inside the stage at the final beat for 16:10, 4:3 and 9:16, even left and right margins, the entry margin, names at least 10 px, and reversibility.
- **Caption strip.** A real caption under the stage with a fixed position and height (176 px, 292 px on phones) so the stage never jumps: beat number and name as a mono label, the part's claim in the serif at 21 px (17.5 px on phones) in ink (not ink-2), the count beneath as a mono label; one 320 ms fade on change. Contrast: ink 13.2 on paper (dark) and 12.4 (light); ink-2 7.7 and 5.6 (tokens.json).
- **Clearings.** Named tags, the landing row, labels and the "and N more" mark sit on paper-coloured clearings so the real field behind them (447 tables, 110 subject areas, drawn a step lighter) reads as background texture; "and N more" sits in the band's corner on its own clearing.
- **The order line has its own lane.** In the warehouse band it climbs in a gutter beside the tags (x = 266, the tags start at 272) and lands on the row from its left edge; it never crosses a tag or its text (`tests/section.test.ts` checks the gutter against the tag edges).
- **Phones frame the doors one at a time** (door one, then door two with the report number), so each door's label and the number reach 10 px; wider stages frame both at once.
- **Group labels.** The model band names its nine functional-area groups quietly (italic serif, 10 units) in the gutters of its field, where they reach the minimum size (scale >= 1: desktop and tablet; phones keep the unlabelled field).
- **Timing is one block.** `TIMING` at the top of `figures/section/model.ts` holds every feel constant (track length in viewports, dwell and pan lengths as relative values that are normalised to the track, easing, when a band starts and finishes drawing); the keyframes, reveal windows and beat boundaries are all derived from it. Risers are the slow moves (0.11 each) and every move eases in and out (quintic). `?debug=1` shows progress, beat, camera scale, closing and stage size.
- **Beats.** 0 ground, 1 NetSuite, 2 ingestion, 3 warehouse, 4 model, 5 two doors, 6 the whole section. Every band is drawn in (stroke reveal, progress-driven timelines, reversible) as the camera reaches it and is finished before the camera leaves it; risers draw while the camera crosses them. Only the ground and the desk are drawn by time on arrival, once, so the first paint is already inviting. Nothing loops. Row marks in the ingestion pipes are a pure function of progress (nothing moves when the reader stops).
- **Two levels of detail.** Close up (stage margins): lettered call-outs (a)(b) with short leaders, never on the drawing. Pulled back: five numbered band labels (1 to 4, doors 5a and 5b) in clean left and right columns. The switch is one threshold between the doors scale and the whole-section scale; the cross-fade is 320 ms with no movement (the one allowed fade). On phones (under 540 px) call-outs move to the caption strip and the numbered labels are balloons only; the numbered list under the drawing names them.
- **Text size after camera scale.** Labels are set in world units (12.5, quiet labels 10) so they grow with the camera; a label whose effective size (world size times scale) would fall under 10 px is hidden, not shrunk (`lodAt`, `effectivePx`). Check: at every progress and for 16:10, 4:3 and 9:16 stages, no visible label is under 10 px, and every band beat shows its labels.
- **Stroke weight.** Strokes keep their pixel weight at any camera scale (`--k` = 1 / scale multiplies every stroke width and the thread dash); hairlines stay 0.6 px.
- **Layers by form (1.6) and provenance (1.7).** NetSuite: plain rectangles. Warehouse: punched tags (fact hatched at 45 degrees, dimension with a punch, DAY_D in the derived double hexagon; the real field of all 447 tables as small tags, secured twins as a second outline). Model: pills, 135 degree hatch (the real field of 110 subject areas). Pencil (documented by Oracle or the deck, not in the lineage file): ingestion, the doors, the gates, the people, the way out through door two. Solid ink: the lineage (BASE_AMOUNT in the `_SEC` twin and COMPANYNAME in CUSTOMER_D climbing to their business names). Stitched thread: inferred (the `_SEC` twin and the dimensions joined to the fact). One legend line under the stage.
- **Accent.** One accent: the order line (thread, knots, form line 1) at every beat. Under hover or keyboard focus the hovered band takes the accent (its frame) and the thread drops to ink. Probe: `accentFor()` (`tests/section.test.ts`) and a source check that amber is only used for order-line parts.
- **Interaction at rest** (progress 0.93 and up): hover or focus a band; click or Enter opens its chapter where one exists (chapter 1 only today). "Not yet drawn" is shown only in the tooltip and the list under the piece, never on the drawing. Named tags, pills and business names open their Atlas pages; Up and Down choose a band, Left and Right a named item, Enter opens, Escape clears; the live region reads it. "From the ground again" scrolls back to the top of the piece. The stage is focusable with a text alternative per beat; the five parts with counts and links follow as a list.
- **Reduced motion.** No camera travel and no draw-in: the finished whole section, then the five band close-ups as still figures in order, each with its call-outs and caption. Probe: with `?reduced=1`, `document.getAnimations().length === 0` after load.
- **Debug.** `?p=0.37` freezes the piece at a progress value (used for screenshots); it is not linked from anywhere.
- **Pencil grain.** Pencil parts use the pencil colour and rougher wobble but not the grain filter (a filter on a scaled, moving group is expensive); a known deviation from 1.1.
- **Board:** L3 not drawn yet. Badge: Design only. Screenshots: `lab/entry/shots/final/`.

## 6b. Scenes (the entry piece: a staffed building)

The entry piece is built one scene at a time. Each scene is designed as a scene, built ALONE in the lab (`lab/scenes/`), signed off by the owner, then the next. The story, the decisions, the Voice rule and every scene's click table (with the exact "Words on screen") are in `docs/entry-story.md`. The climbing-camera section (6a) stays in place until the scenes replace it. Built so far: scene 0 "At the counter" (6 clicks) and scene 1 "The front office" (10 clicks).

**The look (approved 2026-11-21 from `lab/dollhouse/`).** A building cut open side-on like a dollhouse: five rooms (front office, post room, stock room, catalogue desk, counter and dock), one worker in each, a dumbwaiter shaft up the left side, a counter window and a loading dock on the right. A relay: each floor has one worker doing one job; the amber line is passed on. The scene opens and closes at the counter.
- **People are solid silhouettes** (`figures/scenes/figures/`): ONE filled shape in ink, no outline, no visible joints, no faces; a small cut in the paper colour separates a crossing near limb. Role marks are part of the shape or a cut-out (clerk eyeshade, courier cap and satchel, stock-keeper apron and bun, cataloguer spectacles and long hair, counter clerk bow tie and waistcoat, customer hat and long coat). A figure is a tiny skeleton (pelvis, spine lean, head, two feet, two hands) solved with two-bone IK, so a hand meets what it holds; a pose is a set of numbers and poses interpolate (eased, a slight arc on the hands, a small weight shift). No walk cycles, no looping idle motion.
- **Objects** are things recognisable without a label (`figures/scenes/objects/`): form, cards, cabinet with drawers, slip, string through eyelets, calendar, tape, parcel. Solid paper-2 fill, hand-run outline, hatched edge; hatching varies by surface (wall cuts dense 45 degrees, floor slabs sparse 135, shadow sides short strokes).
- **Building** (`figures/scenes/building/`): the rooms in groups that a scene lights or dims. LIT / DIM is how every scene shows which floor we are on: the lit room is at full strength, the others at the background weight (0.28).
- **Three weights**: subject 2.0, support 1.1, background 0.6 dimmed. **One amber thing**: the line we follow (form line 1, its card, the bar, the copy that goes upstairs). **One idea per click**: three to five things at full strength (a worker counts as one); what is not being talked about steps back (strength `back`) or leaves. In clicks 6 to 8 of scene 1 the clerk and cabinet step back behind a quiet veil and the calendar, tapes or parcels own the frame.
- **Words**: plain names large with the system's own name small beneath. One narration line (26 px italic, bottom left) per frame, from `content/scenes.ts`. Type for a room: narration 26, plaques 16 (13 beneath), labels 22 to 26, secondary 13 or more; text that would fall under 10 px on screen is hidden, not shrunk.
- **Voice rule (checkable copy rule).** Every word on screen is narration: what happens and who does it, present tense, short sentences, concrete nouns. No "X, not Y", no "if ... then", no "rather than", no "instead of". `tests/copy.test.ts` lints `content/scenes.ts` and the strings in the scene and object sources, and checks the click words equal the sheet's column.
- **Provenance is quiet**: one legend line (in the lineage data; ink with a small ring: in Oracle's documentation; pencil: invented for the example) and a source mark on documented things. In the slip chain, line to order and order to customer are string (the true data path); the line to item tie is a light pencil string.

**The camera** (`figures/scenes/world/`). Scenes are staged in the building's world coordinates (a floor is 108 high). A camera (centre and zoom) frames the whole building for the wide shot and moves in to a room; it is part of a click's transition (eased, 0.9 to 1.9 s, zoom interpolated in log space), never free-running. Line weights keep their pixel size under zoom (non-scaling strokes; strings and knots compensate), plaque labels keep their screen size and hide above 2.2x, objects' own text scales with them and hides under 10 px. Things drawn in screen space (calendar, tapes, parcels, the veil) are not moved by the camera.

**The world engine.** A scene is a table of POSES per click, with optional STAGES inside a click (a later moment `at` ms): where each object is, how much is drawn, its strength, named props, the figure's pose name and hand targets in the world, and a camera. The state at any moment is the previous stage's pose moving to the next (damped spring; stagger by `delay`). An object missing from a stage fades out; one missing before is drawn in where it stands. Strings are tied to named anchors. A held object follows a figure's hand (`attach`). Everything is a pure function of progress (`evalWorld`); tests run without a DOM.

**Presented live.** Control (`figures/scenes/player.ts`, pure state machine; `sequence.ts`, the DOM glue): click, Space, Right or PageDown plays the next beat (a click mid-beat jumps to its finished frame); Left or PageUp the previous finished frame, across scenes; scroll moves inside a beat; number keys 0 to 6 and a click on a pinned note jump to a scene; End or S skips to the scene's last frame; F is full screen; reduced motion shows every finished frame at once. No fixed length.

**Shared furniture** (`figures/scenes/shared/`), quiet by rule. PINNED NOTES top right (y 20..58): three small numbered paper notes with the short forms "Last year?", "Whose number?", "Other systems?"; a click jumps to the scene that answers it; when a question comes forward it becomes the handwritten line at top left (30 px) and the paper note leaves its slot. In scene 0 the three questions are written large above the customer and pinned by the counter clerk. LEDGER (zone x 820..1160, y 610..734): appears only when a line is written ("173 kinds of record, filed as they happen.", the count read from the ontology), then tucks to a thin tab. LOCATOR: a tiny building outline at the right edge with the lit floor hatched. LEGEND: one line along the foot, drawn over a quiet clearing.

**Stages and phones.** One 1200 x 780 composition scaled to the stage at every width. Below 860 px wide nothing is recomposed: the whole stage scales and its text falls under the floors. A portrait composition is deferred.

**Scene 0, `counter`** (6 clicks): the building at dusk with a customer walking up to the counter window; close on the counter, the three questions written one at a time above the customer; the counter clerk pins three notes to a board and they become the pinned furniture; the view travels down the outside of the building to the ground floor and a light comes on. Its last frame is scene 1's first (`SC0_END`; the test compares them).

**Scene 1, `front-office`** (10 clicks): (1) the form lands on the desk, line 1 turns amber; (2) the clerk tears it into cards; (3) the clerk files each card, the drawers open (orders, lines, customers, items); (4) a slip on the amber card, strings line to order to customer, a lighter string to the item; (5) the clerk rewrites the name on a customer card, the old name is struck through and the new one written on both cards, with a highlight in ink weight; (6) question 1 and a wall calendar for January 2024; (7) question 2 and three tapes against the same order (ordered 1,550.50, shipped 1,240.00, invoiced 620.00; stable ids `tapeOrdered`, `tapeShipped`, `tapeInvoiced`); (8) question 3 and four parcels on the floor beside the cabinet; (9) wide on the tidy room, the ledger's first line is written; (10) the clerk puts a copy of the amber card in the dumbwaiter and it rises. NetSuite is never shown failing.

**Lab** (`lab/scenes/index.html`): the sequence with the real controls plus a scrubber, scene and beat buttons, theme, reduced-motion and phone toggles. `?scene=1&beat=3` opens at that finished frame (beat is 0-based; `&u=0.4` a point inside it), `?theme=light`, `?reduced=1`, `?phone=1`, `?hint=0`, `?chrome=0` (stage only), `?labels=0` (all text hidden). Screenshots: `lab/scenes/shots/00-counter/`, `lab/scenes/shots/01-front-office/`. History: `lab/style/` and `lab/dollhouse/`.

## 7. Decisions log

One line per change. Newest first. Format: `date | build | Label | what changed and why | finding #`.

| Date | Decision |
|---|---|
| 2026-11-21 | Staffed cross-section with solid silhouette figures approved; scenes 0 and 1 rebuilt as the staffed building: figures, building and camera in `figures/scenes/{figures,building,world}`, six clicks at the counter and ten in the front office (section 6b). Supersedes the cabinet-only scenes and the picture world of style C for the entry piece. |
| 2026-11-21 | On-screen copy is narration: no X-not-Y or if-then constructions (also no rather-than or instead-of); the words of every click come from `content/scenes.ts` and equal the sheet; `tests/copy.test.ts` lints them. |
| 2026-11-21 | A camera frames each click (zoom in log space, 0.9 to 1.9 s, lines keep their pixel weight); lit and dim floors show which floor we are on; the legend and locator stay quiet (section 6b). |
| 2026-11-21 | Analogy-led illustration style C chosen from `lab/style`; one picture world (a building seen side-on, climbed floor by floor); provenance demoted to a legend line and a source mark (section 6b). Supersedes the line-style provenance and the reserved right-column furniture below. |
| 2026-11-21 | Style C rules: object vocabulary; three weight levels (subject 2.0, support 1.1, background 0.6 dimmed); plain words large with the system name beneath; solid paper-2 objects with a hatched edge; string and slips, never arrows; one thing at a time (at most five at full strength); type for a room (headline 44-48, labels 22+, secondary 14+) (section 6b). |
| 2026-11-21 | Scenes 0 and 1 redrawn in style C on a pose-table world engine (`figures/scenes/world/`); scene 1 has ten beats; the pinned questions are three small numbered paper notes with short forms; the ledger appears only when written and tucks to a tab. Known gap: no portrait recomposition (phones get the scaled landscape stage). |
| 2026-11-21 | Scenes 0 and 1 are built to the sheets in `docs/entry-story.md`; scene 1 loses the tray, the blank-card fan and the empty "before" inset and gains beat 4, the three pinned questions asked of the record shape (section 6b). |
| 2026-11-21 | Shared stage furniture on the 12-column grid: pinned questions, ledger, locator and legend, in a reserved right column (bottom and top bands on phones) that no scene element may enter in any beat (section 6b). |
| 2026-11-21 | The entry piece is presented live: a click or key jumps to the next finished frame, scroll moves inside a beat, number keys and the pinned questions jump to a scene, End skips to a scene's last frame; no fixed length (section 6b). |
| 2026-11-21 | Entry piece line styles: ink (in the lineage data), ink with a small source mark (in Oracle's documentation, not in the data), pencil (invented for the example). Replaces "pencil for documented" (section 1.7). |
| 2026-11-20 | Entry piece is being redesigned one scene at a time, each built alone in the lab and signed off before the next (section 6b). |
| 2026-11-20 | Row 31, Design change: the caption strip is a real caption (21 px serif claim in ink, mono label and count, fixed height, one 320 ms fade) because it carries the one sentence that explains each layer (section 6a). |
| 2026-11-20 | Row 30, Design change: the ending is the payoff of "put together": the risers close to a thin seam as the camera pulls back, the section is drawn far larger, and the numbered labels become full entries (number, name, claim, count) beside their bands (section 6a). |
| 2026-11-20 | Entry section polish: named things sit on clearings over a lighter field, the order line climbs in a gutter, phones frame the doors one at a time, the model band names its nine groups, timing lives in one `TIMING` block with a `?debug=1` readout (section 6a). |
| 2026-11-20 | Entry piece is the side-on section with a climbing camera; the isometric cutaway is withdrawn as hard to read; the iso engine (`ink/iso.ts`) is kept for chapter 5 (section 6a). |
| 2026-11-20 | Entry section: the camera is a pure function of scroll progress; bands are drawn in as it reaches them; risers (0.6 of a band) are real space where the order line and rows travel; labels are hidden, never shrunk, under 10 px after camera scale; lettered call-outs close up, numbered labels pulled back (section 6a). |
| 2026-11-20 | Entry section: hover or focus gives the accent to the hovered band and drops the order line to ink; chapter availability is shown only in the tooltip and the list, never on the drawing. |
| 2026-11-20 | Row 25, Design change: Atlas star centres the finest-grain fact that matches the subject area's name, bundles universal dimensions (90% or more of subject areas) into one tag, and ranks the rest by presentation columns fed in this subject area (section 3). |
| 2026-11-20 | Row 24, Gap: phones keep the pinned, panning window and add a corner locator plus a full-screen sheet for the whole drawing (section 2, item 11). |
| 2026-11-20 | Row 23, Bug: the final chapter state has one accent, the return thread from the report number back to line 1. Table values on the way stay ink. The figure test now asserts every state's accent is one connected thing. |
| 2026-11-20 | Row 22, Design change: chapter pages exceed the page measure; figure column 620 to 780 px, copy 340 to 440 px, tag text 11 px or more at 600 px and up (section 2, item 10). |
| 2026-11-20 | Variant C Proof chosen. Promoted to the top-level keys of `tokens.json`; A and B and the provisional notes removed. |
| 2026-11-20 | Dark night-ocean is the default theme; light is the alternate (supersedes 'light primary'). |
| 2026-11-20 | Identity lab (`lab/identity/`): three variants built for choice (A Manual, B Ledger, C Proof), paper tiles in `public/paper/`, rulebook and tokens written. Design only; no app code changed. |
| 2026-11-20 | Layers are told apart by form, not colour: shape, outline weight, hatch angle, label face and position (section 1.6). Four colours would need four accents, which breaks "one accent". |
| 2026-11-20 | Provenance is a line style, a site-wide drawing rule: solid ink = explicit in the data, stitched thread = inferred, pencil = illustrative (section 1.7). |
| 2026-11-20 | One accent per figure state. The accent marks the current focus (a lit tag and its thread), never a category and never decoration. |
| 2026-11-20 | No 3D, no generated images. Isometric drawing is allowed only as hairline wireframe built from code (SVG polygons). |
| 2026-11-20 | Ink on paper (light primary at the time; superseded by the dark-default line above). The direction is a hand-inked, plotter-precise field manual (precedent: makingsoftware.com), not a dashboard. |

## 8. Diagram contract

Pointer: follow skill `diagram-contract` (tokens, parts, composition rules, colour meaning). One board per view. Colour means one thing only: here, colour means "the current focus" and nothing else. Layers use form (section 1.6), relationships use provenance (section 1.7).

## 9. Journey contract

Pointer: follow skill `journey-contract` (stage columns, lanes, cards, numbered notes, pain/opportunity chips). Not used in v1; the product is a reading experience with figures, not a journey tool.
