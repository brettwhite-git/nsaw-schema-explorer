import React, { useState } from 'react';
import { Workflow, LayoutGrid } from 'lucide-react';
import { useData } from '../data/DataContext';
import { ViewMode } from '../types';

/**
 * ViewModeSelector - Buttons for switching between visualization modes
 * Both Detailed and Table modes require a table selection
 */
export const ViewModeSelector: React.FC = () => {
  const { viewMode, setViewMode, selection } = useData();

  const isTableModeDisabled = !selection.presentationTable;

  return (
    <div
      className="flex items-center gap-1 rounded-lg p-1 border"
      style={{
        backgroundColor: 'var(--theme-bg-panel)',
        borderColor: 'var(--theme-border-default)',
      }}
    >
      <ViewModeButton
        mode="detailedFlow"
        currentMode={viewMode}
        onClick={setViewMode}
        icon={<Workflow className="w-3.5 h-3.5" />}
        label="Detailed"
        tooltip="3-column view with physical columns"
        disabled={isTableModeDisabled}
      />
      <ViewModeButton
        mode="table"
        currentMode={viewMode}
        onClick={setViewMode}
        icon={<LayoutGrid className="w-3.5 h-3.5" />}
        label="Table"
        tooltip="Sortable spreadsheet view"
        disabled={isTableModeDisabled}
      />
    </div>
  );
};

// View Mode Button Component
interface ViewModeButtonProps {
  mode: ViewMode;
  currentMode: ViewMode;
  onClick: (mode: ViewMode) => void;
  icon: React.ReactNode;
  label: string;
  tooltip?: string;
  disabled?: boolean;
}

const ViewModeButton: React.FC<ViewModeButtonProps> = ({
  mode,
  currentMode,
  onClick,
  icon,
  label,
  tooltip,
  disabled = false,
}) => {
  const isActive = mode === currentMode;
  const [hovered, setHovered] = useState(false);

  const getStyle = (): React.CSSProperties => {
    if (disabled) {
      return { color: 'var(--theme-text-faint)', opacity: 0.5 };
    }
    if (isActive) {
      return {
        backgroundColor: 'var(--theme-accent-cyan-dark)',
        color: '#ffffff', // White text for strong contrast on saturated blue background
      };
    }
    if (hovered) {
      return {
        color: 'var(--theme-text-primary)',
        backgroundColor: 'var(--theme-bg-hover)',
      };
    }
    return { color: 'var(--theme-text-tertiary)' };
  };

  return (
    <button
      onClick={() => !disabled && onClick(mode)}
      disabled={disabled}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md transition-all ${
        disabled ? 'cursor-not-allowed' : ''
      }`}
      style={getStyle()}
      title={tooltip || label}
    >
      {icon}
      <span className="hidden lg:inline">{label}</span>
    </button>
  );
};
