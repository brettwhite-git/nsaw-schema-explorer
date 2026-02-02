/**
 * Radial Layout Utility for Star Schema Visualization
 *
 * Uses deterministic radial positioning to place fact tables at center
 * with dimension tables arranged in a clean circular pattern around them.
 *
 * This is NOT a force simulation - it's explicit geometric placement
 * for a predictable, elegant star schema visualization.
 */

import { Node, Edge } from 'reactflow';
import { PhysicalTableType } from '../types';

// ======================
// Type Definitions
// ======================

export type StarNodeRole = 'primaryFact' | 'secondaryFact' | 'dimension';

export type DimensionGroup =
  | 'entity'
  | 'item'
  | 'org'
  | 'calendar'
  | 'hierarchy'
  | 'global'
  | 'other';

export interface StarSchemaNodeData {
  label: string;
  sublabel?: string;
  nodeType: 'physicalTable' | 'presentationColumn';
  tableName: string;
  tableType: PhysicalTableType;
  role: StarNodeRole;
  group: DimensionGroup;
  columnCount: number;
  isSelected?: boolean;
}

export interface TableInfo {
  type: PhysicalTableType;
  columns: Set<string>;
  group: DimensionGroup;
}

export interface StarSchemaInput {
  primaryFact: string | null;
  secondaryFacts: string[];
  dimensionsByGroup: Map<DimensionGroup, string[]>;
  tableInfo: Map<string, TableInfo>;
}

export interface StarSchemaLayout {
  nodes: Node<StarSchemaNodeData>[];
  edges: Edge[];
  stats: {
    primaryFact: string;
    secondaryFactCount: number;
    dimensionCount: number;
  };
}

// ======================
// Layout Configuration
// ======================

const LAYOUT_CONFIG = {
  // Node dimensions
  NODE_WIDTH: 180,
  NODE_HEIGHT: 50,

  // Radial distances from center
  SECONDARY_FACT_RADIUS: 160,    // Inner ring for related facts
  DIMENSION_RADIUS: 420,         // Outer ring for dimensions

  // Minimum spacing between dimension nodes (arc length)
  MIN_DIMENSION_SPACING: 25,     // Degrees between dimension nodes
};

// Group ordering and colors for visual consistency
const GROUP_ORDER: DimensionGroup[] = [
  'entity',    // Top-right: customers, vendors, employees
  'item',      // Right: items, inventory
  'org',       // Bottom-right: subsidiary, department
  'calendar',  // Bottom: dates, fiscal periods
  'hierarchy', // Bottom-left: hierarchies
  'global',    // Left: global reference
  'other',     // Top-left: miscellaneous
];

// ======================
// Helper Functions
// ======================

/**
 * Clean table name for display
 */
function cleanLabel(tableName: string): string {
  return tableName
    .replace(/^DW_NS_/, '')
    .replace(/_F$|_EF$|_D$|_DH$|_G$|_CF_DH$|_LINES_F$|_LINES_EF$/, '');
}

/**
 * Convert degrees to radians
 */
function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/**
 * Calculate position on a circle
 */
function getCirclePosition(
  centerX: number,
  centerY: number,
  radius: number,
  angleDegrees: number
): { x: number; y: number } {
  const angleRadians = toRadians(angleDegrees - 90); // Start from top (12 o'clock)
  return {
    x: centerX + radius * Math.cos(angleRadians),
    y: centerY + radius * Math.sin(angleRadians),
  };
}

// ======================
// Main Layout Function
// ======================

/**
 * Calculate star schema positions using deterministic radial placement
 *
 * Layout structure:
 * - Primary fact: exact center
 * - Secondary facts: small inner ring
 * - Dimensions: large outer ring, grouped by category
 *
 * @param input - Categorized tables from subject area
 * @param centerX - Center X coordinate (default: 600)
 * @param centerY - Center Y coordinate (default: 450)
 * @returns Positioned nodes and edges for React Flow
 */
