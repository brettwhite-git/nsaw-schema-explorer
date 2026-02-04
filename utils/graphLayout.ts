/**
 * Graph Layout Utility for NSAW Schema Explorer
 *
 * Transforms EnrichedLineageRecord[] into React Flow nodes and edges
 * using dagre for automatic layout positioning.
 */

import { Node, Edge } from 'reactflow';
import dagre from 'dagre';
import { EnrichedLineageRecord, InferredSource } from '../types';

// ======================
// Type Definitions
// ======================

export type LineageNodeType = 'presentationColumn' | 'physicalTable' | 'physicalColumn';

export interface LineageNodeData {
  label: string;
  sublabel?: string;
  nodeType: LineageNodeType;
  record?: EnrichedLineageRecord;
  records?: EnrichedLineageRecord[];  // For grouped nodes (physical tables)
  isNsawGenerated?: boolean;
  inferredSource?: InferredSource;
  columnCount?: number;  // Number of columns for physical tables
  isSelected?: boolean;  // Whether this node is currently selected
}

export type LineageNode = Node<LineageNodeData>;
export type LineageEdge = Edge;

export interface GraphLayout {
  nodes: LineageNode[];
  edges: LineageEdge[];
}

// ======================
// Layout Configuration
// ======================

const LAYOUT_CONFIG = {
  rankdir: 'LR' as const,    // Left to right layout
  nodesep: 40,               // Vertical separation between nodes
  ranksep: 180,              // Horizontal separation between columns
  nodeWidth: 280,            // Fixed node width (matches LineageNode w-[280px])
  nodeHeight: 80,            // Fixed node height (matches LineageNode min-h-[80px])
};

// ======================
// Node ID Generators
// ======================

/**
 * Generate unique ID for presentation column node
 */
export function getPresentationColumnId(presentationColumn: string): string {
  return `pres-col-${presentationColumn.replace(/\s+/g, '-').toLowerCase()}`;
}

/**
 * Generate unique ID for physical table node
 */
export function getPhysicalTableId(physicalTable: string): string {
  return `phys-table-${physicalTable}`;
}

/**
 * Generate unique ID for physical column node
 */
export function getPhysicalColumnId(physicalTable: string, physicalColumn: string): string {
  return `phys-col-${physicalTable}-${physicalColumn}`;
}

// ======================
// Main Transformer Function
// ======================

/**
 * Transform lineage records into React Flow nodes and edges
 *
 * Creates a 3-column layout:
 * - Column 1 (left): Presentation columns
 * - Column 2 (center): Physical tables (grouped)
 * - Column 3 (right): Physical columns (optional, when detailed view needed)
 *
 * @param records - Array of EnrichedLineageRecord from selected presentation table
 * @param includePhysicalColumns - Whether to show individual physical columns (default: false)
 * @returns GraphLayout with positioned nodes and styled edges
 */
