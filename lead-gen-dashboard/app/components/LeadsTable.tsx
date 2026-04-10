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
      <div className="bg-white rounded-lg shadow p-8 text-center">
        <p className="text-gray-500">No leads yet. Start by scraping some leads above!</p>
      </div>
    );
  }
  
  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Business
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Contact
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Location
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Created
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {leads.map((lead) => (
              <tr key={lead.id} className="hover:bg-gray-50">
                <td className="px-6 py-4">
                  <div className="text-sm font-medium text-gray-900">{lead.businessName}</div>
                  {lead.keyword && (
                    <div className="text-xs text-gray-500">Keyword: {lead.keyword}</div>
                  )}
                </td>
                <td className="px-6 py-4">
                  <div className="text-sm text-gray-900">
                    {lead.website && (
                      <a
                        href={lead.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline block"
                      >
                        {lead.website}
                      </a>
                    )}
                    {lead.phone && <div>{lead.phone}</div>}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="text-sm text-gray-900">{lead.address}</div>
                  {lead.location && (
                    <div className="text-xs text-gray-500">{lead.location}</div>
                  )}
                </td>
                <td className="px-6 py-4">
                  <select
                    value={lead.status}
                    onChange={(e) =>
                      handleStatusChange(lead.id, e.target.value as 'NEW' | 'CONTACTED' | 'IGNORED')
                    }
                    disabled={updatingId === lead.id}
                    className="text-sm border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="NEW">New</option>
                    <option value="CONTACTED">Contacted</option>
                    <option value="IGNORED">Ignored</option>
                  </select>
                </td>
                <td className="px-6 py-4 text-sm text-gray-500">
                  {new Date(lead.createdAt).toLocaleDateString()}
                </td>
                <td className="px-6 py-4 text-sm">
                  <button
                    onClick={() => onDelete(lead.id)}
                    className="text-red-600 hover:text-red-800"
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