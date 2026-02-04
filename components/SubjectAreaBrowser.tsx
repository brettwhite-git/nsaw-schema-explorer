import React, { useState, useEffect } from 'react';
import { ChevronRight, Layers, Table2, FolderOpen } from 'lucide-react';
import { useData } from '../data/DataContext';
import { FunctionalArea } from '../types';

export const SubjectAreaBrowser: React.FC = () => {
  const {
    dataIndex,
    selection,
    selectSubjectArea,
    selectPresentationTable,
    functionalAreaGroups,
  } = useData();

  // Track expanded state at both levels
  const [expandedFunctionalAreas, setExpandedFunctionalAreas] = useState<Set<FunctionalArea>>(new Set());
  const [expandedSubjectAreas, setExpandedSubjectAreas] = useState<Set<string>>(new Set());

  // Auto-expand when a subject area is selected via search
  useEffect(() => {
    if (selection.subjectArea) {
      // Find which functional area contains this subject area
      const group = functionalAreaGroups.find((g) =>
        g.subjectAreas.some((sa) => sa.name === selection.subjectArea)
      );

      if (group) {
        // Expand the functional area
        setExpandedFunctionalAreas((prev) => new Set(prev).add(group.name));
      }

      // Expand the subject area
      if (!expandedSubjectAreas.has(selection.subjectArea)) {
        setExpandedSubjectAreas((prev) => new Set(prev).add(selection.subjectArea!));
      }
    }
  }, [selection.subjectArea, functionalAreaGroups]);

  const toggleFunctionalArea = (fa: FunctionalArea) => {
    setExpandedFunctionalAreas((prev) => {
      const next = new Set(prev);
      if (next.has(fa)) {
        next.delete(fa);
      } else {
        next.add(fa);
      }
      return next;
    });
  };

  const toggleSubjectArea = (areaName: string) => {
    setExpandedSubjectAreas((prev) => {
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
    toggleSubjectArea(areaName);
  };

  const handleTableClick = (e: React.MouseEvent, subjectArea: string, tableName: string) => {
    e.stopPropagation();
    selectPresentationTable(subjectArea, tableName);
  };

  if (!dataIndex) {
    return (
      <div className="px-3 py-2 text-sm" style={{ color: 'var(--theme-text-muted)' }}>
        Loading...
      </div>
    );
  }

  if (functionalAreaGroups.length === 0) {
    return (
      <div className="px-3 py-2 text-sm" style={{ color: 'var(--theme-text-muted)' }}>
        No subject areas found
      </div>
    );
  }

  return (
    <div className="max-h-[calc(100vh-200px)] overflow-y-auto">
      <div className="space-y-0.5">
        {functionalAreaGroups.map((group) => {
          const isFaExpanded = expandedFunctionalAreas.has(group.name);

          return (
            <div key={group.name}>
              {/* Functional Area Header */}
              <button
                onClick={() => toggleFunctionalArea(group.name)}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-md cursor-pointer transition-all"
                style={{ color: 'var(--theme-text-secondary)' }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--theme-bg-hover)';
                  e.currentTarget.style.color = 'var(--theme-text-primary)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '';
                  e.currentTarget.style.color = 'var(--theme-text-secondary)';
                }}
              >
                <ChevronRight
                  className={`w-3 h-3 transition-transform duration-200 ${
                    isFaExpanded ? 'rotate-90' : ''
                  }`}
                  style={{ color: 'var(--theme-text-muted)' }}
                />
                <FolderOpen className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--theme-accent-amber-text)' }} />
                <span className="flex-1 text-left text-sm font-semibold truncate">
                  {group.name}
                </span>
                <span
                  className="text-[10px] px-1.5 py-0.5 rounded"
                  style={{
                    color: 'var(--theme-text-muted)',
                    backgroundColor: 'var(--theme-bg-elevated)',
                  }}
                >
                  {group.subjectAreas.length}
                </span>
              </button>

              {/* Subject Areas within Functional Area */}
              {isFaExpanded && (
                <div className="ml-3 mt-0.5 space-y-0.5">
                  {group.subjectAreas.map((area) => {
                    const isExpanded = expandedSubjectAreas.has(area.name);
                    const isSelected = selection.subjectArea === area.name;

                    return (
                      <div key={area.name}>
                        {/* Subject Area Header */}
                        <button
                          onClick={() => handleSubjectAreaClick(area.name)}
                          className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-md cursor-pointer transition-all border ${
                            isSelected
                              ? ''
                              : 'border-transparent'
                          }`}
                          style={
                            isSelected
                              ? {
                                  backgroundColor: 'var(--theme-accent-blue-bg)',
                                  color: 'var(--theme-accent-blue-text)',
                                  borderColor: 'var(--theme-accent-blue-border)',
                                }
                              : {
                                  color: 'var(--theme-text-tertiary)',
                                }
                          }
                          onMouseEnter={(e) => {
                            if (!isSelected) {
                              e.currentTarget.style.backgroundColor = 'var(--theme-bg-hover)';
                              e.currentTarget.style.color = 'var(--theme-text-primary)';
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (!isSelected) {
                              e.currentTarget.style.backgroundColor = '';
                              e.currentTarget.style.color = 'var(--theme-text-tertiary)';
                            }
                          }}
                        >
                          <ChevronRight
                            className={`w-3 h-3 transition-transform duration-200 ${
                              isExpanded ? 'rotate-90' : ''
                            }`}
                            style={{ color: 'var(--theme-text-muted)' }}
                          />
                          <Layers className="w-3.5 h-3.5 flex-shrink-0" />
                          <span className="flex-1 text-left text-xs font-medium truncate">
                            {area.name.replace(/^NetSuite - /, '')}
                          </span>
                        </button>

                        {/* Presentation Tables */}
                        {isExpanded && (
                          <div className="ml-4 mt-0.5 space-y-0.5">
                            {area.presentationTables.map((tableName) => {
                              const isTableSelected =
                                selection.subjectArea === area.name &&
                                selection.presentationTable === tableName;

                              return (
                                <button
                                  key={tableName}
                                  onClick={(e) => handleTableClick(e, area.name, tableName)}
                                  className="w-full flex items-center gap-2 pl-4 pr-2 py-1 text-left rounded transition-all"
                                  style={
                                    isTableSelected
                                      ? {
                                          color: 'var(--theme-accent-blue-text)',
                                          backgroundColor: 'var(--theme-accent-blue-bg)',
                                        }
                                      : {
                                          color: 'var(--theme-text-muted)',
                                        }
                                  }
                                  onMouseEnter={(e) => {
                                    if (!isTableSelected) {
                                      e.currentTarget.style.color = 'var(--theme-text-primary)';
                                      e.currentTarget.style.backgroundColor = 'var(--theme-bg-inset)';
                                    }
                                  }}
                                  onMouseLeave={(e) => {
                                    if (!isTableSelected) {
                                      e.currentTarget.style.color = 'var(--theme-text-muted)';
                                      e.currentTarget.style.backgroundColor = '';
                                    }
                                  }}
                                >
                                  <Table2 className="w-3 h-3 flex-shrink-0" />
                                  <span className="text-xs truncate">{tableName}</span>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
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
