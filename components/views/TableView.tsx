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
      <div className="flex-1 flex items-center justify-center text-slate-500">
        <div className="text-center">
          <p className="text-lg">No records to display</p>
          <p className="text-sm mt-1">Select a presentation table from the sidebar</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto bg-slate-950/30">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-slate-900 border-b border-slate-700">
          <tr>
            <th className="px-4 py-3 text-left">
              <button
                onClick={() => handleSort('presentationColumn')}
                className="flex items-center gap-1 text-xs font-semibold text-slate-400 uppercase tracking-wider hover:text-white transition-colors"
              >
                Presentation Column <SortIcon field="presentationColumn" />
              </button>
            </th>
            <th className="px-4 py-3 text-left">
              <button
                onClick={() => handleSort('physicalTable')}
                className="flex items-center gap-1 text-xs font-semibold text-slate-400 uppercase tracking-wider hover:text-white transition-colors"
              >
                Physical Table <SortIcon field="physicalTable" />
              </button>
            </th>
            <th className="px-4 py-3 text-left">
              <button
                onClick={() => handleSort('physicalColumn')}
                className="flex items-center gap-1 text-xs font-semibold text-slate-400 uppercase tracking-wider hover:text-white transition-colors"
              >
                Physical Column <SortIcon field="physicalColumn" />
              </button>
            </th>
            <th className="px-4 py-3 text-left">
              <button
                onClick={() => handleSort('inferredRecord')}
                className="flex items-center gap-1 text-xs font-semibold text-slate-400 uppercase tracking-wider hover:text-white transition-colors"
              >
                NetSuite Record <SortIcon field="inferredRecord" />
              </button>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800/50">
          {sortedRecords.map((record, idx) => (
            <tr key={idx} className="hover:bg-slate-800/50 transition-colors">
              <td className="px-4 py-2.5 text-blue-400 font-medium">
                {record.presentationColumn}
              </td>
              <td className="px-4 py-2.5 font-mono text-xs text-purple-300">
                {record.physicalTable}
              </td>
              <td className="px-4 py-2.5 font-mono text-xs text-orange-300">
                {record.physicalColumn}
              </td>
              <td className="px-4 py-2.5">
                {record.inferredSource.isNsawGenerated ? (
                  <span className="text-amber-500 text-xs bg-amber-500/10 px-2 py-0.5 rounded">
                    NSAW Generated
                  </span>
                ) : (
                  <span className="text-emerald-400">
                    {record.inferredSource.recordType || '-'}
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Footer with stats */}
      <div className="sticky bottom-0 bg-slate-900 border-t border-slate-700 px-4 py-2 text-xs text-slate-500">
        {records.length} field mapping{records.length !== 1 ? 's' : ''}
      </div>
    </div>
  );
};
