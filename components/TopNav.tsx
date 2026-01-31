
import React from 'react';
import { Search, Layers, Database, Share2, Hexagon } from 'lucide-react';

export const TopNav: React.FC = () => {
  return (
    <div className="h-16 border-b border-slate-800 flex items-center justify-between px-6 bg-slate-900/50 backdrop-blur-md z-10">
      <div className="flex items-center gap-3">
        <div className="p-1.5 bg-blue-600/20 rounded-lg border border-blue-500/30">
          <Hexagon className="w-6 h-6 text-blue-400" />
        </div>
        <span className="text-xl font-bold tracking-tight text-white uppercase italic">Nexus</span>
      </div>

      <div className="flex-1 max-w-2xl px-8">
        <div className="relative group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-blue-400 transition-colors" />
          <input 
            type="text" 
            placeholder="Search Semantic Fields, Tables, and Objects..." 
            className="w-full bg-slate-950/50 border border-slate-800 rounded-md py-2 pl-10 pr-4 text-sm text-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-all"
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-slate-400 hover:text-white border border-slate-800 hover:border-slate-700 rounded transition-colors bg-slate-900">
          <Database className="w-3.5 h-3.5" />
          Tables
        </button>
        <button className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-slate-400 hover:text-white border border-slate-800 hover:border-slate-700 rounded transition-colors bg-slate-900">
          <Layers className="w-3.5 h-3.5" />
          Columns
        </button>
        <button className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-slate-400 hover:text-white border border-slate-800 hover:border-slate-700 rounded transition-colors bg-slate-900">
          <Share2 className="w-3.5 h-3.5" />
          Relationships
        </button>
      </div>
    </div>
  );
};
