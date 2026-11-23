# DESIGN.md: NSAW Schema Explorer, Paper ledger (v2)

Source of truth for how the explorer looks. Code follows this file; change a rule here in the same commit as the code. Last updated 2026-11-22.
Tokens live in `tokens.json` and are generated into `styles/tokens.generated.css` by `npm run tokens`. Never hand-copy a hex value into CSS or components.

The explorer is a reference ledger: ruled paper, ink type, one red pen for the thing you picked. It shows what Oracle's files state, and lays it out so shared dimensions, grain and relationships can be read at a glance. The illustrated "Warehouse, Drawn" system (v1) is retired; `lab/` keeps its sketches as history.

## 0. Taste principles (each with a test)

1. **Present what the data shows.** No sentence describes an absence. TEST: `tests/copy-rule.test.ts` passes; a section with no data is not rendered.
2. **One red pen.** The accent marks only the current selection (a row, a column, a wire). TEST: every accent use sits under a selected/hot state class; a legend says "selected".
3. **Names read like the reports.** Table titles use `prettyTable` (report-folder spelling); the physical name sits beside it in mono. TEST: no two different tables share a display name (`tests/explorer-data.test.ts`).
4. **Same number, same words.** A figure that appears on two pages comes from one function and uses one phrasing. TEST: the matrix stats and the search side column both read "102 of the 282 fact tables in the lineage have a grain in Oracle's key list".
5. **Phone is a first-class reading.** At 390px nothing scrolls sideways except an explicit strip; tap targets are 40px. TEST: `npm run shoot` reports no horizontal overflow at 390x844.

## 1. Tokens (from tokens.json)

| Token | Value | Use |
|---|---|---|
| paper | `#F6F5F0` | page background |
| surface2 | `#FBFAF6` | palette, cards, inputs |
| ink | `#1B1A17` | headings, body, strong rules |
| ink2 | `#57534B` | secondary text, labels |
| ink3 | `#6E695F` | counts, hints, captions (5.0:1 on paper) |
| line | `#2A2823` | the rule under a section heading |
| rule | ink at 16% | hairlines |
| edge | ink at 38% | control borders, link underlines |
| tint | ink at 4.5% | hover and selected-row wash |
| accent | `#9E2A1B` | ink red: the selected thing (6.87:1 on paper) |
| accentSoft | accent at 7% | wash behind the selected thing |

- **Faces:** Source Serif 4 (titles, lead, section heads, report names), Source Sans 3 (UI, body, captions), JetBrains Mono (physical table, column and NetSuite field names). Self-hosted via `@fontsource-variable`.
- **Type scale:** body 13px/1.5, lead 18px serif, section 23px serif, title 44px (30px under 760px). Floor 10px (mono badges only).
- **Spacing:** 4px unit, page pad 40px (16px narrow), gutter 28px, max width 1440px.
- **Hit areas:** 32px controls, 40px on touch.
- **Lines:** hairline 1px, wire 1.1px, selected wire 2.1px.
- **Motion:** 160ms hover only; none under reduced motion.

## 2. Provenance marks

Every relationship drawn is stated in Oracle's files (the ontology is built `STATED_ONLY`), so there is one line style.

| Mark | Meaning |
|---|---|
| solid ink line | a stated link (lineage row, key-list entry) |
| accent line with end dots | the selected link |
| faded ink line | a stated link while something else is selected |
| `SECURED` badge | a `_SEC` table; lists may set it beside its namesake, no sentence claims a relation |
| `KEY`, `TO HEADER` badges | key columns from the Entity Key List; the column linking a line table to its header |

Each section that draws lines carries a small legend: "— stated" and, where selection is possible, "— selected".

## 3. Page contract

- Header: brand, then the search button (placeholder and Cmd/Ctrl-K hint on desktop; icon and "Search" on phones). Sticky, hairline below.
- Title block: an eyebrow (role or breadcrumb, italic serif), the title (grain sentence for tables with a key-list entry, readable name otherwise), then a lead sentence built by `explorer/data/copy.ts`.
- Stats row: up to six figures, number in serif, label in UI type; a stat with no data is left out.
- Sections: serif heading over a `line` rule, count at the right in ink3, one plain-sentence description, then the list or ledger.
- Side column on wide screens (`aside`), stacked below on phones.
- Footer: one italic line crediting Oracle's published 25R4 files and the NetSuite data lineage 4.0 workbook.
- Every page sets `document.title`, focuses its `h1` on route change and sets `body[data-ready="1"]` when its data has rendered.

## 4. Components

- **Bus matrix** (`BusMatrix.tsx`): a real `<table>`, rows = subject areas grouped by functional area, columns = shared dimensions ordered by reach, long tail in three bands. Arrow keys move between cells. Under 760px it becomes grouped lists (`PhoneMatrix.tsx`).
- **Column ledger** (`table/Ledger.tsx`): NetSuite field, wire, warehouse column, wire, report column. Rows are buttons; the selection lives in `?col=`. Phones stack each row (field, column, arrow, report name) without wires.
- **Wires** (`Wires.tsx`): SVG in a gutter between two measured columns; pair mode (one S-curve per pair) and comb mode (one source fanning to many rows). Redrawn on resize and font load.
- **Fan trace** (`field/FanWires.tsx`): warehouse columns fan to one bundle per functional area, then split to subject areas.
- **Header partner** (`table/HeaderPartner.tsx`): two boxes, header and this table, joined by the stated key with "1" and "many" ends.
- **Palette** (`Palette.tsx`): dialog + combobox, full screen on phones, same index and ranking as `/search`.

## 5. Accessibility

Skip link; palette is a labelled dialog with focus trap; matrix cells carry labels; selection never relies on colour alone (row wash, bold, dots); contrast pairs in `tokens.json` are checked by `tests/tokens.test.ts`; reduced motion removes transitions.

## 6. Decisions log

- 2026-11-22: Pivot from the illustrated course site to the Paper ledger explorer (bus matrix, compare, area, table, field trace, search). Light only.
- 2026-11-22: Data is stated-only. Inferred layers (name-guessed NetSuite sources, `_SEC` pairing, concepts) are dropped from the ontology.
- 2026-11-22: Copy rule: present what the data shows; never narrate gaps.
- 2026-11-22: `_SEC` tables get their own pages, tagged "secured".
- 2026-11-22: ink3 darkened from `#807B70` to `#6E695F` for 4.5:1 small text.
- 2026-11-22: "Facts with a grain" has one definition (`factsWithGrain`), shown identically on the matrix and search pages.
