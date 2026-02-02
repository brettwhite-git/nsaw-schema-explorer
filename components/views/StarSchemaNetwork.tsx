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
  LINK_DISTANCE: 160,
  CHARGE_STRENGTH: -100,
  COLLISION_PADDING: 12,
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

// ======================
// Main Component
// ======================

export const StarSchemaNetwork: React.FC = () => {
  const { dataIndex, selection } = useData();
  const containerRef = useRef<HTMLDivElement>(null);
  const simulationRef = useRef<ReturnType<typeof forceSimulation<NetworkNode>> | null>(null);

  const [dimensions, setDimensions] = useState({ width: 1000, height: 700 });
  const [nodes, setNodes] = useState<NetworkNode[]>([]);
  const [links, setLinks] = useState<NetworkLink[]>([]);
  const [hoveredNode, setHoveredNode] = useState<NetworkNode | null>(null);
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

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

  // Run force simulation with gentle animation
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

    // Set initial state immediately so edges are visible
    setNodes([...simNodes]);
    setLinks([...simLinks]);

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
      .velocityDecay(CONFIG.VELOCITY_DECAY);

    simulationRef.current = simulation;

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
    const delta = e.deltaY > 0 ? 0.92 : 1.08;
    setTransform(t => ({
      ...t,
      scale: Math.min(Math.max(t.scale * delta, 0.3), 5),
    }));
  }, []);

  const resetView = useCallback(() => {
    setTransform({ x: 0, y: 0, scale: 1 });
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
              const isFact = node.role === 'primaryFact' || node.role === 'secondaryFact';
              const isPrimary = node.role === 'primaryFact';

              // Color based on role
              let fill = CONFIG.DIMENSION_COLOR;
              if (isPrimary) fill = CONFIG.PRIMARY_FACT_COLOR;
              else if (node.role === 'secondaryFact') fill = CONFIG.SECONDARY_FACT_COLOR;

              // Hover brightening (lighter variants for dark theme)
              if (isHovered) {
                fill = isPrimary ? '#c084fc' : node.role === 'secondaryFact' ? '#a78bfa' : '#60a5fa';
              }

              return (
                <g
                  key={node.id}
                  onMouseEnter={() => setHoveredNode(node)}
                  onMouseLeave={() => setHoveredNode(null)}
                  className="cursor-pointer"
                >
                  {/* Node circle */}
                  <circle
                    cx={node.x}
                    cy={node.y}
                    r={isHovered ? node.radius + 3 : node.radius}
                    fill={fill}
                    stroke={isHovered ? '#2c3e50' : 'none'}
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

      {/* Info overlay */}
      <div className="absolute top-4 left-4 bg-slate-900/95 border border-slate-700 rounded-lg px-4 py-3 backdrop-blur-sm">
        <div className="text-sm font-semibold text-white mb-2">Star Schema</div>
        <div className="space-y-1.5 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: CONFIG.PRIMARY_FACT_COLOR }} />
            <span className="text-purple-400 font-medium">{stats.primary}</span>
          </div>
          {stats.secondaryCount > 0 && (
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: CONFIG.SECONDARY_FACT_COLOR }} />
              <span className="text-slate-400">{stats.secondaryCount} related fact{stats.secondaryCount > 1 ? 's' : ''}</span>
            </div>
          )}
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: CONFIG.DIMENSION_COLOR }} />
            <span className="text-slate-400">{stats.dimCount} dimension{stats.dimCount !== 1 ? 's' : ''}</span>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="absolute bottom-4 left-4 flex flex-col gap-1">
        <button
          onClick={() => setTransform(t => ({ ...t, scale: Math.min(t.scale * 1.3, 5) }))}
          className="w-8 h-8 bg-slate-800 border border-slate-700 rounded text-slate-400 hover:bg-slate-700 hover:text-white transition-colors text-lg"
        >
          +
        </button>
        <button
          onClick={() => setTransform(t => ({ ...t, scale: Math.max(t.scale * 0.7, 0.3) }))}
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
        </div>
      )}
    </div>
  );
};
