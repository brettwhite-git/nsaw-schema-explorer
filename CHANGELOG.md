# Changelog

## Star Schema Node Styling & Layout Polish (2026-02-05)

### What Changed
- Outer ring nodes (semantic + NSAW derived) now **solid filled** instead of border-only (emerald/orange)
- Outer node radius increased from 6→10px, dimension nodes from 10→12px
- Fact node labels use **multi-line wrapping** at underscore boundaries (via `wrapLabel()` + SVG `<tspan>`)
- All ring distances tightened ~25% for a more compact layout (`computeRadii` scaling)
- Settling transition smoothed: viewport `<g>` gets `transition: transform 0.6s ease-out`, post-settle charge reduced from -120→-60 (was -20, too abrupt)
- Legend updated to show filled dots for presentation layer entries

## Star Schema Outer Ring + Detailed Flow Redesign (2026-02-05)

### What Changed

**Star Schema Network — 3-Ring Layout with Outer Presentation Nodes**
- Added outer ring of presentation table nodes beyond the existing dimension ring
- **Green border-only** circles: Semantic/presentation tables (non-NSAW)
- **Orange border-only** circles: NSAW-derived tables (all source DW tables are NSAW-generated)
- Edges connect DW table nodes (inner) → presentation table nodes (outer) via solid lines
- Outer ring at 140% of dimension ring distance, capped at 40 nodes (`MAX_OUTER_NODES`)
- `forceOrbital` expanded: outer nodes orbit at 30% of dimension node speed
- `forceRadial` returns `outerRing` distance for `presentation`/`derived` roles with stronger pull (0.5 vs 0.3)
- Clicking an outer node navigates directly to that presentation table's detailed flow view
- Legend updated with "Presentation Layer" section showing green + orange border-only circles
- Tooltip shows "Semantic Table" / "NSAW Derived Table" for outer nodes

**Detailed Flow View — 3-Column Layout Matching Data Flow**
- Column layout: NetSuite Source (blue, left) → DW Tables (purple, center) → Semantic Fields (green/orange, right)
- Added `derivedColumn` node type (orange) for presentation columns whose ALL source tables are NSAW-generated
- Physical table nodes now display **FACT / DIMENSION / HIERARCHY** badges via `parsePhysicalTableType()`
- `tableType` field added to `LineageNodeData`: `'fact' | 'dimension' | 'hierarchy' | 'other'`
- Edge colors differentiated: derived edges use `--theme-layer-derived`, normal use `--theme-layer-dw`
- MiniMap, legend, and click handlers updated to support `derivedColumn` type

**Detail Panel — Enhanced Lineage Info**
- DW section now shows explicit "Table:" and "Column:" labels with styled backgrounds
- Table type badge (Fact Table / Dimension Table / Hierarchy / etc.) using `parsePhysicalTableType()`
- "NSAW Derived Field" badge with Zap icon for derived fields in the semantic layer section
- Data Flow Layers legend now includes the orange "NSAW Derived" layer

**Theme Variables — New Derived Layer Colors**
- Added `--theme-layer-derived-*` (9 variables) in both dark and light mode
- Added `--theme-d3-outer-*` (5 variables) for star schema outer ring styling
- Added `.glow-derived` utility class

### Bug Fix

**Double-opacity on outer edges (invisible edges)**
- `--theme-d3-edge-outer` was `rgba(71, 85, 105, 0.3)` — alpha baked into CSS color
- SVG `opacity={0.3}` applied on top → effective visibility: 0.3 × 0.3 = 9% (invisible)
- **Fix:** Changed to solid hex `#475569`, controlling opacity exclusively via SVG `opacity` attribute
- **Lesson:** Never use `rgba()` for D3 stroke/fill CSS variables. D3 SVG applies its own `opacity` attr, causing multiplication.

### Files Modified
- `styles/theme.css` — Derived layer + D3 outer ring color variables
- `utils/graphLayout.ts` — `derivedColumn` type, `tableType` classification, edge color split
- `components/nodes/LineageNode.tsx` — Derived node style, fact/dim badge, Zap icon
- `components/views/StarSchemaNetwork.tsx` — Outer ring nodes, 3-ring force simulation, SVG rendering
- `components/DetailPanel.tsx` — Enhanced DW info, table type badge, NSAW derived indicator
- `components/GraphViewer.tsx` — Legend, minimap, click handler for derived type

