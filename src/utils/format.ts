import type { DetectionStatus } from '../types/forensics';

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(2)} MB`;
}

export function formatDateTime(isoString: string): string {
  try {
    const date = new Date(isoString);
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  } catch {
    return isoString;
  }
}

export function getStatusVisuals(status: DetectionStatus): {
  textClass: string;
  barClass: string;
  strokeHex: string;
  subtleSurfaceClass: string;
  borderClass: string;
  symbol: string;
} {
  if (status === 'AI-Generated') {
    return {
      textClass: 'text-rose-400',
      barClass: 'bg-rose-500',
      strokeHex: '#f43f5e',
      subtleSurfaceClass: 'bg-rose-500/10',
      borderClass: 'border-rose-500/30',
      symbol: '▲',
    };
  }
  if (status === 'Likely Authentic') {
    return {
      textClass: 'text-emerald-400',
      barClass: 'bg-emerald-500',
      strokeHex: '#10b981',
      subtleSurfaceClass: 'bg-emerald-500/10',
      borderClass: 'border-emerald-500/30',
      symbol: '●',
    };
  }
  return {
    textClass: 'text-amber-400',
    barClass: 'bg-amber-500',
    strokeHex: '#f59e0b',
    subtleSurfaceClass: 'bg-amber-500/10',
    borderClass: 'border-amber-500/30',
    symbol: '◆',
  };
}
