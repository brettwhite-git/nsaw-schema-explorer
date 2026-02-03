# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

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
│       ├── OverviewFlowView.tsx       # 3-tier data lineage overview map (NEW)
│       ├── TableView.tsx              # Sortable spreadsheet view
│       ├── StarSchemaNetwork.tsx      # D3 force radial layout for subject areas
│       └── SubjectAreaNetworkView.tsx # Re-export of StarSchemaNetwork
└── DetailPanel.tsx     # Collapsible right panel, shows lineage path
```

### Navigation Flow
```
Overview (3-tier map) ─────────────────────────────────────────────────────┐
  │                                                                         │
  ├─ Click Functional Area ──► Star Schema Network (D3 radial graph)       │
  │     │                                                                   │
  │     └─ Click Table Node ──► Detailed Flow View (field-level lineage)   │
  │           │                                                             │
  │           └─ Click Column ──► Detail Panel (NS source info)            │
  │                                                                         │
  └─ Always accessible via "Overview" button (never disabled) ◄────────────┘
```

### View Modes
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
- `reactflow` - Graph visualization library
- `dagre` - Automatic graph layout algorithm
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
