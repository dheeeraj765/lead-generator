'use client';

import { useState } from 'react';
import StatusBadge from './StatusBadge';
import { LeadWithoutUser } from '@/types';

type LeadsTableProps = {
  leads: LeadWithoutUser[];
  onStatusUpdate: (id: string, status: 'NEW' | 'CONTACTED' | 'IGNORED') => void;
  onDelete: (id: string) => void;
};

export default function LeadsTable({ leads, onStatusUpdate, onDelete }: LeadsTableProps) {
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  
  const handleStatusChange = async (id: string, status: 'NEW' | 'CONTACTED' | 'IGNORED') => {
    setUpdatingId(id);
    await onStatusUpdate(id, status);
    setUpdatingId(null);
  };
  
  if (leads.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-card p-12 text-center border border-gray-200 dark:border-gray-700">
        <div className="flex justify-center mb-4">
          <div className="text-5xl">📭</div>
        </div>
        <p className="text-lg text-gray-600 dark:text-gray-400 font-medium">No leads yet</p>
        <p className="text-gray-500 dark:text-gray-500 mt-2">Start by scraping some leads above to get started!</p>
      </div>
    );
  }
  
  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl shadow-card overflow-hidden border border-gray-200 dark:border-gray-700">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-slate-800">
            <tr>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                Business
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                Contact
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                Location
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                Created
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-slate-900 divide-y divide-gray-200 dark:divide-gray-700">
            {leads.map((lead) => (
              <tr key={lead.id} className="hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors">
                <td className="px-6 py-4">
                  <div className="text-sm font-semibold text-gray-900 dark:text-white">{lead.businessName}</div>
                  {lead.keyword && (
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">Keyword: {lead.keyword}</div>
                  )}
                </td>
                <td className="px-6 py-4">
                  <div className="text-sm text-gray-900 dark:text-white space-y-1">
                    {lead.website && (
                      <a
                        href={lead.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 dark:text-blue-400 hover:underline block font-medium"
                      >
                        {lead.website}
                      </a>
                    )}
                    {lead.phone && (
                      <div className="text-gray-600 dark:text-gray-400">
                        <a href={`tel:${lead.phone}`} className="hover:text-blue-600 dark:hover:text-blue-400">
                          {lead.phone}
                        </a>
                      </div>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="text-sm text-gray-900 dark:text-white font-medium">{lead.address}</div>
                  {lead.location && (
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">{lead.location}</div>
                  )}
                </td>
                <td className="px-6 py-4">
                  <select
                    value={lead.status}
                    onChange={(e) =>
                      handleStatusChange(lead.id, e.target.value as 'NEW' | 'CONTACTED' | 'IGNORED')
                    }
                    disabled={updatingId === lead.id}
                    className="text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-800 dark:text-white disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <option value="NEW">New</option>
                    <option value="CONTACTED">Contacted</option>
                    <option value="IGNORED">Ignored</option>
                  </select>
                </td>
                <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                  {new Date(lead.createdAt).toLocaleDateString('en-US', { 
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric'
                  })}
                </td>
                <td className="px-6 py-4 text-sm">
                  <button
                    onClick={() => {
                      if (confirm('Are you sure you want to delete this lead?')) {
                        onDelete(lead.id);
                      }
                    }}
                    className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 font-medium transition-colors"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}