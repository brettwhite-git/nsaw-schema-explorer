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

## Project Overview

NSAW Schema Explorer is a React + TypeScript web application for visualizing data lineage from NetSuite Analytics Warehouse (NSAW). It displays an interactive graph showing how data flows from presentation layer (semantic model) through the physical data warehouse to inferred NetSuite source records.

**Key stats:**
- 56,000+ field mappings loaded from CSV
- 110+ subject areas
- React Flow graph visualization with dagre auto-layout

## Development Commands

```bash
npm run dev      # Start dev server on http://localhost:3000
npm run build    # Production build
npm run preview  # Preview production build
```

**Note:** Source files are at project root (`App.tsx`, `components/`, `data/`, etc.) — there is no `src/` directory.

## Architecture

### Component Hierarchy
```
App.tsx (wraps with DataProvider)
├── LoadingScreen.tsx   # ASCII ∞ infinity loop animation during CSV load
├── TopNav.tsx          # Search bar with grouped results dropdown
├── ViewModeSelector.tsx # View mode buttons (Overview, Detailed, Table)
├── GraphLegend.tsx     # Color legend for graph
├── Sidebar.tsx         # Contains SubjectAreaBrowser
│   └── SubjectAreaBrowser.tsx  # 3-level hierarchy: Functional Area → Subject Area → Table
├── GraphViewer.tsx     # Main view router
│   ├── nodes/
│   │   ├── LineageNode.tsx     # Custom node for detailed flow view
│   │   └── OverviewNodes.tsx   # Custom nodes for overview map
│   └── views/
│       ├── DataStackHero.tsx          # Welcome state: isometric 3D data stack (orchestrator)
│       ├── IsometricStack.tsx         # SVG isometric visualization (3 layers + leader lines)
│       ├── StackInfoPanel.tsx         # Hover overlay: layer specs + technical properties
│       ├── StackIcons.tsx             # SVG icons: DatabaseIcon, WarehouseIcon, AnalyticsIcon
│       ├── OverviewFlowView.tsx       # 3-tier data lineage overview map
│       ├── TableView.tsx              # Sortable spreadsheet view
│       ├── StarSchemaNetwork.tsx      # D3 force radial layout for subject areas (see D3 patterns below)
│       └── SubjectAreaNetworkView.tsx # Re-export of StarSchemaNetwork
└── DetailPanel.tsx     # Collapsible right panel, shows lineage path
```

### Navigation Flow
```
Welcome (Isometric Data Stack hero, no selection) ─────────────────────────┐
  │                                                                         │
  ├─ Select Subject Area ──► Star Schema Network (D3 3-ring radial graph)  │
  │     │                                                                   │
  │     ├─ Click Inner DW Node ──► Detailed Flow (finds matching pres tbl) │
  │     │                                                                   │
  │     └─ Click Outer Pres Node ──► Detailed Flow (direct navigation)     │
  │           │                                                             │
  │           └─ Click Column ──► Detail Panel (full lineage path)         │
  │                                                                         │
  └─ Always accessible via clearing selection ◄────────────────────────────┘
```

### View Modes
- Welcome state - Isometric 3D data stack hero (no selection)
- `overview` - High-level 3-tier data architecture map (NS Source → DW → Semantic)
- `detailedFlow` - Field-level lineage graph (dagre layout, 3 columns)
- `table` - Sortable spreadsheet view
- Star Schema Network - Auto-renders when subject area selected (D3 force layout)

### Configuration (`config/`)
```
config/
└── functionalAreas.ts  # Maps 110 subject areas → 10 functional area groups
                        # Pattern-based matching (Order to Cash, Procure to Pay, etc.)
```

### Data Layer (`data/`)
```
data/
├── DataContext.tsx    # React Context: selection state, search, data index
├── dataLoader.ts      # CSV parsing with PapaParse (worker mode), builds DataIndex
└── searchIndex.ts     # FlexSearch integration for fast fuzzy search
```

