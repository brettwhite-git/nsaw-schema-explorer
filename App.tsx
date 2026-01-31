
import React, { useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { TopNav } from './components/TopNav';
import { GraphViewer } from './components/GraphViewer';
import { DetailPanel } from './components/DetailPanel';
import { INITIAL_DATA } from './constants';
import { SchemaNode } from './types';

const App: React.FC = () => {
  const [selectedNode, setSelectedNode] = useState<SchemaNode | null>(null);

  return (
    <div className="flex flex-col h-screen overflow-hidden selection:bg-blue-500/30">
      <TopNav />
      
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        
        <main className="flex-1 flex flex-col min-w-0 bg-slate-950">
          <div className="p-8 border-b border-slate-900 bg-slate-900/20">
            <h1 className="text-3xl font-light text-white tracking-tight mb-2">ONTOLOGY TRACEABILITY</h1>
            <p className="text-sm text-slate-500 max-w-2xl">
              Visualize the end-to-end lineage of semantic objects from ingestion to consumption. 
              Analyze dependencies and schema contracts across the enterprise graph.
            </p>
          </div>

          <div className="flex-1 flex overflow-hidden">
            <GraphViewer 
              data={INITIAL_DATA} 
              onSelectNode={setSelectedNode}
              selectedNodeId={selectedNode?.id || null}
            />
            <DetailPanel node={selectedNode} />
          </div>
        </main>
      </div>

      <footer className="h-8 border-t border-slate-900 bg-slate-950 flex items-center justify-between px-6 text-[10px] text-slate-600 font-mono tracking-wider">
        <div className="flex gap-4 uppercase">
          <span>Status: Synchronized</span>
          <span>Version: 3.4.12-LTS</span>
        </div>
        <div className="flex gap-4">
          <span className="text-blue-500/80">LATENCY: 14ms</span>
          <span>SMM: 0.992</span>
        </div>
      </footer>
    </div>
  );
};

export default App;
