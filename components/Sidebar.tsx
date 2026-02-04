
import React from 'react';
import { SubjectAreaBrowser } from './SubjectAreaBrowser';

export const Sidebar: React.FC = () => {
  return (
    <div
      className="w-80 border-r flex flex-col h-full"
      style={{
        borderColor: 'var(--theme-border-default)',
        backgroundColor: 'var(--theme-bg-base)',
      }}
    >
      <div className="p-6 pb-3">
        <h1
          className="text-xs font-semibold uppercase tracking-[0.2em] mb-4"
          style={{ color: 'var(--theme-text-muted)' }}
        >
          Subject Areas
        </h1>
        <SubjectAreaBrowser />
      </div>

    </div>
  );
};
