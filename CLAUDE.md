# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Nexus Ontology Explorer is a React + TypeScript web application for visualizing data lineage and ontology relationships in data pipelines. It displays an interactive graph showing how data flows from source systems through pipelines to fact/dimension tables.

## Development Commands

```bash
npm run dev      # Start dev server on http://localhost:3000
npm run build    # Production build
npm run preview  # Preview production build
```

## Architecture

### Component Hierarchy
```
App.tsx (root state: selectedNode)
├── TopNav.tsx      # Header with search and filter buttons
├── Sidebar.tsx     # Left navigation menu
├── GraphViewer.tsx # SVG graph visualization (main feature)
└── DetailPanel.tsx # Right panel showing selected node details
```

### Data Flow
- `App.tsx` holds the `selectedNode` state and passes it down
- `GraphViewer` calls `onSelectNode` when a node is clicked
- `DetailPanel` displays metadata for the selected node
- Initial data comes from `constants.tsx` (INITIAL_DATA)

### Graph Layout Algorithm (GraphViewer.tsx)
The graph uses a 4-column symmetrical layout based on NodeType:
- **Column 1 (Left)**: SOURCE nodes
- **Column 2**: PIPELINE nodes
- **Column 3**: FACT nodes
- **Column 4 (Right)**: DIMENSION and TABLE nodes

Connections are rendered as SVG Bezier curves.

### Type System (types.ts)
- `NodeType`: enum with SOURCE, PIPELINE, TABLE, FACT, DIMENSION
- `SchemaNode`: id, label, type, description, columns, sources
- `GraphLink`: source, target
- `OntologyData`: nodes[], links[]

## Configuration

### Vite (vite.config.ts)
- Server binds to `0.0.0.0:3000`
- Path alias: `@/*` maps to project root
- Environment variables: `GEMINI_API_KEY` injected as `process.env.API_KEY`

### Environment
Set `GEMINI_API_KEY` in `.env.local` for Gemini API integration.

## Styling
- Tailwind CSS loaded via CDN in index.html
- Dark theme with slate-950 base
- Custom CSS for blueprint grid background (in index.html)
- Icons from lucide-react

## Data Files
CSV files in `/public/` contain sample ontology data:
- `25R4_NS_BI_View_Objects_in_Data_Enrichment - Sheet1.csv`
- `25R4_NS_Data_Augmentation_Entity_Key_List - Sheet1.csv`
- `25R4_NS_Semantic_Model_Lineage - 25R4_NS_Semantic_Model_Lineage.csv`
