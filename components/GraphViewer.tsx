import React, { useMemo, useEffect, useCallback } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  Node,
  Edge,
  OnNodesChange,
  OnEdgesChange,
  ReactFlowProvider,
  useReactFlow,
} from 'reactflow';
import 'reactflow/dist/style.css';

import { useData } from '../data/DataContext';
import { Database } from 'lucide-react';
import { transformRecordsToDetailedGraph, LineageNodeData } from '../utils/graphLayout';
import { lineageNodeTypes } from './nodes/LineageNode';
import { TableView } from './views/TableView';
import { SubjectAreaNetworkView } from './views/SubjectAreaNetworkView';
import { DataStackHero } from './views/DataStackHero';

/** Helper to read a CSS custom property from the document root */
function getThemeColor(varName: string, fallback: string): string {
  if (typeof document === 'undefined') return fallback;
  const value = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
  return value || fallback;
}

/**
 * Returns appropriate fitView options based on graph size.
 * Smaller graphs get tighter padding and higher min zoom.
 * Larger graphs prevent extreme zoom-out.
 */
function getFitViewOptions(nodeCount: number) {
  if (nodeCount < 20) {
    return { padding: 0.3, minZoom: 0.5, maxZoom: 1.5, duration: 200 };
  }
  if (nodeCount < 100) {
    return { padding: 0.2, minZoom: 0.3, maxZoom: 1.2, duration: 200 };
  }
  // Large graphs - prevent extreme zoom-out
  return { padding: 0.15, minZoom: 0.2, maxZoom: 1.0, duration: 200 };
}

/**
 * Inner component for React Flow that has access to useReactFlow hook.
 * This must be wrapped by ReactFlowProvider to work.
 */
interface DetailedFlowContentProps {
  nodes: Node[];
  edges: Edge[];
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  onNodeClick: (event: React.MouseEvent, node: Node) => void;
  presentationTable: string | null;
}

const DetailedFlowContent: React.FC<DetailedFlowContentProps> = ({
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  onNodeClick,
  presentationTable,
}) => {
  const { fitView } = useReactFlow();

  // Fit view on initial render and when nodes change significantly
  // Using onInit ensures React Flow is ready before fitting
  const handleInit = useCallback(() => {
    // Delay slightly to ensure dagre positions are applied
    setTimeout(() => {
      fitView(getFitViewOptions(nodes.length));
    }, 50);
  }, [fitView, nodes.length]);

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onNodeClick={onNodeClick}
      onInit={handleInit}
      nodeTypes={lineageNodeTypes}
      minZoom={0.1}
      maxZoom={2}
      defaultEdgeOptions={{
        type: 'smoothstep',
        style: { stroke: 'var(--theme-rf-edge-primary)', strokeWidth: 2 },
      }}
      style={{ background: 'var(--theme-bg-surface)' }}
    >
      <Background color="var(--theme-rf-bg)" gap={20} size={1} />
      <Controls />
      <MiniMap
        nodeColor={(node) => {
          switch (node.data?.nodeType) {
            case 'presentationColumn':
              return getThemeColor('--theme-accent-blue', '#3b82f6');
            case 'physicalTable':
              return getThemeColor('--theme-accent-purple', '#a855f7');
            case 'physicalColumn':
              return getThemeColor('--theme-accent-orange', '#f97316');
            default:
              return getThemeColor('--theme-text-muted', '#64748b');
          }
        }}
        maskColor={getThemeColor('--theme-bg-overlay', 'rgba(15, 23, 42, 0.8)')}
      />
    </ReactFlow>
  );
};

/**
 * GraphViewer - Main content area with multiple view modes
 * Supports: flow, detailedFlow, table, starSchema views
 */
