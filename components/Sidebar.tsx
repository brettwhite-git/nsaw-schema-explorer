
import React from 'react';
import { Activity, Database, Settings } from 'lucide-react';
import { SubjectAreaBrowser } from './SubjectAreaBrowser';

export const Sidebar: React.FC = () => {
  return (
    <div className="w-80 border-r border-slate-800 flex flex-col h-full bg-slate-950">
      <div className="p-6 pb-3">
        <h1 className="text-xs font-semibold text-slate-500 uppercase tracking-[0.2em] mb-4">Subject Areas</h1>
        <SubjectAreaBrowser />
      </div>

      <div className="p-6 pt-3">
        <h1 className="text-xs font-semibold text-slate-500 uppercase tracking-[0.2em] mb-4">Data Views</h1>
        <div className="space-y-1">
          <NavItem icon={<Activity className="w-4 h-4" />} label="Flow Health" />
          <NavItem icon={<Database className="w-4 h-4" />} label="Warehouse Ops" />
        </div>
      </div>

      <div className="mt-auto p-6 border-t border-slate-900">
        <NavItem icon={<Settings className="w-4 h-4" />} label="Settings" />
      </div>
    </div>
  );
};

const NavItem: React.FC<{ icon: React.ReactNode, label: string, active?: boolean }> = ({ icon, label, active }) => (
  <button className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-all ${
    active
      ? 'bg-blue-600/10 text-blue-400 border border-blue-500/20'
      : 'text-slate-400 hover:text-white hover:bg-slate-900'
  }`}>
    {icon}
    {label}
  </button>
);
