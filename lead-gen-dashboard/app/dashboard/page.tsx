'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/app/components/NavBar';
import ScrapeForm from '@/app/components/ScrapeForm';
import FiltersBar from '@/app/components/FiltersBar';
import LeadsTable from '@/app/components/LeadsTable';
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
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="flex justify-center">
            <div className="inline-block animate-spin h-12 w-12 border-4 border-blue-500 border-t-transparent rounded-full"></div>
          </div>
          <p className="text-gray-600 dark:text-gray-400 font-medium">Loading your leads...</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-slate-900 dark:to-slate-800">
      <Navbar user={user || undefined} />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-8">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
            <p className="text-lg text-gray-600 dark:text-gray-400">
              Manage and organize your business leads efficiently
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
            <div className="flex justify-center items-center gap-3">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-white dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors"
              >
                ← Previous
              </button>
              <span className="px-4 py-2 bg-white dark:bg-slate-900 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white font-medium">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-white dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors"
              >
                Next →
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}