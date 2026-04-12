'use client';

import { useState, useEffect } from 'react';

type FiltersBarProps = {
  onSearchChange: (search: string) => void;
  onStatusChange: (status: string) => void;
  onExport: () => void;
};

export default function FiltersBar({ onSearchChange, onStatusChange, onExport }: FiltersBarProps) {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  
  useEffect(() => {
    const timer = setTimeout(() => {
      onSearchChange(search);
    }, 300);
    
    return () => clearTimeout(timer);
  }, [search, onSearchChange]);
  
  const handleStatusChange = (newStatus: string) => {
    setStatus(newStatus);
    onStatusChange(newStatus);
  };
  
  const handleClear = () => {
    setSearch('');
    setStatus('');
    onSearchChange('');
    onStatusChange('');
  };
  
  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl shadow-card p-5 border border-gray-200 dark:border-gray-700 space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-end">
        <div className="flex-1 space-y-2">
          <label htmlFor="search" className="text-sm font-semibold text-gray-700 dark:text-gray-300">
            Search
          </label>
          <input
            id="search"
            type="text"
            placeholder="Search by business name, email, or phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-slate-800 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 transition-all"
          />
        </div>
        
        <div className="w-full sm:w-auto space-y-2">
          <label htmlFor="status-filter" className="text-sm font-semibold text-gray-700 dark:text-gray-300">
            Status
          </label>
          <select
            id="status-filter"
            value={status}
            onChange={(e) => handleStatusChange(e.target.value)}
            className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-slate-800 dark:text-white transition-all"
          >
            <option value="">All Statuses</option>
            <option value="NEW">New</option>
            <option value="CONTACTED">Contacted</option>
            <option value="IGNORED">Ignored</option>
          </select>
        </div>
        
        <button
          onClick={handleClear}
          className="w-full sm:w-auto px-4 py-2.5 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800 font-medium transition-colors"
        >
          Clear Filters
        </button>
        
        <button
          onClick={onExport}
          className="w-full sm:w-auto px-6 py-2.5 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-lg hover:from-green-700 hover:to-green-800 font-medium shadow-md hover:shadow-lg transition-all"
        >
          Export CSV
        </button>
      </div>
    </div>
  );
}