**DataContext provides:**
- `dataIndex` - Indexed data with Maps for O(1) lookups
- `selection` - Current selection state (subjectArea, table, column)
- `selectedRecords` - Records for currently selected presentation table
- `search()` / `searchResults` - FlexSearch-powered search
- Navigation helpers: `selectSubjectArea()`, `selectPresentationTable()`, `selectFromSearchResult()`
  - `selectFromSearchResult()` must set full context (subjectArea + presentationTable) for graph to render. For `physicalTable` results, look up first record via `dataIndex.byPhysicalTable` — setting only physicalTable produces a blank view.
  - The `record` property on `presentationColumn` and `physicalColumn` search results contains the full `EnrichedLineageRecord` including `inferredSource`
- `viewMode` / `setViewMode` - Current view mode (overview, detailedFlow, table)
- `functionalAreaGroups` - Subject areas grouped by business domain
- `overviewData` - Pre-computed aggregations for Overview map (56k → ~130 nodes)

### Utilities (`utils/`)
```
utils/
├── graphLayout.ts     # Transforms records to React Flow nodes/edges using dagre
└── overviewLayout.ts  # Aggregates records for Overview map (computeOverviewData, transformOverviewToGraph)
```

### Custom Nodes (`components/nodes/`)
```
components/nodes/
├── LineageNode.tsx    # Node component for detailed flow view
│                      # - netsuiteSource (blue) - Inferred NS record type
│                      # - physicalTable (purple) - DW table with fact/dim badge
│                      # - physicalColumn (purple-dark) - DW column
│                      # - presentationColumn (green) - Semantic layer field
│                      # - derivedColumn (orange) - NSAW-derived field
└── OverviewNodes.tsx  # Node component for Overview map
                       # - sourceRecord (emerald) - NetSuite record types
                       # - dwGroup (purple/blue) - DW table groupings
                       # - functionalArea (amber) - Business domains
                       # - subjectArea (blue) - Expanded drill-down
```

### Data Flow
1. `App.tsx` wraps everything in `DataProvider`
2. On mount, `dataLoader.ts` fetches and parses CSV, builds `DataIndex`
3. `searchIndex.ts` initializes FlexSearch index from records
4. User browses sidebar or searches -> updates `selection` in context
5. `GraphViewer` gets `selectedRecords` from context, transforms to nodes/edges
6. Clicking a node updates `selection`, which `DetailPanel` displays

### Graph Layout (graphLayout.ts)
Creates a left-to-right (LR) layout using dagre:
- **Column 1 (Left)**: NetSuite source nodes (blue) — grouped by inferred record type
- **Column 2 (Center)**: Physical DW tables (purple) — with fact/dimension/hierarchy `tableType` badge
- **Column 3 (Right)**: Semantic fields (green) + NSAW-derived fields (orange)
  - `presentationColumn` — fields from non-NSAW tables (green)
  - `derivedColumn` — fields where ALL source DW tables are NSAW-generated (orange)

**Node type system:** `LineageNodeType = 'netsuiteSource' | 'physicalTable' | 'physicalColumn' | 'presentationColumn' | 'derivedColumn'`

**Table type classification:** `parsePhysicalTableType()` → `tableType` field on physical table nodes. Used by `LineageNode.tsx` to render FACT / DIMENSION / HIERARCHY badges.

### React Flow Patterns

**Dynamic fitView (viewport auto-fit when data changes):**

The `fitView` prop on `<ReactFlow>` only fires on initial mount, NOT when nodes change. For dynamic data:

```typescript
// Pattern: key + onInit for auto-fit on data changes
<ReactFlowProvider key={uniqueDataKey}>  // Forces remount when key changes
  <InnerComponent />
</ReactFlowProvider>

// Inside InnerComponent:
const { fitView } = useReactFlow();

const handleInit = useCallback(() => {
  setTimeout(() => fitView(options), 50);  // Small delay for dagre positions
}, [fitView, nodeCount]);

<ReactFlow onInit={handleInit} ... />
```

**Why this pattern:**
- `useReactFlow()` requires `ReactFlowProvider` wrapper
- `fitView` function is unstable (changes every render) - don't use in useEffect dependencies
- `key` prop forces complete remount, ensuring `onInit` fires with fresh viewport
- 50ms delay allows dagre layout positions to be applied before fitView calculates bounds

