# NSAW Schema Explorer (rebuild "The Warehouse, Drawn") - Behaviour Spec

A public web site that teaches data warehousing and NetSuite Analytics Warehouse (NSAW) from the ground up as a hand-inked, explorable field manual, and lets the reader pull any thread into the real semantic-model lineage. Readers are NetSuite and analytics practitioners and learners. One principle shapes every choice: ink on paper, where line style tells the reader what is known (solid = explicit in the data, stitched thread = inferred, pencil = illustrative).

**Status (2026-11-21):** branch `drawn`, nothing deployed from the rebuild. The entry piece is being built one scene at a time in the lab (`lab/scenes/`): scenes 0 (three questions) and 1 (NetSuite) are built; scenes 2 to 6 are sheets only (`docs/entry-story.md`). The live home page still shows the earlier climbing section. The pre-rebuild app (lineage browser: sidebar tree, star-schema network, detailed flow, table view) still runs and is described in `CLAUDE.md`. Rebuild is in Phase 0 (ontology build, rulebook and identity lab, housekeeping); no surface below is built yet. Audit findings are in `docs/testing/2026-11-20/findings.md`.

**How to keep this current:** update this file in the same commit as any behaviour change. When this file and the code disagree, the code is the truth; fix this file.

Paths: `F/` = repo root (`/Users/brettwhite/Projects/nsaw-schema-explorer`). Plan: `/Users/brettwhite/.claude/plans/async-painting-taco.md`.

---

## 1. The three surfaces (one ontology)

**Purpose.** Teach and explore from one shared model, so a lesson can open the real tables it discusses and a table page can open the lesson that explains it.

**Intended behaviour.**
- The Course: chapters whose figures draw themselves with scroll; each figure is a working machine driven by real lineage or by a small computed example (a TS relational engine: scan, join, group, filter).
- The Atlas: every concept, table, field and NetSuite record has a page and a URL; home is a bus matrix (subject areas by shared dimensions).
- The Index: search as a back-of-book index, ranked concepts first, relationship questions answered, keyboard navigable.
- Real URLs, history and deep links for every page and selection.
- One order line (customer 88, SO1041, 1,240.00, labelled illustrative) is followed through every chapter.
- Provenance is a drawing rule: solid = explicit, stitched = inferred, pencil = illustrative.

**Rules & limits.** Dark night-ocean theme is the default, light is the alternate (DESIGN.md decisions log). One accent colour. No 3D library or WebGL; all figures are code-drawn SVG/canvas, and isometric drawing built from code (`ink/iso.ts`) is allowed. Figure contract: `mount(el, {step, reducedMotion}) -> {setStep, replay, destroy}` plus a React wrapper. Version constant: `package.json` `"version"` (0.0.0).

**Key files.** `F/DESIGN.md`, `F/tokens.json` (rulebook), `F/scripts/build-ontology.mjs` (planned), `F/public/ontology/` (planned output).

**Open gaps.** Nothing here is built. Phase 1 is the gate.

---

## 1a. Entry piece

**Purpose.** "How NetSuite Data Intelligence is put together", presented live by the owner to finance leadership: three pinned questions, one order line followed up through the product, a ledger that grows one line per scene. Full story, decisions and scene sheets: `docs/entry-story.md`. Design rules and the control scheme: DESIGN.md section 6b.

**Current behaviour.** Lab only (`lab/scenes/index.html`; the live home page is unchanged). Scene 0 writes the three questions and draws the order form; scene 1 pulls the form into records, asks each pinned question of that shape and writes the first ledger line. Click, Space or Right: next finished frame; Left: back; scroll: within a beat; 0 to 6: a scene; End or S: skip to the scene's end; F: full screen. Reduced motion: every beat shows its finished frame at once.

**Rules & limits.** Three line styles: ink (in the lineage data), ink with a source mark (in Oracle's documentation), pencil (invented). Shared furniture owns a reserved zone; scenes never enter it. NetSuite is never shown failing; people appear only at the doors. Counts come from the ontology at run time.

**Key files.** `F/figures/scenes/` (`player.ts`, `sequence.ts`, `shared/`, `order/`, `scene0/`, `netsuite/`), `F/lab/scenes/`, `F/tests/scene-netsuite.test.ts`.

**Open gaps.** Scenes 2 to 6; the home page does not use the sequence yet.

---

## 2. The nine chapters

1. Follow one order line (first slice). 2. Why a warehouse exists. 3. Facts, dimensions, grain. 4. Shared dimensions. 5. Star and cube. 6. The model is the product. 7. Bronze, silver, gold, two doors. 8. Getting data in and extending. 9. Who sees what.

**Current behaviour.** Chapter 1 steps: order as a NetSuite form; three records; rows land; fact row plus dimension rows joined by thread; grain; the model names it; a number on a report. Each step ends with "pull this thread" into the Atlas.

**Rules & limits.** Chapters 2-9 are built only after Phase 1 is judged clearly better than the deck slides it replaces (slides 5-6 of the NSAW master deck).

**Open gaps.** All chapters unbuilt.

---

## 3. Data and ontology

**Purpose.** One static, typed graph the whole site reads.

**Intended behaviour.**
- `npm run ontology` builds JSON from the lineage CSV (about 56,000 rows, 110 subject areas, 447 warehouse tables), workbook source edges (2,774), the Entity Key List and the Oracle table-group index. Each node and edge is tagged explicit, inferred or curated.
- `parsePhysicalTableType` checks `_SEC` before `_F` today (`F/types.ts`); the build fixes this, uses one definition of "derived" (workbook `NSAW_DERIVED`), and keeps the 5,804 rows dropped by `F/data/dataLoader.ts` as SQL sources.

**Rules & limits.** No data types, descriptions, keys or formulas exist in any source. Teaching copy and example numbers are authored and labelled illustrative. Fact-to-dimension links are co-occurrence and drawn as inferred. True source lineage covers about 32% of warehouse columns; the rest uses the name guess (`inferFieldName`, `inferRecordType` for dimensions only) and is drawn as a guess. The site is public (Vercel, MIT repo): confirm workbook-derived data and deck wording may be published before Phase 0 ships any of it.

**Key files.** `F/data/dataLoader.ts`, `F/types.ts`, `F/config/functionalAreas.ts` (9 functional areas).

**Open gaps.** Build script and tests not written.

---

## 4. Testing and quality

**Rules & limits.** `npx tsc --noEmit` clean (2 pre-existing errors in `data/dataLoader.ts` lines 61-62 as of 2026-11-20), `npm run build`, `npm test` (Vitest: ontology counts, mini engine sums customer 88 to 1,550.50). Every figure is checked in a real browser at each step, light and dark, reduced motion, phone width, with a clean console.

---

## N. Change log
- 2026-11-20 - Spec filled from the approved rebuild plan; no behaviour change. Version 0.0.0.
