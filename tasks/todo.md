# Plan: The Warehouse, Drawn rebuild (drafted 2026-11-20, approved 2026-11-20)

Source: `/Users/brettwhite/.claude/plans/async-painting-taco.md`, findings in `docs/testing/2026-11-20/findings.md`. Paths are under the repo root. One phase = one deploy.
Size: S under 1 h, M half a day, L more. Keep this file under 150 lines; archive done phases.

## Phase 0 - Foundations (version 0.0.0 stays until first deploy)
- [ ] 0.1 Ontology build (L) - IN PROGRESS: `scripts/build-ontology.mjs` writes typed nodes and edges (explicit / inferred / curated) to `public/ontology/`. Inputs: lineage CSV, workbook source edges (2,774), Entity Key List, Oracle table-group index. Folds in: `_SEC` before `_F` fix in `types.ts`, one "derived" definition, 5,804 dropped SQL rows kept as SQL sources. Done when: `npm run ontology` exits 0 and counts match the audit (110 subject areas, 447 warehouse tables, 2,774 source edges).
- [ ] 0.2 Rulebook and identity lab (M) - IN PROGRESS: adapt `~/.claude/skills/ink-and-thread/references/drawing-rules.md` into `DESIGN.md` and `tokens.json` (paper, ink, one accent, thread, line weights, type, motion; roughness below skill default). `lab/identity/` with 3 variants (accent, paper tile, serif). Done when: one variant is picked by eye and the rulebook is written.
- [ ] 0.3 Housekeeping (S) - IN PROGRESS: correct `CLAUDE.md`, log audit findings in `docs/testing/2026-11-20/findings.md` (linter exits 0), fill `SPEC.md` and this file, delete `utils/radialLayout.ts`. Done when: each file exists and `npx tsc --noEmit` shows no new errors.
- [ ] 0.4 Shell (M): routing with real URLs, paper background tiles, type, both themes; replace the Tailwind CDN, stray importmap and missing `/index.css` link in `index.html`; delete unused tokens. Depends on 0.2.
- [ ] 0.5 Figure contract in TS (M): `mount(el,{step,reducedMotion}) -> {setStep, replay, destroy}` plus React wrapper, ported from `ink-and-thread/assets/figure-template/`, `stitches.js`, `written.js`. Depends on 0.2.
- [ ] 0.6 Add Vitest (S): tests for the ontology build and the mini engine; set `TEST_CMD` in `.claude/harness.env`; add `npm test`. Depends on 0.1.
- [ ] 0.7 Publishing check (S): confirm workbook-derived data and deck wording are fine to publish before anything ships (Vercel, MIT repo). Owner decides.
- [ ] 0.8 Pre-existing tsc errors (S): `data/dataLoader.ts:61-62` TS2352 (`CsvRow` to `Record<string,string>`). Fix with an `unknown` cast.

## Phase 1 - First slice: "Follow one order line"
- [ ] 1.1 Mini relational engine (M): TS, about 300 lines (scan, join, group, filter) emitting inspectable steps. Done when: a Vitest case sums customer 88 to 1,550.50. Depends on 0.6.
- [ ] 1.2 Order-line figure, steps a-g (L): order as NetSuite form; three records; rows land; fact row plus dimension rows by thread; grain; the model names it; number on a report. Depends on 0.2, 0.5, 1.1.
- [ ] 1.3 Real lineage behind the figure (S): `Transactions.tranid -> DW_NS_SALES_ORDER_F.TRANID -> Sales Order Document Number` (12 subject areas); `Transactions.entity -> DW_NS_SALES_ORDER_LINES_F.CUSTOMER`; `customer.companyname -> DW_NS_CUSTOMER_D.COMPANYNAME` (49 subject areas). Depends on 0.1.
- [ ] 1.4 Minimal Atlas pages (M): pages for the handful of entities the chapter touches so "pull this thread" is real. Depends on 0.4, 1.3.
- [ ] 1.5 Lab verification (M): zoomed screenshots at every step, light and dark, reduced motion, phone width, clean console, layout measured numerically.
- Tests: Vitest for ontology and engine. Live: read the chapter in a real browser tab and judge against deck slides 5-6.

## Gated (needs approval, do not build)
- [ ] G.1 Phases 2-4 (Atlas and Index, chapters 2-9, finish): gated on the Phase 1 exit judgement.
- [ ] G.2 Sound: last; confirmed by ear before it ships.

## Order
Rulebook and contract first (0.2, 0.5), then ontology and tests, then one figure at a time against the rulebook. Phase 1 is the gate: if one chapter is not clearly better than the slides, stop and rethink.

## Open questions
1. Which identity variant (accent, paper tile, serif)? Answer (2026-11-20): open.
2. May workbook-derived data and deck wording be published? Answer (2026-11-20): open.

## Review (not yet)
- Shipped: nothing.
- Not verified live: everything.
- Follow-ups: the audit findings (21 rows, all Open) are addressed by the rebuild.
