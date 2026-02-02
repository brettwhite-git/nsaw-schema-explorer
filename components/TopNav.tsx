import React, { useRef, useEffect, useState } from 'react';
import { Search, Layers, Database, Table2, FileText, Code, Home } from 'lucide-react';
import { useData } from '../data/DataContext';
import { groupSearchResults, getResultTypeLabel } from '../data/searchIndex';
import { SearchResultType } from '../types';

const resultTypeIcons: Record<SearchResultType, React.ReactNode> = {
  subjectArea: <Layers className="w-4 h-4 text-purple-400" />,
  presentationTable: <Table2 className="w-4 h-4 text-blue-400" />,
  presentationColumn: <FileText className="w-4 h-4 text-green-400" />,
  physicalTable: <Database className="w-4 h-4 text-orange-400" />,
  physicalColumn: <Code className="w-4 h-4 text-yellow-400" />,
};

export const TopNav: React.FC = () => {
  const { searchQuery, setSearchQuery, searchResults, selectFromSearchResult, clearSelection } = useData();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Click-outside detection to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Open dropdown when there are results and query is not empty
  useEffect(() => {
    if (searchQuery.trim().length > 0 && searchResults.length > 0) {
      setIsOpen(true);
    } else {
      setIsOpen(false);
    }
  }, [searchQuery, searchResults]);

  const groupedResults = groupSearchResults(searchResults);

  const handleResultClick = (result: typeof searchResults[0]) => {
    selectFromSearchResult(result);
    setIsOpen(false);
  };

  return (
    <header className="h-16 border-b border-slate-800 grid grid-cols-3 items-center px-6 bg-slate-900/50 backdrop-blur-md z-20">
      {/* Left - Logo */}
      <div className="flex items-center gap-3">
        <button
          onClick={clearSelection}
          className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-700 hover:border-slate-600 transition-colors"
          title="Home"
        >
          <Home className="w-5 h-5 text-slate-400 hover:text-white" />
        </button>
        <span className="text-sm font-semibold tracking-tight text-white">NetSuite Analytics Warehouse Explorer</span>
      </div>

      {/* Center - Search */}
      <div className="flex justify-center">
        <div className="w-full max-w-2xl" ref={containerRef}>
          <div className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-blue-400 transition-colors" />
            <input
              type="text"
              placeholder="Search Semantic Fields, Tables, and Objects..."
              className="w-full bg-slate-950/50 border border-slate-800 rounded-md py-2 pl-10 pr-4 text-sm text-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-all"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => {
                if (searchQuery.trim().length > 0 && searchResults.length > 0) {
                  setIsOpen(true);
                }
              }}
            />

            {/* Search Results Dropdown */}
            {isOpen && searchQuery.trim().length > 0 && searchResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-slate-900 border border-slate-700 rounded-lg shadow-xl max-h-96 overflow-y-auto z-50">
                {Array.from(groupedResults.entries()).map(([type, results]) => (
                  <div key={type}>
                    {/* Group Header */}
                    <div className="px-3 py-2 text-xs text-slate-500 uppercase font-semibold tracking-wider bg-slate-900/80 sticky top-0 border-b border-slate-800">
                      {getResultTypeLabel(type)}
                    </div>

                    {/* Result Items */}
                    {results.map((result) => (
                      <button
                        key={result.id}
                        className="w-full px-3 py-2 flex items-center gap-3 hover:bg-slate-800 transition-colors text-left"
                        onClick={() => handleResultClick(result)}
                      >
                        {resultTypeIcons[result.type]}
                        <div className="flex-1 min-w-0">
                          <div className="text-sm text-slate-200 truncate">{result.value}</div>
                          {result.context && (
                            <div className="text-xs text-slate-500 truncate">{result.context}</div>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Right - Empty spacer for symmetry */}
      <div></div>
    </header>
  );
};
