import {
  AlertCircle,
  Eye,
  Film,
  Image as ImageIcon,
  ScanSearch,
  Search,
  Trash2,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { AnalysisReport, HistoryRecord } from '../types/forensics';
import { formatBytes, formatDateTime, getStatusVisuals } from '../utils/format';
import type { AppPage } from './Navbar';

interface HistoryPageProps {
  onOpenReport: (report: AnalysisReport) => void;
  onNavigate: (page: AppPage) => void;
}

type FilterOption =
  | 'all'
  | 'image'
  | 'video'
  | 'AI-Generated'
  | 'Likely Authentic'
  | 'Inconclusive';

export function HistoryPage({ onOpenReport, onNavigate }: HistoryPageProps) {
  const [records, setRecords] = useState<HistoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<FilterOption>('all');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const loadHistory = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/history');
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || 'Failed to load analysis history.');
      }
      setRecords(Array.isArray(data.items) ? data.items : []);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to fetch analysis history.'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  const handleViewReport = async (id: string) => {
    setBusyId(id);
    setError(null);
    try {
      const response = await fetch(`/api/history/${encodeURIComponent(id)}`);
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || 'Failed to retrieve report details.');
      }
      onOpenReport(data as AnalysisReport);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Could not open forensic report.'
      );
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (id: string) => {
    setBusyId(id);
    setError(null);
    try {
      const response = await fetch(`/api/history/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || 'Failed to delete record.');
      }
      setRecords((prev) => prev.filter((item) => item.id !== id));
      setConfirmDeleteId(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Could not delete history entry.'
      );
    } finally {
      setBusyId(null);
    }
  };

  const filteredRecords = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return records.filter((item) => {
      const matchesSearch =
        !q ||
        item.fileName.toLowerCase().includes(q) ||
        item.detectedFormat.toLowerCase().includes(q) ||
        item.status.toLowerCase().includes(q);
      if (!matchesSearch) return false;
      if (filter === 'all') return true;
      if (filter === 'image' || filter === 'video') {
        return item.mediaType === filter;
      }
      return item.status === filter;
    });
  }, [records, searchQuery, filter]);

  const filterButtons: Array<{ value: FilterOption; label: string }> = [
    { value: 'all', label: 'All' },
    { value: 'image', label: 'Images' },
    { value: 'video', label: 'Videos' },
    { value: 'AI-Generated', label: 'AI-Generated' },
    { value: 'Likely Authentic', label: 'Authentic' },
    { value: 'Inconclusive', label: 'Inconclusive' },
  ];

  return (
    <div className="mx-auto max-w-7xl px-5 py-12 sm:px-8 lg:py-16">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-cyan-400">SQLite Audit Log</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Analysis History
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            Review past image and video forensic assessments stored locally in
            SQLite, reopen full reports, or remove old entries.
          </p>
        </div>

        <button
          type="button"
          onClick={() => onNavigate('detect')}
          className="inline-flex min-h-[42px] items-center gap-2 rounded-lg bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 transition-colors hover:bg-cyan-400 whitespace-nowrap shrink-0"
        >
          <ScanSearch className="h-4 w-4" />
          New Analysis
        </button>
      </div>

      {/* Filter & Search Toolbar */}
      <div className="mt-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative w-full lg:max-w-sm">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by file name, format, or verdict..."
            aria-label="Search analysis history"
            className="h-10 w-full rounded-lg border border-slate-800 bg-[#0B1224] pr-4 pl-10 text-sm text-slate-100 placeholder:text-slate-500 focus:border-cyan-500 focus:outline-none"
          />
        </div>

        <div
          role="group"
          aria-label="Filter history records"
          className="flex flex-wrap items-center gap-1 rounded-lg border border-slate-800/90 bg-[#080E1E] p-1"
        >
          {filterButtons.map((btn) => (
            <button
              key={btn.value}
              type="button"
              onClick={() => setFilter(btn.value)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                filter === btn.value
                  ? 'bg-cyan-500/20 text-cyan-200'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {btn.label}
            </button>
          ))}
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div
          role="alert"
          className="mt-6 flex items-center gap-3 rounded-lg border border-rose-500/40 bg-rose-950/30 p-4 text-sm text-rose-200"
        >
          <AlertCircle className="h-5 w-5 shrink-0 text-rose-400" />
          <span>{error}</span>
        </div>
      )}

      {/* Table Surface */}
      <div className="mt-6 overflow-hidden rounded-xl border border-slate-800/90 bg-[#0B1224]/80">
        {loading ? (
          <div className="divide-y divide-slate-800/70 p-6">
            {Array.from({ length: 4 }).map((_, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between gap-4 py-4 animate-pulse"
              >
                <div className="h-4 w-48 rounded bg-slate-800" />
                <div className="h-4 w-20 rounded bg-slate-800" />
                <div className="h-4 w-28 rounded bg-slate-800" />
                <div className="h-4 w-16 rounded bg-slate-800" />
                <div className="h-4 w-24 rounded bg-slate-800" />
              </div>
            ))}
          </div>
        ) : filteredRecords.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
            <ScanSearch className="h-10 w-10 text-slate-600" />
            <h2 className="mt-4 text-lg font-semibold text-white">
              {records.length === 0
                ? 'No forensic analyses recorded yet'
                : 'No records match your current filter'}
            </h2>
            <p className="mt-2 max-w-md text-sm text-slate-400">
              {records.length === 0
                ? 'Upload an image or video in the Detection Workspace to generate and archive your first forensic report.'
                : 'Try clearing the search term or switching back to the All filter.'}
            </p>
            {records.length === 0 && (
              <button
                type="button"
                onClick={() => onNavigate('detect')}
                className="mt-6 inline-flex min-h-[42px] items-center gap-2 rounded-lg bg-cyan-500 px-5 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-400"
              >
                Analyze First File
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[780px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-slate-800 bg-[#080D1C] text-xs font-medium text-slate-400">
                  <th className="py-3.5 pr-4 pl-6">File Name</th>
                  <th className="py-3.5 pr-4">Media Type</th>
                  <th className="py-3.5 pr-4">Analyzed Date</th>
                  <th className="py-3.5 pr-4 text-right">AI Prob.</th>
                  <th className="py-3.5 pr-4 text-right">Confidence</th>
                  <th className="py-3.5 pr-4">Status</th>
                  <th className="py-3.5 pr-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70">
                {filteredRecords.map((item) => {
                  const visuals = getStatusVisuals(item.status);
                  const isBusy = busyId === item.id;
                  return (
                    <tr
                      key={item.id}
                      className="transition-colors hover:bg-slate-800/30"
                    >
                      <td className="py-3.5 pr-4 pl-6">
                        <div className="flex items-center gap-3">
                          {item.thumbnailDataUrl ? (
                            <img
                              src={item.thumbnailDataUrl}
                              alt=""
                              className="h-9 w-12 shrink-0 rounded border border-slate-800 object-cover"
                            />
                          ) : (
                            <div className="flex h-9 w-12 shrink-0 items-center justify-center rounded border border-slate-800 bg-slate-900 text-slate-500">
                              {item.mediaType === 'video' ? (
                                <Film className="h-4 w-4" />
                              ) : (
                                <ImageIcon className="h-4 w-4" />
                              )}
                            </div>
                          )}
                          <div className="min-w-0">
                            <p
                              className="max-w-[230px] truncate font-medium text-slate-100"
                              title={item.fileName}
                            >
                              {item.fileName}
                            </p>
                            <p className="text-xs text-slate-500 font-mono tabular-nums">
                              {item.detectedFormat} ·{' '}
                              {formatBytes(item.fileSizeBytes)}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 pr-4 capitalize text-slate-300">
                        {item.mediaType}
                      </td>

                      <td className="py-3.5 pr-4 text-xs text-slate-400 font-mono tabular-nums">
                        {formatDateTime(item.createdAt)}
                      </td>

                      <td className="py-3.5 pr-4 text-right font-mono font-semibold text-white tabular-nums">
                        {item.aiProbability.toFixed(1)}%
                      </td>

                      <td className="py-3.5 pr-4 text-right font-mono text-slate-300 tabular-nums">
                        {item.modelConfidence.toFixed(1)}%
                      </td>

                      <td className="py-3.5 pr-4 font-medium">
                        <span className={visuals.textClass}>
                          {visuals.symbol} {item.status}
                        </span>
                      </td>

                      <td className="py-3.5 pr-6 text-right">
                        {confirmDeleteId === item.id ? (
                          <div className="inline-flex items-center justify-end gap-2">
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => handleDelete(item.id)}
                              className="rounded-md bg-rose-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-rose-500 disabled:opacity-50"
                            >
                              Confirm Delete
                            </button>
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => setConfirmDeleteId(null)}
                              className="rounded-md border border-slate-700 px-2.5 py-1.5 text-xs font-medium text-slate-300 hover:text-white"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div className="inline-flex items-center justify-end gap-2">
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => handleViewReport(item.id)}
                              className="inline-flex items-center gap-1.5 rounded-md border border-slate-700 bg-slate-900/70 px-3 py-1.5 text-xs font-medium text-slate-200 transition-colors hover:border-cyan-500/60 hover:text-cyan-300 disabled:opacity-50"
                            >
                              <Eye className="h-3.5 w-3.5" />
                              View
                            </button>
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => setConfirmDeleteId(item.id)}
                              aria-label={`Delete report for ${item.fileName}`}
                              className="inline-flex items-center justify-center rounded-md border border-slate-800 p-1.5 text-slate-400 transition-colors hover:border-rose-500/50 hover:text-rose-400 disabled:opacity-50"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
