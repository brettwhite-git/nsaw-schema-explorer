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
import { Columns, Database, Table2 } from 'lucide-react';

// ======================
// Node Style Constants
// ======================

const NODE_STYLES = {
  presentationColumn: {
    borderColor: 'var(--theme-accent-blue-border-half)',
    borderColorSelected: 'var(--theme-accent-blue-border)',
    accentColor: 'var(--theme-accent-blue)',
    ringColor: 'var(--theme-accent-blue-ring)',
    iconColor: 'var(--theme-accent-blue-text)',
  },
  physicalTable: {
    borderColor: 'var(--theme-accent-purple-border-half)',
    borderColorSelected: 'var(--theme-accent-purple-border)',
    accentColor: 'var(--theme-accent-purple)',
    ringColor: 'var(--theme-accent-purple-ring)',
    iconColor: 'var(--theme-accent-purple-text)',
  },
  physicalColumn: {
    borderColor: 'var(--theme-accent-orange-border-half)',
    borderColorSelected: 'var(--theme-accent-orange-border)',
    accentColor: 'var(--theme-accent-orange)',
    ringColor: 'var(--theme-accent-orange-ring)',
    iconColor: 'var(--theme-accent-orange-text)',
  },
};

// ======================
// LineageNode Component
// ======================

const LineageNode: React.FC<NodeProps<LineageNodeData>> = ({ data, selected }) => {
  const { label, sublabel, nodeType, isNsawGenerated, inferredSource, columnCount, isSelected } = data;
  const styles = NODE_STYLES[nodeType];

  // Use either React Flow's selected state or our custom isSelected from data
  const isHighlighted = selected || isSelected;

  // Determine icon based on node type
  const NodeIcon = nodeType === 'presentationColumn'
    ? Columns
    : nodeType === 'physicalTable'
      ? Database
      : Table2;

  return (
    <div
      className={`
        relative w-[280px] min-h-[80px]
        backdrop-blur-sm
        rounded-lg border-2 transition-all duration-150 cursor-pointer
      `}
      style={{
        backgroundColor: 'var(--theme-surface-card)',
        borderColor: isHighlighted ? styles.borderColorSelected : styles.borderColor,
        boxShadow: isHighlighted ? `0 0 0 2px ${styles.ringColor}` : undefined,
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
