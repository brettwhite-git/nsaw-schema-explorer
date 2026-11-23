# NetSuite Data Intelligence Schema Explorer: behaviour spec

A public reference site for Oracle NetSuite Analytics Warehouse (NSAW) 25R4. It shows how subject areas share dimensions, what grain each fact table has, which tables each fact relates to in Oracle's data model, and how a NetSuite field flows through warehouse columns into report columns. Readers are NetSuite and analytics practitioners. Everything shown is stated in Oracle's published files; the site never narrates what the files leave out.

**Status (2026-11-23):** live at https://nsaw-schema-explorer.vercel.app (version 0.2.0, `main` = `drawn`). Deploys are a push to `main`, made only on the owner's explicit yes. The release gate's secret scan flags the regenerated single-line `core.json`; reviewed pushes use `--no-verify`.

**How to keep this current:** update this file in the same commit as any behaviour change. When this file and the code disagree, the code is the truth; fix this file.

## Data

- Inputs (`data-src/`): 25R4 semantic model lineage CSV, Entity Key List CSV, BI view objects CSV, analytics tables HTML index, two CSVs extracted from the NetSuite data lineage 4.0 workbook, and `nsaw_data_model_edges.csv` extracted by `scripts/extract-diagrams.mjs` from Oracle's NSAW 26R4 data model diagrams (one star per fact; 2,547 rows, 2,496 matched to tables in the 25R4 data as the explicit `relatesTo` edge group; the unmatched names are recorded in `core.meta.dataModels`). The diagrams state that a fact relates to a table; they give no join columns, direction or cardinality.
- `npm run ontology` writes `public/ontology/core.json` (loaded first, about 330 KB) and `columns.json` (column-level lineage, loaded on idle or when a page needs it). `STATED_ONLY = true`: only relationships the files state are emitted.
- `explorer/data` builds indexes from those files in the browser. Counts used on more than one page come from one function (for example `factsWithGrain`: 102 fact tables in the lineage have a grain in the key list, shown as that positive count; `_SEC` tables count as their own tables). `explorer/data/relations.ts` serves the data model: `modelRelations`, `modelFactsOf`, `modelArea`.

## Routes

### Behaviour on every page: level bar and inspector
A level bar under the header shows four levels: 1 Matrix, 2 Subject area, 3 Table, 4 Field. Levels above the current one link back up; levels below say what to pick next. It reads the route and the query: the area comes from `/area/:slug`, `?area=`, the field page's `?sa=` or the matrix's `?a=`; the table comes from `/table/:name`, the area page's `?sel=` or the field page's `?at=`; the field comes from `/field/…` or the table page's `?col=` (its first stated NetSuite source). With no area, table and field pages offer a "pick a subject area" menu listing the areas that list the table or read the field. When an area is known, ‹ previous / next › link to the neighbouring subject areas in its functional area. One inspector sits on the right of every page (an inline card under the title on phones): what is selected, its key figures, one small visual, "Go next" links and detail lists. Esc clears the selection, or folds the inspector when nothing is selected. Links that move down a level carry `?area=<slug>`.

### `/` Bus matrix
Rows are the 110 subject areas grouped by 9 functional areas; columns are the 104 dimension tables listed under two or more areas, ordered by reach. The 29 most shared columns are named; the long tail sits in three bands (24 to 72, 6 to 20, 5 or fewer areas) that open on click (`?open=`), and opened columns are named too. Names slant at 60°; when the columns don't fit, the matrix scrolls sideways with the subject-area column and header pinned. Hovering or focusing a column shows its full name and reach. Stats: subject areas, warehouse tables in the lineage, shared dimensions, facts with a grain, NetSuite records. Inspector: a guide by default; hover or pick a row (`?a=`) for the area's figures and its facts with their grain; pick two rows (`?a=&b=`) for only-in-A, only-in-B and listed-under-both with a "Compare the two" link; pick a column (`?dim=`) for its reach by functional area, the report folders that read from it, and the facts in the same areas. Phones get grouped lists with Subject areas / Dimensions tabs.

