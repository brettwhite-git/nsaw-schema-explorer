import React from 'react';
import { Hexagon, Database, Loader2 } from 'lucide-react';

interface LoadingScreenProps {
  message?: string;
  error?: string | null;
}

export const LoadingScreen: React.FC<LoadingScreenProps> = ({
  message = 'Loading NSAW Lineage Data...',
  error,
}) => {
  if (error) {
    return (
      <div className="fixed inset-0 bg-slate-950 flex items-center justify-center z-50">
        <div className="text-center">
          <div className="p-4 bg-red-500/10 rounded-xl border border-red-500/20 mb-6">
            <Database className="w-16 h-16 text-red-400 mx-auto" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Failed to Load Data</h2>
          <p className="text-sm text-red-400 max-w-md">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-6 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-md text-sm font-medium transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-slate-950 flex items-center justify-center z-50">
      <div className="text-center">
        <div className="relative mb-8">
          <div className="p-4 bg-blue-600/10 rounded-xl border border-blue-500/20">
            <Hexagon className="w-16 h-16 text-blue-400" />
          </div>
          <div className="absolute -bottom-2 -right-2 p-2 bg-slate-900 rounded-full border border-slate-800">
            <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />
          </div>
        </div>

        <h1 className="text-2xl font-bold text-white mb-2 tracking-tight">
          NSAW
        </h1>
        <p className="text-sm text-slate-400 mb-4">{message}</p>

        <div className="w-64 h-1 bg-slate-800 rounded-full overflow-hidden">
          <div className="h-full bg-blue-500 rounded-full animate-pulse w-2/3" />
        </div>

        <p className="text-xs text-slate-600 mt-4">
          Indexing 56,000+ field mappings...
        </p>
      </div>
    </div>
  );
};
