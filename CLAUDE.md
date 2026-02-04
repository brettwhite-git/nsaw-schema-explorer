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

## Architecture

### Component Hierarchy
```
App.tsx (wraps with DataProvider)
├── LoadingScreen.tsx   # Shown during CSV load
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
  ├─ Select Subject Area ──► Star Schema Network (D3 radial graph)         │
  │     │                                                                   │
  │     └─ Click Table Node ──► Detailed Flow View (field-level lineage)   │
  │           │                                                             │
  │           └─ Click Column ──► Detail Panel (NS source info)            │
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
├── dataLoader.ts      # CSV parsing with PapaParse, builds DataIndex
└── searchIndex.ts     # FlexSearch integration for fast fuzzy search
```

**DataContext provides:**
- `dataIndex` - Indexed data with Maps for O(1) lookups
- `selection` - Current selection state (subjectArea, table, column)
- `selectedRecords` - Records for currently selected presentation table
- `search()` / `searchResults` - FlexSearch-powered search
- Navigation helpers: `selectSubjectArea()`, `selectPresentationTable()`, `selectFromSearchResult()`
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
│                      # - presentationColumn (blue)
│                      # - physicalTable (purple)
│                      # - physicalColumn (orange)
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
- **Column 1 (Left)**: Presentation columns (blue)
- **Column 2 (Right)**: Physical tables (purple)
- Optional Column 3: Physical columns (orange) - for detailed view

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

**Force simulation architecture:**
- Primary fact node pinned at center with `fx`/`fy` (immovable hub)
- No `forceCenter` — it fights `forceRadial`. The pinned hub + radial force handles centering.
- `forceRadial` with viewport-responsive ring distances (computed from container dimensions)
- Custom `forceOrbital` force for smooth infinite animation of dimension nodes
- Auto-fit via `computeFitTransform()` after settling — computes bounding box and scales/translates to center

**Primary fact detection:** Uses token-overlap matching (≥50% of subject area name tokens must appear in table name). Falls back to promoting the most-connected dimension as a virtual hub when no fact tables exist.

### Isometric Data Stack (DataStackHero / IsometricStack)

**Welcome state visualization** showing 3 architecture layers as an exploded isometric view:
- NetSuite ERP (bottom) → Autonomous AI Datawarehouse (middle) → Semantic Layer (top)
- Hover highlights layer with cyan glow and shows System Specification panel

**Isometric diamond formula** (SVG polygons, no CSS 3D transforms):
```
top:    (x, y)          right:  (x + width, y + height * 0.5)
bottom: (x, y + height) left:   (x - width, y + height * 0.5)
```
Plus two side-face polygons offset 10px down for 3D depth effect.

**Glow effect:** Extra blurred polygon overlay (`filter="blur(10px)"`, `fillOpacity="0.05"`) on active slab.

**Icons inside SVG:** Uses `<foreignObject>` to embed React components (StackIcons) within the SVG coordinate space.

**Dataset metrics** (Subject Areas, Tables, Fields) live in the site footer bar (`App.tsx`), not in the visualization.

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
- `inferRecordType()` - Extracts NetSuite record from DW table name (DW_NS_CUSTOMER_D -> customer)
- `inferFieldName()` - Converts DW column to camelCase field name
- `parsePhysicalTableType()` - Classifies DW tables by suffix (_F=fact, _D=dimension, _DH=hierarchy, etc.)

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

### Detailed Flow View
- **Blue** - Presentation columns (semantic layer)
- **Purple** - Physical DW tables
- **Orange** - Physical DW columns

### Detail Panel
- **Blue** - Presentation layer
- **Purple** - DW layer
- **Green** - Inferred NetSuite source

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
- Dark theme with slate-950 base
- Custom CSS for blueprint grid background (in index.html)
- Icons from lucide-react

## Data Files
CSV file in `/public/` (loaded at runtime):
- `25R4_NS_Semantic_Model_Lineage - 25R4_NS_Semantic_Model_Lineage.csv` - Main lineage data (~8MB, 56k+ rows)

Supporting files (not currently used in app):
- `25R4_NS_BI_View_Objects_in_Data_Enrichment - Sheet1.csv`
- `25R4_NS_Data_Augmentation_Entity_Key_List - Sheet1.csv`
- `25R4_Fusion_NS_Analytics_Tables.html` - Reference doc showing physical table organization by functional area
