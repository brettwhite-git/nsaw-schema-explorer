
import React, { useMemo, useState } from 'react';
import { OntologyData, NodeType, SchemaNode } from '../types';

interface GraphViewerProps {
  data: OntologyData;
  onSelectNode: (node: SchemaNode) => void;
  selectedNodeId: string | null;
}

export const GraphViewer: React.FC<GraphViewerProps> = ({ data, onSelectNode, selectedNodeId }) => {
  // Symmetrical Layout Calculation
  // Sources: Left, Pipeline: Mid-Left, Fact: Center, Dimensions/Tables: Right
  const layout = useMemo(() => {
    const coords: Record<string, { x: number, y: number }> = {};
    const width = 1200;
    const height = 800;
    const centerX = width / 2;
    const centerY = height / 2;

    const sources = data.nodes.filter(n => n.type === NodeType.SOURCE);
    const pipelines = data.nodes.filter(n => n.type === NodeType.PIPELINE);
    const facts = data.nodes.filter(n => n.type === NodeType.FACT);
    const others = data.nodes.filter(n => n.type !== NodeType.SOURCE && n.type !== NodeType.PIPELINE && n.type !== NodeType.FACT);

    sources.forEach((n, i) => {
      coords[n.id] = { x: 150, y: (height / (sources.length + 1)) * (i + 1) };
    });

    pipelines.forEach((n, i) => {
      coords[n.id] = { x: 400, y: centerY + (i - (pipelines.length - 1) / 2) * 150 };
    });

    facts.forEach((n, i) => {
      coords[n.id] = { x: 650, y: centerY + (i - (facts.length - 1) / 2) * 200 };
    });

    others.forEach((n, i) => {
      coords[n.id] = { x: 950, y: (height / (others.length + 1)) * (i + 1) };
    });

    return coords;
  }, [data]);

  const renderLink = (link: { source: string, target: string }, idx: number) => {
    const start = layout[link.source];
    const end = layout[link.target];
    if (!start || !end) return null;

    const dx = end.x - start.x;
    const midX = start.x + dx / 2;
    
    // Bezier path for clean wiring look
    const path = `M ${start.x + 80} ${start.y} 
                  C ${midX} ${start.y}, 
                    ${midX} ${end.y}, 
                    ${end.x - 80} ${end.y}`;

    return (
      <g key={`link-${idx}`}>
        <path
          d={path}
          stroke="#334155"
          strokeWidth="1.5"
          fill="none"
          strokeDasharray="4 4"
        />
        <circle cx={end.x - 80} cy={end.y} r="2.5" fill="#475569" />
      </g>
    );
  };

  return (
    <div className="flex-1 relative blueprint-grid overflow-auto bg-slate-900/20">
      {/* Structural Headers */}
      <div className="absolute top-8 left-1/2 -translate-x-1/2 w-full flex justify-around pointer-events-none px-20">
        <h3 className="text-[10px] font-bold text-slate-600 uppercase tracking-[0.4em] border-b border-slate-800 pb-2">Source Pipeline</h3>
        <h3 className="text-[10px] font-bold text-slate-600 uppercase tracking-[0.4em] border-b border-slate-800 pb-2">Semantic Core</h3>
        <h3 className="text-[10px] font-bold text-slate-600 uppercase tracking-[0.4em] border-b border-slate-800 pb-2">Downstream Graph</h3>
      </div>

      <svg width="1200" height="800" className="absolute top-0 left-0">
        <defs>
          <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>
        
        {/* Draw Links First */}
        {data.links.map((l, i) => renderLink(l, i))}

        {/* Draw Nodes */}
        {data.nodes.map((node) => {
          const { x, y } = layout[node.id];
          const isActive = selectedNodeId === node.id;
          
          return (
            <g 
              key={node.id} 
              transform={`translate(${x},${y})`} 
              className="cursor-pointer group"
              onClick={() => onSelectNode(node)}
            >
              {/* Node Box */}
              <rect
                x="-80"
                y="-30"
                width="160"
                height="60"
                rx="4"
                className={`transition-all duration-300 ${
                  isActive 
                    ? 'fill-slate-950 stroke-blue-500 stroke-2' 
                    : 'fill-slate-950 stroke-slate-700 hover:stroke-slate-500 stroke-1'
                }`}
              />
              
              {/* Left Indicator bar */}
              <rect
                x="-80"
                y="-30"
                width="3"
                height="60"
                className={`${
                  node.type === NodeType.SOURCE ? 'fill-orange-500' :
                  node.type === NodeType.PIPELINE ? 'fill-blue-500' :
                  node.type === NodeType.FACT ? 'fill-purple-500' :
                  'fill-emerald-500'
                }`}
              />

              <text
                textAnchor="middle"
                dy="4"
                className={`text-[11px] font-medium tracking-tight pointer-events-none transition-colors ${
                  isActive ? 'fill-white' : 'fill-slate-300'
                }`}
              >
                {node.label}
              </text>
              
              <text
                textAnchor="middle"
                dy="18"
                className="text-[8px] font-bold uppercase tracking-tighter fill-slate-500 pointer-events-none"
              >
                {node.type}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
};
