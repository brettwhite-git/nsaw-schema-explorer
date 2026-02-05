/**
 * LineageNode - Custom React Flow node component for NSAW Schema Explorer
 *
 * A flexible node component that renders differently based on nodeType:
 * - presentationColumn: Blue accent, shows column name and presentation table
 * - physicalTable: Purple accent, shows table name, column count, NSAW badge
 * - physicalColumn: Orange accent, shows column name in monospace
 */

import React, { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { LineageNodeData } from '../../utils/graphLayout';
import { Columns, Database, Table2, Cloud, Zap } from 'lucide-react';

// ======================
// Node Style Constants
// ======================

// Node styles using layer-based semantic colors:
// NetSuite Source (blue) → DW Physical (purple) → Semantic/Presentation (green)
const NODE_STYLES = {
  netsuiteSource: {
    borderColor: 'var(--theme-layer-netsuite-border-half)',
    borderColorSelected: 'var(--theme-layer-netsuite-border)',
    accentColor: 'var(--theme-layer-netsuite)',
    ringColor: 'var(--theme-layer-netsuite-ring)',
    iconColor: 'var(--theme-layer-netsuite-text)',
  },
  physicalTable: {
    borderColor: 'var(--theme-layer-dw-border-half)',
    borderColorSelected: 'var(--theme-layer-dw-border)',
    accentColor: 'var(--theme-layer-dw)',
    ringColor: 'var(--theme-layer-dw-ring)',
    iconColor: 'var(--theme-layer-dw-text)',
  },
  physicalColumn: {
    borderColor: 'var(--theme-layer-dw-border-half)',
    borderColorSelected: 'var(--theme-layer-dw-border)',
    accentColor: 'var(--theme-layer-dw-dark)',
    ringColor: 'var(--theme-layer-dw-ring)',
    iconColor: 'var(--theme-layer-dw-text)',
  },
  presentationColumn: {
    borderColor: 'var(--theme-layer-semantic-border-half)',
    borderColorSelected: 'var(--theme-layer-semantic-border)',
    accentColor: 'var(--theme-layer-semantic)',
    ringColor: 'var(--theme-layer-semantic-ring)',
    iconColor: 'var(--theme-layer-semantic-text)',
  },
  derivedColumn: {
    borderColor: 'var(--theme-layer-derived-border-half)',
    borderColorSelected: 'var(--theme-layer-derived-border)',
    accentColor: 'var(--theme-layer-derived)',
    ringColor: 'var(--theme-layer-derived-ring)',
    iconColor: 'var(--theme-layer-derived-text)',
  },
};

// ======================
// LineageNode Component
// ======================

const LineageNode: React.FC<NodeProps<LineageNodeData>> = ({ data, selected }) => {
  const { label, sublabel, nodeType, isNsawGenerated, inferredSource, columnCount, isSelected, isHovered } = data;
  const styles = NODE_STYLES[nodeType];

  // Use either React Flow's selected state or our custom isSelected from data
  const isHighlighted = selected || isSelected;

  // Determine icon based on node type
  const NodeIcon = nodeType === 'netsuiteSource'
    ? Cloud
    : nodeType === 'physicalTable'
      ? Database
      : nodeType === 'physicalColumn'
        ? Table2
        : nodeType === 'derivedColumn'
          ? Zap
          : Columns;

  return (
    <div
      className={`
        relative w-[280px] min-h-[80px]
        backdrop-blur-sm
        rounded-lg border-2 transition-all duration-150 cursor-pointer
      `}
      style={{
        backgroundColor: 'var(--theme-surface-card)',
        borderColor: isHighlighted
          ? styles.borderColorSelected
          : isHovered
            ? styles.borderColorSelected
            : styles.borderColor,
        boxShadow: isHighlighted
          ? `0 0 0 2px ${styles.ringColor}`
          : isHovered
            ? `0 0 0 1px ${styles.ringColor}`
            : undefined,
      }}
    >
      {/* Left accent stripe */}
      <div
        className="absolute left-0 top-0 bottom-0 w-1 rounded-l-md"
        style={{ backgroundColor: styles.accentColor }}
      />

      {/* Content */}
      <div className="pl-4 pr-3 py-3">
        {/* Header row with icon */}
        <div className="flex items-start gap-2">
          <NodeIcon
            className="w-4 h-4 mt-0.5 flex-shrink-0"
            style={{ color: styles.iconColor }}
          />
          <div className="flex-1 min-w-0">
            {/* Label */}
            <div
              className={`
                text-sm font-medium leading-tight
                ${nodeType === 'physicalColumn' ? 'font-mono text-xs' : ''}
                ${nodeType === 'physicalTable' ? 'truncate' : 'line-clamp-2'}
              `}
              style={{ color: 'var(--theme-text-default)' }}
              title={label}
            >
              {label}
            </div>

            {/* Sublabel */}
            {sublabel && (
              <div
                className="text-[10px] mt-0.5 truncate"
                style={{ color: 'var(--theme-text-tertiary)' }}
                title={sublabel}
              >
                {sublabel}
              </div>
            )}
          </div>
        </div>

        {/* Physical Table specific content */}
        {nodeType === 'physicalTable' && (
          <div className="mt-2 flex items-center gap-2 flex-wrap">
            {/* Table type badge (Fact/Dimension/Hierarchy) */}
            {data.tableType && (
              <span
                className="text-[10px] px-1.5 py-0.5 rounded font-semibold uppercase tracking-wider"
                style={{
                  color: data.tableType === 'fact' ? 'var(--theme-accent-amber-text)' : 'var(--theme-layer-dw-text)',
                  backgroundColor: data.tableType === 'fact' ? 'var(--theme-accent-amber-bg)' : 'var(--theme-layer-dw-bg)',
                  border: `1px solid ${data.tableType === 'fact' ? 'var(--theme-accent-amber-border)' : 'var(--theme-layer-dw-border)'}`,
                }}
              >
                {data.tableType === 'fact' ? 'FACT' :
                 data.tableType === 'dimension' ? 'DIMENSION' :
                 data.tableType === 'hierarchy' ? 'HIERARCHY' : 'TABLE'}
              </span>
            )}

            {/* Column count badge */}
            {columnCount !== undefined && (
              <span
                className="text-[10px] px-1.5 py-0.5 rounded"
                style={{
                  color: 'var(--theme-text-muted)',
                  backgroundColor: 'var(--theme-bg-inset)',
                }}
              >
                {columnCount} columns
              </span>
            )}

            {/* NSAW Generated badge */}
            {isNsawGenerated && (
              <span
                className="text-[10px] font-medium uppercase"
                style={{ color: 'var(--theme-accent-amber-text)' }}
              >
                NSAW
              </span>
            )}
          </div>
        )}

        {/* Physical Column - show inferred field name */}
        {nodeType === 'physicalColumn' && inferredSource?.fieldName && !isNsawGenerated && (
          <div
            className="mt-1 text-[10px] truncate"
            style={{ color: 'var(--theme-accent-emerald-text)' }}
            title={inferredSource.fieldName}
          >
            {inferredSource.fieldName}
          </div>
        )}
      </div>

      {/* Handle connectors */}
      <Handle
        type="target"
        position={Position.Left}
        className="!w-2 !h-2"
        style={{
          backgroundColor: 'var(--theme-text-muted)',
          borderColor: 'var(--theme-text-faint)',
        }}
      />
      <Handle
        type="source"
        position={Position.Right}
        className="!w-2 !h-2"
        style={{
          backgroundColor: 'var(--theme-text-muted)',
          borderColor: 'var(--theme-text-faint)',
        }}
      />
    </div>
  );
};

// Memoize for performance
export default memo(LineageNode);

// ======================
// Node Types Export
// ======================

/**
 * Export nodeTypes object for React Flow
 * Usage: <ReactFlow nodeTypes={lineageNodeTypes} />
 */
export const lineageNodeTypes = {
  lineageNode: memo(LineageNode),
};
