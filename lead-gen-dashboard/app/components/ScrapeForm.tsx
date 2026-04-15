'use client';

import { useState } from 'react';

type ScrapeFormProps = {
  onScrapeComplete: () => void;
};

type ApiResponse = {
  success?: boolean;
  inserted?: number;
  duplicatesSkipped?: number;
  error?: string;
  count?: number;
};

export default function ScrapeForm({
  onScrapeComplete,
}: ScrapeFormProps) {
  const [keyword, setKeyword] = useState('');
  const [location, setLocation] = useState('');
  const [limit, setLimit] = useState(20);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!keyword.trim() || !location.trim()) {
      setMessage({
        type: 'error',
        text: 'Keyword and location are required',
      });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const response = await fetch('/api/leads/scrape', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          keyword: keyword.trim(),
          location: location.trim(),
          limit,
        }),
      });

      const rawText = await response.text();
      const contentType = response.headers.get('content-type') || '';

      // 🚨 HTML returned instead of JSON
      if (
        rawText.trim().startsWith('<!DOCTYPE html>') ||
        contentType.includes('text/html')
      ) {
        console.error('HTML ERROR RESPONSE:', rawText);

        throw new Error(
          'Server returned an HTML error page. This usually means auth middleware, server crash, or deployment issue.'
        );
      }

      let data: ApiResponse;

      try {
        data = JSON.parse(rawText);
      } catch {
        console.error('INVALID RAW RESPONSE:', rawText);

        throw new Error(
          `Server returned invalid JSON: ${rawText.slice(0, 200)}`
        );
      }

      if (!response.ok || data.success === false) {
        throw new Error(data.error || 'Scraping failed');
      }

      setMessage({
        type: 'success',
        text: `Successfully added ${
          data.inserted ?? data.count ?? 0
        } leads.`,
      });

      setKeyword('');
      setLocation('');
      setLimit(20);

      onScrapeComplete();
    } catch (error) {
      console.error('SCRAPE FORM ERROR:', error);

      setMessage({
        type: 'error',
        text:
          error instanceof Error
            ? error.message
            : 'Failed to scrape leads',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl shadow-card p-6 border border-gray-200 dark:border-gray-700">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">
          Scrape New Leads
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Enter your search criteria to find relevant business leads
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <label
              htmlFor="keyword"
              className="block text-sm font-semibold text-gray-700 dark:text-gray-300"
            >
              Keyword
              <span className="text-red-500 ml-1">*</span>
            </label>
            <input
              type="text"
              id="keyword"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="e.g., dentist, plumber"
              required
              className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-slate-800 dark:text-white"
            />
          </div>

          <div className="space-y-2">
            <label
              htmlFor="location"
              className="block text-sm font-semibold text-gray-700 dark:text-gray-300"
            >
              Location
              <span className="text-red-500 ml-1">*</span>
            </label>
            <input
              type="text"
              id="location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g., Chicago, IL"
              required
              className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-slate-800 dark:text-white"
            />
          </div>

          <div className="space-y-2">
            <label
              htmlFor="limit"
              className="block text-sm font-semibold text-gray-700 dark:text-gray-300"
            >
              Limit
            </label>
            <input
              type="number"
              id="limit"
              value={limit}
              onChange={(e) =>
                setLimit(
                  Number.isNaN(parseInt(e.target.value))
                    ? 20
                    : parseInt(e.target.value)
                )
              }
              min="1"
              max="100"
              required
              className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-slate-800 dark:text-white"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full md:w-auto px-8 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-semibold rounded-lg disabled:opacity-50"
        >
          {loading ? 'Scraping...' : 'Start Scraping'}
        </button>
      </form>

      {message && (
        <div
          className={`mt-6 p-4 rounded-lg border-l-4 ${
            message.type === 'success'
              ? 'bg-green-50 dark:bg-green-900/20 border-green-500 text-green-800 dark:text-green-200'
              : 'bg-red-50 dark:bg-red-900/20 border-red-500 text-red-800 dark:text-red-200'
          }`}
        >
          <p className="font-semibold">{message.text}</p>
        </div>
      )}
    </div>
  );
}