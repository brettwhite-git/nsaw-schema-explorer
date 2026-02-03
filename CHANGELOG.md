# Changelog

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
