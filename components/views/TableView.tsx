import React, { useState, useMemo } from 'react';
import { EnrichedLineageRecord, parsePhysicalTableType } from '../../types';
import { ArrowUpDown, ArrowUp, ArrowDown, Code, Cloud, Database, Columns, ChevronRight, Zap } from 'lucide-react';

interface TableViewProps {
  records: EnrichedLineageRecord[];
}

type SortField = 'inferredField' | 'inferredRecord' | 'physicalTable' | 'presentationColumn';
type SortDirection = 'asc' | 'desc';

function getTableTypeBadge(tableName: string): { label: string; isFact: boolean } {
  const type = parsePhysicalTableType(tableName);
  switch (type) {
    case 'fact': return { label: 'FACT', isFact: true };
    case 'enhanced': return { label: 'ENH', isFact: true };
    case 'dimension': return { label: 'DIM', isFact: false };
    case 'hierarchy': return { label: 'HIER', isFact: false };
    case 'global': return { label: 'GLOBAL', isFact: false };
    case 'calculated': return { label: 'CALC', isFact: false };
    default: return { label: '', isFact: false };
  }
}

// Column header definitions with layer colors and icons
const COLUMNS = [
  {
    field: 'inferredField' as SortField,
    label: 'NetSuite Field',
    icon: Code,
    layerPrefix: '--theme-layer-netsuite',
  },
  {
    field: 'inferredRecord' as SortField,
    label: 'NetSuite Record',
    icon: Cloud,
    layerPrefix: '--theme-layer-netsuite',
  },
  {
    field: 'physicalTable' as SortField,
    label: 'DW Table',
    icon: Database,
    layerPrefix: '--theme-layer-dw',
  },
  {
    field: 'presentationColumn' as SortField,
    label: 'Presentation',
    icon: Columns,
    layerPrefix: '--theme-layer-semantic',
  },
];

