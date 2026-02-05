import React, { useState } from 'react';
import { ChevronRight, Home } from 'lucide-react';
import { useData } from '../data/DataContext';

export function Breadcrumbs() {
  const { selection, functionalAreaGroups, selectSubjectArea } = useData();
  const [homeHovered, setHomeHovered] = useState(false);
  const [subjectAreaHovered, setSubjectAreaHovered] = useState(false);

  // Find the functional area that contains this subject area
  const functionalArea = selection.subjectArea
    ? functionalAreaGroups.find(g =>
        g.subjectAreas.some(sa => sa.name === selection.subjectArea)
      )?.name
    : null;

  // If nothing selected, show just the home button
  if (!selection.subjectArea) {
    return (
      <div className="flex items-center">
        <div
          className="flex items-center justify-center rounded-md px-2 py-1.5 border"
          style={{
            backgroundColor: 'var(--theme-bg-panel)',
            borderColor: 'var(--theme-border-default)',
            color: 'var(--theme-text-tertiary)',
          }}
        >
          <Home className="w-3.5 h-3.5" />
        </div>
      </div>
    );
  }

  return (
    <nav className="flex items-center gap-1.5 text-sm flex-wrap">
      {/* Home button - always visible, sized to match ViewModeSelector buttons */}
      <button
        onClick={() => selectSubjectArea(null)}
        onMouseEnter={() => setHomeHovered(true)}
        onMouseLeave={() => setHomeHovered(false)}
        className="flex items-center justify-center rounded-md px-2 py-1.5 border transition-all"
        style={{
          color: homeHovered ? 'var(--theme-text-primary)' : 'var(--theme-text-tertiary)',
          backgroundColor: homeHovered ? 'var(--theme-bg-hover)' : 'var(--theme-bg-panel)',
          borderColor: homeHovered ? 'var(--theme-border-hover)' : 'var(--theme-border-default)',
        }}
        title="Back to home"
      >
        <Home className="w-3.5 h-3.5" />
      </button>

      {/* Functional Area */}
      {functionalArea && (
        <>
          <ChevronRight className="w-3.5 h-3.5" style={{ color: 'var(--theme-text-faint)' }} />
          <span style={{ color: 'var(--theme-text-tertiary)' }}>{functionalArea}</span>
        </>
      )}

      {/* Subject Area */}
      <ChevronRight className="w-3.5 h-3.5" style={{ color: 'var(--theme-text-faint)' }} />
      {selection.presentationTable ? (
        <button
          onClick={() => selectSubjectArea(selection.subjectArea)}
          onMouseEnter={() => setSubjectAreaHovered(true)}
          onMouseLeave={() => setSubjectAreaHovered(false)}
          className="transition-colors"
          style={{
            color: subjectAreaHovered ? 'var(--theme-accent-cyan-light)' : 'var(--theme-accent-cyan-text)',
            textDecoration: subjectAreaHovered ? 'underline' : 'none',
          }}
        >
          {selection.subjectArea}
        </button>
      ) : (
        <span className="font-medium" style={{ color: 'var(--theme-text-primary)' }}>
          {selection.subjectArea}
        </span>
      )}

      {/* Presentation Table */}
      {selection.presentationTable && (
        <>
          <ChevronRight className="w-3.5 h-3.5" style={{ color: 'var(--theme-text-faint)' }} />
          <span className="font-medium" style={{ color: 'var(--theme-text-primary)' }}>
            {selection.presentationTable}
          </span>
        </>
      )}
    </nav>
  );
}
