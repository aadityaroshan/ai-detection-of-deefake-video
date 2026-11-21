import {
  ArrowRight,
  Film,
  Fingerprint,
  ScanFace,
  ShieldCheck,
} from 'lucide-react';
import { useState } from 'react';
import type { AppPage } from './Navbar';

interface HomePageProps {
  onNavigate: (page: AppPage, section?: string) => void;
}

function ForensicVisualFrame({
  src,
  alt,
  caption,
  aspectClass,
}: {
  src: string;
  alt: string;
  caption: string;
  aspectClass?: string;
}) {
  const [failed, setFailed] = useState(false);

  return (
    <div
      className={`relative overflow-hidden rounded-xl border border-slate-800/90 bg-[#0A1122] ${aspectClass ?? 'h-full min-h-[300px]'}`}
    >
      {!failed ? (
        <img
          src={src}
          alt={alt}
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
          className="h-full w-full object-cover"
        />
      ) : (
        <div className="flex h-full min-h-[280px] w-full flex-col items-center justify-center bg-gradient-to-br from-[#0B1328] via-[#0F1B38] to-[#080E1E] p-8 text-center">
          <Fingerprint className="h-10 w-10 text-cyan-400/80" />
          <p className="mt-3 text-sm font-medium text-slate-300">{caption}</p>
        </div>
      )}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#050811]/90 via-[#050811]/45 to-transparent px-5 py-4">
        <p className="text-xs font-medium text-slate-200">{caption}</p>
      </div>
    </div>
  );
}

