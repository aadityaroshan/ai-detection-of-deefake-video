import {
  AlertCircle,
  CheckCircle2,
  FileVideo,
  Image as ImageIcon,
  Loader2,
  ScanSearch,
  Trash2,
  Upload,
} from 'lucide-react';
import { type ChangeEvent, type DragEvent, useEffect, useRef, useState } from 'react';
import type { AnalysisReport, MediaType } from '../types/forensics';
import { formatBytes } from '../utils/format';

interface DetectPageProps {
  onAnalysisComplete: (report: AnalysisReport) => void;
}

const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'];
const VIDEO_EXTENSIONS = ['.mp4', '.mov', '.avi'];
const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
const MAX_VIDEO_BYTES = 60 * 1024 * 1024;

function detectClientMediaType(file: File): MediaType | null {
  const nameLower = file.name.toLowerCase();
  if (IMAGE_EXTENSIONS.some((ext) => nameLower.endsWith(ext))) {
    return 'image';
  }
  if (VIDEO_EXTENSIONS.some((ext) => nameLower.endsWith(ext))) {
    return 'video';
  }
  if (file.type.startsWith('image/')) return 'image';
  if (file.type.startsWith('video/')) return 'video';
  return null;
}

const ANALYSIS_STAGES_IMAGE = [
  'Validating binary header signature and file integrity',
  'Scanning EXIF camera metadata and AI provenance markers',
  'Evaluating optical lighting, texture floor, and facial cues',
  'Calibrating synthetic probability and model confidence',
];

const ANALYSIS_STAGES_VIDEO = [
  'Validating video container signature and duration limits',
  'Extracting sequential keyframes across video timeline',
  'Analyzing facial manipulation and temporal cross-frame drift',
  'Aggregating frame predictions into calibrated video verdict',
];

