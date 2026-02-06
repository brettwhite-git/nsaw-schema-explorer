/**
 * Graph Layout Utility for NSAW Schema Explorer
 *
 * Transforms EnrichedLineageRecord[] into React Flow nodes and edges
 * using dagre for automatic layout positioning.
 */

import { Node, Edge } from 'reactflow';
import dagre from 'dagre';
import { EnrichedLineageRecord, InferredSource, parsePhysicalTableType } from '../types';

// ======================
// Type Definitions
// ======================

export type LineageNodeType = 'netsuiteSource' | 'physicalTable' | 'physicalColumn' | 'presentationColumn' | 'derivedColumn';

export interface LineageNodeData {
  label: string;
  sublabel?: string;
  nodeType: LineageNodeType;
  record?: EnrichedLineageRecord;
  records?: EnrichedLineageRecord[];  // For grouped nodes (physical tables)
  isNsawGenerated?: boolean;
  inferredSource?: InferredSource;
  columnCount?: number;  // Number of columns for physical tables
  tableType?: 'fact' | 'dimension' | 'hierarchy' | 'other';  // For DW table badge display
  isDerived?: boolean;  // Whether this presentation column comes from NSAW-derived tables
  isSelected?: boolean;  // Whether this node is currently selected
  isHovered?: boolean;   // Whether this node is hovered or connected to hovered node
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
 * Generate unique ID for NetSuite source node (grouped by inferred record type)
 */
export function getNetSuiteSourceId(recordType: string): string {
  return `ns-source-${recordType.replace(/\s+/g, '-').toLowerCase()}`;
}

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
 * Creates a 3-column layout with correct data flow direction:
 * - Column 1 (left): NetSuite source records (inferred, grouped by record type)
 * - Column 2 (center): Physical DW tables
 * - Column 3 (right): Presentation/Semantic columns
 *
 * Flow direction: NetSuite Source → DW → Semantic (left to right)
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
  // NEW: Group by inferred NetSuite record type
  const nsSourcesByType = new Map<string, Set<string>>(); // recordType → Set of physicalTables
  const nsawGeneratedTables = new Set<string>(); // Tables that are NSAW-generated (no NS source)

  // Group records by presentation column, physical table, and inferred NS source
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

