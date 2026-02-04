/**
 * StarSchemaNetwork - Highcharts-style network graph
 *
 * Inspired by Highcharts network graphs:
 * - Text labels always visible (inside large nodes, above small nodes)
 * - Node sizes vary by importance
 * - All edges visible from start
 * - Gentle, smooth animation
 */

import React, { useRef, useEffect, useMemo, useState, useCallback } from 'react';
import {
  forceSimulation,
  forceLink,
  forceCollide,
  forceManyBody,
  forceRadial,
  SimulationNodeDatum,
  SimulationLinkDatum,
} from 'd3-force';
import { drag } from 'd3-drag';
import { select } from 'd3-selection';
import { useData } from '../../data/DataContext';
import { useTheme } from '../../contexts/ThemeContext';
import { parsePhysicalTableType, PhysicalTableType } from '../../types';

// ======================
// Types
// ======================

interface NetworkNode extends SimulationNodeDatum {
  id: string;
  label: string;
  role: 'primaryFact' | 'secondaryFact' | 'dimension';
  columnCount: number;
  radius: number;
}

interface NetworkLink extends SimulationLinkDatum<NetworkNode> {
  source: string | NetworkNode;
  target: string | NetworkNode;
}

// ======================
// Configuration
// ======================

const CONFIG = {
  // Node radii
  PRIMARY_FACT_RADIUS: 50,      // Large hub
  SECONDARY_FACT_RADIUS: 30,    // Medium nodes
  DIMENSION_RADIUS: 10,         // Small endpoints

  // Force parameters - pushed out for better text visibility
  LINK_DISTANCE: 180,
  CHARGE_STRENGTH: -120,
  COLLISION_PADDING: 20,
  RADIAL_STRENGTH: 0.3,      // Increased from 0.15 for better ring cohesion

  // Animation - smooth and gentle
  ALPHA_START: 0.4,
  ALPHA_DECAY: 0.02,  // Faster decay for quicker settling
  VELOCITY_DECAY: 0.4,
};

// ======================
// Helper Functions
// ======================

function getDimensionGroup(tableName: string, type: PhysicalTableType): string {
  const name = tableName.toUpperCase();
  if (name.includes('DAY_D') || name.includes('FISCALCAL') || name.includes('CALENDAR')) return 'calendar';
  if (type === 'hierarchy') return 'hierarchy';
  if (type === 'global') return 'global';
  if (['ENTITY', 'CUSTOMER', 'VENDOR', 'EMPLOYEE', 'PARTNER', 'CONTACT'].some(p => name.includes(p))) return 'entity';
  if (['ITEM', 'INVENTORY'].some(p => name.includes(p))) return 'item';
  if (['SUBSIDIARY', 'DEPARTMENT', 'CLASSIFICATION', 'LOCATION', 'ACCOUNT'].some(p => name.includes(p))) return 'org';
  return 'other';
}

function extractSubjectAreaKey(subjectArea: string): string {
  return subjectArea.replace(/^NetSuite\s*-\s*/i, '').replace(/\s+/g, '_').toUpperCase();
}

function isPrimaryFact(tableName: string, subjectAreaKey: string): boolean {
  const tableCore = tableName.replace(/^DW_NS_/, '').replace(/_F$|_EF$|_LINES_F$|_LINES_EF$/, '');

  // Direct substring match (existing logic)
  if (tableCore.includes(subjectAreaKey) || subjectAreaKey.includes(tableCore)) return true;

  // Token overlap: split both into words by underscore, check if >=50% of
  // subject area tokens appear in the table core
  const tableTokens = new Set(tableCore.split('_').filter(t => t.length > 1));
  const saTokens = subjectAreaKey.split('_').filter(t => t.length > 1);
  if (saTokens.length === 0) return false;

  const matchCount = saTokens.filter(t => tableTokens.has(t)).length;
  return matchCount / saTokens.length >= 0.5;
}

function cleanLabel(tableName: string): string {
  return tableName
    .replace(/^DW_NS_/, '')
    .replace(/_F$|_EF$|_D$|_DH$|_G$|_CF_DH$|_LINES_F$|_LINES_EF$/, '');
}