**Intelligent zoom bounds based on node count:**
```typescript
function getFitViewOptions(nodeCount: number) {
  if (nodeCount < 20)  return { padding: 0.3, minZoom: 0.5, maxZoom: 1.5, duration: 200 };
  if (nodeCount < 100) return { padding: 0.2, minZoom: 0.3, maxZoom: 1.2, duration: 200 };
  return { padding: 0.15, minZoom: 0.2, maxZoom: 1.0, duration: 200 };  // Large graphs
}
```

### D3 Force Graph Patterns (StarSchemaNetwork.tsx)

**Container ref must always mount:** The component uses a ResizeObserver to measure its container. The container div with `ref={containerRef}` must ALWAYS render (even during loading/empty states). Loading and empty content goes INSIDE the container as children via ternary. Never use separate `return` statements with different root divs — the ref won't be attached during mount-time effects.

```typescript
// CORRECT: Single container always renders with ref
return (
  <div ref={containerRef} className="flex-1 w-full h-full ...">
    {showEmpty ? (<EmptyState />) : !isReady ? (<Loading />) : (<Graph />)}
  </div>
);

// WRONG: Separate returns — ref only attaches after isReady
if (!isReady) return <div>Loading...</div>;  // No ref!
return <div ref={containerRef}>...</div>;
```

**Initial dimensions must be `{0, 0}`:** Start with zero dimensions and guard the `useMemo` to skip graph building until ResizeObserver provides real measurements. Never hardcode initial dimensions (e.g., 1000x700) — they'll be wrong for the actual container size.

**Force simulation architecture (3-ring layout):**
- Primary fact node pinned at center with `fx`/`fy` (immovable hub)
- No `forceCenter` — it fights `forceRadial`. The pinned hub + radial force handles centering.
- `forceRadial` with viewport-responsive ring distances (computed from container dimensions):
  - **Inner ring**: Secondary fact tables (43% of max radius)
  - **Middle ring**: Dimension tables (max radius)
  - **Outer ring**: Presentation tables + NSAW-derived tables (140% of middle ring, capped at 40 nodes)
- Custom `forceOrbital` force: dimension nodes orbit at full speed, outer nodes at 30% speed
- Auto-fit via `computeFitTransform()` after settling — computes bounding box and scales/translates to center

**Outer ring nodes (presentation tables):**
- Built from `dataIndex.bySubjectArea` records, grouped by `presentationTable`
- `role: 'presentation'` (green filled) — semantic layer tables
- `role: 'derived'` (orange filled) — tables where ALL physical sources are NSAW-generated
- Classified via `isNsawGeneratedTable()` check on every connected physical table
- Clicking an outer node navigates to `detailedFlow` for that presentation table
- Capped at `MAX_OUTER_NODES: 40` for performance

**Primary fact detection:** Uses token-overlap matching (≥50% of subject area name tokens must appear in table name). Falls back to promoting the most-connected dimension as a virtual hub when no fact tables exist.

**D3+CSS double-opacity trap:** Always use solid hex colors for `--theme-d3-*` variables, never `rgba()`. SVG elements apply their own `opacity` attribute; if the CSS color also has alpha, they multiply (e.g., 0.3 × 0.3 = 0.09 effective visibility). Control transparency exclusively via SVG `opacity`.

**Theme transition timing trap:** HTML overlays (legends, tooltips) in `StarSchemaNetwork.tsx` must use CSS variable strings (`'var(--theme-xxx)'`) directly in inline styles — NOT the computed `colors` object from `getComputedStyle()`. The `colors` useMemo may fire before CSS variables flush on theme toggle, capturing stale values. SVG node fills can use the `colors` object because the D3 simulation re-renders continuously. Reference: the detailed flow legend in `GraphViewer.tsx` uses CSS vars directly and works correctly.

**Text on filled nodes:** Use `--theme-d3-text-on-fill` (always `#ffffff`) for text rendered inside colored/filled circles (fact nodes). Do NOT use `--theme-d3-text-bright` which is dark in light mode.

**DW node hover tooltips:** Show inferred NS record type via `inferRecordType()` from `types.ts` for fact/dimension nodes (not presentation or derived nodes).

### Isometric Data Stack (DataStackHero / IsometricStack)

