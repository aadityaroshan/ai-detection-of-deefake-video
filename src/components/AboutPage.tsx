import { ArrowRight, BookOpen, Cpu, Database, Shield } from 'lucide-react';
import type { AppPage } from './Navbar';

interface AboutPageProps {
  onNavigate: (page: AppPage) => void;
}

export function AboutPage({ onNavigate }: AboutPageProps) {
  const endpoints = [
    {
      method: 'POST',
      path: '/api/analyze/image',
      purpose:
        'Validates image magic bytes, inspects binary EXIF/AI provenance markers, executes neural forensic inference, archives report in SQLite, and deletes temporary upload.',
    },
    {
      method: 'POST',
      path: '/api/analyze/video',
      purpose:
        'Validates video container & duration limit, samples sequential keyframes via FFmpeg/OpenCV pipeline, detects temporal and facial anomalies, aggregates frame probabilities, and cleans temp artifacts.',
    },
    {
      method: 'GET',
      path: '/api/history',
      purpose:
        'Returns stored forensic audit records ordered chronologically from SQLite.',
    },
    {
      method: 'GET',
      path: '/api/history/{id}',
      purpose:
        'Fetches the full multi-axis forensic report and video frame log for a specific case ID.',
    },
    {
      method: 'DELETE',
      path: '/api/history/{id}',
      purpose: 'Permanently removes a stored forensic analysis record from SQLite.',
    },
  ];

  return (
    <div className="mx-auto max-w-5xl px-5 py-12 sm:px-8 lg:py-16">
      <div className="max-w-3xl">
        <p className="text-sm font-medium text-cyan-400">
          Platform Documentation &amp; Methodology
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-white sm:text-4xl">
          About AI Truth Detector
        </h1>
        <p className="mt-4 text-base leading-relaxed text-slate-300">
          AI Truth Detector is a production-style digital media forensics
          platform engineered to help journalists, educators, investigators, and
          everyday users evaluate whether an image or video exhibits signs of
          generative AI synthesis or deepfake facial manipulation.
        </p>
      </div>

      {/* Architecture & Technology Stack */}
      <section className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="rounded-xl border border-slate-800/90 bg-[#0B1224]/80 p-6">
          <div className="flex items-center gap-2.5 text-cyan-400">
            <Cpu className="h-5 w-5" />
            <h2 className="text-lg font-bold text-white">
              Live Web Inference Stack
            </h2>
          </div>
          <ul className="mt-4 space-y-2.5 text-sm text-slate-300">
            <li>
              <strong className="text-slate-100">Frontend:</strong> HTML5,
              Tailwind CSS, TypeScript/React SPA with Fetch/XHR upload telemetry
              and client-side jsPDF report generation.
            </li>
            <li>
              <strong className="text-slate-100">Live Backend API:</strong>{' '}
              Node.js Express REST API with Multer isolated disk ingestion,
              magic-byte validation, and automatic post-inference file cleanup.
            </li>
            <li>
              <strong className="text-slate-100">Media Processing:</strong>{' '}
              Server-side FFmpeg/FFprobe keyframe extraction and raw binary
              EXIF/C2PA/AI-generator metadata scanning.
            </li>
            <li>
              <strong className="text-slate-100">Forensic AI Engine:</strong>{' '}
              Multimodal neural vision forensics with calibrated probability,
              separate confidence estimation, and explicit Inconclusive banding.
            </li>
            <li>
              <strong className="text-slate-100">Database:</strong> Local SQLite
              with parameterized queries storing report history.
            </li>
          </ul>
        </div>

        <div className="rounded-xl border border-slate-800/90 bg-[#0B1224]/80 p-6">
          <div className="flex items-center gap-2.5 text-cyan-400">
            <Database className="h-5 w-5" />
            <h2 className="text-lg font-bold text-white">
              Local Python / PyTorch Reference
            </h2>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-slate-300">
            For BTech CSE local GPU workstation deployment, the project
            repository also includes a complete modular{' '}
            <code className="font-mono text-xs text-cyan-300">
              python_backend/
            </code>{' '}
            reference implementation and{' '}
            <code className="font-mono text-xs text-cyan-300">README.md</code>{' '}
            built with:
          </p>
          <ul className="mt-3 space-y-2 text-sm text-slate-300">
            <li>FastAPI + Uvicorn REST API matching the identical endpoints</li>
            <li>
              PyTorch + HuggingFace pretrained ViT/ConvNeXt deepfake &amp; AI
              image detectors (with explicit weight verification)
            </li>
            <li>OpenCV frame sampling, Pillow &amp; NumPy preprocessing</li>
            <li>SQLite persistence &amp; Windows 11 / VS Code setup instructions</li>
          </ul>
        </div>
      </section>

      {/* Forensic Methodology */}
      <section className="mt-10 rounded-xl border border-slate-800/90 bg-[#0B1224]/80 p-6 sm:p-8">
        <div className="flex items-center gap-2.5 text-cyan-400">
          <BookOpen className="h-5 w-5" />
          <h2 className="text-xl font-bold text-white">
            AI Detection Methodology &amp; Calibration
          </h2>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-8 md:grid-cols-2">
          <div>
            <h3 className="text-sm font-semibold text-slate-100">
              Probability vs. Model Confidence
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-400">
              AI-Generated Probability and Likely Authentic Probability sum to
              100% and represent the statistical likelihood that a file was
              synthetically produced or manipulated. Model Confidence is tracked
              separately to measure signal clarity: a heavily compressed or low-resolution
              image yields lower confidence even when weak visual cues lean one way.
            </p>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-100">
              Inconclusive Classification Safeguard
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-400">
              To avoid overconfident false accusations, the platform enforces an
              explicit Inconclusive threshold: whenever Model Confidence drops
              below 55% or estimated AI Probability sits inside the ambiguous
              38%–62% band, the verdict is transparently marked Inconclusive.
            </p>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-100">
              Spatial Image Inspection
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-400">
              Evaluates light-source physics, shadow geometry, sensor noise floor
              uniformity, anatomical and structural coherence, face-swap blending
              seams, and binary provenance markers (C2PA, Stable Diffusion,
              ComfyUI, Midjourney, DALL-E, Firefly).
            </p>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-100">
              Temporal Video Aggregation
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-400">
              Extracts sequential keyframes across the video timeline and evaluates
              both per-frame manipulation and cross-frame temporal stability. The
              final video score blends the overall mean with upper-quartile peak
              frames so localized deepfake splices are surfaced alongside exact
              suspicious timestamps.
            </p>
          </div>
        </div>
      </section>

      {/* REST API Reference */}
      <section className="mt-10 rounded-xl border border-slate-800/90 bg-[#0B1224]/80 p-6 sm:p-8">
        <h2 className="text-xl font-bold text-white">REST API Endpoints</h2>
        <div className="mt-5 divide-y divide-slate-800/80">
          {endpoints.map((ep) => (
            <div
              key={`${ep.method}-${ep.path}`}
              className="flex flex-col gap-2 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-baseline sm:gap-6"
            >
              <div className="flex shrink-0 items-center gap-3 sm:w-56">
                <span className="font-mono text-xs font-bold text-cyan-400">
                  {ep.method}
                </span>
                <code className="font-mono text-xs text-slate-100">
                  {ep.path}
                </code>
              </div>
              <p className="text-sm text-slate-400">{ep.purpose}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Model Limitations */}
      <section className="mt-10 rounded-xl border border-slate-800/90 bg-[#0B1224]/80 p-6 sm:p-8">
        <div className="flex items-center gap-2.5 text-amber-400">
          <Shield className="h-5 w-5" />
          <h2 className="text-xl font-bold text-white">
            Known Limitations &amp; Responsible Use
          </h2>
        </div>

        <ul className="mt-4 space-y-3 text-sm leading-relaxed text-slate-300">
          <li>
            <strong className="text-slate-100">
              Probabilistic Estimation, Not Absolute Proof:
            </strong>{' '}
            Detection scores indicate statistical likelihood based on observable
            artifacts — they never represent the exact percentage of AI tools
            used, and should not be used as sole legal or disciplinary evidence
            without independent verification.
          </li>
          <li>
            <strong className="text-slate-100">
              Social Media Recompression &amp; Resizing:
            </strong>{' '}
            Repeated JPEG/H.264 recompression (such as WhatsApp, Instagram, or
            screen recordings) strips EXIF headers and destroys high-frequency
            sensor noise, reducing forensic confidence.
          </li>
          <li>
            <strong className="text-slate-100">
              Hybrid Human + AI Editing:
            </strong>{' '}
            Authentic photographs retouched with minor AI inpainting, background
            blur, or smartphone computational photography may trigger moderate
            anomaly indicators or Inconclusive results.
          </li>
          <li>
            <strong className="text-slate-100">
              Rapidly Evolving Generators:
            </strong>{' '}
            Next-generation diffusion and video models continually reduce classic
            visual artifacts, requiring ongoing model calibration and evaluation
            benchmarks.
          </li>
        </ul>

        <div className="mt-8 border-t border-slate-800/80 pt-6">
          <button
            type="button"
            onClick={() => onNavigate('detect')}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-cyan-500 px-5 py-2.5 text-sm font-semibold text-slate-950 transition-colors hover:bg-cyan-400"
          >
            Launch Detection Workspace
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </section>
    </div>
  );
}
