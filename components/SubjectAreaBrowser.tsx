import React, { useState, useEffect } from 'react';
import { ChevronRight, Layers, Table2 } from 'lucide-react';
import { useData } from '../data/DataContext';

export const SubjectAreaBrowser: React.FC = () => {
  const { dataIndex, selection, selectSubjectArea, selectPresentationTable } = useData();
  const [expandedAreas, setExpandedAreas] = useState<Set<string>>(new Set());

  // Auto-expand when a subject area is selected via search
  useEffect(() => {
    if (selection.subjectArea && !expandedAreas.has(selection.subjectArea)) {
      setExpandedAreas(prev => new Set(prev).add(selection.subjectArea!));
    }
  }, [selection.subjectArea]);

  const toggleExpand = (areaName: string) => {
    setExpandedAreas(prev => {
      const next = new Set(prev);
      if (next.has(areaName)) {
        next.delete(areaName);
      } else {
        next.add(areaName);
      }
      return next;
    });
  };

  const handleSubjectAreaClick = (areaName: string) => {
    selectSubjectArea(areaName);
    // Also toggle expand
    toggleExpand(areaName);
  };

  const handleTableClick = (e: React.MouseEvent, subjectArea: string, tableName: string) => {
    e.stopPropagation();
    selectPresentationTable(subjectArea, tableName);
  };

  if (!dataIndex) {
    return (
      <div className="px-3 py-2 text-sm text-slate-500">
        Loading...
      </div>
    );
  }

  if (dataIndex.subjectAreas.length === 0) {
    return (
      <div className="px-3 py-2 text-sm text-slate-500">
        No subject areas found
      </div>
    );
  }

  return (
    <div className="max-h-[calc(100vh-200px)] overflow-y-auto">
      <div className="space-y-0.5">
        {dataIndex.subjectAreas.map(area => {
          const isExpanded = expandedAreas.has(area.name);
          const isSelected = selection.subjectArea === area.name;

          return (
            <div key={area.name}>
              {/* Subject Area Header */}
              <button
                onClick={() => handleSubjectAreaClick(area.name)}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-md cursor-pointer transition-all ${
                  isSelected
                    ? 'bg-blue-600/10 text-blue-400 border border-blue-500/20'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-white border border-transparent'
                }`}
              >
                <ChevronRight
                  className={`w-3 h-3 text-slate-500 transition-transform duration-200 ${
                    isExpanded ? 'rotate-90' : ''
                  }`}
                />
                <Layers className="w-4 h-4 flex-shrink-0" />
                <span className="flex-1 text-left text-sm font-medium truncate">
                  {area.name.replace(/^NetSuite - /, '')}
                </span>
              </button>

              {/* Presentation Tables List */}
              {isExpanded && (
                <div className="ml-2 mt-0.5 mb-1">
                  {area.presentationTables.map(tableName => {
                    const isTableSelected =
                      selection.subjectArea === area.name &&
                      selection.presentationTable === tableName;

                    return (
                      <button
                        key={tableName}
                        onClick={(e) => handleTableClick(e, area.name, tableName)}
                        className={`w-full flex items-center gap-2 pl-6 pr-3 py-1.5 text-left rounded-md transition-all ${
                          isTableSelected
                            ? 'text-blue-400 bg-blue-600/5'
                            : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                        }`}
                      >
                        <Table2 className="w-3.5 h-3.5 flex-shrink-0" />
                        <span className="text-sm truncate">{tableName}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
