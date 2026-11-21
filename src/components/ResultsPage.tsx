import {
  AlertTriangle,
  ArrowLeft,
  Clock,
  Download,
  FileSearch,
  History,
  Info,
  ShieldAlert,
  ShieldCheck,
  ShieldQuestion,
} from 'lucide-react';
import type { AnalysisReport } from '../types/forensics';
import { formatBytes, formatDateTime, getStatusVisuals } from '../utils/format';
import { downloadForensicPdf } from '../utils/pdfReport';
import type { AppPage } from './Navbar';
import { ProbabilityGauge } from './ProbabilityGauge';

interface ResultsPageProps {
  report: AnalysisReport;
  onNavigate: (page: AppPage) => void;
}

export function ResultsPage({ report, onNavigate }: ResultsPageProps) {
  const visuals = getStatusVisuals(report.status);

  const StatusIcon =
    report.status === 'AI-Generated'
      ? ShieldAlert
      : report.status === 'Likely Authentic'
        ? ShieldCheck
        : ShieldQuestion;

  return (
    <div className="mx-auto max-w-7xl px-5 py-10 sm:px-8 lg:py-14">
      {/* Top Action Strip */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800/80 pb-6">
        <div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
            <span className="font-mono uppercase">{report.mediaType}</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono">{report.metadata.detectedFormat}</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">
              {formatBytes(report.metadata.fileSizeBytes)}
            </span>
            <span aria-hidden="true">·</span>
            <span>{formatDateTime(report.createdAt)}</span>
          </div>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-white sm:text-3xl">
            Forensic Report: {report.fileName}
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => downloadForensicPdf(report)}
            className="inline-flex min-h-[42px] items-center gap-2 rounded-lg bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 transition-colors hover:bg-cyan-400 whitespace-nowrap shrink-0"
          >
            <Download className="h-4 w-4" />
            Download PDF Report
          </button>
          <button
            type="button"
            onClick={() => onNavigate('detect')}
            className="inline-flex min-h-[42px] items-center gap-2 rounded-lg border border-slate-700 bg-slate-900/70 px-4 py-2 text-sm font-medium text-slate-200 transition-colors hover:border-slate-500 hover:text-white whitespace-nowrap shrink-0"
          >
            <ArrowLeft className="h-4 w-4" />
            Analyze Another
          </button>
          <button
            type="button"
            onClick={() => onNavigate('history')}
            className="inline-flex min-h-[42px] items-center gap-2 rounded-lg border border-slate-800 bg-transparent px-4 py-2 text-sm font-medium text-slate-300 transition-colors hover:border-slate-600 hover:text-white whitespace-nowrap shrink-0"
          >
            <History className="h-4 w-4" />
            History
          </button>
        </div>
      </div>

      {/* Primary Forensic Verdict Panel */}
      <section className="mt-8 grid grid-cols-1 gap-8 rounded-xl border border-slate-800/90 bg-[#0B1224]/85 p-6 backdrop-blur-md lg:grid-cols-12 lg:p-8">
        {/* Left: Animated Circular Gauge */}
        <div className="flex flex-col items-center justify-center border-b border-slate-800/80 pb-8 lg:col-span-4 lg:border-r lg:border-b-0 lg:pr-8 lg:pb-0">
          <ProbabilityGauge
            aiProbability={report.aiProbability}
            status={report.status}
          />
          {report.thumbnailDataUrl && (
            <div className="mt-6 w-full max-w-[220px] overflow-hidden rounded-lg border border-slate-800 bg-[#050811]">
              <img
                src={report.thumbnailDataUrl}
                alt={`Analyzed preview of ${report.fileName}`}
                className="h-28 w-full object-cover"
              />
            </div>
          )}
        </div>

        {/* Right: Calibrated Metrics & Executive Summary */}
        <div className="flex flex-col justify-between lg:col-span-8">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <StatusIcon className={`h-6 w-6 ${visuals.textClass}`} />
              <span className={`text-xl font-bold ${visuals.textClass}`}>
                Detection Status: {report.status}
              </span>
            </div>

            {/* 3 Core Numerical Readouts (Tabular Numerals) */}
            <div className="mt-6 grid grid-cols-1 gap-6 border-y border-slate-800/80 py-6 sm:grid-cols-3">
              <div>
                <p className="text-xs font-medium text-slate-400">
                  AI-Generated Probability
                </p>
                <p className="mt-1.5 font-mono text-3xl font-bold text-white tabular-nums">
                  {report.aiProbability.toFixed(1)}
                  <span className="ml-0.5 text-base font-medium text-slate-400">
                    %
                  </span>
                </p>
                <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
                  <div
                    className="h-full rounded-full bg-rose-500"
                    style={{ width: `${report.aiProbability}%` }}
                  />
                </div>
              </div>

              <div>
                <p className="text-xs font-medium text-slate-400">
                  Likely Authentic Probability
                </p>
                <p className="mt-1.5 font-mono text-3xl font-bold text-white tabular-nums">
                  {report.authenticProbability.toFixed(1)}
                  <span className="ml-0.5 text-base font-medium text-slate-400">
                    %
                  </span>
                </p>
                <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
                  <div
                    className="h-full rounded-full bg-emerald-500"
                    style={{ width: `${report.authenticProbability}%` }}
                  />
                </div>
              </div>

              <div>
                <p className="text-xs font-medium text-slate-400">
                  Model Confidence
                </p>
                <p className="mt-1.5 font-mono text-3xl font-bold text-cyan-300 tabular-nums">
                  {report.modelConfidence.toFixed(1)}
                  <span className="ml-0.5 text-base font-medium text-slate-400">
                    %
                  </span>
                </p>
                <p className="mt-2 text-xs text-slate-400">
                  Signal reliability, distinct from AI probability
                </p>
              </div>
            </div>

            {/* Detailed Analysis Summary */}
            <div className="mt-6">
              <h2 className="text-sm font-semibold text-slate-200">
                Forensic Assessment Summary
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-300">
                {report.summary}
              </p>
            </div>
          </div>

          {/* Probability Interpretation Disclaimer */}
          <div className="mt-6 flex items-start gap-3 rounded-lg border border-slate-800 bg-[#070D1D] p-4 text-xs leading-relaxed text-slate-400">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-cyan-400" />
            <p>{report.disclaimer}</p>
          </div>
        </div>
      </section>

      {/* Video Suspicious Timestamps Section (Shown when video) */}
      {report.mediaType === 'video' &&
        report.allFrames &&
        report.allFrames.length > 0 && (
          <section className="mt-8 rounded-xl border border-slate-800/90 bg-[#0B1224]/80 p-6 sm:p-8">
            <div className="flex flex-wrap items-baseline justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-white">
                  Temporal Video Frame Analysis &amp; Suspicious Timestamps
                </h2>
                <p className="mt-1 text-sm text-slate-400">
                  Evaluated {report.allFrames.length} evenly spaced keyframes across{' '}
                  {report.metadata.durationSeconds?.toFixed(2)}s of footage (
                  {report.suspiciousFrames.length} suspicious timestamp
                  {report.suspiciousFrames.length === 1 ? '' : 's'} flagged).
                </p>
              </div>
              {report.suspiciousFrames.length > 0 && (
                <div className="flex items-center gap-2 text-xs font-medium text-rose-400">
                  <AlertTriangle className="h-4 w-4" />
                  <span>
                    Flagged at:{' '}
                    {report.suspiciousFrames.map((f) => f.timestamp).join(', ')}
                  </span>
                </div>
              )}
            </div>

            <div className="mt-6 overflow-x-auto">
              <table className="w-full min-w-[640px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-800 text-xs font-medium text-slate-400">
                    <th className="py-3 pr-4">Frame</th>
                    <th className="py-3 pr-4">Timestamp</th>
                    <th className="py-3 pr-4 text-right">AI Prob.</th>
                    <th className="py-3 pr-4">Face Manipulation</th>
                    <th className="py-3 pr-4">Status</th>
                    <th className="py-3">Temporal Observation</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70">
                  {report.allFrames.map((frame) => (
                    <tr
                      key={frame.frameIndex}
                      className={
                        frame.suspicious ? 'bg-rose-500/[0.06]' : undefined
                      }
                    >
                      <td className="py-3.5 pr-4 font-mono text-slate-300 tabular-nums">
                        #{frame.frameIndex}
                      </td>
                      <td className="py-3.5 pr-4 font-mono font-medium text-cyan-300 tabular-nums">
                        <span className="inline-flex items-center gap-1.5">
                          <Clock className="h-3.5 w-3.5 text-slate-500" />
                          {frame.timestamp}
                        </span>
                      </td>
                      <td className="py-3.5 pr-4 text-right font-mono font-semibold text-white tabular-nums">
                        {frame.aiProbability.toFixed(1)}%
                      </td>
                      <td className="py-3.5 pr-4 text-slate-300">
                        {frame.faceManipulationDetected ? 'Detected' : 'None'}
                      </td>
                      <td className="py-3.5 pr-4 font-medium">
                        {frame.suspicious ? (
                          <span className="text-rose-400">▲ Suspicious</span>
                        ) : (
                          <span className="text-emerald-400">● Normal</span>
                        )}
                      </td>
                      <td className="py-3.5 text-slate-300">
                        {frame.temporalAnomaly}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

      {/* Multi-Axis Forensic Signal Breakdown + Metadata Provenance */}
      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-12">
        {/* 6-Axis Forensic Signals */}
        <section className="rounded-xl border border-slate-800/90 bg-[#0B1224]/80 p-6 lg:col-span-8">
          <h2 className="text-lg font-bold text-white">
            Multi-Axis Forensic Signal Breakdown
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            Anomaly intensity across independent visual, structural, and
            provenance dimensions (0% = natural optical signal, 100% = strong
            synthetic signature).
          </p>

          <div className="mt-6 divide-y divide-slate-800/80">
            {report.forensicIndicators.map((indicator) => {
              const barColor =
                indicator.verdict === 'Anomalous'
                  ? 'bg-rose-500'
                  : indicator.verdict === 'Suspicious'
                    ? 'bg-amber-500'
                    : 'bg-cyan-400';
              const verdictColor =
                indicator.verdict === 'Anomalous'
                  ? 'text-rose-400'
                  : indicator.verdict === 'Suspicious'
                    ? 'text-amber-400'
                    : 'text-emerald-400';

              return (
                <div
                  key={indicator.category}
                  className="py-4 first:pt-0 last:pb-0"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold text-slate-100">
                      {indicator.category}
                    </h3>
                    <div className="flex items-center gap-3 text-xs">
                      <span className={`font-medium ${verdictColor}`}>
                        {indicator.verdict}
                      </span>
                      <span className="font-mono text-slate-300 tabular-nums">
                        {indicator.score.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
                    <div
                      className={`h-full rounded-full ${barColor}`}
                      style={{ width: `${indicator.score}%` }}
                    />
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-slate-400">
                    {indicator.observation}
                  </p>
                </div>
              );
            })}
          </div>
        </section>

        {/* Right Column: Artifacts + File Provenance Metadata */}
        <aside className="space-y-8 lg:col-span-4">
          <div className="rounded-xl border border-slate-800/90 bg-[#0B1224]/80 p-6">
            <div className="flex items-center gap-2">
              <FileSearch className="h-4 w-4 text-cyan-400" />
              <h2 className="text-base font-bold text-white">
                Key Observations &amp; Artifacts
              </h2>
            </div>

            <ul className="mt-4 space-y-2.5 text-sm text-slate-300">
              {report.artifactsDetected.map((artifact, idx) => (
                <li key={idx} className="flex items-start gap-2.5">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-400" />
                  <span className="leading-relaxed">{artifact}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-xl border border-slate-800/90 bg-[#0B1224]/80 p-6">
            <h2 className="text-base font-bold text-white">
              Technical File Provenance
            </h2>
            <dl className="mt-4 divide-y divide-slate-800/80 text-xs">
              <div className="flex items-center justify-between py-2.5">
                <dt className="text-slate-400">Face Manipulation Risk</dt>
                <dd className="font-medium text-slate-100">
                  {report.faceManipulationRisk}
                </dd>
              </div>
              <div className="flex items-center justify-between py-2.5">
                <dt className="text-slate-400">Container Format</dt>
                <dd className="font-mono text-slate-200">
                  {report.metadata.detectedFormat}
                </dd>
              </div>
              {report.metadata.width && report.metadata.height && (
                <div className="flex items-center justify-between py-2.5">
                  <dt className="text-slate-400">Dimensions</dt>
                  <dd className="font-mono text-slate-200 tabular-nums">
                    {report.metadata.width} × {report.metadata.height} px
                  </dd>
                </div>
              )}
              {report.metadata.durationSeconds && (
                <div className="flex items-center justify-between py-2.5">
                  <dt className="text-slate-400">Duration &amp; FPS</dt>
                  <dd className="font-mono text-slate-200 tabular-nums">
                    {report.metadata.durationSeconds.toFixed(2)}s ·{' '}
                    {report.metadata.fps ?? 0} fps
                  </dd>
                </div>
              )}
              <div className="flex items-center justify-between py-2.5">
                <dt className="text-slate-400">EXIF Camera Markers</dt>
                <dd className="text-slate-200">
                  {report.metadata.hasExifCameraMarkers
                    ? 'Present'
                    : 'Not Present'}
                </dd>
              </div>
              <div className="flex items-center justify-between py-2.5">
                <dt className="text-slate-400">SHA-256 Fingerprint</dt>
                <dd className="font-mono text-slate-300">
                  {report.metadata.sha256Prefix}
                </dd>
              </div>
              <div className="py-2.5">
                <dt className="text-slate-400">AI Provenance Signatures</dt>
                <dd className="mt-1 text-slate-200">
                  {report.metadata.aiGeneratorMarkers.length > 0
                    ? report.metadata.aiGeneratorMarkers.join(', ')
                    : 'No embedded AI generator headers detected'}
                </dd>
              </div>
            </dl>
          </div>
        </aside>
      </div>
    </div>
  );
}
