import React from 'react';
import { useData } from '../data/DataContext';
import { FileText, Database, Info, Code, ArrowUpRight, Layers, ChevronRight } from 'lucide-react';

export const DetailPanel: React.FC = () => {
  const { selection, selectedRecords, dataIndex } = useData();

  // Empty state - nothing selected
  if (!selection.subjectArea) {
    return (
      <div className="w-80 border-l border-slate-800 flex items-center justify-center p-8 bg-slate-950 text-slate-600 text-center italic">
        Select a subject area or search for a field to view its lineage details.
      </div>
    );
  }

  // Get current selection info
  const subjectAreaInfo = dataIndex?.subjectAreas.find(
    sa => sa.name === selection.subjectArea
  );

  return (
    <div className="w-80 border-l border-slate-800 flex flex-col h-full bg-slate-950 overflow-y-auto custom-scrollbar">
      {/* Header */}
      <div className="p-6 border-b border-slate-900">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-widest">
            Lineage Details
          </h2>
          <span className="px-2 py-0.5 bg-blue-500/10 text-blue-400 text-[10px] rounded border border-blue-500/20 font-bold uppercase">
            {selection.presentationTable ? 'Table' : 'Subject Area'}
          </span>
        </div>

        {/* Breadcrumb */}
        <div className="flex items-center gap-1 text-xs text-slate-500 mb-3 flex-wrap">
          <span className="text-blue-400">{selection.subjectArea}</span>
          {selection.presentationTable && (
            <>
              <ChevronRight className="w-3 h-3" />
              <span className="text-white">{selection.presentationTable}</span>
            </>
          )}
        </div>

        <h1 className="text-xl font-bold text-white mb-2">
          {selection.presentationTable || selection.subjectArea}
        </h1>

        <p className="text-xs text-slate-400 leading-relaxed">
          {selection.presentationTable
            ? `${selectedRecords.length} field mappings to physical data warehouse tables.`
            : `${subjectAreaInfo?.presentationTables.length || 0} presentation tables with ${subjectAreaInfo?.recordCount || 0} total fields.`}
        </p>
      </div>

      <div className="p-6 space-y-6">
        {/* Summary Stats */}
        <section>
          <div className="flex items-center gap-2 mb-3 text-slate-300">
            <Info className="w-4 h-4 text-blue-400" />
            <h3 className="text-sm font-medium">Summary</h3>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="p-3 bg-slate-900/50 rounded-lg border border-slate-800">
              <div className="text-lg font-bold text-blue-400">
                {selection.presentationTable
                  ? selectedRecords.length
                  : subjectAreaInfo?.presentationTables.length || 0}
              </div>
              <div className="text-[10px] text-slate-500 uppercase">
                {selection.presentationTable ? 'Fields' : 'Tables'}
              </div>
            </div>
            <div className="p-3 bg-slate-900/50 rounded-lg border border-slate-800">
              <div className="text-lg font-bold text-purple-400">
                {selection.presentationTable
                  ? new Set(selectedRecords.map(r => r.physicalTable)).size
                  : subjectAreaInfo?.recordCount || 0}
              </div>
              <div className="text-[10px] text-slate-500 uppercase">
                {selection.presentationTable ? 'DW Tables' : 'Total Fields'}
              </div>
            </div>
          </div>
        </section>

        {/* Physical Tables */}
        {selection.presentationTable && selectedRecords.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-3 text-slate-300">
              <Database className="w-4 h-4 text-blue-400" />
              <h3 className="text-sm font-medium">Physical Tables</h3>
            </div>
            <div className="space-y-2">
              {Array.from(new Set(selectedRecords.map(r => r.physicalTable))).map((table) => {
                const record = selectedRecords.find(r => r.physicalTable === table);
                const inferredRecord = record?.inferredSource.recordType;
                const isNsawGenerated = record?.inferredSource.isNsawGenerated;

                return (
                  <div
                    key={table}
                    className="p-3 rounded-lg bg-slate-900/30 border border-slate-800 hover:border-slate-700 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="font-mono text-xs text-purple-300 break-all">
                        {table}
                      </div>
                    </div>
                    {isNsawGenerated ? (
                      <div className="mt-1 text-[10px] text-amber-500/80 uppercase font-medium">
                        NSAW Generated
                      </div>
                    ) : inferredRecord && (
                      <div className="mt-1 text-[10px] text-slate-500">
                        NetSuite: <span className="text-emerald-400">{inferredRecord}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Presentation Tables (when subject area selected) */}
        {!selection.presentationTable && subjectAreaInfo && (
          <section>
            <div className="flex items-center gap-2 mb-3 text-slate-300">
              <Layers className="w-4 h-4 text-blue-400" />
              <h3 className="text-sm font-medium">Presentation Tables</h3>
            </div>
            <div className="space-y-1 max-h-64 overflow-y-auto">
              {subjectAreaInfo.presentationTables.slice(0, 15).map((table) => (
                <div
                  key={table}
                  className="p-2 rounded hover:bg-slate-900 transition-colors group cursor-pointer"
                >
                  <span className="text-xs text-slate-300 group-hover:text-blue-400 transition-colors">
                    {table}
                  </span>
                </div>
              ))}
              {subjectAreaInfo.presentationTables.length > 15 && (
                <div className="text-xs text-slate-600 p-2">
                  +{subjectAreaInfo.presentationTables.length - 15} more tables...
                </div>
              )}
            </div>
          </section>
        )}

        {/* 3-Layer Lineage Path (when specific field context available) */}
        {selectedRecords.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-3 text-slate-300">
              <Code className="w-4 h-4 text-blue-400" />
              <h3 className="text-sm font-medium">Lineage Path</h3>
            </div>
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2 p-2 bg-blue-500/5 rounded border border-dashed border-blue-500/20">
                <span className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
                <span className="text-[10px] text-slate-400 uppercase tracking-tight">
                  Presentation Layer
                </span>
              </div>
              <div className="flex items-center gap-2 p-2 bg-purple-500/5 rounded border border-dashed border-purple-500/20">
                <span className="w-2 h-2 rounded-full bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.5)]" />
                <span className="text-[10px] text-slate-400 uppercase tracking-tight">
                  Data Warehouse (DW)
                </span>
              </div>
              <div className="flex items-center gap-2 p-2 bg-emerald-500/5 rounded border border-dashed border-emerald-500/20">
                <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                <span className="text-[10px] text-slate-400 uppercase tracking-tight">
                  NetSuite Source (Inferred)
                </span>
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
};