export const TableView: React.FC<TableViewProps> = ({ records }) => {
  const [sortField, setSortField] = useState<SortField>('inferredField');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  const sortedRecords = useMemo(() => {
    return [...records].sort((a, b) => {
      let aVal: string = '';
      let bVal: string = '';

      switch (sortField) {
        case 'inferredField':
          aVal = a.inferredSource.fieldName || '';
          bVal = b.inferredSource.fieldName || '';
          break;
        case 'inferredRecord':
          aVal = a.inferredSource.recordType || '';
          bVal = b.inferredSource.recordType || '';
          break;
        case 'physicalTable':
          aVal = a.physicalTable;
          bVal = b.physicalTable;
          break;
        case 'presentationColumn':
          aVal = a.presentationColumn;
          bVal = b.presentationColumn;
          break;
      }

      const compare = aVal.localeCompare(bVal);
      return sortDirection === 'asc' ? compare : -compare;
    });
  }, [records, sortField, sortDirection]);

  // Footer stats
  const stats = useMemo(() => {
    const dwTables = new Set(records.map(r => r.physicalTable)).size;
    const nsRecords = new Set(records.map(r => r.inferredSource.recordType).filter(Boolean)).size;
    return { dwTables, nsRecords };
  }, [records]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="w-3 h-3 opacity-50" />;
    return sortDirection === 'asc' ? (
      <ArrowUp className="w-3 h-3" />
    ) : (
      <ArrowDown className="w-3 h-3" />
    );
  };

  if (records.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center" style={{ color: 'var(--theme-text-muted)' }}>
        <div className="text-center">
          <p className="text-lg">No records to display</p>
          <p className="text-sm mt-1">Select a presentation table from the sidebar</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto" style={{ backgroundColor: 'var(--theme-bg-base)' }}>
      <table className="w-full text-sm">
        <thead
          className="sticky top-0"
          style={{
            backgroundColor: 'var(--theme-bg-panel)',
            borderBottom: '1px solid var(--theme-border-strong)',
          }}
        >
          <tr>
            {COLUMNS.map((col, colIdx) => {
              const Icon = col.icon;
              return (
                <React.Fragment key={col.field}>
                  <th
                    className="text-left"
                    style={{
                      padding: 0,
                    }}
                  >
                    <button
                      onClick={() => handleSort(col.field)}
                      className="flex items-center gap-1.5 w-full px-4 py-3 text-xs font-semibold uppercase tracking-wider transition-colors"
                      style={{
                        color: `var(${col.layerPrefix}-text)`,
                        borderLeft: `3px solid var(${col.layerPrefix})`,
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--theme-text-primary)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.color = `var(${col.layerPrefix}-text)`; }}
                    >
                      <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                      <span>{col.label}</span>
                      <SortIcon field={col.field} />
                    </button>
                  </th>
                  {/* Arrow connector between columns */}
                  {colIdx < COLUMNS.length - 1 && (
                    <th
                      className="px-0 py-3"
                      style={{
                        width: '20px',
                        minWidth: '20px',
                        backgroundColor: 'var(--theme-bg-panel)',
                      }}
                    >
                      <ChevronRight
                        className="w-3.5 h-3.5 mx-auto"
                        style={{ color: 'var(--theme-text-faint)' }}
                      />
                    </th>
                  )}
                </React.Fragment>
              );
            })}
          </tr>
        </thead>
        <tbody style={{ borderColor: 'var(--theme-border-subtle)' }}>
          {sortedRecords.map((record, idx) => {
            const tableType = getTableTypeBadge(record.physicalTable);
            const isNsaw = record.inferredSource.isNsawGenerated;
            const isDerived = isNsaw;

            return (
              <tr
                key={idx}
                className="group transition-colors"
                style={{
                  borderBottom: '1px solid var(--theme-border-subtle)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--theme-bg-inset)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '';
                }}
              >
                {/* NetSuite Field */}
                <td className="px-4 py-2.5" style={{ borderLeft: '3px solid transparent' }}>
                  {isNsaw ? (
                    <span
                      className="text-[10px] px-1.5 py-0.5 rounded font-semibold uppercase tracking-wider"
                      style={{
                        color: 'var(--theme-accent-amber-text)',
                        backgroundColor: 'var(--theme-accent-amber-bg)',
                      }}
                    >
                      NSAW
                    </span>
                  ) : record.inferredSource.fieldName ? (
                    <span className="font-mono text-xs" style={{ color: 'var(--theme-layer-netsuite-text)' }}>
                      {record.inferredSource.fieldName}
                    </span>
                  ) : (
                    <span style={{ color: 'var(--theme-text-faint)' }}>—</span>
                  )}
                </td>

                {/* Arrow spacer */}
                <td style={{ width: '20px', minWidth: '20px' }} />

                {/* NetSuite Record */}
                <td className="px-4 py-2.5">
                  {isNsaw ? (
                    <span
                      className="text-xs px-2 py-0.5 rounded"
                      style={{
                        color: 'var(--theme-accent-amber-text)',
                        backgroundColor: 'var(--theme-accent-amber-bg)',
                      }}
                    >
                      NSAW Generated
                    </span>
                  ) : record.inferredSource.recordType ? (
                    <span style={{ color: 'var(--theme-layer-netsuite-text)' }}>
                      {record.inferredSource.recordType}
                    </span>
                  ) : (
                    <span style={{ color: 'var(--theme-text-faint)' }}>—</span>
                  )}
                </td>

                {/* Arrow spacer */}
                <td style={{ width: '20px', minWidth: '20px' }} />

                {/* DW Table */}
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs" style={{ color: 'var(--theme-layer-dw-text)' }}>
                      {record.physicalTable}
                    </span>
                    {tableType.label && (
                      <span
                        className="text-[9px] px-1 py-0.5 rounded font-semibold uppercase tracking-wider flex-shrink-0"
                        style={{
                          color: tableType.isFact ? 'var(--theme-accent-amber-text)' : 'var(--theme-layer-dw-text)',
                          backgroundColor: tableType.isFact ? 'var(--theme-accent-amber-bg)' : 'var(--theme-layer-dw-bg)',
                          border: `1px solid ${tableType.isFact ? 'var(--theme-accent-amber-border)' : 'var(--theme-layer-dw-border)'}`,
                        }}
                      >
                        {tableType.label}
                      </span>
                    )}
                  </div>
                  <div className="font-mono text-[10px] mt-0.5" style={{ color: 'var(--theme-layer-dw-text)', opacity: 0.7 }}>
                    {record.physicalColumn}
                  </div>
                </td>

                {/* Arrow spacer */}
                <td style={{ width: '20px', minWidth: '20px' }} />

                {/* Presentation Column */}
                <td className="px-4 py-2.5">
                  <span className="font-medium" style={{ color: isDerived ? 'var(--theme-layer-derived-text)' : 'var(--theme-layer-semantic-text)' }}>
                    {record.presentationColumn}
                  </span>
                  {isDerived && (
                    <span className="ml-2 inline-flex items-center gap-0.5">
                      <Zap className="w-3 h-3" style={{ color: 'var(--theme-layer-derived-text)' }} />
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Footer with expanded stats */}
      <div
        className="sticky bottom-0 px-4 py-2 text-xs flex items-center gap-3"
        style={{
          backgroundColor: 'var(--theme-bg-panel)',
          borderTop: '1px solid var(--theme-border-strong)',
          color: 'var(--theme-text-muted)',
        }}
      >
        <span>{records.length} field mapping{records.length !== 1 ? 's' : ''}</span>
        <span style={{ color: 'var(--theme-border-strong)' }}>·</span>
        <span>{stats.dwTables} DW table{stats.dwTables !== 1 ? 's' : ''}</span>
        <span style={{ color: 'var(--theme-border-strong)' }}>·</span>
        <span>{stats.nsRecords} NS record{stats.nsRecords !== 1 ? 's' : ''}</span>
      </div>
    </div>
  );
};
