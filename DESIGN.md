# DESIGN.md: NetSuite Data Intelligence Schema Explorer, Paper ledger (v2)

Source of truth for how the explorer looks. Code follows this file; change a rule here in the same commit as the code. Last updated 2026-11-23.
Tokens live in `tokens.json` and are generated into `styles/tokens.generated.css` by `npm run tokens`. Never hand-copy a hex value into CSS or components.

The explorer is a reference ledger: ruled paper, ink type, one red pen for the thing you picked. It shows what Oracle's files state, and lays it out so shared dimensions, grain and relationships can be read at a glance. The illustrated "Warehouse, Drawn" system (v1) is retired; `lab/` keeps its sketches as history.

## 0. Taste principles (each with a test)

1. **Present what the data shows.** No sentence describes an absence. TEST: `tests/copy-rule.test.ts` passes; a section with no data is not rendered.
2. **One red pen.** The accent marks only the current selection (a row, a column, a wire). TEST: every accent use sits under a selected/hot state class; a legend says "selected".
3. **Names read like the reports.** Table titles use `prettyTable` (report-folder spelling); the physical name sits beside it in mono. TEST: no two different tables share a display name (`tests/explorer-data.test.ts`).
4. **Same number, same words.** A figure that appears on two pages comes from one function and uses one phrasing. TEST: the matrix stats and the search side column both read "102 fact tables with a grain in Oracle's key list" (a stat shows the positive count; no "of N" total that would imply a gap).
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
- **Spacing:** 4px unit, page pad 40px (16px narrow), gutter 28px, max width 1760px.
- **Hit areas:** 32px controls, 40px on touch.
- **Lines:** hairline 1px, wire 1.1px, selected wire 2.1px.
- **Motion:** 160ms hover only; none under reduced motion.

## 2. Provenance marks

Every relationship drawn is stated in Oracle's files (the ontology is built `STATED_ONLY`), so there is one line style.

