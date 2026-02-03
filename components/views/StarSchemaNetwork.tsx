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
  forceCenter,
  forceRadial,
  SimulationNodeDatum,
  SimulationLinkDatum,
} from 'd3-force';
import { drag } from 'd3-drag';
import { select } from 'd3-selection';
import { useData } from '../../data/DataContext';
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

  // Colors - matching app's dark theme (purple facts, blue dimensions)
  PRIMARY_FACT_COLOR: '#a855f7',    // Purple-500 (matches physicalTable)
  SECONDARY_FACT_COLOR: '#7c3aed',  // Violet-600
  DIMENSION_COLOR: '#3b82f6',       // Blue-500 (matches presentationColumn)
  EDGE_COLOR: '#475569',            // Slate-600
  TEXT_COLOR: '#e2e8f0',            // Slate-200 (light text for dark bg)
  TEXT_COLOR_LIGHT: '#f8fafc',      // Slate-50

  // Force parameters - pushed out for better text visibility
  LINK_DISTANCE: 180,
  CHARGE_STRENGTH: -120,
  COLLISION_PADDING: 20,  // Increased for better label spacing
  RADIAL_STRENGTH: 0.05,
  CENTER_STRENGTH: 0.015,

  // Radial distances - pushed out more
  SECONDARY_RING: 180,
  DIMENSION_RING: 420,

  // Animation - smooth and gentle
  ALPHA_START: 0.4,
  ALPHA_DECAY: 0.008,
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
  return tableCore.includes(subjectAreaKey) || subjectAreaKey.includes(tableCore);
}

function cleanLabel(tableName: string): string {
  return tableName
    .replace(/^DW_NS_/, '')
    .replace(/_F$|_EF$|_D$|_DH$|_G$|_CF_DH$|_LINES_F$|_LINES_EF$/, '');
}

// Truncate label for display
function truncateLabel(label: string, maxLen: number): string {
  if (label.length <= maxLen) return label;
  return label.substring(0, maxLen - 1) + '…';
}

// Calculate bounding box of all nodes (accounting for node radius AND text labels)
function calculateBounds(nodes: NetworkNode[]) {
  if (nodes.length === 0) return null;

  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;

  for (const node of nodes) {
    if (node.x === undefined || node.y === undefined) continue;

    // Estimate text label width based on label length (roughly 6px per character)
    const labelWidth = (node.label?.length || 0) * 6;
    const halfLabelWidth = labelWidth / 2;

    // Text labels are positioned above dimension nodes (small nodes)
    // Add extra space above for labels: radius + gap(4px) + fontSize(~12px)
    const labelHeightAbove = node.role === 'dimension' ? 20 : 0;

    // Account for node radius + label extension
    minX = Math.min(minX, node.x - Math.max(node.radius, halfLabelWidth));
    maxX = Math.max(maxX, node.x + Math.max(node.radius, halfLabelWidth));
    minY = Math.min(minY, node.y - node.radius - labelHeightAbove);
    maxY = Math.max(maxY, node.y + node.radius);
  }

  if (minX === Infinity) return null;

  return {
    minX, maxX, minY, maxY,
    width: maxX - minX,
    height: maxY - minY,
    centerX: (minX + maxX) / 2,
    centerY: (minY + maxY) / 2,
  };
}

// Calculate transform to fit content within viewport with asymmetric padding
function calculateFitTransform(
  bounds: NonNullable<ReturnType<typeof calculateBounds>>,
  viewportWidth: number,
  viewportHeight: number
) {
  // Asymmetric padding: more on right (legend ~180px), less on left (controls ~50px)
  // More at top (header area ~20px), less at bottom
  const paddingLeft = 50;
  const paddingRight = 60;  // Legend is positioned inside viewport, so less padding needed
  const paddingTop = 30;
  const paddingBottom = 50;

  const availableWidth = viewportWidth - paddingLeft - paddingRight;
  const availableHeight = viewportHeight - paddingTop - paddingBottom;

  // Calculate scale to fit content (cap at 1.2 for reasonable zoom)
  const scaleX = availableWidth / bounds.width;
  const scaleY = availableHeight / bounds.height;
  const scale = Math.min(scaleX, scaleY, 1.2);

  // Calculate center of available area (shifted slightly left and down due to asymmetric padding)
  const availableCenterX = paddingLeft + availableWidth / 2;
  const availableCenterY = paddingTop + availableHeight / 2;

  // Calculate translation to center content in available area
  const tx = availableCenterX - (bounds.centerX * scale);
  const ty = availableCenterY - (bounds.centerY * scale);

  return { x: tx, y: ty, scale };
}

