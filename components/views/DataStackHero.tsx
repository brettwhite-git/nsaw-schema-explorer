import React, { useState } from 'react';
import { IsometricStack } from './IsometricStack';
import { StackInfoPanel } from './StackInfoPanel';

export const DataStackHero: React.FC = () => {
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);

  return (
    <div className="flex-1 w-full h-full relative blueprint-grid overflow-hidden bg-slate-900/20">
      {/* HUD inner border */}
      <div className="absolute inset-0 border border-cyan-900/30 m-4 pointer-events-none" />

      {/* Corner brackets */}
      <div className="absolute top-4 left-4 w-3 h-3 border-t border-l border-cyan-500/50 z-20" />
      <div className="absolute top-4 right-4 w-3 h-3 border-t border-r border-cyan-500/50 z-20" />
      <div className="absolute bottom-4 left-4 w-3 h-3 border-b border-l border-cyan-500/50 z-20" />
      <div className="absolute bottom-4 right-4 w-3 h-3 border-b border-r border-cyan-500/50 z-20" />

      {/* Isometric 3D data stack */}
      <main className="w-full h-full flex items-center justify-center p-8">
        <IsometricStack onLayerSelect={setSelectedLayerId} />
      </main>

      {/* Info overlay */}
      <StackInfoPanel layerId={selectedLayerId} />
    </div>
  );
};
