# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Workflow Instructions

**Always use Plan Mode and Subagents for non-trivial tasks:**

1. **Enter Plan Mode** - Use plan mode to research and design before implementing
2. **Use Explore subagents** - Launch parallel Explore agents to investigate the codebase (up to 3)
3. **Use Plan subagents** - Launch Plan agents to design implementation approaches
4. **Execute with subagents** - After plan approval, use general-purpose subagents to implement changes
5. **Main chat stays lean** - Main conversation coordinates and reviews; subagents do the heavy lifting

**Why this workflow:**
- Subagents have fresh context windows for deep exploration and implementation
- Main chat maintains high-level awareness without context bloat
- Parallel subagents can investigate/implement multiple areas simultaneously
- Errors in subagents don't pollute main conversation history

**Reference:** See `CHANGELOG.md` for a log of what was tried, what worked, and key lessons learned.

## What this is

NSAW Schema Explorer: a lineage and catalog explorer for Oracle NetSuite Analytics Warehouse 25R4, in the **Paper ledger** look (light only). Shared (conformed) dimensions, fact grain and relationships are first-class. Plan of record: `/Users/brettwhite/.claude/plans/async-painting-taco.md`. The old illustrated "drawn" site and the legacy React Flow explorer are retired; `lab/` keeps the mock-ups as history (excluded from `tsconfig`).

## Rules that override everything

- **Stated only.** The ontology carries only what Oracle's files state (`STATED_ONLY = true` in `scripts/build-ontology.mjs`). No name-guessed NetSuite sources, no `_SEC` -> base pairing, no inferred concepts. Table role by suffix and `isSecured` are naming conventions, not relationships, and stay.
- **Copy rule.** Present what the data shows; never narrate gaps. Absent data is a blank cell or an omitted section, never a sentence ("no key", "not in", "no NetSuite source", "none"). Write plain sentences: no "not X, it's Y", no "if this then that". The only not-found copy is "Nothing here is called `X`." and "Nothing here matches `q`.". Sentence builders live in `explorer/data/copy.ts` and return `null` when the data is absent; `tests/copy-rule.test.ts` greps `site/` and `explorer/` for gap phrases.
- **One figure, one definition.** Counts shown on more than one page come from one function in `explorer/data` (e.g. `factsWithGrain(m)`: fact and enhanced tables the lineage lists under a subject area, each `_SEC` table counted as its own table; 102 of 282).
- **Provenance marks.** Every drawn line is a stated link: solid ink. The accent (ink red) marks only the one selected thing. Accent is never the only signal.

## Folders

- `data-src/` Oracle's source files (lineage CSV, entity key list, BI view objects, table index HTML) and the two CSVs extracted once from the NetSuite data lineage 4.0 workbook (`scripts/extract-workbook.py`).
- `scripts/build-ontology.mjs` builds `public/ontology/{core,columns,usedwith}.json` from `data-src/` (`npm run ontology`). `scripts/build-tokens.mjs` generates `styles/tokens.generated.css` from `tokens.json`. `scripts/shoot.mjs` is the route check.
- `ontology/` typed loader (`load.ts`, `columnar()`), types, naming conventions (`parsePhysicalTableType`, `isSecuredTable`), functional areas.
- `explorer/data/` pure data module (no React, no DOM; tested in Node). `model.ts` (`buildCore`, `buildColumns`), `grain.ts` (Entity Key List grain, header/line links, `factsWithGrain`), `names.ts` (slugs, `prettyTable`), `matrix.ts`, `folders.ts`, `ledger.ts`, `trace.ts`, `search.ts` (filters `is: type: grain: area: shared:`), `area.ts`, `table.ts`, `copy.ts`. Import from `explorer/data` (the index), not from its files.
- `site/` React 19 app: `main.tsx`, `App.tsx`, `Shell.tsx` (header, search button, footer, palette), `router.tsx` + `routes.ts` (history-API router, pure route table), `useExplorer.ts` (core.json first, columns.json on idle or on need), `usePage.ts` (title, focus, `body[data-ready="1"]`), `pages/`, `components/` (`Wires.tsx` measured SVG lines, `Palette.tsx`, `BusMatrix.tsx`, and per-page folders).
- `styles/explorer.css` imports `styles/explorer/{base,matrix,table,trace,search,area}.css`; colours and sizes only from `styles/tokens.generated.css`. No hex values in those files.
- `tests/` vitest: data counts, columns, copy rule, router, tokens, ontology.

## Routes

| Route | Page |
|---|---|
| `/` (`?dim=`) | Bus matrix: subject areas by shared dimensions; side panel for a row, a pair, or a dimension |
| `/compare/:a/:b` | Two subject areas, differences first |
| `/area/:slug` | One subject area: facts with grain, shared dimensions, report folders, closest areas |
| `/table/:name` (`?col=`) | One warehouse table: grain, header partner, loaded-from, key list, column ledger, neighbours, subject areas |
| `/field/:record/:field` (`?at=`, `?sa=`) | Fan-out impact trace of one NetSuite field (no dot in the URL) |
| `/search?q=` | Full search results; the palette (Cmd/Ctrl-K or `/`) opens anywhere |
| anything else | Friendly not-found with a search box |

`vercel.json`: SPA rewrite (except `/ontology/` and `/assets/`), redirects from the old `/atlas/*`, `/course/*`, `/index`, `/legacy.html`, cache headers for `/ontology/*`.

## Commands

```bash
npm run dev        # dev server on http://localhost:3001 (port 3000 is another app)
npm run build      # production build into dist/
npm run preview    # serve dist/
npm run ontology   # rebuild public/ontology/*.json from data-src/
npm run tokens     # regenerate styles/tokens.generated.css from tokens.json (never hand-copy token values)
npm test           # vitest
npx tsc --noEmit   # typecheck
npm run shoot      # route check: serve a build first (npx vite preview --port 3002 --strictPort);
                   # screenshots into lab/_shots-final/, fails on console errors, unready pages, overflow.
                   # node scripts/shoot.mjs --full --slice 1400 [routes…] writes readable slices.
```

## Look (Paper ledger)

Tokens in `tokens.json` (paper `#F6F5F0`, ink, ink-2, ink-3 darkened to 5.0:1, hairline rules, accent ink red `#9E2A1B`). Faces: Source Serif 4 (titles, lead), Source Sans 3 (UI), JetBrains Mono (names), self-hosted through `@fontsource-variable`. Rules in `DESIGN.md`; behaviour per route in `SPEC.md`.

## Gotchas

- `Wires` / `FanWires` read `scope.current` on every measure: an ancestor's ref is not attached when a child's layout effect first runs.
- Table display names come from `prettyTable` (report-folder spelling first, then vocabulary word split; a suffix word such as "Enhanced" or "Hierarchy" only when another table shares the base name). Extend `EXTRA_WORDS` in `names.ts` for new compound names.
- The browser pane throttles rAF; take a screenshot to wake it before reading layout.
