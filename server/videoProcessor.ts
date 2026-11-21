import { execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import {
  assertPathInsideTempRoot,
  MAX_VIDEO_DURATION_SECONDS,
} from './security.ts';

const execFileAsync = promisify(execFile);

export interface ExtractedVideoFrame {
  frameIndex: number;
  timestampSeconds: number;
  timestampFormatted: string;
  base64Jpeg: string;
}

export interface VideoProcessingResult {
  durationSeconds: number;
  width: number;
  height: number;
  fps: number;
  frames: ExtractedVideoFrame[];
  thumbnailDataUrl: string | null;
}

export function formatTimestamp(seconds: number): string {
  const safe = Math.max(0, seconds);
  const mins = Math.floor(safe / 60);
  const secs = safe - mins * 60;
  const minStr = String(mins).padStart(2, '0');
  const secStr = secs.toFixed(1).padStart(4, '0');
  return `${minStr}:${secStr}`;
}

interface FfprobeStream {
  codec_type?: string;
  width?: number;
  height?: number;
  r_frame_rate?: string;
  avg_frame_rate?: string;
  duration?: string;
}

interface FfprobeOutput {
  streams?: FfprobeStream[];
  format?: {
    duration?: string;
  };
}

function parseFrameRate(rateStr?: string): number {
  if (!rateStr) return 0;
  const parts = rateStr.split('/');
  if (parts.length === 2) {
    const num = Number(parts[0]);
    const den = Number(parts[1]);
    if (Number.isFinite(num) && Number.isFinite(den) && den > 0) {
      return Number((num / den).toFixed(2));
    }
  }
  const parsed = Number(rateStr);
  return Number.isFinite(parsed) ? Number(parsed.toFixed(2)) : 0;
}

async function probeVideo(videoPath: string): Promise<{
  durationSeconds: number;
  width: number;
  height: number;
  fps: number;
}> {
  const safePath = assertPathInsideTempRoot(videoPath);

  const { stdout } = await execFileAsync(
    'ffprobe',
    [
      '-v',
      'error',
      '-print_format',
      'json',
      '-show_format',
      '-show_streams',
      safePath,
    ],
    { timeout: 15_000, maxBuffer: 4 * 1024 * 1024 }
  );

  const parsed = JSON.parse(stdout) as FfprobeOutput;
  const videoStream = parsed.streams?.find((s) => s.codec_type === 'video');
  if (!videoStream) {
    throw new Error('No decodable video track found in the uploaded file.');
  }

  const rawDuration =
    Number(parsed.format?.duration) || Number(videoStream.duration) || 0;

  if (!Number.isFinite(rawDuration) || rawDuration <= 0) {
    throw new Error('Unable to determine valid video duration.');
  }

  if (rawDuration > MAX_VIDEO_DURATION_SECONDS) {
    throw new Error(
      `Video duration (${rawDuration.toFixed(1)}s) exceeds the maximum allowed limit of ${MAX_VIDEO_DURATION_SECONDS} seconds.`
    );
  }

  const fps =
    parseFrameRate(videoStream.avg_frame_rate) ||
    parseFrameRate(videoStream.r_frame_rate) ||
    30;

  return {
    durationSeconds: Number(rawDuration.toFixed(2)),
    width: videoStream.width ?? 0,
    height: videoStream.height ?? 0,
    fps,
  };
}

/**
 * Extracts evenly spaced keyframes across the video timeline using FFmpeg
 * (strictly via execFile with parameterized arguments — zero shell execution).
 */
export async function extractVideoKeyframes(
  videoPath: string,
  sessionDir: string,
  maxFrames = 6
): Promise<VideoProcessingResult> {
  const safeVideoPath = assertPathInsideTempRoot(videoPath);
  const safeSessionDir = assertPathInsideTempRoot(sessionDir);

  const metadata = await probeVideo(safeVideoPath);

  const targetCount =
    metadata.durationSeconds < 1.5
      ? Math.min(3, maxFrames)
      : metadata.durationSeconds < 4
        ? Math.min(4, maxFrames)
        : maxFrames;

  const timestamps: number[] = [];
  if (targetCount === 1) {
    timestamps.push(metadata.durationSeconds * 0.5);
  } else {
    const startMargin = Math.min(0.25, metadata.durationSeconds * 0.08);
    const endMargin = Math.max(
      startMargin,
      metadata.durationSeconds - Math.min(0.25, metadata.durationSeconds * 0.08)
    );
    const span = Math.max(0.05, endMargin - startMargin);
    for (let i = 0; i < targetCount; i++) {
      const ratio = targetCount === 1 ? 0.5 : i / (targetCount - 1);
      timestamps.push(Number((startMargin + span * ratio).toFixed(2)));
    }
  }

  const frames: ExtractedVideoFrame[] = [];
  for (let i = 0; i < timestamps.length; i++) {
    const ts = timestamps[i];
    const outFile = assertPathInsideTempRoot(
      path.join(safeSessionDir, `frame_${i}.jpg`)
    );

    await execFileAsync(
      'ffmpeg',
      [
        '-nostdin',
        '-hide_banner',
        '-loglevel',
        'error',
        '-ss',
        ts.toFixed(2),
        '-i',
        safeVideoPath,
        '-frames:v',
        '1',
        '-vf',
        "scale='min(960,iw)':-2",
        '-q:v',
        '4',
        '-y',
        outFile,
      ],
      { timeout: 15_000 }
    );

    if (fs.existsSync(outFile)) {
      const buf = fs.readFileSync(outFile);
      frames.push({
        frameIndex: i + 1,
        timestampSeconds: ts,
        timestampFormatted: formatTimestamp(ts),
        base64Jpeg: buf.toString('base64'),
      });
    }
  }

  if (frames.length === 0) {
    throw new Error('Failed to decode frames from the uploaded video.');
  }

  // Generate a compact preview thumbnail from the first extracted frame
  let thumbnailDataUrl: string | null = null;
  const thumbOut = assertPathInsideTempRoot(
    path.join(safeSessionDir, 'thumb.jpg')
  );
  try {
    await execFileAsync(
      'ffmpeg',
      [
        '-nostdin',
        '-hide_banner',
        '-loglevel',
        'error',
        '-ss',
        timestamps[0].toFixed(2),
        '-i',
        safeVideoPath,
        '-frames:v',
        '1',
        '-vf',
        "scale='min(320,iw)':-2",
        '-q:v',
        '7',
        '-y',
        thumbOut,
      ],
      { timeout: 10_000 }
    );
    if (fs.existsSync(thumbOut)) {
      thumbnailDataUrl = `data:image/jpeg;base64,${fs.readFileSync(thumbOut).toString('base64')}`;
    }
  } catch {
    thumbnailDataUrl = null;
  }

  return {
    durationSeconds: metadata.durationSeconds,
    width: metadata.width,
    height: metadata.height,
    fps: metadata.fps,
    frames,
    thumbnailDataUrl,
  };
}

/**
 * Creates a small JPEG preview thumbnail for an uploaded image using FFmpeg
 * so History rows can render fast thumbnails without storing multi-megabyte originals.
 */
export async function createImageThumbnailDataUrl(
  imagePath: string,
  sessionDir: string
): Promise<string | null> {
  const safeImagePath = assertPathInsideTempRoot(imagePath);
  const thumbOut = assertPathInsideTempRoot(
    path.join(sessionDir, 'img_thumb.jpg')
  );
  try {
    await execFileAsync(
      'ffmpeg',
      [
        '-nostdin',
        '-hide_banner',
        '-loglevel',
        'error',
        '-i',
        safeImagePath,
        '-frames:v',
        '1',
        '-vf',
        "scale='min(320,iw)':-2",
        '-q:v',
        '7',
        '-y',
        thumbOut,
      ],
      { timeout: 10_000 }
    );
    if (fs.existsSync(thumbOut)) {
      return `data:image/jpeg;base64,${fs.readFileSync(thumbOut).toString('base64')}`;
    }
  } catch {
    // Fallback handled gracefully
  }
  return null;
}

/**
 * Normalizes very large uploaded images (e.g. > 2.5 MB) to a crisp max-1600px JPEG copy
 * inside the isolated session folder so neural vision inference stays fast and reliable.
 * Binary metadata/EXIF inspection always runs on the untouched original file first.
 */
export async function prepareAnalysisImagePayload(
  imagePath: string,
  canonicalMimeType: string,
  sessionDir: string
): Promise<{ base64: string; mimeType: string }> {
  const safeImagePath = assertPathInsideTempRoot(imagePath);
  const stat = fs.statSync(safeImagePath);

  // Small/medium images go straight through untouched
  if (stat.size <= 2 * 1024 * 1024) {
    return {
      base64: fs.readFileSync(safeImagePath).toString('base64'),
      mimeType: canonicalMimeType,
    };
  }

  const normalizedOut = assertPathInsideTempRoot(
    path.join(sessionDir, 'analysis_norm.jpg')
  );
  try {
    await execFileAsync(
      'ffmpeg',
      [
        '-nostdin',
        '-hide_banner',
        '-loglevel',
        'error',
        '-i',
        safeImagePath,
        '-frames:v',
        '1',
        '-vf',
        "scale='min(1600,iw)':-2",
        '-q:v',
        '3',
        '-y',
        normalizedOut,
      ],
      { timeout: 12_000 }
    );
    if (fs.existsSync(normalizedOut)) {
      return {
        base64: fs.readFileSync(normalizedOut).toString('base64'),
        mimeType: 'image/jpeg',
      };
    }
  } catch {
    // Fall back to original buffer if ffmpeg resize fails
  }

  return {
    base64: fs.readFileSync(safeImagePath).toString('base64'),
    mimeType: canonicalMimeType,
  };
}

