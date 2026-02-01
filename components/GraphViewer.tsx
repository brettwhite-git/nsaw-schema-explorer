import React, { useMemo, useEffect, useCallback } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  Node,
} from 'reactflow';
import 'reactflow/dist/style.css';

import { useData } from '../data/DataContext';
import { Database } from 'lucide-react';
import { transformRecordsToGraph, LineageNodeData } from '../utils/graphLayout';
import { lineageNodeTypes } from './nodes/LineageNode';

/**
 * GraphViewer - React Flow visualization of data lineage
 * Shows presentation columns -> physical tables mapping
 */
export const GraphViewer: React.FC = () => {
  const { selection, selectedRecords, dataIndex, setSelection } = useData();

  // Transform records to React Flow graph when selectedRecords changes
  const { nodes: initialNodes, edges: initialEdges } = useMemo(() => {
    if (selectedRecords.length === 0) {
      return { nodes: [], edges: [] };
    }
    const graph = transformRecordsToGraph(selectedRecords);
    // Update node types to use our custom lineageNode component
    // Add isSelected flag based on current selection
    const nodesWithType = graph.nodes.map(node => ({
      ...node,
      type: 'lineageNode',
      data: {
        ...node.data,
        isSelected: node.data.nodeType === 'presentationColumn'
          ? node.data.record?.presentationColumn === selection.presentationColumn
          : node.data.nodeType === 'physicalTable'
            ? node.data.label === selection.physicalTable
            : false,
      },
    }));
    return { nodes: nodesWithType, edges: graph.edges };
  }, [selectedRecords, selection.presentationColumn, selection.physicalTable]);

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

  // Show welcome state when nothing selected
  if (!selection.presentationTable) {
    return (
      <div className="flex-1 w-full h-full relative blueprint-grid overflow-auto bg-slate-900/20 flex items-center justify-center">
        <div className="text-center max-w-md p-8 mx-auto">
          <div className="p-4 bg-blue-600/10 rounded-xl border border-blue-500/20 inline-block mb-6">
            <Database className="w-12 h-12 text-blue-400" />
          </div>
          <h2 className="text-xl font-semibold text-white mb-3">
            Select a Presentation Table
          </h2>
          <p className="text-sm text-slate-400 mb-6">
            Use the sidebar to browse Subject Areas and select a table, or search for a specific field using the search bar above.
          </p>
          {dataIndex && (
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="p-3 bg-slate-800/50 rounded-lg border border-slate-700">
                <div className="text-2xl font-bold text-blue-400">
                  {dataIndex.subjectAreas.length}
                </div>
                <div className="text-xs text-slate-500 uppercase tracking-wider">
                  Subject Areas
                </div>
              </div>
              <div className="p-3 bg-slate-800/50 rounded-lg border border-slate-700">
                <div className="text-2xl font-bold text-purple-400">
                  {dataIndex.presentationTables.length}
                </div>
                <div className="text-xs text-slate-500 uppercase tracking-wider">
                  Tables
                </div>
              </div>
              <div className="p-3 bg-slate-800/50 rounded-lg border border-slate-700">
                <div className="text-2xl font-bold text-emerald-400">
                  {dataIndex.totalRecords.toLocaleString()}
                </div>
                <div className="text-xs text-slate-500 uppercase tracking-wider">
                  Fields
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Show React Flow graph for selected table
  return (
    <div className="flex-1 w-full h-full relative">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        nodeTypes={lineageNodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.1}
        maxZoom={2}
        defaultEdgeOptions={{
          type: 'smoothstep',
          style: { stroke: '#475569', strokeWidth: 2 },
        }}
        className="bg-slate-900/20"
      >
        <Background color="#334155" gap={20} size={1} />
        <Controls className="!bg-slate-800 !border-slate-700 [&>button]:!bg-slate-800 [&>button]:!border-slate-700 [&>button]:!text-slate-300 [&>button:hover]:!bg-slate-700" />
        <MiniMap
          nodeColor={(node) => {
            switch (node.data?.nodeType) {
              case 'presentationColumn':
                return '#3b82f6'; // Blue
              case 'physicalTable':
                return '#a855f7'; // Purple
              case 'physicalColumn':
                return '#f97316'; // Orange
              default:
                return '#64748b'; // Slate
            }
          }}
          className="!bg-slate-900 !border-slate-700"
          maskColor="rgba(15, 23, 42, 0.8)"
        />
      </ReactFlow>

      {/* Empty state overlay */}
      {selectedRecords.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-900/50">
          <div className="text-slate-500 text-center">
            <Database className="w-8 h-8 mx-auto mb-2 opacity-50" />
            No field mappings found for this table.
          </div>
        </div>
      )}
    </div>
  );
};