export function transformRecordsToGraph(
  records: EnrichedLineageRecord[],
  includePhysicalColumns: boolean = false
): GraphLayout {
  if (!records || records.length === 0) {
    return { nodes: [], edges: [] };
  }

  // Track unique entities
  const presentationColumns = new Map<string, EnrichedLineageRecord[]>();
  const physicalTables = new Map<string, EnrichedLineageRecord[]>();
  const physicalColumns = new Map<string, EnrichedLineageRecord>();

  // Group records by presentation column and physical table
  for (const record of records) {
    // Group by presentation column
    const presColKey = record.presentationColumn;
    if (!presentationColumns.has(presColKey)) {
      presentationColumns.set(presColKey, []);
    }
    presentationColumns.get(presColKey)!.push(record);

    // Group by physical table
    const physTableKey = record.physicalTable;
    if (!physicalTables.has(physTableKey)) {
      physicalTables.set(physTableKey, []);
    }
    physicalTables.get(physTableKey)!.push(record);

    // Track physical columns (if needed)
    if (includePhysicalColumns) {
      const physColKey = `${record.physicalTable}-${record.physicalColumn}`;
      physicalColumns.set(physColKey, record);
    }
  }

  // Create dagre graph
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  dagreGraph.setGraph({
    rankdir: LAYOUT_CONFIG.rankdir,
    nodesep: LAYOUT_CONFIG.nodesep,
    ranksep: LAYOUT_CONFIG.ranksep,
  });

  // Create nodes and add to dagre
  const nodes: LineageNode[] = [];
  const edges: LineageEdge[] = [];
  const edgeSet = new Set<string>();  // Prevent duplicate edges

  // 1. Create presentation column nodes
  for (const [presCol, presRecords] of presentationColumns) {
    const nodeId = getPresentationColumnId(presCol);
    const firstRecord = presRecords[0];

    // Add to dagre with dimensions
    dagreGraph.setNode(nodeId, {
      width: LAYOUT_CONFIG.nodeWidth,
      height: LAYOUT_CONFIG.nodeHeight,
    });

    // Create React Flow node
    nodes.push({
      id: nodeId,
      type: 'default',
      position: { x: 0, y: 0 },  // Will be set by dagre
      data: {
        label: presCol,
        sublabel: firstRecord.presentationTable,
        nodeType: 'presentationColumn',
        record: firstRecord,
        records: presRecords,
      },
    });
  }

  // 2. Create physical table nodes
  for (const [physTable, tableRecords] of physicalTables) {
    const nodeId = getPhysicalTableId(physTable);
    const firstRecord = tableRecords[0];
    const uniqueColumns = new Set(tableRecords.map(r => r.physicalColumn));

    // Add to dagre with dimensions (same as presentation columns for consistency)
    dagreGraph.setNode(nodeId, {
      width: LAYOUT_CONFIG.nodeWidth,
      height: LAYOUT_CONFIG.nodeHeight,
    });

    // Create React Flow node
    nodes.push({
      id: nodeId,
      type: 'default',
      position: { x: 0, y: 0 },  // Will be set by dagre
      data: {
        label: physTable,
        sublabel: firstRecord.inferredSource.recordType
          ? `NetSuite: ${firstRecord.inferredSource.recordType}`
          : undefined,
        nodeType: 'physicalTable',
        records: tableRecords,
        isNsawGenerated: firstRecord.inferredSource.isNsawGenerated,
        inferredSource: firstRecord.inferredSource,
        columnCount: uniqueColumns.size,
      },
    });

    // Create edges from presentation columns to this physical table
    for (const record of tableRecords) {
      const sourceId = getPresentationColumnId(record.presentationColumn);
      const edgeKey = `${sourceId}-${nodeId}`;

      if (!edgeSet.has(edgeKey)) {
        edgeSet.add(edgeKey);
        dagreGraph.setEdge(sourceId, nodeId);

        edges.push({
          id: `edge-${edgeKey}`,
          source: sourceId,
          target: nodeId,
          type: 'smoothstep',
          animated: false,
          style: { stroke: 'var(--theme-rf-edge-primary)', strokeWidth: 2 },
        });
      }
    }
  }

  // 3. Create physical column nodes (if enabled)
  if (includePhysicalColumns) {
    for (const [physColKey, record] of physicalColumns) {
      const nodeId = getPhysicalColumnId(record.physicalTable, record.physicalColumn);
      const parentTableId = getPhysicalTableId(record.physicalTable);

      // Add to dagre with dimensions
      dagreGraph.setNode(nodeId, {
        width: LAYOUT_CONFIG.nodeWidth,
        height: LAYOUT_CONFIG.nodeHeight,
      });

      // Create React Flow node
      nodes.push({
        id: nodeId,
        type: 'default',
        position: { x: 0, y: 0 },  // Will be set by dagre
        data: {
          label: record.physicalColumn,
          sublabel: record.inferredSource.fieldName
            ? `NS Field: ${record.inferredSource.fieldName}`
            : undefined,
          nodeType: 'physicalColumn',
          record: record,
          isNsawGenerated: record.inferredSource.isNsawGenerated,
          inferredSource: record.inferredSource,
        },
      });

      // Create edge from physical table to physical column
      const edgeKey = `${parentTableId}-${nodeId}`;
      if (!edgeSet.has(edgeKey)) {
        edgeSet.add(edgeKey);
        dagreGraph.setEdge(parentTableId, nodeId);

        edges.push({
          id: `edge-${edgeKey}`,
          source: parentTableId,
          target: nodeId,
          type: 'smoothstep',
          animated: false,
          style: { stroke: 'var(--theme-rf-edge)', strokeWidth: 1.5 },
        });
      }
    }
  }

  // Run dagre layout algorithm
  dagre.layout(dagreGraph);

  // Apply dagre positions to React Flow nodes
  for (const node of nodes) {
    const dagreNode = dagreGraph.node(node.id);
    if (dagreNode) {
      // Dagre gives center coordinates, React Flow needs top-left
      node.position = {
        x: dagreNode.x - dagreNode.width / 2,
        y: dagreNode.y - dagreNode.height / 2,
      };
    }
  }

  return { nodes, edges };
}

// ======================
// Utility Functions
// ======================

/**
 * Get edge color based on source node type
 */
export function getEdgeColor(sourceType: LineageNodeType): string {
  switch (sourceType) {
    case 'presentationColumn':
      return 'var(--theme-accent-blue)';
    case 'physicalTable':
      return 'var(--theme-rf-edge-primary)';
    case 'physicalColumn':
      return 'var(--theme-rf-edge)';
    default:
      return 'var(--theme-rf-edge-primary)';
  }
}

/**
 * Get node background color based on type
 */
export function getNodeColor(nodeType: LineageNodeType, isNsawGenerated?: boolean): string {
  if (isNsawGenerated) {
    return 'var(--theme-bg-elevated)';
  }

  switch (nodeType) {
    case 'presentationColumn':
      return 'var(--theme-accent-blue-dark)';
    case 'physicalTable':
      return 'var(--theme-accent-emerald)';
    case 'physicalColumn':
      return 'var(--theme-accent-cyan-dark)';
    default:
      return 'var(--theme-border-strong)';
  }
}

/**
 * Get node border color based on type
 */
export function getNodeBorderColor(nodeType: LineageNodeType, isNsawGenerated?: boolean): string {
  if (isNsawGenerated) {
    return 'var(--theme-text-faint)';
  }

  switch (nodeType) {
    case 'presentationColumn':
      return 'var(--theme-accent-blue)';
    case 'physicalTable':
      return 'var(--theme-accent-emerald)';
    case 'physicalColumn':
      return 'var(--theme-accent-cyan)';
    default:
      return 'var(--theme-text-muted)';
  }
}

/**
 * Transform records for a detailed 3-column view
 * Shows presentation columns -> physical tables -> physical columns
 */
export function transformRecordsToDetailedGraph(
  records: EnrichedLineageRecord[]
): GraphLayout {
  return transformRecordsToGraph(records, true);
}