    // Group by inferred NS record type
    const recordType = record.inferredSource.recordType;
    if (record.inferredSource.isNsawGenerated) {
      nsawGeneratedTables.add(physTableKey);
    } else if (recordType) {
      if (!nsSourcesByType.has(recordType)) {
        nsSourcesByType.set(recordType, new Set());
      }
      nsSourcesByType.get(recordType)!.add(physTableKey);
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

  // 1. Create NetSuite source nodes (LEFT column)
  for (const [recordType, physTables] of nsSourcesByType) {
    const nodeId = getNetSuiteSourceId(recordType);

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
        label: recordType,
        sublabel: `${physTables.size} DW table${physTables.size > 1 ? 's' : ''}`,
        nodeType: 'netsuiteSource',
      },
    });
  }

  // 2. Create physical table nodes (CENTER column)
  for (const [physTable, tableRecords] of physicalTables) {
    const nodeId = getPhysicalTableId(physTable);
    const firstRecord = tableRecords[0];
    const uniqueColumns = new Set(tableRecords.map(r => r.physicalColumn));
    const recordType = firstRecord.inferredSource.recordType;

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
        label: physTable,
        sublabel: recordType
          ? `NetSuite: ${recordType}`
          : undefined,
        nodeType: 'physicalTable',
        records: tableRecords,
        isNsawGenerated: firstRecord.inferredSource.isNsawGenerated,
        inferredSource: firstRecord.inferredSource,
        columnCount: uniqueColumns.size,
        tableType: (() => {
          const pt = parsePhysicalTableType(physTable);
          if (pt === 'fact' || pt === 'enhanced') return 'fact' as const;
          if (pt === 'dimension') return 'dimension' as const;
          if (pt === 'hierarchy') return 'hierarchy' as const;
          return 'other' as const;
        })(),
      },
    });

    // Create edge from NetSuite source to physical table (if not NSAW-generated)
    if (recordType && !firstRecord.inferredSource.isNsawGenerated) {
      const sourceId = getNetSuiteSourceId(recordType);
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
          style: { stroke: 'var(--theme-layer-netsuite)', strokeWidth: 2 },
        });
      }
    }
  }

  // 3. Create presentation column nodes (RIGHT column)
  for (const [presCol, presRecords] of presentationColumns) {
    const nodeId = getPresentationColumnId(presCol);
    const firstRecord = presRecords[0];

    // Determine if this is a derived column (ALL its physical tables are NSAW-generated)
    const isDerived = presRecords.every(r => r.inferredSource.isNsawGenerated);

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
        nodeType: isDerived ? 'derivedColumn' : 'presentationColumn',
        isDerived,
        record: firstRecord,
        records: presRecords,
      },
    });

    // Create edges from physical tables/columns to presentation columns
    // Dimension tables route through physical columns; fact tables connect directly
    for (const record of presRecords) {
      let sourceId: string;
      if (includePhysicalColumns) {
        const tableType = parsePhysicalTableType(record.physicalTable);
        if (tableType === 'fact' || tableType === 'enhanced') {
          sourceId = getPhysicalTableId(record.physicalTable);
        } else {
          sourceId = getPhysicalColumnId(record.physicalTable, record.physicalColumn);
        }
      } else {
        sourceId = getPhysicalTableId(record.physicalTable);
      }
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
          style: { stroke: isDerived ? 'var(--theme-layer-derived)' : 'var(--theme-layer-dw)', strokeWidth: 2 },
        });
      }
    }
  }

  // 4. Create physical column nodes (if enabled) - these appear between DW tables and Presentation
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
          style: { stroke: 'var(--theme-layer-dw-dark)', strokeWidth: 1.5 },
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
 * Uses layer-based colors: NS (blue) → DW (purple) → Semantic (green)
 */
export function getEdgeColor(sourceType: LineageNodeType): string {
  switch (sourceType) {
    case 'netsuiteSource':
      return 'var(--theme-layer-netsuite)';
    case 'physicalTable':
    case 'physicalColumn':
      return 'var(--theme-layer-dw)';
    case 'presentationColumn':
      return 'var(--theme-layer-semantic)';
    case 'derivedColumn':
      return 'var(--theme-layer-derived)';
    default:
      return 'var(--theme-rf-edge-primary)';
  }
}

/**
 * Get node background color based on type
 * Uses layer-based colors: NS (blue) → DW (purple) → Semantic (green)
 */
export function getNodeColor(nodeType: LineageNodeType, isNsawGenerated?: boolean): string {
  if (isNsawGenerated) {
    return 'var(--theme-bg-elevated)';
  }

  switch (nodeType) {
    case 'netsuiteSource':
      return 'var(--theme-layer-netsuite-dark)';
    case 'physicalTable':
      return 'var(--theme-layer-dw-dark)';
    case 'physicalColumn':
      return 'var(--theme-layer-dw)';
    case 'presentationColumn':
      return 'var(--theme-layer-semantic-dark)';
    case 'derivedColumn':
      return 'var(--theme-layer-derived-bg)';
    default:
      return 'var(--theme-border-strong)';
  }
}

/**
 * Get node border color based on type
 * Uses layer-based colors: NS (blue) → DW (purple) → Semantic (green)
 */
export function getNodeBorderColor(nodeType: LineageNodeType, isNsawGenerated?: boolean): string {
  if (isNsawGenerated) {
    return 'var(--theme-text-faint)';
  }

  switch (nodeType) {
    case 'netsuiteSource':
      return 'var(--theme-layer-netsuite)';
    case 'physicalTable':
    case 'physicalColumn':
      return 'var(--theme-layer-dw)';
    case 'presentationColumn':
      return 'var(--theme-layer-semantic)';
    case 'derivedColumn':
      return 'var(--theme-layer-derived)';
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
