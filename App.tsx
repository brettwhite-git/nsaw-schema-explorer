import React from 'react';
import { Sidebar } from './components/Sidebar';
import { TopNav } from './components/TopNav';
import { GraphViewer } from './components/GraphViewer';
import { DetailPanel } from './components/DetailPanel';
import { LoadingScreen } from './components/LoadingScreen';
import { DataProvider, useData } from './data/DataContext';

const AppContent: React.FC = () => {
  const { isLoading, error, dataIndex, selection, selectedRecords } = useData();

  // Show loading screen while data loads
  if (isLoading) {
    return <LoadingScreen />;
  }

  // Show error if data failed to load
  if (error) {
    return <LoadingScreen error={error} />;
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden selection:bg-blue-500/30">
      <TopNav />

      <div className="flex flex-1 overflow-hidden">
        <Sidebar />

        <main className="flex-1 flex flex-col min-w-0 bg-slate-950">
          <div className="p-4 px-6 border-b border-slate-900 bg-slate-900/20">
            <h1 className="text-lg font-light text-white tracking-tight mb-1">
              {selection.presentationTable
                ? `${selection.presentationTable}`
                : 'NSAW Schema Explorer'}
            </h1>
            <p className="text-xs text-slate-500 max-w-2xl">
              {selection.presentationTable
                ? `${selectedRecords.length} field mappings in ${selection.subjectArea}`
                : `Explore ${dataIndex?.totalRecords.toLocaleString() || '56,000+'} field mappings across ${dataIndex?.subjectAreas.length || 110} subject areas.`}
            </p>
          </div>

          <div className="flex-1 flex overflow-hidden">
            <GraphViewer />
          </div>
        </main>

        <DetailPanel />
      </div>

      <footer className="h-8 border-t border-slate-900 bg-slate-950 flex items-center justify-between px-6 text-[10px] text-slate-600 font-mono tracking-wider">
        <div className="flex gap-4 uppercase">
          <span>Status: {isLoading ? 'Loading' : 'Ready'}</span>
          <span>Records: {dataIndex?.totalRecords.toLocaleString() || '-'}</span>
        </div>
        <div className="flex gap-4">
          <span className="text-blue-500/80">
            Load Time: {dataIndex?.loadTimeMs ? `${dataIndex.loadTimeMs.toFixed(0)}ms` : '-'}
          </span>
          <span>Subject Areas: {dataIndex?.subjectAreas.length || '-'}</span>
        </div>
      </footer>
    </div>
  );
};

const App: React.FC = () => {
  return (
    <DataProvider>
      <AppContent />
    </DataProvider>
  );
};

export default App;
