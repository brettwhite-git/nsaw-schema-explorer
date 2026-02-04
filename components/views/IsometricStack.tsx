import React, { useState } from 'react';
import { DatabaseIcon, WarehouseIcon, AnalyticsIcon } from './StackIcons';

// ---------- Constants ----------

export interface ArchitectureLayer {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  icon: 'database' | 'warehouse' | 'analytics';
  zOffset: number;
}

export const LAYERS: ArchitectureLayer[] = [
  {
    id: 'erp',
    title: 'NetSuite ERP',
    subtitle: 'Raw Data Source',
    description: 'Transaction-level business data including financial, inventory, and customer records stored in the primary relational database.',
    icon: 'database',
    zOffset: 50,
  },
  {
    id: 'warehouse',
    title: 'Autonomous AI Datawarehouse',
    subtitle: 'Central Storage & Processing',
    description: 'Cloud-based data repository optimized for high-performance querying and historical data analysis through automated ETL pipelines.',
    icon: 'warehouse',
    zOffset: 250,
  },
  {
    id: 'semantic',
    title: 'Semantic Layer',
    subtitle: 'Analytics & Reporting',
    description: 'Standardized business definitions and metrics that enable self-service business intelligence and consistent data interpretation.',
    icon: 'analytics',
    zOffset: 450,
  },
];

export const STACK_COLORS = {
  cyan: '#22d3ee',
  line: 'rgba(186, 230, 253, 0.4)',
  lineHighlight: '#7dd3fc',
};

// ---------- Icon resolver ----------

const ICON_MAP = {
  database: DatabaseIcon,
  warehouse: WarehouseIcon,
  analytics: AnalyticsIcon,
} as const;

// ---------- Slab (inline) ----------

interface SlabProps {
  x: number;
  y: number;
  width: number;
  height: number;
  type: 'database' | 'warehouse' | 'analytics';
  title: string;
  isActive: boolean;
  onHover: () => void;
  onLeave: () => void;
}

const Slab: React.FC<SlabProps> = ({ x, y, width, height, type, title, isActive, onHover, onLeave }) => {
  const isoPoints = [
    { x: x, y: y },                          // top
    { x: x + width, y: y + height * 0.5 },   // right
    { x: x, y: y + height },                  // bottom
    { x: x - width, y: y + height * 0.5 },   // left
  ];

  const pointsStr = isoPoints.map(p => `${p.x},${p.y}`).join(' ');
  const Icon = ICON_MAP[type];

  return (
    <g
      className="cursor-pointer transition-all duration-300"
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
    >
      {/* Glow effect when active */}
      {isActive && (
        <polygon
          points={pointsStr}
          fill={STACK_COLORS.cyan}
          fillOpacity="0.05"
          filter="blur(10px)"
        />
      )}

      {/* Main face */}
      <polygon
        points={pointsStr}
        fill={isActive ? 'rgba(34, 211, 238, 0.1)' : 'rgba(30, 41, 59, 0.4)'}
        stroke={isActive ? STACK_COLORS.cyan : STACK_COLORS.line}
        strokeWidth="1.5"
        className="transition-colors duration-300"
      />

      {/* Side faces (3D depth) */}
      <polygon
        points={`${isoPoints[2].x},${isoPoints[2].y} ${isoPoints[1].x},${isoPoints[1].y} ${isoPoints[1].x},${isoPoints[1].y + 10} ${isoPoints[2].x},${isoPoints[2].y + 10}`}
        fill="rgba(30, 41, 59, 0.6)"
        stroke={isActive ? STACK_COLORS.cyan : STACK_COLORS.line}
        strokeWidth="1"
      />
      <polygon
        points={`${isoPoints[2].x},${isoPoints[2].y} ${isoPoints[3].x},${isoPoints[3].y} ${isoPoints[3].x},${isoPoints[3].y + 10} ${isoPoints[2].x},${isoPoints[2].y + 10}`}
        fill="rgba(30, 41, 59, 0.6)"
        stroke={isActive ? STACK_COLORS.cyan : STACK_COLORS.line}
        strokeWidth="1"
      />

      {/* Internal grid lines */}
      <line x1={x - width * 0.5} y1={y + height * 0.25} x2={x + width * 0.5} y2={y + height * 0.75} stroke={STACK_COLORS.line} strokeWidth="0.5" strokeOpacity="0.3" />
      <line x1={x + width * 0.5} y1={y + height * 0.25} x2={x - width * 0.5} y2={y + height * 0.75} stroke={STACK_COLORS.line} strokeWidth="0.5" strokeOpacity="0.3" />

      {/* Icon and label */}
      <foreignObject x={x - 40} y={y + height * 0.3} width="80" height="80">
        <div className="flex flex-col items-center justify-center text-sky-200/60 transition-colors duration-300">
          <Icon className={`w-8 h-8 mb-1 ${isActive ? 'text-cyan-400' : ''}`} />
          <span className="text-[8px] uppercase tracking-widest font-mono text-center leading-tight">
            {title}
          </span>
        </div>
      </foreignObject>
    </g>
  );
};

