import React, { useState } from 'react';
import { Hexagon, Database, Loader2 } from 'lucide-react';

interface LoadingScreenProps {
  message?: string;
  error?: string | null;
}

export const LoadingScreen: React.FC<LoadingScreenProps> = ({
  message = 'Loading NSAW Lineage Data...',
  error,
}) => {
  const [retryHovered, setRetryHovered] = useState(false);

  if (error) {
    return (
      <div
        className="fixed inset-0 flex items-center justify-center z-50"
        style={{ backgroundColor: 'var(--theme-bg-base)' }}
      >
        <div className="text-center">
          <div
            className="p-4 rounded-xl border mb-6"
            style={{
              backgroundColor: 'var(--theme-accent-red-bg)',
              borderColor: 'var(--theme-accent-red-border)',
            }}
          >
            <Database className="w-16 h-16 mx-auto" style={{ color: 'var(--theme-accent-red-text)' }} />
          </div>
          <h2
            className="text-xl font-bold mb-2"
            style={{ color: 'var(--theme-text-primary)' }}
          >
            Failed to Load Data
          </h2>
          <p
            className="text-sm max-w-md"
            style={{ color: 'var(--theme-accent-red-text)' }}
          >
            {error}
          </p>
          <button
            onClick={() => window.location.reload()}
            onMouseEnter={() => setRetryHovered(true)}
            onMouseLeave={() => setRetryHovered(false)}
            className="mt-6 px-4 py-2 rounded-md text-sm font-medium transition-colors"
            style={{
              backgroundColor: retryHovered ? 'var(--theme-accent-cyan)' : 'var(--theme-accent-cyan-dark)',
              color: 'var(--theme-text-primary)',
            }}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-50"
      style={{ backgroundColor: 'var(--theme-bg-base)' }}
    >
      <div className="text-center">
        <div className="relative mb-8">
          <div
            className="p-4 rounded-xl border"
            style={{
              backgroundColor: 'var(--theme-accent-cyan-bg)',
              borderColor: 'var(--theme-accent-cyan-border)',
            }}
          >
            <Hexagon className="w-16 h-16" style={{ color: 'var(--theme-accent-cyan-text)' }} />
          </div>
          <div
            className="absolute -bottom-2 -right-2 p-2 rounded-full border"
            style={{
              backgroundColor: 'var(--theme-bg-panel)',
              borderColor: 'var(--theme-border-default)',
            }}
          >
            <Loader2 className="w-5 h-5 animate-spin" style={{ color: 'var(--theme-accent-cyan-text)' }} />
          </div>
        </div>

        <h1
          className="text-2xl font-bold mb-2 tracking-tight"
          style={{ color: 'var(--theme-text-primary)' }}
        >
          NSAW
        </h1>
        <p
          className="text-sm mb-4"
          style={{ color: 'var(--theme-text-tertiary)' }}
        >
          {message}
        </p>

        <div
          className="w-64 h-1 rounded-full overflow-hidden"
          style={{ backgroundColor: 'var(--theme-bg-elevated)' }}
        >
          <div
            className="h-full rounded-full animate-pulse w-2/3"
            style={{ backgroundColor: 'var(--theme-accent-cyan)' }}
          />
        </div>

        <p
          className="text-xs mt-4"
          style={{ color: 'var(--theme-text-faint)' }}
        >
          Indexing 56,000+ field mappings...
        </p>
      </div>
    </div>
  );
};