**Welcome state visualization** showing 3 architecture layers as an exploded isometric view:
- NetSuite ERP (bottom) → Autonomous AI Datawarehouse (middle) → Semantic Layer (top)
- Hover highlights layer with blue glow and shows System Specification panel

**Isometric diamond formula** (SVG polygons, no CSS 3D transforms):
```
top:    (x, y)          right:  (x + width, y + height * 0.5)
bottom: (x, y + height) left:   (x - width, y + height * 0.5)
```
Plus two side-face polygons offset 10px down for 3D depth effect.

**Glow effect:** Extra blurred polygon overlay (`filter="blur(10px)"`, `fillOpacity="0.05"`) on active slab.

**Icons inside SVG:** Uses `<foreignObject>` to embed React components (StackIcons) within the SVG coordinate space.

**Dataset metrics** (Subject Areas, Tables, Fields) live in the site footer bar (`App.tsx`), not in the visualization.

**CSS `background` shorthand trap:** When a component uses the `blueprint-grid` CSS class (which sets `background-image`), the inline style must use `backgroundColor` NOT `background`. The shorthand resets all sub-properties including `background-image`, hiding the grid dots.

### DetailPanel Lineage Pipeline
The 3-layer lineage path (NS → DW → Semantic) uses a connected pipeline pattern:
- Outer wrapper: `rounded-lg overflow-hidden` with `1px solid var(--theme-border-default)`
- Each section: `3px solid` left accent border in layer color (blue/purple/green rail)
- Between sections: `2px` gradient separator using `linear-gradient(to right, colorA, colorB)`
- No arrow icons — the colored left rail implies top-to-bottom directionality

### LoadingScreen Infinity Animation (LoadingScreen.tsx)
- Hand-crafted Unicode box-drawing ∞ symbol (╭╮╰╯╱╲╳─│), 5 rows × 25 chars
- `InfinityLoader` extracted as separate component to avoid conditional hooks (error branch returns early in parent)
- 44-position `TRACE_PATH` traces figure-8 outline; animated tracer with 10-frame fade trail
- `<pre>` block with per-character `<span>` coloring using `var(--theme-accent-cyan-text)` and `var(--theme-text-faint)`
- JetBrains Mono font at 16px, `FRAME_MS` and `STEPS_PER_TICK` constants control speed

### PapaParse Main Thread Blocking Trap
`Papa.parse()` runs synchronously by default, blocking the main thread for ~300-500ms on 56k rows. This prevents any `setInterval`/`requestAnimationFrame` callbacks from firing (JavaScript is single-threaded). The loading animation appears frozen because no frames can paint during synchronous parsing. **Fix:** `worker: true` moves parsing to a Web Worker. Trade-off: `transformHeader` and other function-based config options can't be used with workers (functions aren't serializable) — trim headers manually in post-processing instead.

### JSX Ternary Fragment Trap
When adding multiple sibling JSX elements inside a ternary branch (`? ... : ...`), wrap in `<>...</>`. Each ternary branch must return a single JSX expression. This commonly breaks when inserting a second element beneath an existing one inside a conditional.

## Type System (types.ts)

### Core Types
- `LineageRecord` - Raw CSV row mapping
- `EnrichedLineageRecord` - Extends LineageRecord with `inferredSource`
- `InferredSource` - Algorithmically derived NetSuite record/field info
- `DataIndex` - Indexed data with Maps for fast lookup

### Selection & Search
- `SelectionState` - Current UI selection (subjectArea, table, columns)
- `SearchResult` - Search result with type and context
- `SearchResultType` - 'subjectArea' | 'presentationTable' | 'presentationColumn' | 'physicalTable' | 'physicalColumn'

### Graph Types
- `GraphNodeType` - Node classification
- `GraphNodeData` - Data attached to React Flow nodes
- `LineageNodeData` - Extended data for LineageNode component

### Overview Types
- `OverviewNodeType` - 'sourceRecord' | 'dwGroup' | 'functionalArea' | 'subjectArea'
- `SourceRecordAggregation` - Aggregated NetSuite source data
- `DWGroupAggregation` - Aggregated DW table group data
- `OverviewData` - Complete pre-computed overview (sourceRecords, dwGroups, functionalAreas, edges, stats)