// ---------- Main component ----------

interface IsometricStackProps {
  onLayerSelect: (id: string | null) => void;
}

export const IsometricStack: React.FC<IsometricStackProps> = ({ onLayerSelect }) => {
  const [activeLayer, setActiveLayer] = useState<string | null>(null);

  const handleHover = (id: string | null) => {
    setActiveLayer(id);
    onLayerSelect(id);
  };

  const viewBoxWidth = 1000;
  const viewBoxHeight = 800;
  const centerX = viewBoxWidth / 2;
  const baseCenterY = viewBoxHeight - 200;
  const slabWidth = 220;
  const slabHeight = 130;

  return (
    <div className="relative w-full h-full flex items-center justify-center">
      <svg
        viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`}
        className="w-full h-full max-w-5xl"
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Dashed connection lines between layers */}
        {[
          { dx: 0, dy: 0 },
          { dx: slabWidth, dy: slabHeight * 0.5 },
          { dx: 0, dy: slabHeight },
          { dx: -slabWidth, dy: slabHeight * 0.5 },
        ].map((offset, i) => (
          <line
            key={`connect-${i}`}
            x1={centerX + offset.dx}
            y1={baseCenterY - LAYERS[0].zOffset + offset.dy}
            x2={centerX + offset.dx}
            y2={baseCenterY - LAYERS[2].zOffset + offset.dy}
            stroke={STACK_COLORS.line}
            strokeWidth="0.5"
            strokeDasharray="4,4"
            className="opacity-50"
          />
        ))}

        {/* Isometric slabs (bottom → top) */}
        {LAYERS.map((layer) => (
          <Slab
            key={layer.id}
            x={centerX}
            y={baseCenterY - layer.zOffset}
            width={slabWidth}
            height={slabHeight}
            type={layer.icon}
            title={layer.title}
            isActive={activeLayer === layer.id}
            onHover={() => handleHover(layer.id)}
            onLeave={() => handleHover(null)}
          />
        ))}

        {/* Leader lines + callout labels */}
        {LAYERS.map((layer, idx) => {
          const isActive = activeLayer === layer.id;
          const yPos = baseCenterY - layer.zOffset + slabHeight * 0.5;

          return (
            <g key={`leader-${layer.id}`} className={`transition-opacity duration-300 ${isActive ? 'opacity-100' : 'opacity-20'}`}>
              <path
                d={`M ${centerX + slabWidth} ${yPos} L ${centerX + slabWidth + 60} ${yPos} L ${centerX + slabWidth + 100} ${yPos - 30}`}
                fill="none"
                stroke={isActive ? STACK_COLORS.cyan : STACK_COLORS.line}
                strokeWidth="1"
              />
              <foreignObject x={centerX + slabWidth + 110} y={yPos - 60} width="200" height="100">
                <div className="flex flex-col text-left">
                  <span className={`text-[10px] font-mono tracking-tighter uppercase ${isActive ? 'text-cyan-400' : 'text-slate-500'}`}>
                    Layer_0{idx + 1}
                  </span>
                  <span className={`text-sm font-semibold tracking-wide ${isActive ? 'text-white' : 'text-slate-400'}`}>
                    {layer.title}
                  </span>
                  <span className={`text-[9px] uppercase tracking-widest ${isActive ? 'text-cyan-500' : 'text-slate-600'}`}>
                    {layer.subtitle}
                  </span>
                </div>
              </foreignObject>
            </g>
          );
        })}
      </svg>
    </div>
  );
};
