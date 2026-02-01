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
    borderColor: 'border-blue-500/50',
    borderColorSelected: 'border-blue-400',
    accentColor: 'bg-blue-500',
    ringColor: 'ring-blue-500/30',
    iconColor: 'text-blue-400',
  },
  physicalTable: {
    borderColor: 'border-purple-500/50',
    borderColorSelected: 'border-purple-400',
    accentColor: 'bg-purple-500',
    ringColor: 'ring-purple-500/30',
    iconColor: 'text-purple-400',
  },
  physicalColumn: {
    borderColor: 'border-orange-500/50',
    borderColorSelected: 'border-orange-400',
    accentColor: 'bg-orange-500',
    ringColor: 'ring-orange-500/30',
    iconColor: 'text-orange-400',
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
        bg-slate-800/80 backdrop-blur-sm
        rounded-lg border-2 transition-all duration-150 cursor-pointer
        ${isHighlighted
          ? `${styles.borderColorSelected} ring-2 ${styles.ringColor}`
          : `${styles.borderColor} hover:border-opacity-100`
        }
      `}
    >
      {/* Left accent stripe */}
      <div
        className={`
          absolute left-0 top-0 bottom-0 w-1
          ${styles.accentColor}
          rounded-l-md
        `}
      />

      {/* Content */}
      <div className="pl-4 pr-3 py-3">
        {/* Header row with icon */}
        <div className="flex items-start gap-2">
          <NodeIcon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${styles.iconColor}`} />
          <div className="flex-1 min-w-0">
            {/* Label */}
            <div
              className={`
                text-sm font-medium text-slate-100 leading-tight
                ${nodeType === 'physicalColumn' ? 'font-mono text-xs' : ''}
                ${nodeType === 'physicalTable' ? 'truncate' : 'line-clamp-2'}
              `}
              title={label}
            >
              {label}
            </div>

            {/* Sublabel */}
            {sublabel && (
              <div className="text-[10px] text-slate-400 mt-0.5 truncate" title={sublabel}>
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
              <span className="text-[10px] text-slate-500 bg-slate-700/50 px-1.5 py-0.5 rounded">
                {columnCount} columns
              </span>
            )}

            {/* NSAW Generated badge */}
            {isNsawGenerated && (
              <span className="text-[10px] text-amber-500 font-medium uppercase">
                NSAW
              </span>
            )}
          </div>
        )}

        {/* Physical Column - show inferred field name */}
        {nodeType === 'physicalColumn' && inferredSource?.fieldName && !isNsawGenerated && (
          <div className="mt-1 text-[10px] text-emerald-400 truncate" title={inferredSource.fieldName}>
            {inferredSource.fieldName}
          </div>
        )}
      </div>

      {/* Handle connectors */}
      <Handle
        type="target"
        position={Position.Left}
        className="!w-2 !h-2 !bg-slate-500 !border-slate-600"
      />
      <Handle
        type="source"
        position={Position.Right}
        className="!w-2 !h-2 !bg-slate-500 !border-slate-600"
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
