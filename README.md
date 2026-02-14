<div align="center">

# NSAW Schema Explorer

**Interactive data lineage visualization for NetSuite Analytics Warehouse**

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![React](https://img.shields.io/badge/React-19-61dafb?logo=react&logoColor=white)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178c6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Vite](https://img.shields.io/badge/Vite-6-646cff?logo=vite&logoColor=white)](https://vite.dev)
[![React Flow](https://img.shields.io/badge/React_Flow-11-ff0072?logo=reactflow&logoColor=white)](https://reactflow.dev)
[![D3.js](https://img.shields.io/badge/D3.js-7-f9a03c?logo=d3dotjs&logoColor=white)](https://d3js.org)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3-06b6d4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com)

</div>

## About

NSAW Schema Explorer visualizes how data flows through Oracle NetSuite Analytics Warehouse — from the NetSuite ERP source layer, through the physical data warehouse, to the semantic presentation layer. It renders 56,000+ field-level lineage mappings across 110+ subject areas as interactive, explorable graphs.

> **Disclaimer:** This project is for **informational and educational purposes only**. It references publicly available Oracle NetSuite Analytics Warehouse documentation to visualize data lineage relationships. It is not affiliated with, endorsed by, or sponsored by Oracle Corporation or NetSuite.

## Features

- **Star Schema Network** — D3 force-directed radial layout showing fact, dimension, and presentation tables per subject area
- **Detailed Flow View** — Field-level lineage graph with dagre auto-layout (source → warehouse → semantic)
- **Overview Map** — High-level 3-tier architecture view across all subject areas
- **Table View** — Sortable spreadsheet of all lineage mappings
- **Full-Text Search** — Fuzzy search across tables, columns, and subject areas powered by FlexSearch
- **Isometric Welcome** — 3D data stack visualization of the three architecture layers
- **Dark / Light Theme** — Full theme system with CSS variables
- **56,000+ Records** — CSV parsed in a Web Worker for non-blocking load

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Framework** | React 19 + TypeScript 5.8 |
| **Build** | Vite 6 |
| **Graph Visualization** | React Flow (dagre layout) |
| **Force Simulation** | D3-Force (star schema network) |
| **Search** | FlexSearch |
| **Data Parsing** | PapaParse (Web Worker mode) |
| **Styling** | Tailwind CSS + CSS Variables |
| **Icons** | Lucide React |

## Getting Started

**Prerequisites:** Node.js 18+

```bash
# Install dependencies
npm install

# Start development server (http://localhost:3000)
npm run dev

# Production build
npm run build

# Preview production build
npm run preview
```

## Architecture

The app follows a three-layer data flow pattern mirroring the NSAW architecture itself:

```
NetSuite ERP Source  →  Physical Data Warehouse  →  Semantic Presentation Layer
   (inferred)              (DW tables)                (subject areas)
```

Key areas: `data/` (context, CSV loader, search index), `components/views/` (visualization modes), `components/nodes/` (custom React Flow / D3 nodes), `utils/` (graph layout transforms), `config/` (functional area groupings).

## License

This project is licensed under the [MIT License](LICENSE).

> This project is for **informational and educational purposes only**. It references publicly available Oracle NetSuite Analytics Warehouse documentation to visualize data lineage relationships. It is not affiliated with, endorsed by, or sponsored by Oracle Corporation or NetSuite. All trademarks are the property of their respective owners.
