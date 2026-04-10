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
    <div className="bg-white rounded-lg shadow p-4">
      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-1">
          <input
            type="text"
            placeholder="Search by business name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        
        <div>
          <select
            value={status}
            onChange={(e) => handleStatusChange(e.target.value)}
            className="w-full md:w-auto px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Statuses</option>
            <option value="NEW">New</option>
            <option value="CONTACTED">Contacted</option>
            <option value="IGNORED">Ignored</option>
          </select>
        </div>
        
        <button
          onClick={handleClear}
          className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
        >
          Clear
        </button>
        
        <button
          onClick={onExport}
          className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
        >
          Export CSV
        </button>
      </div>
    </div>
  );
}