import React, { useRef, useEffect, useState } from 'react';
import { Search, Layers, Database, Table2, FileText, Code } from 'lucide-react';
import { useData } from '../data/DataContext';
import { groupSearchResults, getResultTypeLabel } from '../data/searchIndex';
import { SearchResultType } from '../types';
import { ThemeToggle } from './ThemeToggle';

const resultTypeIcons: Record<SearchResultType, React.ReactNode> = {
  subjectArea: <Layers className="w-4 h-4" style={{ color: 'var(--theme-accent-purple-text)' }} />,
  presentationTable: <Table2 className="w-4 h-4" style={{ color: 'var(--theme-accent-blue-text)' }} />,
  presentationColumn: <FileText className="w-4 h-4" style={{ color: 'var(--theme-accent-green-text)' }} />,
  physicalTable: <Database className="w-4 h-4" style={{ color: 'var(--theme-accent-orange-text)' }} />,
  physicalColumn: <Code className="w-4 h-4" style={{ color: 'var(--theme-accent-yellow-text)' }} />,
};

export const TopNav: React.FC = () => {
  const { searchQuery, setSearchQuery, searchResults, selectFromSearchResult } = useData();
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
    <header className="h-16 grid grid-cols-3 items-center px-6 backdrop-blur-md z-20" style={{ borderBottom: '1px solid var(--theme-border-default)', backgroundColor: 'var(--theme-bg-panel)' }}>
      {/* Left - Logo */}
      <div className="flex items-center gap-3">
        <span className="text-sm font-semibold tracking-tight" style={{ color: 'var(--theme-text-primary)' }}>NetSuite Analytics Warehouse Explorer</span>
      </div>

      {/* Center - Search */}
      <div className="flex justify-center">
        <div className="w-full max-w-2xl" ref={containerRef}>
          <div className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 transition-colors" style={{ color: 'var(--theme-text-muted)' }} />
            <input
              type="text"
              placeholder="Search Semantic Fields, Tables, and Objects..."
              className="w-full rounded-md py-2 pl-10 pr-4 text-sm focus:outline-none focus:ring-1 transition-all"
              style={{ backgroundColor: 'var(--theme-bg-overlay)', border: '1px solid var(--theme-border-default)', color: 'var(--theme-text-secondary)' }}
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
              <div className="absolute top-full left-0 right-0 mt-2 rounded-lg shadow-xl max-h-96 overflow-y-auto z-50" style={{ backgroundColor: 'var(--theme-surface-dropdown)', border: '1px solid var(--theme-border-strong)' }}>
                {Array.from(groupedResults.entries()).map(([type, results]) => (
                  <div key={type}>
                    {/* Group Header */}
                    <div className="px-3 py-2 text-xs uppercase font-semibold tracking-wider sticky top-0" style={{ color: 'var(--theme-text-muted)', backgroundColor: 'var(--theme-surface-dropdown)', borderBottom: '1px solid var(--theme-border-default)' }}>
                      {getResultTypeLabel(type)}
                    </div>

                    {/* Result Items */}
                    {results.map((result) => (
                      <button
                        key={result.id}
                        className="w-full px-3 py-2 flex items-center gap-3 transition-colors text-left"
                        style={{ color: 'var(--theme-text-default)' }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--theme-bg-hover)'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                        onClick={() => handleResultClick(result)}
                      >
                        {resultTypeIcons[result.type]}
                        <div className="flex-1 min-w-0">
                          <div className="text-sm truncate" style={{ color: 'var(--theme-text-default)' }}>{result.value}</div>
                          {result.context && (
                            <div className="text-xs truncate" style={{ color: 'var(--theme-text-muted)' }}>{result.context}</div>
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

      {/* Right - Theme Toggle */}
      <div className="flex justify-end">
        <ThemeToggle />
      </div>
    </header>
  );
};