export function HomePage({ onNavigate }: HomePageProps) {
  const features = [
    {
      icon: Fingerprint,
      title: 'Synthetic Pattern Detection',
      description:
        'Examines diffusion noise floors, optical lighting coherence, micro-texture density, and structural geometry across JPG, PNG, and WEBP uploads.',
    },
    {
      icon: ScanFace,
      title: 'Facial Manipulation Forensics',
      description:
        'Identifies face-swap boundary blending, asymmetric iris reflections, jawline skin-texture drift, and unnatural facial proportions.',
    },
    {
      icon: Film,
      title: 'Temporal Video Inspection',
      description:
        'Samples sequential keyframes across MP4, MOV, and AVI footage to evaluate cross-frame motion continuity and flag suspicious timestamps.',
    },
    {
      icon: ShieldCheck,
      title: 'Calibrated Probability & Confidence',
      description:
        'Separates estimated AI-generated probability from model confidence and explicitly returns Inconclusive when visual signals are ambiguous.',
    },
  ];

  const steps = [
    {
      num: '01.',
      title: 'Validated Media Upload',
      body: 'Upload an image (up to 20 MB) or video (up to 60 MB, 2 min max). The server verifies actual binary file headers, assigns a random isolated filename, and checks embedded metadata.',
    },
    {
      num: '02.',
      title: 'Signal & Keyframe Extraction',
      body: 'Images are inspected for EXIF camera markers and embedded AI provenance signatures. Videos are decoded server-side into evenly distributed keyframes with exact timestamps.',
    },
    {
      num: '03.',
      title: 'Multimodal Neural Inference',
      body: 'Our forensic engine evaluates lighting physics, skin and background textures, facial geometry, and temporal frame coherence across six structured dimensions.',
    },
    {
      num: '04.',
      title: 'Calibrated Report & Cleanup',
      body: 'Receive AI-generated probability, likely authentic probability, separate model confidence, suspicious video timestamps, and an exportable PDF report. Temporary uploads are purged immediately.',
    },
  ];

  return (
    <div className="pb-24">
      {/* Hero Section: 2-Column Balanced Split */}
      <section className="mx-auto max-w-7xl px-5 pt-14 pb-16 sm:px-8 lg:pt-20 lg:pb-20">
        <div className="grid grid-cols-1 items-stretch gap-10 lg:grid-cols-12">
          <div className="flex flex-col justify-center lg:col-span-6">
            <p className="text-sm font-medium tracking-wide text-cyan-400">
              Discover What&apos;s Real. Detect What&apos;s AI.
            </p>
            <h1 className="mt-4 text-4xl font-extrabold tracking-tight text-white sm:text-5xl lg:text-[3.5rem] lg:leading-[1.08]">
              Is It Real or AI?
            </h1>
            <p className="mt-6 max-w-xl text-base leading-relaxed text-slate-300 sm:text-lg">
              AI Truth Detector is a digital media forensics platform built to
              inspect photographs and videos for generative synthesis, deepfake
              facial manipulation, and temporal inconsistencies — delivering
              calibrated probability scores and transparent forensic reports.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-4">
              <button
                type="button"
                onClick={() => onNavigate('detect')}
                className="inline-flex min-h-[46px] items-center gap-2 rounded-lg bg-cyan-500 px-6 py-3 text-sm font-semibold text-slate-950 transition-colors duration-150 hover:bg-cyan-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 whitespace-nowrap shrink-0"
              >
                Get Started
                <ArrowRight className="h-4 w-4" />
              </button>
              <a
                href="#how-it-works"
                className="inline-flex min-h-[46px] items-center rounded-lg border border-slate-700 bg-slate-900/60 px-5 py-3 text-sm font-medium text-slate-200 transition-colors duration-150 hover:border-slate-500 hover:text-white whitespace-nowrap shrink-0"
              >
                How It Works
              </a>
            </div>

            <div className="mt-8 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-slate-800/80 pt-6 text-xs text-slate-400">
              <span>Images: JPG, PNG, WEBP</span>
              <span aria-hidden="true">·</span>
              <span>Videos: MP4, MOV, AVI</span>
              <span aria-hidden="true">·</span>
              <span>Zero Persistent Upload Storage</span>
              <span aria-hidden="true">·</span>
              <span>Exportable PDF Reports</span>
            </div>
          </div>

          <div className="lg:col-span-6">
            <ForensicVisualFrame
              src="/src/assets/images/hero_forensic_prism_1795234561150.jpg"
              alt="Precision optical lens inspecting digital pixel topography and facial mesh contours"
              caption="Optical & neural pixel lattice inspection for synthetic artifact and facial manipulation detection"
              aspectClass="h-full min-h-[300px] lg:min-h-[410px]"
            />
          </div>
        </div>

        {/* Full-Width 4-Column Feature Capabilities Grid */}
        <div className="mt-16 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((feat) => {
            const Icon = feat.icon;
            return (
              <div
                key={feat.title}
                className="flex flex-col rounded-xl border border-slate-800/80 bg-[#0B1224]/75 p-6 backdrop-blur-sm transition-colors duration-150 hover:border-slate-700"
              >
                <Icon className="h-5 w-5 text-cyan-400" />
                <h2 className="mt-4 text-base font-semibold text-slate-50">
                  {feat.title}
                </h2>
                <p className="mt-2.5 text-sm leading-relaxed text-slate-400">
                  {feat.description}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {/* How It Works Section */}
      <section
        id="how-it-works"
        className="border-t border-slate-800/70 bg-[#070C18]/70 py-20"
      >
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <div className="max-w-2xl">
            <p className="text-sm font-medium text-cyan-400">
              Forensic Detection Pipeline
            </p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight text-white sm:text-4xl">
              How AI Truth Detector Evaluates Media
            </h2>
            <p className="mt-3 text-base leading-relaxed text-slate-400">
              Every uploaded file passes through strict binary validation,
              metadata inspection, and calibrated multimodal visual inference
              before a statistical verdict is issued.
            </p>
          </div>

          <div className="mt-12 grid grid-cols-1 items-start gap-12 lg:grid-cols-12">
            {/* Editorial Numbered Steps */}
            <div className="divide-y divide-slate-800/80 lg:col-span-7">
              {steps.map((step) => (
                <div key={step.num} className="py-6 first:pt-0 last:pb-0">
                  <div className="flex items-baseline gap-3">
                    <span className="font-mono text-sm font-semibold text-cyan-400 tabular-nums">
                      {step.num}
                    </span>
                    <h3 className="text-lg font-semibold text-white">
                      {step.title}
                    </h3>
                  </div>
                  <p className="mt-2.5 pl-9 text-sm leading-relaxed text-slate-400">
                    {step.body}
                  </p>
                </div>
              ))}
            </div>

            {/* Dual Visual Proof Column */}
            <div className="flex flex-col gap-6 lg:col-span-5">
              <ForensicVisualFrame
                src="/src/assets/images/methodology_spectral_scan_1795234561991.jpg"
                alt="Scientific optical prism separating sensor light frequencies for forensic inspection"
                caption="Spatial noise floor, lighting geometry, and provenance signal analysis"
                aspectClass="aspect-[16/9]"
              />
              <ForensicVisualFrame
                src="/src/assets/images/video_temporal_frames_1795234561409.jpg"
                alt="Sequential smoked-glass cinema frames aligned along cyan temporal vectors"
                caption="Multi-frame temporal consistency tracking across video timestamps"
                aspectClass="aspect-[4/3]"
              />
            </div>
          </div>

          {/* Closing Call to Action */}
          <div className="mt-16 flex flex-col items-start justify-between gap-6 rounded-xl border border-slate-800/80 bg-[#0B1224]/80 p-8 sm:flex-row sm:items-center">
            <div>
              <h3 className="text-xl font-bold text-white">
                Ready to inspect an image or video?
              </h3>
              <p className="mt-1.5 text-sm text-slate-400">
                Upload any supported media file to generate a complete forensic
                report with calibrated probabilities.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('detect')}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-cyan-500 px-6 py-2.5 text-sm font-semibold text-slate-950 transition-colors hover:bg-cyan-400 whitespace-nowrap shrink-0"
            >
              Open Detection Workspace
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
