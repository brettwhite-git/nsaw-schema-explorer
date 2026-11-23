# NSAW Schema Explorer: behaviour spec

A public reference site for Oracle NetSuite Analytics Warehouse (NSAW) 25R4. It shows how subject areas share dimensions, what grain each fact table has, and how a NetSuite field flows through warehouse columns into report columns. Readers are NetSuite and analytics practitioners. Everything shown is stated in Oracle's published files; the site never narrates what the files leave out.

**Status (2026-11-22):** branch `drawn`, all routes built, route check clean at 1440x900 and 390x844. Not deployed yet; deploys go to a Vercel preview, then production, each on the owner's explicit yes.

**How to keep this current:** update this file in the same commit as any behaviour change. When this file and the code disagree, the code is the truth; fix this file.

## Data

- Inputs (`data-src/`): 25R4 semantic model lineage CSV, Entity Key List CSV, BI view objects CSV, analytics tables HTML index, and two CSVs extracted from the NetSuite data lineage 4.0 workbook.
- `npm run ontology` writes `public/ontology/core.json` (loaded first, about 330 KB) and `columns.json` (column-level lineage, loaded on idle or when a page needs it). `STATED_ONLY = true`: only relationships the files state are emitted.
- `explorer/data` builds indexes from those files in the browser. Counts used on more than one page come from one function (for example `factsWithGrain`: 102 of the 282 fact tables in the lineage have a grain in the key list; `_SEC` tables count as their own tables).

## Routes

### `/` Bus matrix
Rows are the 110 subject areas grouped by 9 functional areas; columns are the 104 dimension tables listed under two or more areas, ordered by reach. The 29 most shared columns are readable; the long tail sits in three bands (24 to 72, 6 to 20, 5 or fewer areas) that open on click. Stats: subject areas, warehouse tables in the lineage, shared dimensions, facts with a grain, NetSuite records. Side panel: hover or pick a row for its facts and their grain; pick two rows to compare; pick a column (`?dim=`) for its reach by functional area, the report folders that read from it, and the facts in the same areas. Phones get grouped lists with Subject areas / Dimensions tabs.

### `/compare/:a/:b`
Two subject areas by slug. A sentence and three stats (only in A, only in B, listed under both), the two "only in" lists with reach, then both matrix rows side by side with differences in the accent, and links back to the matrix and to each area.

### `/area/:slug`
One subject area: lead sentence and stats (fact tables, shared dimensions, report folders, report columns); fact tables with their grain sentence and key columns (a `_SEC` table listed beside its namesake, tagged "secured"); shared dimensions ranked by reach; report folders with column counts; "Compare with..." the closest areas by shared dimensions, plus a picker for any area.

### `/table/:name` (`?col=`)
One warehouse table, `_SEC` tables included as their own pages. Title is the grain sentence when the Entity Key List has an entry, the readable name otherwise. Sections render only with data: key and key-list entries, header partner (line table to header on a stated key), loaded from NetSuite, column ledger (NetSuite field, warehouse column, report columns; picking a row sets `?col=` and shows the selected column card), dimension or fact tables in the same subject areas, report folders that read from it, and subject areas grouped by functional area.

### `/field/:record/:field` (`?at=`, `?sa=`)
Fan-out impact trace of one NetSuite field (record and field as two path segments, no dot). Headline sentence with warehouse columns, report columns and subject areas; the field, its warehouse columns grouped by table role, report names, then subject areas bundled per functional area. Picking a column (`?at=`) or a subject area (`?sa=`) lights its path. "Trace another" offers sample fields; "Copy link" copies the URL.

### `/search?q=`
Ranked search over warehouse tables, columns, report columns, report tables, NetSuite records and fields, and subject areas. Typed filters: `is:`, `type:`, `grain:`, `area:`, `shared:`. Tabs per kind with counts. Side column: share of warehouse columns with a stated NetSuite source, share of report columns that reach a stated field, facts with a grain, most shared dimensions. No match reads "Nothing here matches `q`." with suggested queries. The palette (Cmd/Ctrl-K, or `/` outside a text field; the header button on touch) uses the same index.

### Not found
Any other path: "Nothing here is called `X`." with a search box prefilled from the path.

## Behaviour common to every page
Deep links hard-load (Vercel rewrites everything except `/ontology/` and `/assets/` to `index.html`); old `/atlas/*`, `/course/*`, `/index` and `/legacy.html` redirect. Each page sets its title, focuses its `h1` on route change and sets `body[data-ready="1"]` once rendered. Selections live in the query string so a link reopens the same view.

## Checks
`npx tsc --noEmit`, `npm test` (data counts, copy rule, router, tokens, ontology), `npm run build`, and `npm run shoot` against `vite preview --port 3002` (every route at both sizes, zero console errors, no horizontal overflow).
