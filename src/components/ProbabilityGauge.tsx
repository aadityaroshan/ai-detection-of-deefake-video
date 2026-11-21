import { useEffect, useState } from 'react';
import type { DetectionStatus } from '../types/forensics';
import { getStatusVisuals } from '../utils/format';

interface ProbabilityGaugeProps {
  aiProbability: number;
  status: DetectionStatus;
}

export function ProbabilityGauge({
  aiProbability,
  status,
}: ProbabilityGaugeProps) {
  const [displayValue, setDisplayValue] = useState(0);
  const visuals = getStatusVisuals(status);

  useEffect(() => {
    const target = Math.max(0, Math.min(100, aiProbability));
    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReduced) {
      setDisplayValue(target);
      return;
    }

    let frameId = 0;
    const durationMs = 750;
    const start = performance.now();

    const tick = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(1, elapsed / durationMs);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayValue(target * eased);
      if (progress < 1) {
        frameId = requestAnimationFrame(tick);
      } else {
        setDisplayValue(target);
      }
    };

    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [aiProbability]);

  const size = 236;
  const center = size / 2;
  const radius = 92;
  const strokeWidth = 12;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - displayValue / 100);

  // Subtle calibrated dial ticks
  const ticks = Array.from({ length: 40 }, (_, idx) => {
    const angle = (idx / 40) * 360 - 90;
    const rad = (angle * Math.PI) / 180;
    const inner = radius - 16;
    const outer = radius - (idx % 5 === 0 ? 10 : 13);
    return {
      x1: center + inner * Math.cos(rad),
      y1: center + inner * Math.sin(rad),
      x2: center + outer * Math.cos(rad),
      y2: center + outer * Math.sin(rad),
      major: idx % 5 === 0,
    };
  });

  return (
    <div className="relative flex flex-col items-center justify-center">
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="overflow-visible"
        role="img"
        aria-label={`Estimated AI-Generated Probability: ${aiProbability.toFixed(1)} percent, classified as ${status}`}
      >
        {/* Inner calibrated dial ticks */}
        {ticks.map((t, i) => (
          <line
            key={i}
            x1={t.x1}
            y1={t.y1}
            x2={t.x2}
            y2={t.y2}
            stroke={t.major ? '#334155' : '#1e293b'}
            strokeWidth={t.major ? 1.5 : 1}
          />
        ))}

        {/* Track circle */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="#111b33"
          strokeWidth={strokeWidth}
        />

        {/* Active calibrated probability arc */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={visuals.strokeHex}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          transform={`rotate(-90 ${center} ${center})`}
          style={{
            filter: `drop-shadow(0 0 10px ${visuals.strokeHex}44)`,
          }}
        />
      </svg>

      {/* Center Readout */}
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="text-xs font-medium text-slate-400">
          AI Probability
        </span>
        <div className="mt-1 flex items-baseline justify-center font-mono tabular-nums">
          <span className="text-4xl font-bold tracking-tight text-white">
            {displayValue.toFixed(1)}
          </span>
          <span className="ml-0.5 text-lg font-semibold text-slate-400">%</span>
        </div>
        <span
          className={`mt-1.5 text-xs font-semibold tracking-wide ${visuals.textClass}`}
        >
          {visuals.symbol} {status}
        </span>
      </div>
    </div>
  );
}