---

## StarSchemaNetwork - D3 Force Graph Overhaul (2026-02-03)

### What's Working Now

**Container Ref Fix (ROOT CAUSE of invisible boundary)**
- The "invisible boundary" was a React lifecycle race condition, not a CSS or D3 issue
- Loading and empty state returns used DIFFERENT div elements that lacked `ref={containerRef}`
- ResizeObserver never attached during initial mount → dimensions stuck at hardcoded 1000x700
- Nodes were centered at (500, 350) instead of the actual container center
- **Fix:** Always render a single container div with `ref={containerRef}`, place loading/empty content inside it as children. Initial dimensions set to `{0, 0}` with a guard to skip simulation until real measurements arrive.

**Improved Primary Fact Detection**
- `isPrimaryFact()` now uses token-overlap matching (≥50% of subject area tokens must appear in table name)
- Handles long subject area names like "Account Analysis Template" that failed substring matching
- Virtual hub fallback: when no fact tables exist, promotes the most-connected dimension to center hub

**Viewport-Responsive Radial Distances**
- Ring distances computed dynamically from container size via `computeRadii(width, height, nodeCount)`
- Replaces fixed `DIMENSION_RING: 420px` / `SECONDARY_RING: 180px` that overflowed smaller containers
- Scales based on node count — fewer nodes use tighter layout, more nodes expand to fill space

**Auto-Fit Transform**
- `computeFitTransform()` calculates bounding box of all settled nodes and computes scale + translation to center the graph within the viewport
- Applied after simulation settles (alpha < 0.05), on reset button click, and on subject area navigation
- Capped at 1.0 scale (never zooms in beyond 100%), floor at 0.3 scale

**Orbital Animation**
- Custom `forceOrbital()` force applies tangential velocity to dimension nodes
- Creates smooth counterclockwise orbiting around center hub
- After settling: `alphaDecay(0)` + `alphaTarget(0.01)` keeps simulation alive indefinitely
- Charge and link forces reduced during floating phase to prevent jitter
- Orbital pauses during drag, resumes after release

**Force Configuration**
- Removed `forceCenter` — was fighting `forceRadial`; primary fact's `fx`/`fy` pin handles centering
- Removed `distanceMax(500)` on charge force — was creating blind spots where opposite-side nodes couldn't repel each other (root cause of the two-cluster "invisible wall" pattern)
- `RADIAL_STRENGTH` increased from 0.15 to 0.3 for tighter ring cohesion

### What Was Tried That Didn't Work

| Approach | Problem |
|----------|---------|
| CSS `transition` on SVG `transform` attribute | Unreliable in React — browser re-parses transform string each frame |
| `calculateFitTransform` centering on bounds | Bounds center ≠ primary fact position (asymmetric spread) |
| `calculateFitTransform` centering on primary fact | Required separate padding logic that created mismatches |
| Padding-aware simulation center | Duplicated padding logic — double-offset problem |
| `animateTo` after settling | Caused visible "zoom in" effect on load |
| `alphaTarget(0.0008)` for floating | Too low — D3 multiplies forces by alpha, so tiny alpha = invisible movement |
| `overflow-hidden` on container | Clipped nodes at edges of graph |
| Force fixes only (Attempt 2) | Improved fact detection + responsive radii + auto-fit + orbital — all correct but graph still off-center because the real issue was the container ref race condition |

### Key Lesson

**Always ensure `ref` elements are mounted before `useEffect` hooks that depend on them.** When a component has conditional returns (loading states, empty states) BEFORE the main render, any `ref` attached only to the main render div won't be available during mount-time effects. The fix is to always render the ref container and place conditional content inside it.

---

## React Flow fitView Fix (WORKING)

**Problem:** React Flow `fitView` boolean prop only fires on mount, not when switching tables.

**Solution:** `ReactFlowProvider` with `key={presentationTable}` + `onInit` callback.
- Forces complete remount on table change
- `onInit` fires when React Flow is ready
- `getFitViewOptions(nodeCount)` provides intelligent zoom bounds based on graph size
