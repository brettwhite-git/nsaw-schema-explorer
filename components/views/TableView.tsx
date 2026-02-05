import React, { useState, useMemo } from 'react';
import { EnrichedLineageRecord } from '../../types';
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';

interface TableViewProps {
  records: EnrichedLineageRecord[];
}

type SortField = 'presentationColumn' | 'physicalTable' | 'physicalColumn' | 'inferredRecord';
type SortDirection = 'asc' | 'desc';

export const TableView: React.FC<TableViewProps> = ({ records }) => {
  const [sortField, setSortField] = useState<SortField>('presentationColumn');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  const sortedRecords = useMemo(() => {
    return [...records].sort((a, b) => {
      let aVal: string = '';
      let bVal: string = '';

      switch (sortField) {
        case 'presentationColumn':
          aVal = a.presentationColumn;
          bVal = b.presentationColumn;
          break;
        case 'physicalTable':
          aVal = a.physicalTable;
          bVal = b.physicalTable;
          break;
        case 'physicalColumn':
          aVal = a.physicalColumn;
          bVal = b.physicalColumn;
          break;
        case 'inferredRecord':
          aVal = a.inferredSource.recordType || '';
          bVal = b.inferredSource.recordType || '';
          break;
      }

      const compare = aVal.localeCompare(bVal);
      return sortDirection === 'asc' ? compare : -compare;
    });
  }, [records, sortField, sortDirection]);

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
            <th className="px-4 py-3 text-left">
              <button
                onClick={() => handleSort('presentationColumn')}
                className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wider transition-colors"
                style={{ color: 'var(--theme-text-tertiary)' }}
                onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--theme-text-primary)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--theme-text-tertiary)'; }}
              >
                Presentation Column <SortIcon field="presentationColumn" />
              </button>
            </th>
            <th className="px-4 py-3 text-left">
              <button
                onClick={() => handleSort('physicalTable')}
                className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wider transition-colors"
                style={{ color: 'var(--theme-text-tertiary)' }}
                onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--theme-text-primary)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--theme-text-tertiary)'; }}
              >
                Physical Table <SortIcon field="physicalTable" />
              </button>
            </th>
            <th className="px-4 py-3 text-left">
              <button
                onClick={() => handleSort('physicalColumn')}
                className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wider transition-colors"
                style={{ color: 'var(--theme-text-tertiary)' }}
                onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--theme-text-primary)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--theme-text-tertiary)'; }}
              >
                Physical Column <SortIcon field="physicalColumn" />
              </button>
            </th>
            <th className="px-4 py-3 text-left">
              <button
                onClick={() => handleSort('inferredRecord')}
                className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wider transition-colors"
                style={{ color: 'var(--theme-text-tertiary)' }}
                onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--theme-text-primary)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--theme-text-tertiary)'; }}
              >
                NetSuite Record <SortIcon field="inferredRecord" />
              </button>
            </th>
          </tr>
        </thead>
        <tbody style={{ borderColor: 'var(--theme-border-subtle)' }}>
          {sortedRecords.map((record, idx) => (
            <tr
              key={idx}
              className="transition-colors"
              style={{ borderBottom: '1px solid var(--theme-border-subtle)' }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--theme-bg-inset)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = ''; }}
            >
              <td className="px-4 py-2.5 font-medium" style={{ color: 'var(--theme-accent-cyan-text)' }}>
                {record.presentationColumn}
              </td>
              <td className="px-4 py-2.5 font-mono text-xs" style={{ color: 'var(--theme-accent-purple-text)' }}>
                {record.physicalTable}
              </td>
              <td className="px-4 py-2.5 font-mono text-xs" style={{ color: 'var(--theme-accent-orange-text)' }}>
                {record.physicalColumn}
              </td>
              <td className="px-4 py-2.5">
                {record.inferredSource.isNsawGenerated ? (
                  <span
                    className="text-xs px-2 py-0.5 rounded"
                    style={{
                      color: 'var(--theme-accent-amber-text)',
                      backgroundColor: 'var(--theme-accent-amber-bg)',
                    }}
                  >
                    NSAW Generated
                  </span>
                ) : (
                  <>
                    <span style={{ color: 'var(--theme-accent-emerald-text)' }}>
                      {record.inferredSource.recordType || '-'}
                    </span>
                    {record.inferredSource.fieldName && (
                      <div className="text-[10px] mt-0.5" style={{ color: 'var(--theme-layer-netsuite-text)', opacity: 0.8 }}>
                        .{record.inferredSource.fieldName}
                      </div>
                    )}
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Footer with stats */}
      <div
        className="sticky bottom-0 px-4 py-2 text-xs"
        style={{
          backgroundColor: 'var(--theme-bg-panel)',
          borderTop: '1px solid var(--theme-border-strong)',
          color: 'var(--theme-text-muted)',
        }}
      >
        {records.length} field mapping{records.length !== 1 ? 's' : ''}
      </div>
    </div>
  );
};
