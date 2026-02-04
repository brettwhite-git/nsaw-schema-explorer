import React from 'react';
import { ArchitectureLayer, LAYERS } from './IsometricStack';

interface StackInfoPanelProps {
  layerId: string | null;
}

/** Per-layer technical properties (static metadata) */
const LAYER_PROPERTIES: Record<string, { latency: string; storage: string; auth: string; schema: string }> = {
  erp: {
    latency: 'Transactional',
    storage: 'Oracle RDBMS',
    auth: 'OAuth 2.0 / JWT',
    schema: 'Relational',
  },
  warehouse: {
    latency: 'Near Real-Time',
    storage: 'Elastic Cloud',
    auth: 'OAuth 2.0 / JWT',
    schema: 'Star / Snowflake',
  },
  semantic: {
    latency: 'On-Demand',
    storage: 'Virtual Layer',
    auth: 'Role-Based',
    schema: 'Presentation Model',
  },
};

export const StackInfoPanel: React.FC<StackInfoPanelProps> = ({ layerId }) => {
  const layer: ArchitectureLayer | undefined = LAYERS.find(l => l.id === layerId) || undefined;

  // No layer hovered — render nothing
  if (!layer) return null;

  // Layer hovered — show full specification
  const props = LAYER_PROPERTIES[layer.id];

  return (
    <div className="absolute top-6 left-6 max-w-sm p-6 border-l border-cyan-500/50 bg-slate-900/20 backdrop-blur-sm transition-all duration-500 ease-out z-10">
      <div className="flex items-center gap-2 mb-2">
        <div className="h-px w-8 bg-cyan-500" />
        <span className="text-[10px] font-mono text-cyan-400 tracking-widest uppercase">System Specification</span>
      </div>
      <h2 className="text-3xl font-light text-white tracking-tight leading-none mb-1">
        {layer.title}
      </h2>
      <p className="text-cyan-600 text-[10px] font-mono uppercase tracking-[0.2em] mb-6">
        {layer.subtitle}
      </p>

      <div className="space-y-4">
        <div>
          <h4 className="text-[9px] font-mono text-slate-500 uppercase tracking-widest mb-1">Functional Overview</h4>
          <p className="text-sm text-slate-400 leading-relaxed font-light">
            {layer.description}
          </p>
        </div>

        <div className="pt-4 border-t border-slate-800">
          <h4 className="text-[9px] font-mono text-slate-500 uppercase tracking-widest mb-2">Technical Properties</h4>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-[8px] text-slate-600 uppercase">Input Latency</p>
              <p className="text-xs text-cyan-200/70 font-mono">{props.latency}</p>
            </div>
            <div>
              <p className="text-[8px] text-slate-600 uppercase">Storage Type</p>
              <p className="text-xs text-cyan-200/70 font-mono">{props.storage}</p>
            </div>
            <div>
              <p className="text-[8px] text-slate-600 uppercase">Auth Protocol</p>
              <p className="text-xs text-cyan-200/70 font-mono">{props.auth}</p>
            </div>
            <div>
              <p className="text-[8px] text-slate-600 uppercase">Schema</p>
              <p className="text-xs text-cyan-200/70 font-mono">{props.schema}</p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
