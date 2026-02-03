import React from 'react';
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
    <div className="flex items-center gap-1 bg-slate-900/80 rounded-lg p-1 border border-slate-800">
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

  return (
    <button
      onClick={() => !disabled && onClick(mode)}
      disabled={disabled}
      className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md transition-all ${
        disabled
          ? 'text-slate-600 cursor-not-allowed opacity-50'
          : isActive
            ? 'bg-blue-600 text-white'
            : 'text-slate-400 hover:text-white hover:bg-slate-800'
      }`}
      title={tooltip || label}
    >
      {icon}
      <span className="hidden lg:inline">{label}</span>
    </button>
  );
};