export function calculateStarSchemaLayout(
  input: StarSchemaInput,
  centerX: number = 600,
  centerY: number = 450
): StarSchemaLayout {
  const { primaryFact, secondaryFacts, dimensionsByGroup, tableInfo } = input;

  const nodes: Node<StarSchemaNodeData>[] = [];
  const edges: Edge[] = [];

  // Count total dimensions for angle calculation
  let totalDimensions = 0;
  for (const tables of dimensionsByGroup.values()) {
    totalDimensions += tables.length;
  }

  // ======================
  // 1. Place Primary Fact at Center
  // ======================
  if (primaryFact) {
    const info = tableInfo.get(primaryFact);
    nodes.push({
      id: `star-${primaryFact}`,
      type: 'lineageNode',
      position: {
        x: centerX - LAYOUT_CONFIG.NODE_WIDTH / 2,
        y: centerY - LAYOUT_CONFIG.NODE_HEIGHT / 2,
      },
      data: {
        label: cleanLabel(primaryFact),
        sublabel: `${info?.columns.size || 0} columns • Primary Fact`,
        nodeType: 'physicalTable',
        tableName: primaryFact,
        tableType: info?.type || 'fact',
        role: 'primaryFact',
        group: 'other',
        columnCount: info?.columns.size || 0,
        isSelected: false,
      },
    });
  }

  // ======================
  // 2. Place Secondary Facts in Inner Ring
  // ======================
  if (secondaryFacts.length > 0) {
    const secondaryAngleStep = 360 / secondaryFacts.length;

    secondaryFacts.forEach((table, index) => {
      const info = tableInfo.get(table);
      const angle = index * secondaryAngleStep;
      const pos = getCirclePosition(
        centerX,
        centerY,
        LAYOUT_CONFIG.SECONDARY_FACT_RADIUS,
        angle
      );

      nodes.push({
        id: `star-${table}`,
        type: 'lineageNode',
        position: {
          x: pos.x - LAYOUT_CONFIG.NODE_WIDTH / 2,
          y: pos.y - LAYOUT_CONFIG.NODE_HEIGHT / 2,
        },
        data: {
          label: cleanLabel(table),
          sublabel: `${info?.columns.size || 0} columns • Fact`,
          nodeType: 'physicalTable',
          tableName: table,
          tableType: info?.type || 'fact',
          role: 'secondaryFact',
          group: 'other',
          columnCount: info?.columns.size || 0,
          isSelected: false,
        },
      });

      // Connect to primary fact
      if (primaryFact) {
        edges.push({
          id: `edge-${primaryFact}-${table}`,
          source: `star-${primaryFact}`,
          target: `star-${table}`,
          type: 'straight',
          style: {
            stroke: '#a855f7',
            strokeWidth: 2,
            opacity: 0.7,
          },
        });
      }
    });
  }

  // ======================
  // 3. Place Dimensions in Outer Ring
  // ======================

  // Calculate angle allocation per dimension
  // Leave small gaps between groups for visual separation
  const groupGapDegrees = totalDimensions > 30 ? 5 : 10;
  const totalGapDegrees = groupGapDegrees * GROUP_ORDER.filter(
    g => (dimensionsByGroup.get(g)?.length || 0) > 0
  ).length;
  const availableDegrees = 360 - totalGapDegrees;
  const degreesPerDimension = Math.max(
    LAYOUT_CONFIG.MIN_DIMENSION_SPACING / 3,
    availableDegrees / Math.max(totalDimensions, 1)
  );

  let currentAngle = 0;

  for (const group of GROUP_ORDER) {
    const tables = dimensionsByGroup.get(group) || [];
    if (tables.length === 0) continue;

    // Sort tables alphabetically within group for consistency
    const sortedTables = [...tables].sort((a, b) =>
      cleanLabel(a).localeCompare(cleanLabel(b))
    );

    sortedTables.forEach((table) => {
      const info = tableInfo.get(table);
      const pos = getCirclePosition(
        centerX,
        centerY,
        LAYOUT_CONFIG.DIMENSION_RADIUS,
        currentAngle
      );

      nodes.push({
        id: `star-${table}`,
        type: 'lineageNode',
        position: {
          x: pos.x - LAYOUT_CONFIG.NODE_WIDTH / 2,
          y: pos.y - LAYOUT_CONFIG.NODE_HEIGHT / 2,
        },
        data: {
          label: cleanLabel(table),
          sublabel: `${info?.columns.size || 0} cols`,
          nodeType: 'presentationColumn', // Blue styling for dimensions
          tableName: table,
          tableType: info?.type || 'dimension',
          role: 'dimension',
          group,
          columnCount: info?.columns.size || 0,
          isSelected: false,
        },
      });

      // Connect to primary fact
      if (primaryFact) {
        edges.push({
          id: `edge-${primaryFact}-${table}`,
          source: `star-${primaryFact}`,
          target: `star-${table}`,
          type: 'straight',
          style: {
            stroke: '#3b82f6',
            strokeWidth: 1,
            opacity: 0.3,
          },
        });
      }

      currentAngle += degreesPerDimension;
    });

    // Add gap between groups
    currentAngle += groupGapDegrees;
  }

  return {
    nodes,
    edges,
    stats: {
      primaryFact: primaryFact ? cleanLabel(primaryFact) : 'None',
      secondaryFactCount: secondaryFacts.length,
      dimensionCount: totalDimensions,
    },
  };
}