export const GraphViewer: React.FC = () => {
  const { selection, selectedRecords, dataIndex, setSelection, viewMode } = useData();

  // Transform records to React Flow graph when selectedRecords changes
  // Always use detailed 3-column graph
  const { nodes: initialNodes, edges: initialEdges } = useMemo(() => {
    if (selectedRecords.length === 0) {
      return { nodes: [], edges: [] };
    }

    // Always use detailed transformation (3-column layout)
    const graph = transformRecordsToDetailedGraph(selectedRecords);

    // Update node types to use our custom lineageNode component
    // Add isSelected flag based on current selection
    const nodesWithType = graph.nodes.map((node) => ({
      ...node,
      type: 'lineageNode',
      data: {
        ...node.data,
        isSelected:
          node.data.nodeType === 'presentationColumn'
            ? node.data.record?.presentationColumn === selection.presentationColumn
            : node.data.nodeType === 'physicalTable'
              ? node.data.label === selection.physicalTable
              : node.data.nodeType === 'physicalColumn'
                ? node.data.record?.physicalColumn === selection.physicalColumn
                : false,
      },
    }));
    return { nodes: nodesWithType, edges: graph.edges };
  }, [selectedRecords, selection.presentationColumn, selection.physicalTable, selection.physicalColumn, viewMode]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Update nodes/edges when initialNodes/initialEdges change
  useEffect(() => {
    setNodes(initialNodes);
    setEdges(initialEdges);
  }, [initialNodes, initialEdges, setNodes, setEdges]);

  // Handle node clicks - update selection based on node type
  const onNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
    const data = node.data as LineageNodeData;

    if (data.nodeType === 'presentationColumn' && data.record) {
      // Clicking a presentation column selects it and shows its lineage
      setSelection({
        presentationColumn: data.record.presentationColumn,
        physicalTable: data.record.physicalTable,
        physicalColumn: data.record.physicalColumn,
      });
    } else if (data.nodeType === 'physicalTable') {
      // Clicking a physical table clears column selection, shows table info
      setSelection({
        physicalTable: data.label,
        presentationColumn: null,
        physicalColumn: null,
      });
    } else if (data.nodeType === 'physicalColumn' && data.record) {
      // Clicking a physical column selects the related presentation column
      setSelection({
        presentationColumn: data.record.presentationColumn,
        physicalTable: data.record.physicalTable,
        physicalColumn: data.record.physicalColumn,
      });
    }
  }, [setSelection]);

  // No table selected = show Star Schema (if subject area selected) or Welcome
  if (!selection.presentationTable) {
    if (selection.subjectArea) {
      return <SubjectAreaNetworkView />;
    }
    // Welcome state — isometric data stack hero
    return <DataStackHero />;
  }

  // Route to correct view based on viewMode
  if (viewMode === 'table') {
    return <TableView records={selectedRecords} />;
  }

  // Show React Flow graph for detailedFlow mode
  // Wrapped in ReactFlowProvider with key to force remount on table change
  // This ensures onInit fires and fitView is called with correct bounds
  return (
    <div className="flex-1 w-full h-full relative">
      <ReactFlowProvider key={selection.presentationTable}>
        <DetailedFlowContent
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={onNodeClick}
          presentationTable={selection.presentationTable}
        />
      </ReactFlowProvider>

      {/* Detailed Flow Legend */}
      <div
        className="absolute top-4 right-4 z-10 backdrop-blur-sm rounded-lg border p-3"
        style={{
          backgroundColor: 'var(--theme-surface-legend)',
          borderColor: 'var(--theme-border-strong)',
        }}
      >
        <div
          className="text-[10px] uppercase tracking-wider mb-2 font-medium"
          style={{ color: 'var(--theme-text-tertiary)' }}
        >
          Legend
        </div>
        <div className="flex flex-col gap-2 text-xs" style={{ color: 'var(--theme-text-secondary)' }}>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: 'var(--theme-accent-blue)' }} />
            <span>Presentation Fields</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: 'var(--theme-accent-purple)' }} />
            <span>DW Tables</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: 'var(--theme-accent-orange)' }} />
            <span>DW Columns</span>
          </div>
        </div>
      </div>

      {/* Empty state overlay */}
      {selectedRecords.length === 0 && (
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{ backgroundColor: 'var(--theme-bg-overlay)' }}
        >
          <div className="text-center" style={{ color: 'var(--theme-text-muted)' }}>
            <Database className="w-8 h-8 mx-auto mb-2 opacity-50" />
            No field mappings found for this table.
          </div>
        </div>
      )}
    </div>
  );
};
