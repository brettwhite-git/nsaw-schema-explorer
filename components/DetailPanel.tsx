import React, { useMemo, useState } from 'react';
import { useData } from '../data/DataContext';
import { FileText, Database, Info, Code, Layers, ChevronRight, Columns, Table2, Zap } from 'lucide-react';
import { parsePhysicalTableType } from '../types';

function getTableTypeBadge(tableName: string): string {
  const type = parsePhysicalTableType(tableName);
  switch (type) {
    case 'fact': return 'Fact Table';
    case 'enhanced': return 'Enhanced Fact';
    case 'dimension': return 'Dimension Table';
    case 'hierarchy': return 'Hierarchy Table';
    case 'global': return 'Global Table';
    case 'calculated': return 'Calculated';
    default: return 'DW Table';
  }
}

export const DetailPanel: React.FC = () => {
  const { selection, selectedRecords, dataIndex } = useData();

  // Hover state for interactive list items
  const [hoveredPhysicalTable, setHoveredPhysicalTable] = useState<string | null>(null);
  const [hoveredPresentationTable, setHoveredPresentationTable] = useState<string | null>(null);

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
      <div
        className="w-80 flex flex-col"
        style={{
          borderLeft: '1px solid var(--theme-border-default)',
          backgroundColor: 'var(--theme-bg-surface)',
        }}
      >
        <div
          className="p-4"
          style={{ borderBottom: '1px solid var(--theme-border-subtle)' }}
        >
          <h2
            className="text-xs font-semibold uppercase tracking-widest"
            style={{ color: 'var(--theme-text-muted)' }}
          >
            Lineage Details
          </h2>
        </div>
        <div
          className="flex-1 flex items-center justify-center p-8 text-center italic"
          style={{ color: 'var(--theme-text-faint)' }}
        >
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

  // Badge styles by detail type - using layer-based colors
  const badgeStyles: Record<string, React.CSSProperties> = {
    column: {
      backgroundColor: 'var(--theme-layer-semantic-bg)',
      color: 'var(--theme-layer-semantic-text)',
      borderColor: 'var(--theme-layer-semantic-border)',
    },
    table: {
      backgroundColor: 'var(--theme-layer-semantic-bg)',
      color: 'var(--theme-layer-semantic-text)',
      borderColor: 'var(--theme-layer-semantic-border)',
    },
    subjectArea: {
      backgroundColor: 'var(--theme-layer-dw-bg)',
      color: 'var(--theme-layer-dw-text)',
      borderColor: 'var(--theme-layer-dw-border)',
    },
  };

  return (
    <div
      className="w-80 flex flex-col h-full overflow-y-auto custom-scrollbar"
      style={{
        borderLeft: '1px solid var(--theme-border-default)',
        backgroundColor: 'var(--theme-bg-surface)',
      }}
    >
      {/* Header */}
      <div
        className="p-4"
        style={{ borderBottom: '1px solid var(--theme-border-subtle)' }}
      >
        <div className="flex items-center justify-between mb-3">
          <h2
            className="text-xs font-semibold uppercase tracking-widest"
            style={{ color: 'var(--theme-text-muted)' }}
          >
            Lineage Details
          </h2>
          <span
            className="px-2 py-0.5 text-[10px] rounded font-semibold uppercase"
            style={{
              border: '1px solid',
              ...badgeStyles[detailType],
            }}
          >
            {detailType === 'column' ? 'Column' : detailType === 'table' ? 'Table' : 'Subject Area'}
          </span>
        </div>

        {/* Breadcrumb */}
        <div
          className="flex items-center gap-1 text-xs mb-3 flex-wrap"
          style={{ color: 'var(--theme-text-muted)' }}
        >
          <span style={{ color: 'var(--theme-accent-cyan-text)' }}>{selection.subjectArea}</span>
          {selection.presentationTable && (
            <>
              <ChevronRight className="w-3 h-3" />
              <span style={{ color: selectedColumnRecord ? 'var(--theme-text-tertiary)' : 'var(--theme-text-primary)' }}>
                {selection.presentationTable}
              </span>
            </>
          )}
          {selectedColumnRecord && (
            <>
              <ChevronRight className="w-3 h-3" />
              <span style={{ color: 'var(--theme-text-primary)' }}>{selection.presentationColumn}</span>
            </>
          )}
        </div>

        <h1
          className="text-xl font-semibold mb-2"
          style={{ color: 'var(--theme-text-primary)' }}
        >
          {selectedColumnRecord
            ? selection.presentationColumn
            : selection.presentationTable || selection.subjectArea}
        </h1>

        <p
          className="text-xs leading-relaxed"
          style={{ color: 'var(--theme-text-tertiary)' }}
        >
          {selectedColumnRecord
            ? `Field mapping from ${selection.presentationTable} to physical data warehouse.`
            : selection.presentationTable
              ? `${selectedRecords.length} field mappings to physical data warehouse tables.`
              : `${subjectAreaInfo?.presentationTables.length || 0} presentation tables with ${subjectAreaInfo?.recordCount || 0} total fields.`}
        </p>
      </div>

      <div className="p-6 space-y-6">
        {/* Column-level Lineage Path (when a column is selected) */}
        {/* Shows correct data flow: NetSuite Source → DW → Semantic */}
        {selectedColumnRecord && (
          <section>
            <div className="flex items-center gap-2 mb-4" style={{ color: 'var(--theme-text-secondary)' }}>
              <Code className="w-4 h-4" style={{ color: 'var(--theme-layer-semantic-text)' }} />
              <h3 className="text-sm font-medium">Data Lineage Path</h3>
            </div>

            {/* 3-Layer Visual Path - connected pipeline: NS → DW → Semantic */}
            <div className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--theme-border-default)' }}>
              {/* NetSuite Source Layer (TOP - data origin) */}
              <div
                className="p-4"
                style={{
                  backgroundColor: 'var(--theme-layer-netsuite-bg)',
                  borderLeft: '3px solid var(--theme-layer-netsuite)',
                }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <Table2 className="w-4 h-4" style={{ color: 'var(--theme-layer-netsuite-text)' }} />
                  <span
                    className="text-[10px] uppercase tracking-wider font-semibold"
                    style={{ color: 'var(--theme-layer-netsuite-text)' }}
                  >
                    NetSuite Source
                  </span>
                </div>
                {selectedColumnRecord.inferredSource.isNsawGenerated ? (
                  <div
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md"
                    style={{
                      backgroundColor: 'var(--theme-accent-amber-bg)',
                      border: '1px solid var(--theme-accent-amber-border)',
                    }}
                  >
                    <span
                      className="text-xs font-medium"
                      style={{ color: 'var(--theme-accent-amber-text)' }}
                    >
                      NSAW Generated
                    </span>
                  </div>
                ) : (
                  <>
                    {selectedColumnRecord.inferredSource.recordType && (
                      <div className="text-sm mb-1" style={{ color: 'var(--theme-text-primary)' }}>
                        Record: <span className="font-medium" style={{ color: 'var(--theme-layer-netsuite-text)' }}>{selectedColumnRecord.inferredSource.recordType}</span>
                      </div>
                    )}
                    {selectedColumnRecord.inferredSource.fieldName && (
                      <div className="text-xs" style={{ color: 'var(--theme-text-secondary)' }}>
                        Field: <span className="font-mono" style={{ color: 'var(--theme-layer-netsuite-text)' }}>{selectedColumnRecord.inferredSource.fieldName}</span>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Gradient separator: NetSuite → DW */}
              <div style={{ height: '2px', background: 'linear-gradient(to right, var(--theme-layer-netsuite), var(--theme-layer-dw))' }} />

              {/* Data Warehouse Layer (MIDDLE) */}
              <div
                className="p-4"
                style={{
                  backgroundColor: 'var(--theme-layer-dw-bg)',
                  borderLeft: '3px solid var(--theme-layer-dw)',
                }}
              >
                <div className="flex items-center gap-2 mb-3">
                  <Database className="w-4 h-4" style={{ color: 'var(--theme-layer-dw-text)' }} />
                  <span
                    className="text-[10px] uppercase tracking-wider font-semibold"
                    style={{ color: 'var(--theme-layer-dw-text)' }}
                  >
                    Data Warehouse
                  </span>
                </div>
                <div className="text-[10px] mb-1" style={{ color: 'var(--theme-text-muted)' }}>
                  Table:
                </div>
                <div
                  className="font-mono text-xs mb-3 break-all px-2 py-1 rounded"
                  style={{
                    color: 'var(--theme-layer-dw-text)',
                    backgroundColor: 'var(--theme-layer-dw-bg)',
                  }}
                >
                  {selectedColumnRecord.physicalTable}
                </div>
                <div className="text-[10px] mb-1" style={{ color: 'var(--theme-text-muted)' }}>
                  Column:
                </div>
                <div
                  className="font-mono text-xs break-all px-2 py-1 rounded"
                  style={{
                    color: 'var(--theme-layer-dw-text)',
                    backgroundColor: 'var(--theme-layer-dw-bg)',
                  }}
                >
                  {selectedColumnRecord.physicalColumn}
                </div>
                {/* Table type badge */}
                <div className="mt-3">
                  <span
                    className="text-[10px] px-1.5 py-0.5 rounded font-semibold uppercase tracking-wider"
                    style={{
                      color: getTableTypeBadge(selectedColumnRecord.physicalTable).includes('Fact')
                        ? 'var(--theme-accent-amber-text)'
                        : 'var(--theme-layer-dw-text)',
                      backgroundColor: getTableTypeBadge(selectedColumnRecord.physicalTable).includes('Fact')
                        ? 'var(--theme-accent-amber-bg)'
                        : 'var(--theme-layer-dw-bg)',
                      border: `1px solid ${getTableTypeBadge(selectedColumnRecord.physicalTable).includes('Fact')
                        ? 'var(--theme-accent-amber-border)'
                        : 'var(--theme-layer-dw-border)'}`,
                    }}
                  >
                    {getTableTypeBadge(selectedColumnRecord.physicalTable)}
                  </span>
                </div>
              </div>

              {/* Gradient separator: DW → Semantic */}
              <div style={{ height: '2px', background: 'linear-gradient(to right, var(--theme-layer-dw), var(--theme-layer-semantic))' }} />

              {/* Semantic/Presentation Layer (BOTTOM - data destination) */}
              <div
                className="p-4"
                style={{
                  backgroundColor: 'var(--theme-layer-semantic-bg)',
                  borderLeft: '3px solid var(--theme-layer-semantic)',
                }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <Columns className="w-4 h-4" style={{ color: 'var(--theme-layer-semantic-text)' }} />
                  <span
                    className="text-[10px] uppercase tracking-wider font-semibold"
                    style={{ color: 'var(--theme-layer-semantic-text)' }}
                  >
                    Semantic Layer
                  </span>
                </div>
                <div
                  className="text-sm font-semibold mb-1"
                  style={{ color: 'var(--theme-text-primary)' }}
                >
                  {selectedColumnRecord.presentationColumn}
                </div>
                <div className="text-xs" style={{ color: 'var(--theme-text-tertiary)' }}>
                  Table: {selectedColumnRecord.presentationTable}
                </div>
                {selectedColumnRecord.inferredSource.isNsawGenerated && (
                  <div
                    className="mt-2 inline-flex items-center gap-1 px-2 py-1 rounded"
                    style={{
                      backgroundColor: 'var(--theme-layer-derived-bg)',
                      border: '1px solid var(--theme-layer-derived-border)',
                    }}
                  >
                    <Zap className="w-3 h-3" style={{ color: 'var(--theme-layer-derived-text)' }} />
                    <span
                      className="text-[10px] font-medium uppercase"
                      style={{ color: 'var(--theme-layer-derived-text)' }}
                    >
                      NSAW Derived Field
                    </span>
                  </div>
                )}
              </div>
            </div>
          </section>
        )}

        {/* Summary Stats (show when no column selected) */}
        {!selectedColumnRecord && (
          <section>
            <div className="flex items-center gap-2 mb-3" style={{ color: 'var(--theme-text-secondary)' }}>
              <Info className="w-4 h-4" style={{ color: 'var(--theme-layer-semantic-text)' }} />
              <h3 className="text-sm font-medium">Summary</h3>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div
                className="p-3 rounded-lg"
                style={{
                  backgroundColor: 'var(--theme-bg-panel)',
                  border: '1px solid var(--theme-border-default)',
                }}
              >
                <div className="text-lg font-semibold" style={{ color: 'var(--theme-layer-semantic-text)' }}>
                  {selection.presentationTable
                    ? selectedRecords.length
                    : subjectAreaInfo?.presentationTables.length || 0}
                </div>
                <div
                  className="text-[10px] uppercase"
                  style={{ color: 'var(--theme-text-muted)' }}
                >
                  {selection.presentationTable ? 'Fields' : 'Tables'}
                </div>
              </div>
              <div
                className="p-3 rounded-lg"
                style={{
                  backgroundColor: 'var(--theme-bg-panel)',
                  border: '1px solid var(--theme-border-default)',
                }}
              >
                <div className="text-lg font-semibold" style={{ color: 'var(--theme-layer-dw-text)' }}>
                  {selection.presentationTable
                    ? new Set(selectedRecords.map(r => r.physicalTable)).size
                    : subjectAreaInfo?.recordCount || 0}
                </div>
                <div
                  className="text-[10px] uppercase"
                  style={{ color: 'var(--theme-text-muted)' }}
                >
                  {selection.presentationTable ? 'DW Tables' : 'Total Fields'}
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Physical Tables (show when table selected but no column) */}
        {selection.presentationTable && !selectedColumnRecord && selectedRecords.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-3" style={{ color: 'var(--theme-text-secondary)' }}>
              <Database className="w-4 h-4" style={{ color: 'var(--theme-layer-dw-text)' }} />
              <h3 className="text-sm font-medium">DW Tables</h3>
            </div>
            <div className="space-y-2">
              {Array.from(new Set(selectedRecords.map(r => r.physicalTable))).map((table) => {
                const record = selectedRecords.find(r => r.physicalTable === table);
                const inferredRecord = record?.inferredSource.recordType;
                const isNsawGenerated = record?.inferredSource.isNsawGenerated;
                const isHovered = hoveredPhysicalTable === table;

                return (
                  <div
                    key={table}
                    className="p-3 rounded-lg transition-colors"
                    style={{
                      backgroundColor: 'var(--theme-bg-inset)',
                      border: `1px solid ${isHovered ? 'var(--theme-border-strong)' : 'var(--theme-border-default)'}`,
                    }}
                    onMouseEnter={() => setHoveredPhysicalTable(table)}
                    onMouseLeave={() => setHoveredPhysicalTable(null)}
                  >
                    <div className="flex items-start justify-between">
                      <div
                        className="font-mono text-xs break-all"
                        style={{ color: 'var(--theme-layer-dw-text)' }}
                      >
                        {table}
                      </div>
                    </div>
                    {isNsawGenerated ? (
                      <div
                        className="mt-1 text-[10px] uppercase font-medium"
                        style={{ color: 'var(--theme-accent-amber-text)', opacity: 0.8 }}
                      >
                        NSAW Generated
                      </div>
                    ) : inferredRecord && (
                      <div
                        className="mt-1 text-[10px]"
                        style={{ color: 'var(--theme-text-muted)' }}
                      >
                        NetSuite: <span style={{ color: 'var(--theme-layer-netsuite-text)' }}>{inferredRecord}</span>
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
            <div className="flex items-center gap-2 mb-3" style={{ color: 'var(--theme-text-secondary)' }}>
              <Layers className="w-4 h-4" style={{ color: 'var(--theme-layer-semantic-text)' }} />
              <h3 className="text-sm font-medium">Semantic Tables</h3>
            </div>
            <div className="space-y-1 max-h-64 overflow-y-auto">
              {subjectAreaInfo.presentationTables.slice(0, 15).map((table) => {
                const isHovered = hoveredPresentationTable === table;
                return (
                  <div
                    key={table}
                    className="p-2 rounded transition-colors cursor-pointer"
                    style={{
                      backgroundColor: isHovered ? 'var(--theme-bg-hover)' : 'transparent',
                    }}
                    onMouseEnter={() => setHoveredPresentationTable(table)}
                    onMouseLeave={() => setHoveredPresentationTable(null)}
                  >
                    <span
                      className="text-xs transition-colors"
                      style={{
                        color: isHovered ? 'var(--theme-layer-semantic-text)' : 'var(--theme-text-secondary)',
                      }}
                    >
                      {table}
                    </span>
                  </div>
                );
              })}
              {subjectAreaInfo.presentationTables.length > 15 && (
                <div
                  className="text-xs p-2"
                  style={{ color: 'var(--theme-text-faint)' }}
                >
                  +{subjectAreaInfo.presentationTables.length - 15} more tables...
                </div>
              )}
            </div>
          </section>
        )}

        {/* Generic 3-Layer Legend (show when table selected but no column) */}
        {/* Shows correct data flow: NetSuite → DW → Semantic */}
        {selection.presentationTable && !selectedColumnRecord && selectedRecords.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-3" style={{ color: 'var(--theme-text-secondary)' }}>
              <Code className="w-4 h-4" style={{ color: 'var(--theme-layer-semantic-text)' }} />
              <h3 className="text-sm font-medium">Data Flow Layers</h3>
            </div>
            <p
              className="text-[10px] mb-3"
              style={{ color: 'var(--theme-text-muted)' }}
            >
              Click a column node in the graph to view its full lineage path.
            </p>
            <div className="flex flex-col gap-2">
              {/* NetSuite Source - data origin */}
              <div
                className="flex items-center gap-2 p-2 rounded"
                style={{
                  backgroundColor: 'var(--theme-layer-netsuite-bg)',
                  border: '1px dashed var(--theme-layer-netsuite-border)',
                }}
              >
                <span
                  className="w-2 h-2 rounded-full"
                  style={{
                    backgroundColor: 'var(--theme-layer-netsuite)',
                    boxShadow: '0 0 8px var(--theme-layer-netsuite-glow)',
                  }}
                />
                <span
                  className="text-[10px] uppercase tracking-tight"
                  style={{ color: 'var(--theme-text-tertiary)' }}
                >
                  NetSuite Source
                </span>
              </div>
              {/* DW - middle layer */}
              <div
                className="flex items-center gap-2 p-2 rounded"
                style={{
                  backgroundColor: 'var(--theme-layer-dw-bg)',
                  border: '1px dashed var(--theme-layer-dw-border)',
                }}
              >
                <span
                  className="w-2 h-2 rounded-full"
                  style={{
                    backgroundColor: 'var(--theme-layer-dw)',
                    boxShadow: '0 0 8px var(--theme-layer-dw-glow)',
                  }}
                />
                <span
                  className="text-[10px] uppercase tracking-tight"
                  style={{ color: 'var(--theme-text-tertiary)' }}
                >
                  Data Warehouse (DW)
                </span>
              </div>
              {/* Semantic - data destination */}
              <div
                className="flex items-center gap-2 p-2 rounded"
                style={{
                  backgroundColor: 'var(--theme-layer-semantic-bg)',
                  border: '1px dashed var(--theme-layer-semantic-border)',
                }}
              >
                <span
                  className="w-2 h-2 rounded-full"
                  style={{
                    backgroundColor: 'var(--theme-layer-semantic)',
                    boxShadow: '0 0 8px var(--theme-layer-semantic-glow)',
                  }}
                />
                <span
                  className="text-[10px] uppercase tracking-tight"
                  style={{ color: 'var(--theme-text-tertiary)' }}
                >
                  Semantic Layer
                </span>
              </div>
              {/* Derived - NSAW calculations */}
              <div
                className="flex items-center gap-2 p-2 rounded"
                style={{
                  backgroundColor: 'var(--theme-layer-derived-bg)',
                  border: '1px dashed var(--theme-layer-derived-border)',
                }}
              >
                <span
                  className="w-2 h-2 rounded-full"
                  style={{
                    backgroundColor: 'var(--theme-layer-derived)',
                    boxShadow: '0 0 8px var(--theme-layer-derived-glow)',
                  }}
                />
                <span
                  className="text-[10px] uppercase tracking-tight"
                  style={{ color: 'var(--theme-text-tertiary)' }}
                >
                  NSAW Derived
                </span>
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
};
