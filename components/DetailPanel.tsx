
import React from 'react';
import { SchemaNode } from '../types';
import { FileText, Database, Info, Code, ArrowUpRight } from 'lucide-react';

interface DetailPanelProps {
  node: SchemaNode | null;
}

export const DetailPanel: React.FC<DetailPanelProps> = ({ node }) => {
  if (!node) {
    return (
      <div className="w-80 border-l border-slate-800 flex items-center justify-center p-8 bg-slate-950 text-slate-600 text-center italic">
        Select an object to view its metadata and schema details.
      </div>
    );
  }

  return (
    <div className="w-80 border-l border-slate-800 flex flex-col h-full bg-slate-950 overflow-y-auto custom-scrollbar">
      <div className="p-6 border-b border-slate-900">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-widest">Metadata & Details</h2>
          <span className="px-2 py-0.5 bg-blue-500/10 text-blue-400 text-[10px] rounded border border-blue-500/20 font-bold uppercase">
            {node.type}
          </span>
        </div>
        <h1 className="text-xl font-bold text-white mb-2">{node.label}</h1>
        <p className="text-xs text-slate-400 leading-relaxed">
          {node.description || 'No description provided for this entity.'}
        </p>
      </div>

      <div className="p-6 space-y-6">
        <section>
          <div className="flex items-center gap-2 mb-3 text-slate-300">
            <Info className="w-4 h-4 text-blue-400" />
            <h3 className="text-sm font-medium">Definition</h3>
          </div>
          <div className="p-4 bg-slate-900/50 rounded-lg border border-slate-800 text-xs text-slate-400 leading-normal font-mono">
            {node.description}
          </div>
        </section>

        {node.columns && (
          <section>
            <div className="flex items-center gap-2 mb-3 text-slate-300">
              <Database className="w-4 h-4 text-blue-400" />
              <h3 className="text-sm font-medium">Schema Fields</h3>
            </div>
            <div className="space-y-2">
              {node.columns.map((col, idx) => (
                <div key={idx} className="flex items-center justify-between p-2 rounded hover:bg-slate-900 transition-colors group cursor-default">
                  <span className="text-xs text-slate-300 group-hover:text-blue-400 transition-colors">{col.name}</span>
                  <span className="text-[10px] font-mono text-slate-500 uppercase">{col.type}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        <section>
          <div className="flex items-center gap-2 mb-3 text-slate-300">
            <Code className="w-4 h-4 text-blue-400" />
            <h3 className="text-sm font-medium">Lineage Path</h3>
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2 p-2 bg-slate-900/30 rounded border border-dashed border-slate-800">
              <span className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]" />
              <span className="text-[10px] text-slate-400 uppercase tracking-tight">Active Connection</span>
            </div>
          </div>
        </section>

        <div className="mt-8">
          <button className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white rounded font-semibold text-sm transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-900/20 active:scale-95">
            Explore {node.label}
            <ArrowUpRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
