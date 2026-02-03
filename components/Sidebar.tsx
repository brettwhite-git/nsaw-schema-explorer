
import React from 'react';
import { SubjectAreaBrowser } from './SubjectAreaBrowser';

export const Sidebar: React.FC = () => {
  return (
    <div className="w-80 border-r border-slate-800 flex flex-col h-full bg-slate-950">
      <div className="p-6 pb-3">
        <h1 className="text-xs font-semibold text-slate-500 uppercase tracking-[0.2em] mb-4">Subject Areas</h1>
        <SubjectAreaBrowser />
      </div>

    </div>
  );
};