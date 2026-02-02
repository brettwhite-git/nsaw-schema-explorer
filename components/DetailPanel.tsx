import React, { useMemo } from 'react';
import { useData } from '../data/DataContext';
import { FileText, Database, Info, Code, Layers, ChevronRight, Columns, ArrowDown, Table2 } from 'lucide-react';

export const DetailPanel: React.FC = () => {
  const { selection, selectedRecords, dataIndex } = useData();

  // Get current selection info
  const subjectAreaInfo = useMemo(() => {
    return dataIndex?.subjectAreas.find(sa => sa.name === selection.subjectArea);
  }, [dataIndex, selection.subjectArea]);

  // Find the selected column's full record
  const selectedColumnRecord = useMemo(() => {
    if (!selection.presentationColumn) return null;
    return selectedRecords.find(r => r.presentationColumn === selection.presentationColumn);
  }, [selection.presentationColumn, selectedRecords]);

  // Empty state - nothing selected
  if (!selection.subjectArea) {
    return (
      <div className="w-80 border-l border-slate-800 flex flex-col bg-slate-950">
        <div className="p-4 border-b border-slate-900">
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-widest">
            Lineage Details
          </h2>
        </div>
        <div className="flex-1 flex items-center justify-center p-8 text-slate-600 text-center italic">
          Select a subject area or search for a field to view its lineage details.
        </div>
      </div>
    );
  }

  // Determine what type of detail to show
  const detailType = selectedColumnRecord
    ? 'column'
    : selection.presentationTable
      ? 'table'
      : 'subjectArea';

  return (
    <div className="w-80 border-l border-slate-800 flex flex-col h-full bg-slate-950 overflow-y-auto custom-scrollbar">
      {/* Header */}
      <div className="p-4 border-b border-slate-900">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-widest">
            Lineage Details
          </h2>
          <span className={`px-2 py-0.5 text-[10px] rounded border font-bold uppercase ${
            detailType === 'column'
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
              : detailType === 'table'
                ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                : 'bg-purple-500/10 text-purple-400 border-purple-500/20'
          }`}>
            {detailType === 'column' ? 'Column' : detailType === 'table' ? 'Table' : 'Subject Area'}
          </span>
        </div>

        {/* Breadcrumb */}
        <div className="flex items-center gap-1 text-xs text-slate-500 mb-3 flex-wrap">
          <span className="text-blue-400">{selection.subjectArea}</span>
          {selection.presentationTable && (
            <>
              <ChevronRight className="w-3 h-3" />
              <span className={selectedColumnRecord ? 'text-slate-400' : 'text-white'}>{selection.presentationTable}</span>
            </>
          )}
          {selectedColumnRecord && (
            <>
              <ChevronRight className="w-3 h-3" />
              <span className="text-white">{selection.presentationColumn}</span>
            </>
          )}
        </div>

        <h1 className="text-xl font-bold text-white mb-2">
          {selectedColumnRecord
            ? selection.presentationColumn
            : selection.presentationTable || selection.subjectArea}
        </h1>

        <p className="text-xs text-slate-400 leading-relaxed">
          {selectedColumnRecord
            ? `Field mapping from ${selection.presentationTable} to physical data warehouse.`
            : selection.presentationTable
              ? `${selectedRecords.length} field mappings to physical data warehouse tables.`
              : `${subjectAreaInfo?.presentationTables.length || 0} presentation tables with ${subjectAreaInfo?.recordCount || 0} total fields.`}
        </p>
      </div>

      <div className="p-6 space-y-6">
        {/* Column-level Lineage Path (when a column is selected) */}
        {selectedColumnRecord && (
          <section>
            <div className="flex items-center gap-2 mb-4 text-slate-300">
              <Code className="w-4 h-4 text-blue-400" />
              <h3 className="text-sm font-medium">Column Lineage Path</h3>
            </div>

            {/* 3-Layer Visual Path */}
            <div className="space-y-0">
              {/* Presentation Layer */}
              <div className="p-4 bg-blue-500/5 rounded-t-lg border-2 border-blue-500/30">
                <div className="flex items-center gap-2 mb-2">
                  <Columns className="w-4 h-4 text-blue-400" />
                  <span className="text-[10px] text-blue-400 uppercase tracking-wider font-semibold">
                    Presentation Layer
                  </span>
                </div>
                <div className="text-sm font-semibold text-white mb-1">
                  {selectedColumnRecord.presentationColumn}
                </div>
                <div className="text-xs text-slate-400">
                  Table: {selectedColumnRecord.presentationTable}
                </div>
              </div>

              {/* Arrow Down */}
              <div className="flex justify-center py-1 bg-slate-900/50">
                <ArrowDown className="w-4 h-4 text-slate-500" />
              </div>

              {/* Data Warehouse Layer */}
              <div className="p-4 bg-purple-500/5 border-x-2 border-purple-500/30">
                <div className="flex items-center gap-2 mb-2">
                  <Database className="w-4 h-4 text-purple-400" />
                  <span className="text-[10px] text-purple-400 uppercase tracking-wider font-semibold">
                    Data Warehouse
                  </span>
                </div>
                <div className="font-mono text-xs text-purple-300 mb-1 break-all">
                  {selectedColumnRecord.physicalTable}
                </div>
                <div className="font-mono text-xs text-slate-300">
                  Column: <span className="text-purple-200">{selectedColumnRecord.physicalColumn}</span>
                </div>
              </div>

              {/* Arrow Down */}
              <div className="flex justify-center py-1 bg-slate-900/50">
                <ArrowDown className="w-4 h-4 text-slate-500" />
              </div>

              {/* NetSuite Source Layer */}
              <div className="p-4 bg-emerald-500/5 rounded-b-lg border-2 border-emerald-500/30">
                <div className="flex items-center gap-2 mb-2">
                  <Table2 className="w-4 h-4 text-emerald-400" />
                  <span className="text-[10px] text-emerald-400 uppercase tracking-wider font-semibold">
                    NetSuite Source
                  </span>
                </div>
                {selectedColumnRecord.inferredSource.isNsawGenerated ? (
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-amber-500/10 border border-amber-500/30 rounded-md">
                    <span className="text-xs font-medium text-amber-400">NSAW Generated</span>
                  </div>
                ) : (
                  <>
                    {selectedColumnRecord.inferredSource.recordType && (
                      <div className="text-sm text-white mb-1">
                        Record: <span className="text-emerald-400 font-medium">{selectedColumnRecord.inferredSource.recordType}</span>
                      </div>
                    )}
                    {selectedColumnRecord.inferredSource.fieldName && (
                      <div className="text-xs text-slate-300">
                        Field: <span className="text-emerald-300 font-mono">{selectedColumnRecord.inferredSource.fieldName}</span>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </section>
        )}

        {/* Summary Stats (show when no column selected) */}
        {!selectedColumnRecord && (
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
        )}

        {/* Physical Tables (show when table selected but no column) */}
        {selection.presentationTable && !selectedColumnRecord && selectedRecords.length > 0 && (
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

        {/* Generic 3-Layer Legend (show when table selected but no column) */}
        {selection.presentationTable && !selectedColumnRecord && selectedRecords.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-3 text-slate-300">
              <Code className="w-4 h-4 text-blue-400" />
              <h3 className="text-sm font-medium">Lineage Layers</h3>
            </div>
            <p className="text-[10px] text-slate-500 mb-3">
              Click a column node in the graph to view its full lineage path.
            </p>
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