// ======================
// Main Component
// ======================

export const StarSchemaNetwork: React.FC = () => {
  const { dataIndex, selection, selectPresentationTable, setViewMode } = useData();
  const containerRef = useRef<HTMLDivElement>(null);
  const simulationRef = useRef<ReturnType<typeof forceSimulation<NetworkNode>> | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const [dimensions, setDimensions] = useState({ width: 1000, height: 700 });
  const [nodes, setNodes] = useState<NetworkNode[]>([]);
  const [links, setLinks] = useState<NetworkLink[]>([]);
  const [hoveredNode, setHoveredNode] = useState<NetworkNode | null>(null);
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [draggingNode, setDraggingNode] = useState<string | null>(null);

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
      // Fit to bounds when returning to star schema
      const bounds = calculateBounds(nodes);
      if (bounds) {
        const fitTransform = calculateFitTransform(bounds, dimensions.width, dimensions.height);
        setTransform(fitTransform);
      }
    }
  }, [selection.presentationTable, dimensions.width, dimensions.height]);
  // Note: Don't include nodes in deps to avoid re-triggering on every simulation tick

  // Build network data
  const { initialNodes, initialLinks, stats } = useMemo(() => {
    if (!dataIndex || !selection.subjectArea) {
      return { initialNodes: [], initialLinks: [], stats: { primary: '', secondaryCount: 0, dimCount: 0 } };
    }

    const records = dataIndex.bySubjectArea.get(selection.subjectArea) || [];
    if (records.length === 0) {
      return { initialNodes: [], initialLinks: [], stats: { primary: '', secondaryCount: 0, dimCount: 0 } };
    }

    const subjectAreaKey = extractSubjectAreaKey(selection.subjectArea);
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

    // Build nodes
    const networkNodes: NetworkNode[] = [];
    const networkLinks: NetworkLink[] = [];

    // Primary fact at center
    if (primaryFact) {
      const info = tableInfo.get(primaryFact)!;
      networkNodes.push({
        id: primaryFact,
        label: cleanLabel(primaryFact),
        role: 'primaryFact',
        columnCount: info.columns.size,
        radius: CONFIG.PRIMARY_FACT_RADIUS,
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
      const radius = CONFIG.SECONDARY_RING + (Math.random() - 0.5) * 30;
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
      const radius = CONFIG.DIMENSION_RING + (Math.random() - 0.5) * 40;
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
    };
  }, [dataIndex, selection.subjectArea, dimensions]);

  // Run force simulation - compute layout synchronously to avoid visual glitch
  useEffect(() => {
    if (initialNodes.length === 0) {
      setNodes([]);
      setLinks([]);
      return;
    }

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
        .distanceMax(500)
      )
      .force('collide', forceCollide<NetworkNode>()
        .radius(d => d.radius + CONFIG.COLLISION_PADDING)
        .strength(0.8)
      )
      .force('center', forceCenter<NetworkNode>(centerX, centerY)
        .strength(CONFIG.CENTER_STRENGTH)
      )
      .force('radial', forceRadial<NetworkNode>(
        d => d.role === 'dimension' ? CONFIG.DIMENSION_RING : d.role === 'secondaryFact' ? CONFIG.SECONDARY_RING : 0,
        centerX,
        centerY
      ).strength(CONFIG.RADIAL_STRENGTH))
      .alpha(CONFIG.ALPHA_START)
      .alphaDecay(CONFIG.ALPHA_DECAY)
      .velocityDecay(CONFIG.VELOCITY_DECAY)
      .stop();  // Don't auto-start - we'll run it manually

    // Run simulation synchronously to compute final positions (no animation)
    // This prevents the visual glitch where diagram zooms in after rendering
    const iterations = 300;  // Enough iterations for simulation to converge
    for (let i = 0; i < iterations; i++) {
      simulation.tick();
    }

    // Now nodes have their final positions - set state and transform once
    setNodes([...simNodes]);
    setLinks([...simLinks]);

    // Calculate fit-to-bounds based on FINAL converged positions
    const bounds = calculateBounds(simNodes);
    if (bounds) {
      const fitTransform = calculateFitTransform(bounds, dimensions.width, dimensions.height);
      setTransform(fitTransform);
    }

    // Keep simulation reference for drag interactions
    simulationRef.current = simulation;

    // Re-enable simulation for interactive dragging (but alpha is already 0)
    simulation.on('tick', () => {
      setNodes([...simNodes]);
      setLinks([...simLinks]);
    });

    return () => {
      simulation.stop();
    };
  }, [initialNodes, initialLinks, dimensions]);

  // Pan handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 0 && !hoveredNode) {
      setIsPanning(true);
      setPanStart({ x: e.clientX - transform.x, y: e.clientY - transform.y });
    }
  }, [transform, hoveredNode]);

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
  }, []);

  const resetView = useCallback(() => {
    // Calculate fit-to-bounds transform based on current node positions
    const bounds = calculateBounds(nodes);
    if (bounds) {
      const fitTransform = calculateFitTransform(bounds, dimensions.width, dimensions.height);
      setTransform(fitTransform);
    }
  }, [nodes, dimensions.width, dimensions.height]);

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
      simulationRef.current.alphaTarget(0);
    }
    // Release fixed position (node will drift back with physics)
    // To keep it pinned, remove these two lines:
    node.fx = null;
    node.fy = null;
  }, []);

  if (nodes.length === 0 && initialNodes.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-slate-500">
        <p className="text-lg">No physical tables found</p>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="flex-1 w-full h-full relative overflow-hidden bg-slate-950" style={{ backgroundImage: 'radial-gradient(circle, #334155 1px, transparent 1px)', backgroundSize: '20px 20px' }}>
      <svg
        width={dimensions.width}
        height={dimensions.height}
        className={isPanning ? 'cursor-grabbing' : 'cursor-grab'}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}
      >
        <g transform={`translate(${transform.x}, ${transform.y}) scale(${transform.scale})`}>
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
                  stroke={CONFIG.EDGE_COLOR}
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

              // Color based on role
              let fill = CONFIG.DIMENSION_COLOR;
              if (isPrimary) fill = CONFIG.PRIMARY_FACT_COLOR;
              else if (node.role === 'secondaryFact') fill = CONFIG.SECONDARY_FACT_COLOR;

              // Hover/drag brightening (lighter variants for dark theme)
              if (isHovered || isDragging) {
                fill = isPrimary ? '#c084fc' : node.role === 'secondaryFact' ? '#a78bfa' : '#60a5fa';
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
                    stroke={isHovered || isDragging ? '#60a5fa' : 'none'}
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
                      fill={CONFIG.TEXT_COLOR_LIGHT}
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
                      fill={CONFIG.TEXT_COLOR}
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
      <div className="absolute top-4 right-4 z-10 bg-slate-900/90 backdrop-blur-sm rounded-lg border border-slate-700 p-3">
        <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-2 font-medium">Legend</div>
        <div className="flex flex-col gap-2 text-xs text-slate-300">
          <div className="flex items-center gap-2">
            <span className="w-4 h-4 rounded-full bg-purple-600 border-2 border-purple-400" />
            <span>Primary Fact Table</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-violet-500" />
            <span>Secondary Fact Tables</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-400" />
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
          className="w-8 h-8 bg-slate-800 border border-slate-700 rounded text-slate-400 hover:bg-slate-700 hover:text-white transition-colors text-lg"
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
          className="w-8 h-8 bg-slate-800 border border-slate-700 rounded text-slate-400 hover:bg-slate-700 hover:text-white transition-colors text-lg"
        >
          −
        </button>
        <button
          onClick={resetView}
          className="w-8 h-8 bg-slate-800 border border-slate-700 rounded text-slate-400 hover:bg-slate-700 hover:text-white transition-colors text-xs"
          title="Reset view"
        >
          ⟲
        </button>
      </div>

      {/* Hover tooltip for extra details */}
      {hoveredNode && (
        <div className="absolute bottom-4 right-4 bg-slate-900/95 border border-slate-700 rounded-lg px-3 py-2 backdrop-blur-sm">
          <div className="text-sm font-medium text-white">
            {hoveredNode.label}
          </div>
          <div className="text-xs text-slate-400 mt-0.5">
            {hoveredNode.columnCount} columns
          </div>
          <div className="text-[10px] text-blue-400 mt-1.5 pt-1.5 border-t border-slate-700">
            {hoveredNode.role === 'primaryFact'
              ? 'Click to view lineage'
              : 'Drag to reposition • Click to view lineage'
            }
          </div>
        </div>
      )}
    </div>
  );
};
