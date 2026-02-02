import React from 'react';
import { useData } from '../data/DataContext';

/**
 * GraphLegend - Shows color meanings for the graph visualization
 * Appears below view mode buttons when a table is selected
 */
export const GraphLegend: React.FC = () => {
  const { selection, viewMode } = useData();

  // Only show when a table is selected
  if (!selection.presentationTable) {
    return null;
  }

  // Different legend items based on view mode
  const legendItems = [
    { color: 'bg-blue-500', label: 'Presentation Fields', show: true },
    { color: 'bg-purple-500', label: 'DW Tables', show: true },
    { color: 'bg-orange-500', label: 'DW Columns', show: viewMode === 'detailedFlow' },
  ].filter((item) => item.show);

  return (
    <div className="flex items-center gap-4 text-[10px] text-slate-500">
      {legendItems.map((item) => (
        <div key={item.label} className="flex items-center gap-1.5">
          <span className={`w-2 h-2 rounded-full ${item.color}`} />
          <span>{item.label}</span>
        </div>
      ))}
    </div>
  );
};
