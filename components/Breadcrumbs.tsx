import React from 'react';
import { ChevronRight, Home } from 'lucide-react';
import { useData } from '../data/DataContext';

export function Breadcrumbs() {
  const { selection, functionalAreaGroups, selectSubjectArea } = useData();

  // Find the functional area that contains this subject area
  const functionalArea = selection.subjectArea
    ? functionalAreaGroups.find(g =>
        g.subjectAreas.some(sa => sa.name === selection.subjectArea)
      )?.name
    : null;

  // If nothing selected, show just "Home" or app name
  if (!selection.subjectArea) {
    return (
      <div className="flex items-center gap-2 text-sm">
        <Home className="w-4 h-4 text-slate-400" />
        <span className="text-slate-300 font-medium">Schema Explorer</span>
      </div>
    );
  }

  return (
    <nav className="flex items-center gap-1.5 text-sm flex-wrap">
      {/* Home button - always visible */}
      <button
        onClick={() => selectSubjectArea(null)}
        className="text-slate-400 hover:text-white transition-colors p-1 -ml-1 rounded hover:bg-slate-800"
        title="Back to home"
      >
        <Home className="w-4 h-4" />
      </button>

      {/* Functional Area */}
      {functionalArea && (
        <>
          <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
          <span className="text-slate-400">{functionalArea}</span>
        </>
      )}

      {/* Subject Area */}
      <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
      {selection.presentationTable ? (
        <button
          onClick={() => selectSubjectArea(selection.subjectArea)}
          className="text-blue-400 hover:text-blue-300 transition-colors hover:underline"
        >
          {selection.subjectArea}
        </button>
      ) : (
        <span className="text-white font-medium">{selection.subjectArea}</span>
      )}

      {/* Presentation Table */}
      {selection.presentationTable && (
        <>
          <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
          <span className="text-white font-medium">{selection.presentationTable}</span>
        </>
      )}
    </nav>
  );
}
