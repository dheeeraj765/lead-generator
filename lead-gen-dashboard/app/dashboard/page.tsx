'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/NavBar';
import ScrapeForm from '@/components/ScrapeForm';
import FiltersBar from '@/components/FiltersBar';
import LeadsTable from '@/components/LeadsTable';
import { LeadWithoutUser } from '@/types';

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<{ name: string; email: string } | null>(null);
  const [leads, setLeads] = useState<LeadWithoutUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  
  const fetchLeads = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '25',
      });
      
      if (search) params.set('search', search);
      if (status) params.set('status', status);
      
      const response = await fetch(`/api/leads?${params}`);
      
      if (response.status === 401) {
        router.push('/login');
        return;
      }
      
      const data = await response.json();
      setLeads(data.leads);
      setTotalPages(data.pagination.totalPages);
    } catch (error) {
      console.error('Failed to fetch leads:', error);
    } finally {
      setLoading(false);
    }
  }, [page, search, status, router]);
  
  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);
  
  const handleStatusUpdate = async (id: string, newStatus: 'NEW' | 'CONTACTED' | 'IGNORED') => {
    try {
      const response = await fetch(`/api/leads/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      
      if (!response.ok) throw new Error('Update failed');
      
      await fetchLeads();
    } catch (error) {
      console.error('Failed to update lead:', error);
    }
  };
  
  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this lead?')) return;
    
    try {
      const response = await fetch(`/api/leads/${id}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) throw new Error('Delete failed');
      
      await fetchLeads();
    } catch (error) {
      console.error('Failed to delete lead:', error);
    }
  };
  
  const handleExport = () => {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (status) params.set('status', status);
    
    window.location.href = `/api/leads/export?${params}`;
  };
  
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar user={user || undefined} />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
            <p className="text-gray-600 mt-1">
              Manage your business leads
            </p>
          </div>
          
          <ScrapeForm onScrapeComplete={fetchLeads} />
          
          <FiltersBar
            onSearchChange={setSearch}
            onStatusChange={setStatus}
            onExport={handleExport}
          />
          
          <LeadsTable
            leads={leads}
            onStatusUpdate={handleStatusUpdate}
            onDelete={handleDelete}
          />
          
          {totalPages > 1 && (
            <div className="flex justify-center gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-4 py-2 border border-gray-300 rounded-md disabled:opacity-50"
              >
                Previous
              </button>
              <span className="px-4 py-2">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-4 py-2 border border-gray-300 rounded-md disabled:opacity-50"
              >
                Next
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}