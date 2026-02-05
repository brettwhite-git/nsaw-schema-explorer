import React, { useState } from 'react';
import { IsometricStack } from './IsometricStack';
import { StackInfoPanel } from './StackInfoPanel';

export const DataStackHero: React.FC = () => {
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);

  return (
    <div
      className="flex-1 w-full h-full relative blueprint-grid overflow-hidden"
      style={{ backgroundColor: 'var(--theme-bg-inset)' }}
    >
      {/* HUD inner border */}
      <div
        className="absolute inset-0 m-4 pointer-events-none"
        style={{ border: '1px solid var(--theme-hud-border)', opacity: 0.6 }}
      />

      {/* Corner brackets */}
      <div className="absolute top-4 left-4 w-3 h-3 z-20" style={{ borderTop: '1px solid var(--theme-hud-border)', borderLeft: '1px solid var(--theme-hud-border)' }} />
      <div className="absolute top-4 right-4 w-3 h-3 z-20" style={{ borderTop: '1px solid var(--theme-hud-border)', borderRight: '1px solid var(--theme-hud-border)' }} />
      <div className="absolute bottom-4 left-4 w-3 h-3 z-20" style={{ borderBottom: '1px solid var(--theme-hud-border)', borderLeft: '1px solid var(--theme-hud-border)' }} />
      <div className="absolute bottom-4 right-4 w-3 h-3 z-20" style={{ borderBottom: '1px solid var(--theme-hud-border)', borderRight: '1px solid var(--theme-hud-border)' }} />

      {/* Isometric 3D data stack */}
      <main className="w-full h-full flex items-center justify-center p-8">
        <IsometricStack onLayerSelect={setSelectedLayerId} />
      </main>

      {/* Info overlay */}
      <StackInfoPanel layerId={selectedLayerId} />
    </div>
  );
};