// Truncate label for display
function truncateLabel(label: string, maxLen: number): string {
  if (label.length <= maxLen) return label;
  return label.substring(0, maxLen - 1) + '\u2026';
}

// Viewport-responsive radial distances
function computeRadii(width: number, height: number, nodeCount: number) {
  const maxRadius = Math.min(width, height) / 2 - 80;
  const scaleFactor = Math.min(1, Math.max(0.5, nodeCount / 30));
  const dimensionRing = maxRadius * scaleFactor;
  const secondaryRing = dimensionRing * 0.43;
  return {
    secondaryRing: Math.max(secondaryRing, 80),
    dimensionRing: Math.max(dimensionRing, 150),
  };
}

// Auto-fit transform after settling
function computeFitTransform(
  nodes: NetworkNode[],
  viewportWidth: number,
  viewportHeight: number,
  padding: number = 60
): { x: number; y: number; scale: number } {
  if (nodes.length === 0) return { x: 0, y: 0, scale: 1 };

  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const node of nodes) {
    const x = node.x ?? 0;
    const y = node.y ?? 0;
    const r = node.radius + 20;
    minX = Math.min(minX, x - r);
    maxX = Math.max(maxX, x + r);
    minY = Math.min(minY, y - r);
    maxY = Math.max(maxY, y + r);
  }

  const graphWidth = maxX - minX;
  const graphHeight = maxY - minY;
  const graphCenterX = (minX + maxX) / 2;
  const graphCenterY = (minY + maxY) / 2;

  const availWidth = viewportWidth - padding * 2;
  const availHeight = viewportHeight - padding * 2;

  const scale = Math.min(1.0, availWidth / graphWidth, availHeight / graphHeight);

  const tx = viewportWidth / 2 - graphCenterX * scale;
  const ty = viewportHeight / 2 - graphCenterY * scale;

  return { x: tx, y: ty, scale: Math.max(0.3, scale) };
}

// Orbital animation force for dimension nodes
function forceOrbital(centerX: number, centerY: number, speed: number = 0.002) {
  let nodes: NetworkNode[] = [];

  const force: any = (alpha: number) => {
    for (const node of nodes) {
      if (node.role !== 'dimension') continue;
      if (node.fx != null) continue;

      const x = (node.x ?? 0) - centerX;
      const y = (node.y ?? 0) - centerY;
      const dist = Math.sqrt(x * x + y * y);
      if (dist < 1) continue;

      const tx = -y / dist;
      const ty = x / dist;

      node.vx = (node.vx ?? 0) + tx * speed * dist * 0.01;
      node.vy = (node.vy ?? 0) + ty * speed * dist * 0.01;
    }
  };

  force.initialize = (n: NetworkNode[]) => { nodes = n; };
  return force;
}

// ======================
// Main Component
// ======================

