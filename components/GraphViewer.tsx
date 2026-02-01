import React from 'react';
import { useData } from '../data/DataContext';
import { Database, ArrowRight, Table2 } from 'lucide-react';

/**
 * GraphViewer - Placeholder for Phase 4 React Flow implementation
 * Currently shows a simple list view of lineage records
 */
export const GraphViewer: React.FC = () => {
  const { selection, selectedRecords, dataIndex } = useData();

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

  // Show lineage records for selected table
  return (
    <div className="flex-1 w-full h-full relative blueprint-grid overflow-auto bg-slate-900/20">
      {/* Column Headers */}
      <div className="sticky top-0 z-10 bg-slate-900/95 backdrop-blur border-b border-slate-800 px-6 py-3">
        <div className="grid grid-cols-3 gap-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">
          <div className="flex items-center gap-2">
            <Table2 className="w-3.5 h-3.5" />
            Presentation Column
          </div>
          <div className="flex items-center gap-2 justify-center">
            <ArrowRight className="w-3.5 h-3.5" />
            Maps To
          </div>
          <div className="flex items-center gap-2">
            <Database className="w-3.5 h-3.5" />
            Physical (DW)
          </div>
        </div>
      </div>

      {/* Lineage Records */}
      <div className="p-4 space-y-2">
        {selectedRecords.map((record, idx) => (
          <div
            key={idx}
            className="grid grid-cols-3 gap-4 p-3 bg-slate-800/30 hover:bg-slate-800/50 rounded-lg border border-slate-700/50 hover:border-slate-600 transition-all cursor-pointer group"
          >
            {/* Presentation Column */}
            <div className="flex items-center gap-3">
              <div className="w-1.5 h-8 bg-blue-500 rounded-full" />
              <div>
                <div className="text-sm font-medium text-white group-hover:text-blue-300 transition-colors">
                  {record.presentationColumn}
                </div>
                <div className="text-xs text-slate-500">
                  {record.presentationTable}
                </div>
              </div>
            </div>

            {/* Arrow */}
            <div className="flex items-center justify-center">
              <ArrowRight className="w-4 h-4 text-slate-600 group-hover:text-blue-400 transition-colors" />
            </div>

            {/* Physical Column */}
            <div className="flex items-center gap-3">
              <div className="w-1.5 h-8 bg-purple-500 rounded-full" />
              <div>
                <div className="text-sm font-medium text-white group-hover:text-purple-300 transition-colors font-mono">
                  {record.physicalColumn}
                </div>
                <div className="text-xs text-slate-500 font-mono">
                  {record.physicalTable}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Empty state */}
      {selectedRecords.length === 0 && (
        <div className="flex items-center justify-center h-64 text-slate-500">
          No field mappings found for this table.
        </div>
      )}
    </div>
  );
};