export function DetectPage({ onAnalysisComplete }: DetectPageProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [mediaType, setMediaType] = useState<MediaType | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [clientDims, setClientDims] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [uploadPercent, setUploadPercent] = useState(0);
  const [stageIndex, setStageIndex] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Clean up object URLs on change or unmount
  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  // Advance analysis stage caption while server is running inference
  useEffect(() => {
    if (!isAnalyzing || uploadPercent < 100) return;
    const stages =
      mediaType === 'video' ? ANALYSIS_STAGES_VIDEO : ANALYSIS_STAGES_IMAGE;
    const interval = window.setInterval(() => {
      setStageIndex((prev) => (prev < stages.length - 1 ? prev + 1 : prev));
    }, 2400);
    return () => window.clearInterval(interval);
  }, [isAnalyzing, uploadPercent, mediaType]);

  const clearSelection = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setSelectedFile(null);
    setMediaType(null);
    setPreviewUrl(null);
    setClientDims(null);
    setErrorMessage(null);
    setUploadPercent(0);
    setStageIndex(0);
    if (inputRef.current) {
      inputRef.current.value = '';
    }
  };

  const handleFileSelection = (file: File | undefined) => {
    if (!file) return;
    setErrorMessage(null);

    const detected = detectClientMediaType(file);
    if (!detected) {
      setErrorMessage(
        'Unsupported file format. Please select an image (JPG, JPEG, PNG, WEBP) or video (MP4, MOV, AVI).'
      );
      return;
    }

    const maxBytes = detected === 'image' ? MAX_IMAGE_BYTES : MAX_VIDEO_BYTES;
    if (file.size > maxBytes) {
      const maxMb = detected === 'image' ? 20 : 60;
      setErrorMessage(
        `File size (${formatBytes(file.size)}) exceeds the ${maxMb} MB limit for ${detected} uploads.`
      );
      return;
    }

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    const objectUrl = URL.createObjectURL(file);
    setSelectedFile(file);
    setMediaType(detected);
    setPreviewUrl(objectUrl);
    setClientDims(null);
  };

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    handleFileSelection(e.target.files?.[0]);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (isAnalyzing) return;
    handleFileSelection(e.dataTransfer.files?.[0]);
  };

  const handleAnalyze = () => {
    if (!selectedFile || !mediaType || isAnalyzing) return;

    setIsAnalyzing(true);
    setErrorMessage(null);
    setUploadPercent(0);
    setStageIndex(0);

    const endpoint =
      mediaType === 'image' ? '/api/analyze/image' : '/api/analyze/video';
    const formData = new FormData();
    formData.append('file', selectedFile);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', endpoint, true);
    xhr.timeout = 90_000;

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0) {
        const pct = Math.min(100, Math.round((event.loaded / event.total) * 100));
        setUploadPercent(pct);
        if (pct >= 100) {
          setStageIndex(1);
        }
      }
    };

    xhr.onload = () => {
      setIsAnalyzing(false);
      try {
        const payload = JSON.parse(xhr.responseText);
        if (xhr.status >= 200 && xhr.status < 300) {
          onAnalysisComplete(payload as AnalysisReport);
        } else {
          setErrorMessage(
            payload?.error ||
              'Forensic analysis could not complete for this file. Please try again.'
          );
        }
      } catch {
        setErrorMessage(
          'Received an unexpected response from the forensic server. Please retry.'
        );
      }
    };

    xhr.ontimeout = () => {
      setIsAnalyzing(false);
      setErrorMessage(
        'The forensic engine timed out while calibrating this file. Please click "Analyze Now" to retry.'
      );
    };

    xhr.onerror = () => {
      setIsAnalyzing(false);
      setErrorMessage(
        'Network error while transmitting media to the forensic engine. Check your connection and retry.'
      );
    };

    xhr.send(formData);
  };

  const stages =
    mediaType === 'video' ? ANALYSIS_STAGES_VIDEO : ANALYSIS_STAGES_IMAGE;

  return (
    <div className="mx-auto max-w-5xl px-5 py-12 sm:px-8 lg:py-16">
      <div className="max-w-2xl">
        <p className="text-sm font-medium text-cyan-400">
          Media Forensic Inspection
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-white sm:text-4xl">
          Detect AI-Generated Images &amp; Videos
        </h1>
        <p className="mt-3 text-base text-slate-400">
          Upload a photograph or video clip to evaluate synthetic visual
          patterns, deepfake facial manipulation, and temporal inconsistencies.
        </p>
      </div>

      {/* Main Upload / Preview Surface */}
      <div className="mt-8 rounded-xl border border-slate-800/90 bg-[#0B1224]/80 p-6 backdrop-blur-md sm:p-8">
        {!selectedFile ? (
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                inputRef.current?.click();
              }
            }}
            role="button"
            tabIndex={0}
            aria-label="Upload an image or video for forensic analysis"
            className={`flex min-h-[290px] flex-col items-center justify-center rounded-lg border-2 border-dashed px-6 py-12 text-center transition-colors duration-150 ${
              isDragging
                ? 'border-cyan-400 bg-cyan-500/10'
                : 'border-slate-700/90 bg-[#070D1C]/70 hover:border-cyan-500/60 hover:bg-[#091227]'
            }`}
          >
            <div className="flex h-14 w-14 items-center justify-center rounded-xl border border-slate-700/80 bg-slate-900/90 text-cyan-400">
              <Upload className="h-6 w-6" />
            </div>

            <h2 className="mt-5 text-lg font-semibold text-white">
              Drag and drop media here, or browse files
            </h2>
            <p className="mt-2 max-w-md text-sm text-slate-400">
              Your file is validated via binary signature inspection and
              permanently deleted from temporary server storage immediately
              after analysis.
            </p>

            <div className="mt-6 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs text-slate-400">
              <span>Images: JPG, JPEG, PNG, WEBP (max 20 MB)</span>
              <span aria-hidden="true">·</span>
              <span>Videos: MP4, MOV, AVI (max 60 MB, 2 min)</span>
            </div>

            <input
              ref={inputRef}
              type="file"
              accept=".jpg,.jpeg,.png,.webp,.mp4,.mov,.avi,image/jpeg,image/png,image/webp,video/mp4,video/quicktime,video/x-msvideo"
              onChange={handleInputChange}
              className="hidden"
            />
          </div>
        ) : (
          <div className="space-y-6">
            {/* File Preview Stage */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
              <div className="overflow-hidden rounded-lg border border-slate-800 bg-[#050811] lg:col-span-7">
                {mediaType === 'image' && previewUrl ? (
                  <img
                    src={previewUrl}
                    alt={`Preview of ${selectedFile.name}`}
                    onLoad={(e) => {
                      const img = e.currentTarget;
                      setClientDims(`${img.naturalWidth} × ${img.naturalHeight} px`);
                    }}
                    className="max-h-[380px] w-full object-contain"
                  />
                ) : mediaType === 'video' && previewUrl ? (
                  <video
                    src={previewUrl}
                    controls
                    onLoadedMetadata={(e) => {
                      const vid = e.currentTarget;
                      const dur = Number.isFinite(vid.duration)
                        ? `${vid.duration.toFixed(1)}s`
                        : '';
                      setClientDims(
                        `${vid.videoWidth} × ${vid.videoHeight} px${dur ? ` · ${dur}` : ''}`
                      );
                    }}
                    className="max-h-[380px] w-full bg-black object-contain"
                  />
                ) : null}
              </div>

              {/* File Specification & Actions Column */}
              <div className="flex flex-col justify-between lg:col-span-5">
                <div>
                  <div className="flex items-center gap-2 text-xs font-medium text-cyan-400">
                    {mediaType === 'image' ? (
                      <ImageIcon className="h-4 w-4" />
                    ) : (
                      <FileVideo className="h-4 w-4" />
                    )}
                    <span>
                      {mediaType === 'image'
                        ? 'Image File Ready'
                        : 'Video File Ready'}
                    </span>
                  </div>

                  <h2
                    className="mt-2 truncate text-lg font-semibold text-white"
                    title={selectedFile.name}
                  >
                    {selectedFile.name}
                  </h2>

                  <dl className="mt-5 divide-y divide-slate-800/80 border-y border-slate-800/80 text-sm">
                    <div className="flex items-center justify-between py-2.5">
                      <dt className="text-slate-400">File Size</dt>
                      <dd className="font-mono text-slate-200 tabular-nums">
                        {formatBytes(selectedFile.size)}
                      </dd>
                    </div>
                    <div className="flex items-center justify-between py-2.5">
                      <dt className="text-slate-400">Format</dt>
                      <dd className="font-mono uppercase text-slate-200">
                        {selectedFile.name.split('.').pop() || 'MEDIA'}
                      </dd>
                    </div>
                    <div className="flex items-center justify-between py-2.5">
                      <dt className="text-slate-400">Endpoint</dt>
                      <dd className="font-mono text-xs text-slate-300">
                        {mediaType === 'image'
                          ? 'POST /api/analyze/image'
                          : 'POST /api/analyze/video'}
                      </dd>
                    </div>
                    {clientDims && (
                      <div className="flex items-center justify-between py-2.5">
                        <dt className="text-slate-400">Properties</dt>
                        <dd className="font-mono text-slate-200 tabular-nums">
                          {clientDims}
                        </dd>
                      </div>
                    )}
                  </dl>
                </div>

                <div className="mt-6 flex flex-col gap-3">
                  <button
                    type="button"
                    disabled={isAnalyzing}
                    onClick={handleAnalyze}
                    className="inline-flex min-h-[46px] w-full items-center justify-center gap-2 rounded-lg bg-cyan-500 px-5 py-3 text-sm font-semibold text-slate-950 transition-colors hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isAnalyzing ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Analyzing Media...
                      </>
                    ) : (
                      <>
                        <ScanSearch className="h-4 w-4" />
                        Analyze Now
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    disabled={isAnalyzing}
                    onClick={clearSelection}
                    className="inline-flex min-h-[42px] w-full items-center justify-center gap-2 rounded-lg border border-slate-700 bg-transparent px-4 py-2 text-sm font-medium text-slate-300 transition-colors hover:border-slate-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Trash2 className="h-4 w-4" />
                    Choose Different File
                  </button>
                </div>
              </div>
            </div>

            {/* Live Upload & Forensic Analysis Progress */}
            {isAnalyzing && (
              <div
                aria-live="polite"
                className="rounded-lg border border-cyan-500/30 bg-[#070E20] p-5"
              >
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-slate-100">
                    {uploadPercent < 100
                      ? 'Uploading media securely...'
                      : 'Running neural forensic inference...'}
                  </span>
                  <span className="font-mono text-xs text-cyan-300 tabular-nums">
                    {uploadPercent < 100 ? `${uploadPercent}%` : 'Processing'}
                  </span>
                </div>

                <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-800">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-blue-500 transition-all duration-300"
                    style={{
                      width:
                        uploadPercent < 100
                          ? `${uploadPercent}%`
                          : `${Math.min(96, 35 + stageIndex * 20)}%`,
                    }}
                  />
                </div>

                <ol className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  {stages.map((label, idx) => {
                    const completed = uploadPercent >= 100 && idx < stageIndex;
                    const active = uploadPercent >= 100 && idx === stageIndex;
                    return (
                      <li
                        key={label}
                        className={`flex items-start gap-2.5 text-xs ${
                          completed
                            ? 'text-emerald-400'
                            : active
                              ? 'text-cyan-300'
                              : 'text-slate-500'
                        }`}
                      >
                        {completed ? (
                          <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                        ) : active ? (
                          <Loader2 className="mt-0.5 h-3.5 w-3.5 shrink-0 animate-spin" />
                        ) : (
                          <span className="mt-0.5 inline-block h-3.5 w-3.5 shrink-0 text-center font-mono">
                            {idx + 1}
                          </span>
                        )}
                        <span>{label}</span>
                      </li>
                    );
                  })}
                </ol>
              </div>
            )}
          </div>
        )}

        {/* Inline Error Display */}
        {errorMessage && (
          <div
            role="alert"
            className="mt-6 flex items-start gap-3 rounded-lg border border-rose-500/40 bg-rose-950/30 p-4 text-sm text-rose-200"
          >
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-rose-400" />
            <div>
              <p className="font-semibold text-rose-100">Analysis Error</p>
              <p className="mt-1 text-rose-200/90">{errorMessage}</p>
            </div>
          </div>
        )}
      </div>

      {/* Security & Methodology Footnote */}
      <div className="mt-6 grid grid-cols-1 gap-6 text-sm text-slate-400 sm:grid-cols-3">
        <div>
          <h3 className="font-semibold text-slate-200">
            Strict Magic-Byte Validation
          </h3>
          <p className="mt-1 leading-relaxed">
            Every upload is verified against actual binary container headers,
            preventing spoofed extensions or executable payloads.
          </p>
        </div>
        <div>
          <h3 className="font-semibold text-slate-200">
            Zero-Retention Temp Storage
          </h3>
          <p className="mt-1 leading-relaxed">
            Media files receive isolated UUID names during inspection and are
            deleted immediately once the forensic report is saved.
          </p>
        </div>
        <div>
          <h3 className="font-semibold text-slate-200">
            Calibrated Uncertainty
          </h3>
          <p className="mt-1 leading-relaxed">
            If visual cues conflict or compression degrades signal clarity, the
            engine explicitly reports an Inconclusive classification.
          </p>
        </div>
      </div>
    </div>
  );
}