export const StarSchemaNetwork: React.FC = () => {
  const { dataIndex, selection, selectPresentationTable, setViewMode } = useData();
  const { theme } = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);
  const simulationRef = useRef<ReturnType<typeof forceSimulation<NetworkNode>> | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  // Resolve CSS custom properties into concrete values for D3 computed logic.
  // Re-evaluated when theme changes so the force graph picks up new palette.
  const colors = useMemo(() => {
    const get = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return {
      primaryFact: get('--theme-accent-purple'),
      secondaryFact: get('--theme-accent-purple-dark'),
      dimension: get('--theme-accent-blue'),
      edge: get('--theme-d3-edge'),
      text: get('--theme-d3-text'),
      textBright: get('--theme-d3-text-bright'),
      hoverPrimary: get('--theme-d3-hover-primary'),
      hoverSecondary: get('--theme-d3-hover-secondary'),
      hoverDimension: get('--theme-d3-hover-dimension'),
      hoverStroke: get('--theme-d3-hover-stroke'),
      bgElevated: get('--theme-bg-elevated'),
      bgHover: get('--theme-bg-hover'),
      bgSurface: get('--theme-bg-surface'),
      bgPanel: get('--theme-bg-panel'),
      borderDefault: get('--theme-border-default'),
      borderStrong: get('--theme-border-strong'),
      textPrimary: get('--theme-text-primary'),
      textDefault: get('--theme-text-default'),
      textSecondary: get('--theme-text-secondary'),
      textMuted: get('--theme-text-muted'),
      surfaceLegend: get('--theme-surface-legend'),
      gridDot: get('--theme-grid-dot'),
      accentPurpleText: get('--theme-accent-purple-text'),
      accentBlueText: get('--theme-accent-blue-text'),
    };
  }, [theme]);

  // Start with 0x0 - ResizeObserver will provide real dimensions once the
  // container div mounts. This prevents building a simulation with wrong coordinates.
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [nodes, setNodes] = useState<NetworkNode[]>([]);
  const [links, setLinks] = useState<NetworkLink[]>([]);
  const [hoveredNode, setHoveredNode] = useState<NetworkNode | null>(null);
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [draggingNode, setDraggingNode] = useState<string | null>(null);
  const [isSettling, setIsSettling] = useState(true);
  const [isReady, setIsReady] = useState(false);

  // Resize observer
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setDimensions({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
      }
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // Reset view when entering star schema view (e.g., navigating back from detailed flow)
  useEffect(() => {
    // Only apply when we're actually showing star schema (no table selected)
    if (!selection.presentationTable && nodes.length > 0) {
      setTransform(computeFitTransform(nodes, dimensions.width, dimensions.height));
    }
  }, [selection.presentationTable]);
  // Note: Don't include nodes in deps to avoid re-triggering on every simulation tick

  // Build network data
  const { initialNodes, initialLinks, stats, radii } = useMemo(() => {
    if (!dataIndex || !selection.subjectArea || dimensions.width === 0 || dimensions.height === 0) {
      return { initialNodes: [], initialLinks: [], stats: { primary: '', secondaryCount: 0, dimCount: 0 }, radii: { secondaryRing: 80, dimensionRing: 150 } };
    }

    const records = dataIndex.bySubjectArea.get(selection.subjectArea) || [];
    if (records.length === 0) {
      return { initialNodes: [], initialLinks: [], stats: { primary: '', secondaryCount: 0, dimCount: 0 }, radii: { secondaryRing: 80, dimensionRing: 150 } };
    }

    const subjectAreaKey = extractSubjectAreaKey(selection.subjectArea);
    // Position at viewport center (D3 will center primary fact here)
    const centerX = dimensions.width / 2;
    const centerY = dimensions.height / 2;

    // Build table info
    const tableInfo = new Map<string, {
      type: PhysicalTableType;
      columns: Set<string>;
      isPrimary: boolean;
    }>();

    for (const record of records) {
      const phys = record.physicalTable;
      if (phys.includes('_SEC') || phys.startsWith('"') || phys.startsWith('select')) continue;
      if (!tableInfo.has(phys)) {
        const tableType = parsePhysicalTableType(phys);
        tableInfo.set(phys, {
          type: tableType,
          columns: new Set(),
          isPrimary: (tableType === 'fact' || tableType === 'enhanced') && isPrimaryFact(phys, subjectAreaKey),
        });
      }
      tableInfo.get(phys)!.columns.add(record.physicalColumn);
    }

    // Categorize tables
    let primaryFact: string | null = null;
    const secondaryFacts: string[] = [];
    const dimensionTables: string[] = [];

    for (const [table, info] of tableInfo) {
      if (info.isPrimary) {
        if (!primaryFact || (!table.includes('_LINES') && primaryFact.includes('_LINES'))) {
          if (primaryFact) secondaryFacts.push(primaryFact);
          primaryFact = table;
        } else {
          secondaryFacts.push(table);
        }
      } else if (info.type === 'fact' || info.type === 'enhanced') {
        secondaryFacts.push(table);
      } else {
        dimensionTables.push(table);
      }
    }

    if (!primaryFact && secondaryFacts.length > 0) {
      primaryFact = secondaryFacts.shift()!;
    }

    // If still no primary fact, promote the most-connected dimension to hub
    let useVirtualHub = false;
    if (!primaryFact && dimensionTables.length > 0) {
      useVirtualHub = true;
      let bestDim = dimensionTables[0];
      let bestCount = 0;
      for (const table of dimensionTables) {
        const count = tableInfo.get(table)!.columns.size;
        if (count > bestCount) {
          bestCount = count;
          bestDim = table;
        }
      }
      primaryFact = bestDim;
      const idx = dimensionTables.indexOf(bestDim);
      if (idx >= 0) dimensionTables.splice(idx, 1);
    }

    // Compute viewport-responsive radii
    const totalNodeCount = (primaryFact ? 1 : 0) + secondaryFacts.length + dimensionTables.length;
    const { secondaryRing, dimensionRing } = computeRadii(dimensions.width, dimensions.height, totalNodeCount);

    // Build nodes
    const networkNodes: NetworkNode[] = [];
    const networkLinks: NetworkLink[] = [];

    // Primary fact at center
    if (primaryFact) {
      const info = tableInfo.get(primaryFact)!;
      networkNodes.push({
        id: primaryFact,
        label: cleanLabel(primaryFact),
        role: useVirtualHub ? 'secondaryFact' : 'primaryFact',
        columnCount: info.columns.size,
        radius: useVirtualHub ? CONFIG.SECONDARY_FACT_RADIUS : CONFIG.PRIMARY_FACT_RADIUS,
        x: centerX,
        y: centerY,
        fx: centerX,
        fy: centerY,
      });
    }

    // Secondary facts - start near center
    secondaryFacts.forEach((table, i) => {
      const info = tableInfo.get(table)!;
      const angle = (2 * Math.PI * i) / Math.max(secondaryFacts.length, 1) - Math.PI / 2;
      const radius = secondaryRing + (Math.random() - 0.5) * 30;
      networkNodes.push({
        id: table,
        label: cleanLabel(table),
        role: 'secondaryFact',
        columnCount: info.columns.size,
        radius: CONFIG.SECONDARY_FACT_RADIUS,
        x: centerX + Math.cos(angle) * radius,
        y: centerY + Math.sin(angle) * radius,
      });
      if (primaryFact) {
        networkLinks.push({ source: primaryFact, target: table });
      }
    });

    // Dimensions - start at approximate radial positions
    dimensionTables.forEach((table, index) => {
      const info = tableInfo.get(table)!;
      const baseAngle = (2 * Math.PI * index) / dimensionTables.length;
      const jitter = (Math.random() - 0.5) * 0.1;
      const angle = baseAngle + jitter;
      const radius = dimensionRing + (Math.random() - 0.5) * 40;
      networkNodes.push({
        id: table,
        label: cleanLabel(table),
        role: 'dimension',
        columnCount: info.columns.size,
        radius: CONFIG.DIMENSION_RADIUS,
        x: centerX + Math.cos(angle) * radius,
        y: centerY + Math.sin(angle) * radius,
      });
      if (primaryFact) {
        networkLinks.push({ source: primaryFact, target: table });
      }
    });

    return {
      initialNodes: networkNodes,
      initialLinks: networkLinks,
      stats: {
        primary: primaryFact ? cleanLabel(primaryFact) : 'None',
        secondaryCount: secondaryFacts.length,
        dimCount: dimensionTables.length,
      },
      radii: { secondaryRing, dimensionRing },
    };
  }, [dataIndex, selection.subjectArea, dimensions]);

  // Run force simulation with animated settling
  useEffect(() => {
    if (initialNodes.length === 0) {
      setNodes([]);
      setLinks([]);
      return;
    }

    // Reset ready state at start
    setIsReady(false);

    // Position at viewport center (D3 will center primary fact here)
    const centerX = dimensions.width / 2;
    const centerY = dimensions.height / 2;

    const simNodes = initialNodes.map(n => ({ ...n }));
    const simLinks = initialLinks.map(l => ({ ...l }));

    if (simulationRef.current) {
      simulationRef.current.stop();
    }

    const simulation = forceSimulation<NetworkNode>(simNodes)
      .force('link', forceLink<NetworkNode, NetworkLink>(simLinks)
        .id(d => d.id)
        .distance(CONFIG.LINK_DISTANCE)
        .strength(0.4)
      )
      .force('charge', forceManyBody<NetworkNode>()
        .strength(CONFIG.CHARGE_STRENGTH)
      )
      .force('collide', forceCollide<NetworkNode>()
        .radius(d => d.radius + CONFIG.COLLISION_PADDING)
        .strength(0.8)
      )
      .force('radial', forceRadial<NetworkNode>(
        d => d.role === 'dimension' ? radii.dimensionRing : d.role === 'secondaryFact' ? radii.secondaryRing : 0,
        centerX,
        centerY
      ).strength(CONFIG.RADIAL_STRENGTH))
      .force('orbital', forceOrbital(centerX, centerY, 0.003))
      .alpha(CONFIG.ALPHA_START)
      .alphaDecay(CONFIG.ALPHA_DECAY)
      .velocityDecay(CONFIG.VELOCITY_DECAY)
      .stop();  // Don't auto-start - we'll set up tick handler first

    // Run a few synchronous iterations for warm start (nodes near final positions)
    const warmupIterations = 30;
    for (let i = 0; i < warmupIterations; i++) {
      simulation.tick();
    }

    // Store simulation reference for cleanup
    simulationRef.current = simulation;

    // Set initial state
    setNodes([...simNodes]);
    setLinks([...simLinks]);

    // Mark as ready - transform and nodes are set
    setIsReady(true);

    // Set settling state
    setIsSettling(true);
    let hasSettled = false;

    // Let simulation continue animating
    simulation.on('tick', () => {
      setNodes([...simNodes]);
      setLinks([...simLinks]);

      // When simulation nearly stopped, finalize (only once)
      if (simulation.alpha() < 0.05 && !hasSettled) {
        hasSettled = true;
        setIsSettling(false);

        // Auto-fit to viewport
        const fitTransform = computeFitTransform(simNodes, dimensions.width, dimensions.height);
        setTransform(fitTransform);

        // Keep simulation alive for orbital animation
        simulation.alphaDecay(0);
        simulation.alphaTarget(0.01);

        // Reduce forces during floating to prevent jitter
        simulation.force('charge', forceManyBody<NetworkNode>()
          .strength(-20)
        );
        simulation.force('link', forceLink<NetworkNode, NetworkLink>(simLinks)
          .id(d => d.id)
          .distance(CONFIG.LINK_DISTANCE)
          .strength(0.1)
        );
      }
    });

    // Restart simulation from current alpha (after warmup, alpha is reduced)
    simulation.alpha(0.3).restart();

    return () => {
      if (simulationRef.current) {
        simulationRef.current.stop();
      }
    };
  }, [initialNodes, initialLinks, dimensions]);

  // Pan handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (isSettling) return;
    if (e.button === 0 && !hoveredNode) {
      setIsPanning(true);
      setPanStart({ x: e.clientX - transform.x, y: e.clientY - transform.y });
    }
  }, [transform, hoveredNode, isSettling]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isPanning) {
      setTransform(t => ({
        ...t,
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y,
      }));
    }
  }, [isPanning, panStart]);

  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (isSettling) return;
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const delta = e.deltaY > 0 ? 0.92 : 1.08;

    setTransform(t => {
      const newScale = Math.min(Math.max(t.scale * delta, 0.3), 5);
      const scaleChange = newScale / t.scale;

      // Adjust translation to zoom toward mouse position
      const newX = mouseX - (mouseX - t.x) * scaleChange;
      const newY = mouseY - (mouseY - t.y) * scaleChange;

      return { x: newX, y: newY, scale: newScale };
    });
  }, [isSettling]);

  const prevSubjectAreaRef = useRef<string | null>(null);

  useEffect(() => {
    if (selection.subjectArea !== prevSubjectAreaRef.current && nodes.length > 0) {
      prevSubjectAreaRef.current = selection.subjectArea;
      setTransform(computeFitTransform(nodes, dimensions.width, dimensions.height));
    }
  }, [selection.subjectArea, nodes.length]);

  const resetView = useCallback(() => {
    setTransform(computeFitTransform(nodes, dimensions.width, dimensions.height));
  }, [nodes, dimensions]);

  // Handle node click - navigate to presentation table
  const handleNodeClick = useCallback((node: NetworkNode) => {
    if (!dataIndex || !selection.subjectArea) return;

    // Find presentation tables that use this physical table
    const records = dataIndex.byPhysicalTable.get(node.id) || [];
    const presentationTables = new Set<string>();

    for (const record of records) {
      if (record.subjectArea === selection.subjectArea) {
        presentationTables.add(record.presentationTable);
      }
    }

    const tables = Array.from(presentationTables);

    if (tables.length === 1) {
      // Single match - navigate directly
      selectPresentationTable(selection.subjectArea, tables[0]);
      setViewMode('detailedFlow');
    } else if (tables.length > 1) {
      // Multiple matches - navigate to first one (could add picker later)
      selectPresentationTable(selection.subjectArea, tables[0]);
      setViewMode('detailedFlow');
    }
    // If no matches within this subject area, do nothing
  }, [dataIndex, selection.subjectArea, selectPresentationTable, setViewMode]);

  // Handle node drag start
  const handleDragStart = useCallback((node: NetworkNode) => {
    setDraggingNode(node.id);
    if (simulationRef.current) {
      simulationRef.current.alphaTarget(0.3).restart();
    }
  }, []);

  // Handle node drag
  const handleDrag = useCallback((node: NetworkNode, x: number, y: number) => {
    // Update node position
    node.fx = x;
    node.fy = y;
    setNodes(prev => prev.map(n => n.id === node.id ? { ...n, x, y, fx: x, fy: y } : n));
  }, []);

  // Handle node drag end
  const handleDragEnd = useCallback((node: NetworkNode) => {
    setDraggingNode(null);
    if (simulationRef.current) {
      simulationRef.current.alphaTarget(0.01);
    }
    // Release fixed position (node will drift back with physics)
    node.fx = null;
    node.fy = null;
  }, []);

  // Always render the container div with ref so ResizeObserver can measure
  // real dimensions before the first simulation runs. Previously, the loading
  // and empty states returned different divs WITHOUT containerRef, causing
  // the graph to be built with stale hardcoded dimensions (1000x700).
  const showEmpty = nodes.length === 0 && initialNodes.length === 0;

  return (
    <div
      ref={containerRef}
      className="flex-1 w-full h-full relative overflow-visible"
      style={{
        background: 'var(--theme-bg-base)',
        backgroundImage: `radial-gradient(circle, var(--theme-grid-dot) 1px, transparent 1px)`,
        backgroundSize: '20px 20px',
      }}
    >
      {showEmpty ? (
        <div className="absolute inset-0 flex items-center justify-center" style={{ color: 'var(--theme-text-muted)' }}>
          <p className="text-lg">No physical tables found</p>
        </div>
      ) : !isReady ? (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-sm" style={{ color: 'var(--theme-text-muted)' }}>Loading graph...</div>
        </div>
      ) : (
      <>
      <svg
        width={dimensions.width}
        height={dimensions.height}
        viewBox={`0 0 ${dimensions.width} ${dimensions.height}`}
        className={isPanning ? 'cursor-grabbing' : 'cursor-grab'}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}
      >
        <g
          transform={`translate(${transform.x}, ${transform.y}) scale(${transform.scale})`}
        >
          {/* Edges - always visible, subtle gray */}
          <g className="edges">
            {links.map((link, i) => {
              const source = link.source as NetworkNode;
              const target = link.target as NetworkNode;
              if (!source.x || !target.x) return null;

              const isHovered = hoveredNode &&
                (hoveredNode.id === source.id || hoveredNode.id === target.id);

              return (
                <line
                  key={i}
                  x1={source.x}
                  y1={source.y}
                  x2={target.x}
                  y2={target.y}
                  stroke="var(--theme-d3-edge)"
                  strokeWidth={isHovered ? 2 : 1}
                  opacity={isHovered ? 0.8 : 0.5}
                />
              );
            })}
          </g>

          {/* Nodes with labels */}
          <g className="nodes">
            {nodes.map((node) => {
              const isHovered = hoveredNode?.id === node.id;
              const isDragging = draggingNode === node.id;
              const isFact = node.role === 'primaryFact' || node.role === 'secondaryFact';
              const isPrimary = node.role === 'primaryFact';

              // Color based on role -- use resolved CSS variable values
              let fill = colors.dimension;
              if (isPrimary) fill = colors.primaryFact;
              else if (node.role === 'secondaryFact') fill = colors.secondaryFact;

              // Hover/drag brightening
              if (isHovered || isDragging) {
                fill = isPrimary ? colors.hoverPrimary : node.role === 'secondaryFact' ? colors.hoverSecondary : colors.hoverDimension;
              }

              return (
                <g
                  key={node.id}
                  onMouseEnter={() => !draggingNode && setHoveredNode(node)}
                  onMouseLeave={() => setHoveredNode(null)}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!draggingNode) handleNodeClick(node);
                  }}
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    if (isPrimary) return; // Primary fact is fixed
                    const startX = e.clientX;
                    const startY = e.clientY;
                    const nodeStartX = node.x || 0;
                    const nodeStartY = node.y || 0;
                    let hasDragged = false;

                    handleDragStart(node);

                    const onMouseMove = (moveEvent: MouseEvent) => {
                      const dx = (moveEvent.clientX - startX) / transform.scale;
                      const dy = (moveEvent.clientY - startY) / transform.scale;
                      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
                        hasDragged = true;
                      }
                      handleDrag(node, nodeStartX + dx, nodeStartY + dy);
                    };

                    const onMouseUp = () => {
                      document.removeEventListener('mousemove', onMouseMove);
                      document.removeEventListener('mouseup', onMouseUp);
                      handleDragEnd(node);
                      // Prevent click if we dragged
                      if (hasDragged) {
                        e.preventDefault();
                      }
                    };

                    document.addEventListener('mousemove', onMouseMove);
                    document.addEventListener('mouseup', onMouseUp);
                  }}
                  className={`cursor-pointer ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
                  style={{ transition: isDragging ? 'none' : 'transform 0.1s ease-out' }}
                >
                  {/* Node circle */}
                  <circle
                    cx={node.x}
                    cy={node.y}
                    r={isHovered || isDragging ? node.radius + 3 : node.radius}
                    fill={fill}
                    stroke={isHovered || isDragging ? colors.hoverStroke : 'none'}
                    strokeWidth={2}
                  />

                  {/* Label - inside for large nodes, above for small nodes */}
                  {isFact ? (
                    // Label inside the node for facts
                    <text
                      x={node.x}
                      y={node.y}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fill="var(--theme-d3-text-bright)"
                      fontSize={isPrimary ? 11 : 9}
                      fontWeight={600}
                      className="pointer-events-none select-none"
                    >
                      {truncateLabel(node.label, isPrimary ? 14 : 10)}
                    </text>
                  ) : (
                    // Label above the node for dimensions
                    <text
                      x={node.x}
                      y={(node.y || 0) - node.radius - 4}
                      textAnchor="middle"
                      dominantBaseline="auto"
                      fill="var(--theme-d3-text)"
                      fontSize={9}
                      fontWeight={isHovered ? 600 : 400}
                      className="pointer-events-none select-none"
                    >
                      {truncateLabel(node.label, 16)}
                    </text>
                  )}
                </g>
              );
            })}
          </g>
        </g>
      </svg>

      {/* Star Schema Legend */}
      <div
        className="absolute top-4 right-4 z-10 backdrop-blur-sm rounded-lg p-3"
        style={{
          background: colors.surfaceLegend,
          border: `1px solid ${colors.borderStrong}`,
        }}
      >
        <div className="text-[10px] uppercase tracking-wider mb-2 font-medium" style={{ color: colors.textMuted }}>Legend</div>
        <div className="flex flex-col gap-2 text-xs" style={{ color: colors.textSecondary }}>
          <div className="flex items-center gap-2">
            <span className="w-4 h-4 rounded-full" style={{ background: colors.primaryFact, border: `2px solid ${colors.hoverPrimary}` }} />
            <span>Primary Fact Table</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full" style={{ background: colors.secondaryFact }} />
            <span>Secondary Fact Tables</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: colors.dimension }} />
            <span>Dimension Tables</span>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="absolute bottom-4 left-4 flex flex-col gap-1">
        <button
          onClick={() => {
            const centerX = dimensions.width / 2;
            const centerY = dimensions.height / 2;
            setTransform(t => {
              const newScale = Math.min(t.scale * 1.3, 5);
              const scaleChange = newScale / t.scale;
              // Keep the center point fixed while zooming
              const newX = centerX - (centerX - t.x) * scaleChange;
              const newY = centerY - (centerY - t.y) * scaleChange;
              return { x: newX, y: newY, scale: newScale };
            });
          }}
          className="w-8 h-8 rounded transition-colors text-lg"
          style={{
            background: 'var(--theme-bg-elevated)',
            border: `1px solid var(--theme-border-strong)`,
            color: 'var(--theme-text-tertiary)',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--theme-bg-hover)'; e.currentTarget.style.color = 'var(--theme-text-primary)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--theme-bg-elevated)'; e.currentTarget.style.color = 'var(--theme-text-tertiary)'; }}
        >
          +
        </button>
        <button
          onClick={() => {
            const centerX = dimensions.width / 2;
            const centerY = dimensions.height / 2;
            setTransform(t => {
              const newScale = Math.max(t.scale * 0.7, 0.3);
              const scaleChange = newScale / t.scale;
              // Keep the center point fixed while zooming
              const newX = centerX - (centerX - t.x) * scaleChange;
              const newY = centerY - (centerY - t.y) * scaleChange;
              return { x: newX, y: newY, scale: newScale };
            });
          }}
          className="w-8 h-8 rounded transition-colors text-lg"
          style={{
            background: 'var(--theme-bg-elevated)',
            border: `1px solid var(--theme-border-strong)`,
            color: 'var(--theme-text-tertiary)',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--theme-bg-hover)'; e.currentTarget.style.color = 'var(--theme-text-primary)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--theme-bg-elevated)'; e.currentTarget.style.color = 'var(--theme-text-tertiary)'; }}
        >
          −
        </button>
        <button
          onClick={resetView}
          className="w-8 h-8 rounded transition-colors text-xs"
          style={{
            background: 'var(--theme-bg-elevated)',
            border: `1px solid var(--theme-border-strong)`,
            color: 'var(--theme-text-tertiary)',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--theme-bg-hover)'; e.currentTarget.style.color = 'var(--theme-text-primary)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--theme-bg-elevated)'; e.currentTarget.style.color = 'var(--theme-text-tertiary)'; }}
          title="Reset view"
        >
          ⟲
        </button>
      </div>

      {/* Hover tooltip for extra details */}
      {hoveredNode && (
        <div
          className="absolute bottom-4 right-4 rounded-lg px-3 py-2 backdrop-blur-sm"
          style={{
            background: colors.surfaceLegend,
            border: `1px solid ${colors.borderStrong}`,
          }}
        >
          <div className="text-sm font-medium" style={{ color: colors.textPrimary }}>
            {hoveredNode.label}
          </div>
          <div className="text-xs mt-0.5" style={{ color: colors.textMuted }}>
            {hoveredNode.columnCount} columns
          </div>
          <div className="text-[10px] mt-1.5 pt-1.5" style={{ color: colors.accentBlueText, borderTop: `1px solid ${colors.borderStrong}` }}>
            {hoveredNode.role === 'primaryFact'
              ? 'Click to view lineage'
              : 'Drag to reposition \u2022 Click to view lineage'
            }
          </div>
        </div>
      )}
      </>
      )}
    </div>
  );
};