### `/compare/:a/:b`
Two subject areas by slug. A sentence and three stats (only in A, only in B, listed under both), the two "only in" lists with reach, then both matrix rows side by side with differences in the accent, and links back to the matrix and to each area.

### `/area/:slug` (`?view=grid`, `?sel=fact:NAME|dim:NAME`)
One subject area. The lead says how many fact tables it lists, how many Oracle's 26R4 data model draws, the tables those diagrams relate them to, and how many are shared by two or more of them. Next comes the flow: the drawn facts on the left, their related tables on the right in "Shared by two or more facts" and "Related to one fact", one solid line per stated relation. "Grid" (`?view=grid`) shows the same as a mini bus matrix. Hovering lights a node's lines. Picking a fact or a table (`?sel=`) shows it in the inspector: a fact's grain, its diagram's tables, how many it shares in this area, a mini star and links to its table star, a column and a field; a table's "k of n facts", its reach and links to the bus matrix and its page. With nothing picked, the inspector shows the area. "Also listed in this area" names the facts without a diagram (mostly `_SEC`). Below: the fact tables with their grain sentence and key columns (a `_SEC` table beside its namesake, tagged "secured"), shared dimensions ranked by reach, report folders with column counts, and "Compare with..." (the closest areas by shared dimensions, plus a picker). Areas with no drawn fact skip the flow.

### `/table/:name` (`?col=`, `?area=`)
One warehouse table, `_SEC` tables included as their own pages. Title is the grain sentence when the Entity Key List has an entry, the readable name otherwise. Sections render only with data: key and key-list entries; "In Oracle's data model" for facts with a diagram (a radial star with the header partner on its key-list line, related facts and dimensions, then the same tables ranked by reach; hover is shared between the two; phones show the list only); header partner (line table to header on a stated key) where no star draws it; loaded from NetSuite; column ledger (NetSuite field, warehouse column, report columns; picking a row sets `?col=` and shows that column in the inspector: its NetSuite sources, report names and the subject areas that read it; with no row picked the inspector shows the table); for dimensions, "Facts that relate to it in Oracle's data model" grouped by diagram area; "Listed with it in subject areas" (bus-matrix co-listing); report folders that read from it; and subject areas grouped by functional area.

### `/field/:record/:field` (`?at=`, `?sa=`)
Fan-out impact trace of one NetSuite field (record and field as two path segments, no dot). Headline sentence with warehouse columns, report columns and subject areas; the field, its warehouse columns grouped by table role, report names, then subject areas bundled per functional area. Picking a column (`?at=`) or a subject area (`?sa=`) lights its path. The inspector shows the field (figures, report column names), the picked column (its sources, report names, subject areas) or the picked area (its report columns reading the field). "Trace another" offers sample fields; "Copy link" copies the URL. `?area=` is kept on its links.

### `/search?q=`
Ranked search over warehouse tables, columns, report columns, report tables, NetSuite records and fields, and subject areas. Typed filters: `is:`, `type:`, `grain:`, `area:`, `shared:`. Tabs per kind with counts. Side column: share of warehouse columns with a stated NetSuite source, share of report columns that reach a stated field, facts with a grain, most shared dimensions. No match reads "Nothing here matches `q`." with suggested queries. The palette (Cmd/Ctrl-K, or `/` outside a text field; the header button on touch) uses the same index.

### Not found
Any other path: "Nothing here is called `X`." with a search box prefilled from the path.

## Behaviour common to every page
Deep links hard-load (Vercel rewrites everything except `/ontology/` and `/assets/` to `index.html`); old `/atlas/*`, `/course/*`, `/index` and `/legacy.html` redirect. Each page sets its title, focuses its `h1` on route change and sets `body[data-ready="1"]` once rendered. Selections live in the query string so a link reopens the same view.

## Checks
`npx tsc --noEmit`, `npm test` (data counts, copy rule, router, tokens, ontology), `npm run build`, and `npm run shoot` against `vite preview --port 3002` (every route at both sizes, zero console errors, no horizontal overflow).