| Mark | Meaning |
|---|---|
| solid ink line | a stated link (lineage row, key-list entry, or a relationship in Oracle's 26R4 data model diagrams) |
| accent line with end dots | the selected link |
| faded ink line | a stated link while something else is selected |
| `SECURED` badge | a `_SEC` table; lists may set it beside its namesake, no sentence claims a relation |
| `KEY`, `TO HEADER` badges | key columns from the Entity Key List; the column linking a line table to its header |

Each section that draws lines carries a small legend: "— stated" and, where selection is possible, "— selected". Where two sources meet (the data model star), the legend names each source: "stated in the data model", "stated in the key list". Data model lines carry no arrowheads or cardinality: the diagrams state a relationship, not its direction or join columns.

## 3. Page contract

- Header: brand, then the search button (placeholder and Cmd/Ctrl-K hint on desktop; icon and "Search" on phones). Sticky, hairline below.
- Title block: an eyebrow (role or breadcrumb, italic serif), the title (grain sentence for tables with a key-list entry, readable name otherwise), then a lead sentence built by `explorer/data/copy.ts`.
- Stats row: up to six figures, number in serif, label in UI type; a stat with no data is left out.
- Sections: serif heading over a `line` rule, count at the right in ink3, one plain-sentence description, then the list or ledger.
- Header: brand, search, and "Trace a field" (opens the palette in fields mode; on phones it sits inside the palette).
- Breadcrumb under the header on every page (`Breadcrumb.tsx`): where you are and the way back, nothing ahead, e.g. `Matrix › Sales Order › Sales Order Lines › transactions.tranid`. Earlier crumbs are links; the current one is plain and bold. It is built from the route plus `?area=` and `?from=` only, so hovering or picking things on a page never changes it. On subject-area pages a quiet line on the right reads "Neighbouring subject areas in <functional area>" with ‹ previous / next ›.
- One obvious next step per page, in the page itself: matrix row name → subject area; fact card (flow, grid, "Fact tables") → table; ledger NetSuite field (underlined mono) → field trace.
- One inspector on the right of every page (`Inspector.tsx`), replacing the old hand-built side columns. Phones get it as an inline card under the title.
- Footer: one italic line crediting Oracle's published 25R4 files and the NetSuite data lineage 4.0 workbook.
- Every page sets `document.title`, focuses its `h1` on route change and sets `body[data-ready="1"]` when its data has rendered.

## 4. Components

- **Bus matrix** (`BusMatrix.tsx`): a real `<table>`, rows = subject areas grouped by functional area, columns = shared dimensions ordered by reach (most subject areas first, ties by table name), long tail in three bands. Arrow keys move between cells. Under 760px it becomes grouped lists (`PhoneMatrix.tsx`).
  - Column names: one slant everywhere, 60° from horizontal, leaning up and to the right from their column. Columns are at least lineHeight / sin 60° wide (head 20px, opened bands 15px) so neighbours never overlap; names over 22 characters end in "…". The header height is measured from the longest visible name (120 to 220px) so nothing rises above it.
  - Scrolling: the matrix is its own scroll box (both axes, about one screen tall). The header pins to its top, the subject-area column and corner to its left; the box keeps 84px on the right for the last names. It never runs under the side panel.
  - Hover label: hovering or focusing a column shows one flat label above its reach bar, "Name · N of 110 subject areas"; it never re-renders the table.
- **Data model star** (`table/ModelStar.tsx`): on fact pages with a diagram. The fact card (grain, key tags) in the centre; the header partner above on the key-list line ("1", "many", the key); related facts as cards below; dimensions on two arcs in alphabetical order, each with its reach. Hovering a node lights its line and shows "Name · N of 110 · stated in Oracle's 26R4 data model". Hidden under 760px.
- **Data model list** (`table/ModelList.tsx`): beneath the star, the same tables ranked by reach in "In most subject areas", "In fewer subject areas" and "Fact tables"; hover is shared with the star. On dimension pages it lists the facts Oracle relates to the table, grouped by diagram area, each with its grain sentence.
- **Column ledger** (`table/Ledger.tsx`): NetSuite field, wire, warehouse column, wire, report column. Rows are buttons; the selection lives in `?col=`. Phones stack each row (field, column, arrow, report name) without wires.
- **Wires** (`Wires.tsx`): SVG in a gutter between two measured columns; pair mode (one S-curve per pair) and comb mode (one source fanning to many rows). Redrawn on resize and font load.
- **Fan trace** (`field/FanWires.tsx`): warehouse columns fan to one bundle per functional area, then split to subject areas.
- **Header partner** (`table/HeaderPartner.tsx`): two boxes, header and this table, joined by the stated key with "1" and "many" ends. On fact pages that have a data model star, the star carries the header instead.
- **Palette** (`Palette.tsx`): dialog + combobox, full screen on phones, same index and ranking as `/search`.

- **Inspector** (`Inspector.tsx`, `inspector/builders.tsx`, `inspector/details.tsx`): one sticky 340px panel with the same order on every page: eyebrow, title, mono name, lead, figures (two-column grid, positive counts only), one small visual (mini star, reach bar, fact dots, NetSuite sources), "Go next" (link rows with a sub line and an arrow), detail lists, then the back control. Builders: `inspectArea`, `inspectFact`, `inspectDimension`, `inspectTable`, `inspectPair`, `inspectColumn`, `inspectField`. The fold button tucks it into a 52px rail (remembered per browser). Esc clears the selection when there is one, otherwise folds it. On the matrix, the hovered row shows in it too.
- **Breadcrumb** (`Breadcrumb.tsx`, pure `crumbsFor`): Matrix, then the area (`/area/:slug` or `?area=`), the table (`/table/:name`, or `?from=` on a field page), the field. A table whose readable name reads the same as the area crumb shows its physical name. Without `?area=` the area crumb is left out.
- **"Go next" grammar**: each label names the kind of thing (`Subject area: Cash Refund`, `Fact table: DW_NS_CASH_REFUND_F`, `Dimension: Employee`, `NetSuite field: transactions.tranid`, `Compare with Cash Sale`, `Matrix row: …`). The natural next level down comes first; the inspector drops any action that points at the current page and shows at most four.
- **Trace a field** (`Palette.tsx` mode `fields`): the palette filtered to `is:field`; with an empty query it lists the fields reaching the most subject areas (`topFields`, one per NetSuite record, with the reach). The area page lists "NetSuite fields behind this area" (`areaFields`).
- **Area flow** (`area/AreaFlow.tsx`, A, the default): the area's facts that have a 26R4 data model diagram as cards on the left; every table their diagrams relate them to on the right, in "Shared by two or more facts" and "Related to one fact"; one solid curve per stated relation, no arrows or cardinality. Hover or focus lights a node's lines in the accent and previews it in the inspector; a click opens its table (`?area=` carried). A `?sel=` in a link keeps one node marked. Facts without a diagram are listed under "Also listed in this area". Under 640px wide: plain lists.
- **Area grid** (`area/AreaGrid.tsx`, B, `?view=grid`): the same content as a mini bus matrix with a dot where a fact's diagram draws a table. Names slant 60° as on the home matrix. Columns are 15 to 24px; when they don't fit, names drop to 10.5px and columns to 12px (the matrix's long-tail size), and counts alternate between two lines. The grid scrolls in its own box only when even that is too wide.

## 4a. Area context

A reader's subject area travels in the URL. A link that moves down a level carries it: area to table (`?area=`), table ledger column to field (`?area=`). Links that stay at the same level carry it too (`carryArea`). Each level then knows where the reader came from, and "Back to …" links lead there.

## 5. Accessibility

Skip link; palette is a labelled dialog with focus trap; matrix cells carry labels; selection never relies on colour alone (row wash, bold, dots); contrast pairs in `tokens.json` are checked by `tests/tokens.test.ts`; reduced motion removes transitions.

## 6. Decisions log

- 2026-11-22: Pivot from the illustrated course site to the Paper ledger explorer (bus matrix, compare, area, table, field trace, search). Light only.
- 2026-11-22: Data is stated-only. Inferred layers (name-guessed NetSuite sources, `_SEC` pairing, concepts) are dropped from the ontology.
- 2026-11-22: Copy rule: present what the data shows; never narrate gaps.
- 2026-11-22: `_SEC` tables get their own pages, tagged "secured".
- 2026-11-22: ink3 darkened from `#807B70` to `#6E695F` for 4.5:1 small text.
- 2026-11-22: "Facts with a grain" has one definition (`factsWithGrain`), shown identically on the matrix and search pages.
- 2026-11-23: Renamed to "NetSuite Data Intelligence Schema Explorer"; max width 1440px to 1760px.
- 2026-11-23: Matrix column names slant at 60° up and to the right, with a measured header, pinned sideways scrolling and a hover label. Replaces mixed 45°/68°/vertical labels that rose above the header and left opened columns unnamed.
- 2026-11-23: The numbered level bar is replaced by a plain breadcrumb. The stepper confused readers: it showed steps not yet taken ("pick a fact", "pick a column"), changed when a row was hovered or picked, and hid the way to the field trace. Now each page has one obvious next step in the page itself, a "Trace a field" entry sits in the header, and "Go next" labels name the kind of thing they open.
- 2026-11-23: Navigation in four levels, one direction (matrix, subject area, table, field), picked from `lab/area-proto`. Every page gets a level bar and one shared inspector instead of its own side column. The area page opens with the subject-area flow (bipartite A by default, mini matrix B as a toggle); area context travels in `?area=`.
- 2026-11-23: Oracle's NSAW 26R4 data model diagrams are a stated source (`relatesTo`). The star returns on fact pages as a radial star (A) with a ranked list beneath (B), picked from three lab prototypes (`lab/star-proto`). "Dimension tables in the same subject areas" is renamed "Listed with it in subject areas" and sits lower, so the two sources stay distinct.