### Utility Functions
- `isNsawGeneratedTable()` - Detects NSAW-only tables (DAY_D, FISCALCALPERIOD, etc.)
- `inferRecordType()` - Extracts NetSuite record from DW table name using 3-tier logic:
  1. Mixed-case names preserved as-is (`DW_NS_accountingBook_D` → `accountingBook`)
  2. ALL_CAPS without underscores checked against `RECORD_TYPE_OVERRIDES` map (`ACCOUNTTYPE` → `accountType`)
  3. ALL_CAPS with underscores: standard snake_to_camelCase (`SALES_ORDER` → `salesOrder`)
  - Also strips `_LINES` and `_SNAPSHOT` intermediate suffixes before type suffix
- `inferFieldName()` - Converts DW column to camelCase field name
- `parsePhysicalTableType()` - Classifies DW tables by suffix (_F=fact, _D=dimension, _DH=hierarchy, etc.)

### Inference Accuracy (back-tested against Entity Key CSV + NS Records Catalog)
- **30.6% exact match**, 23% case-only mismatch, 46.4% structural divergence (readable names vs NS abbreviated domain codes)
- **Zero true misidentifications** — the 46.4% "different" cases produce MORE READABLE names than NS internal IDs (e.g., `salesOrder` vs `SalesOrdTransactions`)
- NetSuite record IDs have inconsistent casing (`Customer` PascalCase, `employee` lowercase, `accountingBook` camelCase)
- All transaction DW tables (fact `_F`) map to the single NS `transaction` record — our inference preserves the specific transaction type which is better for lineage
- Override map in `types.ts` covers 11 compound ALL_CAPS words where word boundaries are lost

## Physical Table Naming Convention
DW tables follow suffix patterns that indicate their role:
- `_F` - Fact tables (transactional data, e.g., DW_NS_WORK_ORDER_F)
- `_D` - Dimension tables (reference data, e.g., DW_NS_CUSTOMER_D)
- `_DH` - Hierarchy tables (drill-down support)
- `_G` - Global/reference tables
- `_EF` - Enhanced/flattened fact tables
- `_CF` - Calculated fields
- `_SEC` - Security tables

## Color System

### Overview Map (3-tier)
- **Emerald** - NetSuite source records (inferred)
- **Purple** - DW Fact table groups
- **Blue** - DW Dimension table groups
- **Amber** - Functional Areas / NSAW-generated

### Star Schema Network
- **Purple (filled)** - Fact tables (center hub + inner ring)
- **Purple (hollow ring)** - Dimension tables (middle ring)
- **Green (filled)** - Presentation/semantic tables (outer ring)
- **Orange (filled)** - NSAW-derived tables (outer ring)

### Detailed Flow View
- **Blue** - NetSuite source fields (left column)
- **Purple** - Physical DW tables with fact/dim badge (center column)
- **Green** - Semantic layer fields (right column)
- **Orange** - NSAW-derived fields & calculations (right column)

### Detail Panel
- **Blue** - NetSuite source layer
- **Purple** - DW layer (with table type badge: Fact/Dimension/Hierarchy)
- **Green** - Semantic layer
- **Orange** - NSAW-derived field indicator

### CSS Layer Variables
Four layer color sets in `styles/theme.css` (each with `-light`, `-dark`, `-bg`, `-border`, `-glow`, `-ring`, `-text` variants):
- `--theme-layer-netsuite-*` — Blue
- `--theme-layer-dw-*` — Purple
- `--theme-layer-semantic-*` — Green
- `--theme-layer-derived-*` — Orange (NSAW-derived/calculated)

### CSS Accent Variables (UI Chrome)
Primary UI interaction accent is **blue** (`--theme-accent-cyan-*` variables, now set to blue-500/blue-600 values aligned with NetSuite brand). This includes: selection highlights, active buttons, breadcrumb links, footer stats, loading screen, search result icons, and the isometric welcome design.

**Unified color approach:** `--theme-accent-cyan-*` and `--theme-layer-netsuite-*` now share the same blue palette for visual consistency. The variable names remain separate so they CAN diverge in the future if needed — `accent-cyan` is consumed in UI chrome contexts, `layer-netsuite` in data layer visualization contexts.

