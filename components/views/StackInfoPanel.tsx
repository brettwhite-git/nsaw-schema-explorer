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

  // No layer hovered -- render nothing
  if (!layer) return null;

  // Layer hovered -- show full specification
  const props = LAYER_PROPERTIES[layer.id];

  return (
    <div
      className="absolute top-6 left-6 max-w-sm p-6 backdrop-blur-sm transition-all duration-500 ease-out z-10"
      style={{
        borderLeft: '1px solid var(--theme-accent-cyan-border)',
        background: 'var(--theme-bg-inset)',
      }}
    >
      <div className="flex items-center gap-2 mb-2">
        <div className="h-px w-8" style={{ background: 'var(--theme-accent-cyan)' }} />
        <span className="text-[10px] font-mono tracking-widest uppercase"
          style={{ color: 'var(--theme-accent-cyan-text)' }}>System Specification</span>
      </div>
      <h2 className="text-3xl font-light tracking-tight leading-none mb-1"
        style={{ color: 'var(--theme-text-primary)' }}>
        {layer.title}
      </h2>
      <p className="text-[10px] font-mono uppercase tracking-[0.2em] mb-6"
        style={{ color: 'var(--theme-accent-cyan-dark)' }}>
        {layer.subtitle}
      </p>

      <div className="space-y-4">
        <div>
          <h4 className="text-[9px] font-mono uppercase tracking-widest mb-1"
            style={{ color: 'var(--theme-text-muted)' }}>Functional Overview</h4>
          <p className="text-sm leading-relaxed font-light"
            style={{ color: 'var(--theme-text-tertiary)' }}>
            {layer.description}
          </p>
        </div>

        <div className="pt-4" style={{ borderTop: '1px solid var(--theme-border-default)' }}>
          <h4 className="text-[9px] font-mono uppercase tracking-widest mb-2"
            style={{ color: 'var(--theme-text-muted)' }}>Technical Properties</h4>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-[8px] uppercase" style={{ color: 'var(--theme-text-faint)' }}>Input Latency</p>
              <p className="text-xs font-mono" style={{ color: 'var(--theme-accent-cyan-text)', opacity: 0.7 }}>{props.latency}</p>
            </div>
            <div>
              <p className="text-[8px] uppercase" style={{ color: 'var(--theme-text-faint)' }}>Storage Type</p>
              <p className="text-xs font-mono" style={{ color: 'var(--theme-accent-cyan-text)', opacity: 0.7 }}>{props.storage}</p>
            </div>
            <div>
              <p className="text-[8px] uppercase" style={{ color: 'var(--theme-text-faint)' }}>Auth Protocol</p>
              <p className="text-xs font-mono" style={{ color: 'var(--theme-accent-cyan-text)', opacity: 0.7 }}>{props.auth}</p>
            </div>
            <div>
              <p className="text-[8px] uppercase" style={{ color: 'var(--theme-text-faint)' }}>Schema</p>
              <p className="text-xs font-mono" style={{ color: 'var(--theme-accent-cyan-text)', opacity: 0.7 }}>{props.schema}</p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