Accent variants: `-light`, `-dark`, `-bg`, `-faint`, `-text`, `-border`, `-border-half`, `-glow`, `-ring`

## Dependencies

### Runtime
- `react` / `react-dom` - React 19
- `reactflow` - Graph visualization library (detailed flow view)
- `dagre` - Automatic graph layout algorithm
- `d3-force` / `d3-drag` / `d3-selection` - D3 force simulation (star schema network)
- `flexsearch` - Fast full-text search
- `papaparse` - CSV parsing
- `lucide-react` - Icons

### Dev
- `typescript` - TypeScript 5.8
- `vite` - Build tool
- `@vitejs/plugin-react` - Vite React plugin

## Configuration

### Vite (vite.config.ts)
- Server binds to `0.0.0.0:3000`
- Path alias: `@/*` maps to project root

## Styling
- Tailwind CSS loaded via CDN in index.html
- Full dark/light theme system via `data-theme` attribute on `<html>` (see `styles/theme.css`, `contexts/ThemeContext.tsx`)
- Dark theme: slate-950 base. Light theme: white base with darker grid dots (`#94a3b8`)
- Primary UI accent: **Blue** (`--theme-accent-cyan-*` variables, aligned with NetSuite brand) — used for all interactive highlights
- Custom CSS for blueprint grid background (in index.html, uses `--theme-grid-dot`)
- Icons from lucide-react
- Theme flash prevention: `index.html` sets `data-theme` from localStorage before first paint

### Typography Patterns
Fonts: Inter (UI, via Google Fonts) + JetBrains Mono (technical data). Both loaded in `index.html`.

**Unified weight range (400–600):**
- `font-normal` (400) — body text, descriptions
- `font-medium` (500) — hero/isometric titles, emphasized labels
- `font-semibold` (600) — app titles, badges, section headers, interactive elements

**Standardized `text-[10px] uppercase` headers:**
- Layer headers (DetailPanel, LineageNode): `text-[10px] uppercase tracking-wider font-semibold`
- Legend/section headers: `text-[10px] uppercase tracking-wider font-medium`
- Badges: `text-[10px] px-1.5 py-0.5 rounded font-semibold uppercase tracking-wider`

**Isometric-only sizes:** `text-[8px]` and `text-[9px]` are reserved for SVG `<foreignObject>` labels inside the isometric welcome visualization. Do not use in standard UI components.

## Data Files
CSV file in `/public/` (loaded at runtime):
- `25R4_NS_Semantic_Model_Lineage - 25R4_NS_Semantic_Model_Lineage.csv` - Main lineage data (~8MB, 56k+ rows)

Supporting/validation files (in `/public/`, not loaded by app at runtime):
- `25R4_NS_BI_View_Objects_in_Data_Enrichment - Sheet1.csv` - 378 entity names (single-column reference list)
- `25R4_NS_Data_Augmentation_Entity_Key_List - Sheet1.csv` - 660 entity-to-table key mappings; columns: `Entity Name`, `Domain Code`, `Entity Keys`, `Table Name`, `Table Column`. Used as ground truth for back-testing `inferRecordType()` (330 unique DW tables). Table names use mixed case (`DW_NS_account_D` vs `DW_NS_ACCOUNTTYPE_D`).
- `25R4_Fusion_NS_Analytics_Tables.html` - Reference doc showing physical table organization by functional area

### Data Content Limitations
- CSV data contains field-level lineage mappings only (source → target paths)
- No calculation formulas, measure definitions, or expression logic exists in any data file
- 17 `_CF` tables appear in lineage but their calculation logic is not in the dataset — these are NSAW warehouse constructs not visible in the NS Records Catalog
- "Derived" and "Calculated" column names are identifiers, not formulas
- `inferFieldName()` has NOT been back-tested against NS Schema Viewer field IDs (only `inferRecordType()` has been validated)
- `inferFieldName()` has a known compound-word limitation: `ACCOUNTNUMBER` → `accountnumber` (loses word boundary). No override map exists for fields — would need ground truth data (NS Schema Viewer field IDs) to build one.
