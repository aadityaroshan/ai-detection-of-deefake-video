import crypto from 'node:crypto';
import fs from 'node:fs';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import type {
  AnalysisReport,
  DetectionStatus,
  ForensicIndicator,
  MediaMetadataSummary,
  VideoFrameAssessment,
} from '../src/types/forensics.ts';
import type { BinaryMetadataSignals } from './security.ts';
import type { ExtractedVideoFrame } from './videoProcessor.ts';

const PRIMARY_FORENSIC_MODEL = 'gemini-4-hydrogen';
const FALLBACK_FORENSIC_MODEL = 'gemini-3.1-flash-lite';

const PROBABILITY_DISCLAIMER =
  'This score represents an estimated statistical probability derived from visual, temporal, and structural forensic indicators — NOT the exact percentage of AI tools used to create or edit the media. Heavy compression, resizing, or hybrid editing can lower certainty.';

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error(
      'Detection engine API key is not configured on the server. Please configure GEMINI_API_KEY in Settings > Secrets.'
    );
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      timeout: 22_000,
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function isTransientOrFallbackableError(err: unknown): boolean {
  const text = err instanceof Error ? err.message : String(err);
  return /503|UNAVAILABLE|high demand|overloaded|DEADLINE_EXCEEDED|ECONNRESET|ETIMEDOUT|fetch failed|500|timeout|aborted|NOT_FOUND|404/i.test(
    text
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function withHardTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Request timeout (${ms}ms) while waiting for ${label}`));
    }, ms);
    promise.then(
      (val) => {
        clearTimeout(timer);
        resolve(val);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

/**
 * Executes structured Gemini forensic generation with strict per-attempt timeouts,
 * exponential backoff, and fast failover between active free-tier multimodal models
 * whenever an upstream 503 high-demand spike occurs.
 */
async function generateForensicJson<T>(params: {
  parts: Array<
    | { text: string }
    | { inlineData: { mimeType: string; data: string } }
  >;
  systemInstruction: string;
  responseSchema: Record<string, unknown>;
}): Promise<{ data: T; usedModel: string }> {
  const ai = getGeminiClient();

  const attempts: Array<{
    model: string;
    thinkingLevel?: ThinkingLevel;
    delayBeforeMs: number;
    timeoutMs: number;
  }> = [
    {
      model: PRIMARY_FORENSIC_MODEL,
      thinkingLevel: ThinkingLevel.LOW,
      delayBeforeMs: 0,
      timeoutMs: 18_000,
    },
    {
      model: FALLBACK_FORENSIC_MODEL,
      delayBeforeMs: 250,
      timeoutMs: 18_000,
    },
    {
      model: PRIMARY_FORENSIC_MODEL,
      thinkingLevel: ThinkingLevel.LOW,
      delayBeforeMs: 1200,
      timeoutMs: 20_000,
    },
    {
      model: FALLBACK_FORENSIC_MODEL,
      delayBeforeMs: 1200,
      timeoutMs: 20_000,
    },
  ];

  let lastError: unknown = null;

  for (const attempt of attempts) {
    if (attempt.delayBeforeMs > 0) {
      await sleep(attempt.delayBeforeMs);
    }

    try {
      const config: Record<string, unknown> = {
        systemInstruction: params.systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: params.responseSchema,
      };
      if (attempt.thinkingLevel) {
        config.thinkingConfig = { thinkingLevel: attempt.thinkingLevel };
      }

      const response = await withHardTimeout(
        ai.models.generateContent({
          model: attempt.model,
          contents: { parts: params.parts },
          config,
        }),
        attempt.timeoutMs,
        attempt.model
      );

      const rawText = response.text?.trim();
      if (!rawText) {
        throw new Error('Forensic model returned an empty response.');
      }

      // Strip accidental markdown code fences if present
      const cleaned = rawText
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim();

      const parsed = JSON.parse(cleaned) as T;
      return { data: parsed, usedModel: attempt.model };
    } catch (err) {
      lastError = err;
      console.warn(
        `[detector] Attempt with ${attempt.model} failed:`,
        err instanceof Error ? err.message : String(err)
      );
      if (!isTransientOrFallbackableError(err)) {
        throw err;
      }
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error('Forensic inference service is temporarily busy. Please try again shortly.');
}

function clampPercentage(value: number): number {
  if (!Number.isFinite(value)) return 50;
  return Math.max(0, Math.min(100, Number(value.toFixed(1))));
}

/**
 * Calibrates detection status from estimated AI probability and separate model confidence.
 * Returns "Inconclusive" whenever confidence is insufficient or probability lies inside
 * the ambiguous decision band (38% - 62%).
 */
function classifyStatus(
  aiProbability: number,
  modelConfidence: number
): DetectionStatus {
  if (modelConfidence < 55) {
    return 'Inconclusive';
  }
  if (aiProbability >= 62) {
    return 'AI-Generated';
  }
  if (aiProbability <= 38) {
    return 'Likely Authentic';
  }
  return 'Inconclusive';
}

function normalizeIndicators(
  rawIndicators: Array<{
    category: string;
    score: number;
    verdict: string;
    observation: string;
  }>
): ForensicIndicator[] {
  return (rawIndicators || []).slice(0, 6).map((item) => {
    const score = clampPercentage(item.score);
    let verdict: ForensicIndicator['verdict'] = 'Normal';
    if (score >= 65 || item.verdict === 'Anomalous') {
      verdict = 'Anomalous';
    } else if (score >= 38 || item.verdict === 'Suspicious') {
      verdict = 'Suspicious';
    }
    return {
      category: String(item.category || 'Visual Signal').slice(0, 80),
      score,
      verdict,
      observation: String(item.observation || '').slice(0, 320),
    };
  });
}

interface RawImageForensicOutput {
  aiProbability: number;
  modelConfidence: number;
  faceManipulationRisk: 'None Detected' | 'Low' | 'Moderate' | 'High';
  summary: string;
  artifactsDetected: string[];
  forensicIndicators: Array<{
    category: string;
    score: number;
    verdict: string;
    observation: string;
  }>;
}

const IMAGE_FORENSIC_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    aiProbability: {
      type: Type.NUMBER,
      description:
        'Estimated probability (0 to 100) that the image is AI-generated or deepfake-manipulated. Base this strictly on observable visual, structural, optical, and metadata evidence.',
    },
    modelConfidence: {
      type: Type.NUMBER,
      description:
        'Calibrated reliability score (0 to 100) of the assessment itself, distinct from aiProbability. Lower this score (< 55) if the image is heavily compressed, very low resolution, abstract, heavily filtered, or presents conflicting forensic signals.',
    },
    faceManipulationRisk: {
      type: Type.STRING,
      description:
        'One of: "None Detected", "Low", "Moderate", "High". Use "None Detected" if no human faces are present or no facial synthesis/swapping signs exist.',
    },
    summary: {
      type: Type.STRING,
      description:
        'A rigorous 2 to 4 sentence forensic analysis summary explaining the concrete visual evidence observed in the image and why the probabilities were assigned.',
    },
    artifactsDetected: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description:
        'List of specific observable artifacts or authentic optical traits found (3 to 6 concise factual bullet points).',
    },
    forensicIndicators: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          category: { type: Type.STRING },
          score: {
            type: Type.NUMBER,
            description:
              'Synthetic anomaly intensity from 0 (fully natural) to 100 (strongly synthetic).',
          },
          verdict: {
            type: Type.STRING,
            description: 'One of: "Normal", "Suspicious", "Anomalous".',
          },
          observation: {
            type: Type.STRING,
            description:
              'Concrete, image-specific visual observation for this forensic dimension.',
          },
        },
        required: ['category', 'score', 'verdict', 'observation'],
      },
      description:
        'Exactly 6 forensic indicator assessments covering: Lighting & Shadow Physics, Micro-Texture & Noise Floor, Anatomical & Structural Coherence, Facial Manipulation & Blending, Background & Frequency Artifacts, and Metadata & Provenance Signals.',
    },
  },
  required: [
    'aiProbability',
    'modelConfidence',
    'faceManipulationRisk',
    'summary',
    'artifactsDetected',
    'forensicIndicators',
  ],
};

export async function analyzeImageForensics(params: {
  filePath: string;
  fileName: string;
  fileSizeBytes: number;
  detectedFormat: string;
  canonicalMimeType: string;
  analysisBase64?: string;
  analysisMimeType?: string;
  sha256Prefix: string;
  binarySignals: BinaryMetadataSignals;
  thumbnailDataUrl: string | null;
}): Promise<AnalysisReport> {
  const base64Image =
    params.analysisBase64 ?? fs.readFileSync(params.filePath).toString('base64');
  const mimeType = params.analysisMimeType ?? params.canonicalMimeType;

  const metadataContext = [
    `Detected container format: ${params.detectedFormat}`,
    params.binarySignals.width && params.binarySignals.height
      ? `Dimensions: ${params.binarySignals.width}x${params.binarySignals.height}px`
      : 'Dimensions: unavailable',
    `File size: ${(params.fileSizeBytes / 1024).toFixed(1)} KB`,
    `EXIF camera hardware markers present: ${params.binarySignals.hasExifCameraMarkers ? 'Yes' : 'No (note: social media and PNG exports strip EXIF naturally, so absence alone is NOT proof of AI)'}`,
    params.binarySignals.aiGeneratorMarkers.length > 0
      ? `Verified embedded AI generator metadata markers found in file header: ${params.binarySignals.aiGeneratorMarkers.join('; ')}`
      : 'Embedded AI generator metadata markers: None detected',
  ].join('\n');

  const prompt = `You are a rigorous digital media forensics analyst evaluating whether an uploaded image is AI-generated / deepfake-manipulated or an authentic real-world photograph.

Examine the attached image carefully across all forensic dimensions:
1. Lighting & Shadow Physics (light-source direction consistency, specular reflections in eyes/glass, shadow softness and contact shadows)
2. Micro-Texture & Noise Floor (natural sensor grain vs. diffusion smoothing, waxy skin pores, painterly hair strands, repetitive fabric micro-patterns)
3. Anatomical & Structural Coherence (fingers, hands, teeth, ears, jewelry symmetry, architectural straight lines, readable text/signage)
4. Facial Manipulation & Blending (face-swap seam halos, mismatched skin noise around jawline/hairline, asymmetric pupils or eyeglasses)
5. Background & Frequency Artifacts (warped background objects, impossible geometry, bokeh edge haloing, upscaler ringing)
6. Metadata & Provenance Signals (interpret the verified binary signals below carefully — remember that authentic screenshots or social media downloads often lack EXIF).

Verified binary metadata signals extracted on the server:
${metadataContext}

Calibration rules:
- Estimate aiProbability strictly from observable evidence (0-100). Authentic photographs with natural lens optics, coherent details, and genuine noise should score low (typically 4-28%). Clearly synthetic diffusion/GAN images or deepfakes should score high (typically 72-97%).
- Keep modelConfidence strictly separate from aiProbability: modelConfidence reflects how clear and reliable the visual evidence is (high resolution & unambiguous cues = 75-95%; ambiguous, heavily compressed, graphic/illustration, or conflicting signals = 30-54%).
- If the evidence is genuinely ambiguous, return an aiProbability near 45-55% and/or a lower modelConfidence so the classification is faithfully marked Inconclusive.
- Never claim 100% absolute certainty unless verified embedded AI generation provenance metadata directly confirms synthetic origin.`;

  const { data: parsed } = await generateForensicJson<RawImageForensicOutput>({
    parts: [
      {
        inlineData: {
          mimeType,
          data: base64Image,
        },
      },
      { text: prompt },
    ],
    systemInstruction:
      'You are a calibrated digital forensics inspection engine. Output strictly factual, evidence-grounded forensic assessments in the requested JSON schema.',
    responseSchema: IMAGE_FORENSIC_SCHEMA,
  });

  // Deterministic calibration: blend indicator consistency with model probability
  let aiProbability = clampPercentage(parsed.aiProbability);
  let modelConfidence = clampPercentage(parsed.modelConfidence);
  if (params.binarySignals.aiGeneratorMarkers.length > 0) {
    aiProbability = Math.max(aiProbability, 92.5);
    modelConfidence = Math.max(modelConfidence, 91.0);
  }

  const authenticProbability = clampPercentage(100 - aiProbability);
  const status = classifyStatus(aiProbability, modelConfidence);

  const validFaceRisks = new Set(['None Detected', 'Low', 'Moderate', 'High']);
  const faceManipulationRisk = validFaceRisks.has(parsed.faceManipulationRisk)
    ? parsed.faceManipulationRisk
    : 'None Detected';

  const metadata: MediaMetadataSummary = {
    fileSizeBytes: params.fileSizeBytes,
    mimeType: params.canonicalMimeType,
    detectedFormat: params.detectedFormat,
    width: params.binarySignals.width,
    height: params.binarySignals.height,
    hasExifCameraMarkers: params.binarySignals.hasExifCameraMarkers,
    aiGeneratorMarkers: params.binarySignals.aiGeneratorMarkers,
    sha256Prefix: params.sha256Prefix,
  };

  return {
    id: crypto.randomUUID(),
    fileName: params.fileName,
    mediaType: 'image',
    createdAt: new Date().toISOString(),
    aiProbability,
    authenticProbability,
    modelConfidence,
    status,
    summary: parsed.summary,
    faceManipulationRisk,
    artifactsDetected: (parsed.artifactsDetected || []).slice(0, 8),
    forensicIndicators: normalizeIndicators(parsed.forensicIndicators),
    suspiciousFrames: [],
    metadata,
    thumbnailDataUrl: params.thumbnailDataUrl,
    modelEngine: 'Multimodal Neural Vision Forensics + Binary Provenance Inspector',
    disclaimer: PROBABILITY_DISCLAIMER,
  };
}

interface RawVideoForensicOutput {
  modelConfidence: number;
  faceManipulationRisk: 'None Detected' | 'Low' | 'Moderate' | 'High';
  summary: string;
  artifactsDetected: string[];
  forensicIndicators: Array<{
    category: string;
    score: number;
    verdict: string;
    observation: string;
  }>;
  frameAssessments: Array<{
    frameIndex: number;
    aiProbability: number;
    faceManipulationDetected: boolean;
    temporalAnomaly: string;
  }>;
}

const VIDEO_FORENSIC_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    modelConfidence: {
      type: Type.NUMBER,
      description:
        'Calibrated reliability score (0 to 100) for the overall multi-frame video assessment, distinct from AI probability.',
    },
    faceManipulationRisk: {
      type: Type.STRING,
      description: 'One of: "None Detected", "Low", "Moderate", "High".',
    },
    summary: {
      type: Type.STRING,
      description:
        'A rigorous 2 to 4 sentence forensic summary covering spatial frame quality, facial consistency, and temporal coherence across the extracted keyframes.',
    },
    artifactsDetected: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description:
        '3 to 6 concise factual observations about visual and temporal cues across the video.',
    },
    forensicIndicators: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          category: { type: Type.STRING },
          score: { type: Type.NUMBER },
          verdict: { type: Type.STRING },
          observation: { type: Type.STRING },
        },
        required: ['category', 'score', 'verdict', 'observation'],
      },
      description:
        'Exactly 6 forensic indicators covering: Temporal Motion Coherence, Facial & Jawline Stability, Lighting & Reflection Continuity, Micro-Texture & Compression Floor, Background & Spatial Geometry, and Container & Metadata Provenance.',
    },
    frameAssessments: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          frameIndex: {
            type: Type.INTEGER,
            description: '1-based frame index matching the provided keyframes.',
          },
          aiProbability: {
            type: Type.NUMBER,
            description:
              'Estimated synthetic / deepfake probability (0 to 100) for this specific frame.',
          },
          faceManipulationDetected: {
            type: Type.BOOLEAN,
            description:
              'True if facial swapping, unnatural lip/eye warping, or blending artifacts appear in this frame.',
          },
          temporalAnomaly: {
            type: Type.STRING,
            description:
              'Specific observation for this frame and its consistency relative to neighboring frames.',
          },
        },
        required: [
          'frameIndex',
          'aiProbability',
          'faceManipulationDetected',
          'temporalAnomaly',
        ],
      },
    },
  },
  required: [
    'modelConfidence',
    'faceManipulationRisk',
    'summary',
    'artifactsDetected',
    'forensicIndicators',
    'frameAssessments',
  ],
};

export async function analyzeVideoForensics(params: {
  fileName: string;
  fileSizeBytes: number;
  detectedFormat: string;
  canonicalMimeType: string;
  sha256Prefix: string;
  binarySignals: BinaryMetadataSignals;
  durationSeconds: number;
  width: number;
  height: number;
  fps: number;
  frames: ExtractedVideoFrame[];
  thumbnailDataUrl: string | null;
}): Promise<AnalysisReport> {
  const frameParts = params.frames.flatMap((frame) => [
    {
      text: `Frame ${frame.frameIndex} (timestamp ${frame.timestampFormatted} / ${frame.timestampSeconds.toFixed(2)}s):`,
    },
    {
      inlineData: {
        mimeType: 'image/jpeg',
        data: frame.base64Jpeg,
      },
    },
  ]);

  const videoContext = [
    `Detected container format: ${params.detectedFormat}`,
    `Resolution: ${params.width}x${params.height}px at ${params.fps} fps`,
    `Duration: ${params.durationSeconds.toFixed(2)} seconds`,
    `Extracted keyframes analyzed: ${params.frames.length}`,
    params.binarySignals.aiGeneratorMarkers.length > 0
      ? `Embedded AI provenance markers: ${params.binarySignals.aiGeneratorMarkers.join('; ')}`
      : 'Embedded AI provenance markers: None detected',
  ].join('\n');

  const prompt = `You are a digital video forensics and deepfake detection analyst.
You have been provided ${params.frames.length} sequential keyframes extracted across a video timeline.

Video telemetry:
${videoContext}

Inspect BOTH individual frames AND cross-frame temporal consistency:
1. Temporal Motion Coherence (object permanence, morphing limbs/accessories, fluid physics, flickering edges between sequential frames)
2. Facial & Jawline Stability (identity drift across frames, unnatural eye blinking/gaze, lip/teeth warping, face-swap mask boundaries)
3. Lighting & Reflection Continuity (consistent shadows, specular highlights, and color temperature across timestamps)
4. Micro-Texture & Compression Floor (consistent natural camera sensor grain vs. AI temporal smoothing or plastic skin textures)
5. Background & Spatial Geometry (background warping, floating artifacts, distorted text/lines)
6. Container & Metadata Provenance

Return an assessment for EVERY frame (frameIndex 1 through ${params.frames.length}).
Keep modelConfidence strictly separate from frame AI probabilities: lower modelConfidence (< 55) if resolution is very low, motion blur is extreme, or cues conflict.`;

  const { data: parsed } = await generateForensicJson<RawVideoForensicOutput>({
    parts: [...frameParts, { text: prompt }],
    systemInstruction:
      'You are a calibrated video deepfake and synthetic media forensic engine. Output strictly evidence-grounded frame-level and temporal assessments in the requested JSON schema.',
    responseSchema: VIDEO_FORENSIC_SCHEMA,
  });

  // Map frame predictions back onto verified extracted frame timestamps
  const byIndex = new Map(
    (parsed.frameAssessments || []).map((f) => [f.frameIndex, f])
  );

  const allFrames: VideoFrameAssessment[] = params.frames.map((frame) => {
    const match = byIndex.get(frame.frameIndex);
    const frameProb = clampPercentage(match?.aiProbability ?? 50);
    const faceManip = Boolean(match?.faceManipulationDetected);
    return {
      frameIndex: frame.frameIndex,
      timestamp: frame.timestampFormatted,
      timestampSeconds: frame.timestampSeconds,
      aiProbability: frameProb,
      suspicious: frameProb >= 60 || faceManip,
      faceManipulationDetected: faceManip,
      temporalAnomaly:
        match?.temporalAnomaly ||
        'Evaluated within sequential timeline window.',
    };
  });

  // Aggregate frame-level predictions mathematically into overall video AI probability
  const sortedProbs = [...allFrames]
    .map((f) => f.aiProbability)
    .sort((a, b) => a - b);
  const meanProb =
    sortedProbs.reduce((sum, p) => sum + p, 0) / Math.max(1, sortedProbs.length);
  const topSlice = sortedProbs.slice(
    Math.max(0, Math.floor(sortedProbs.length * 0.65))
  );
  const upperQuartileMean =
    topSlice.reduce((sum, p) => sum + p, 0) / Math.max(1, topSlice.length);

  let aiProbability = clampPercentage(meanProb * 0.65 + upperQuartileMean * 0.35);
  let modelConfidence = clampPercentage(parsed.modelConfidence);

  if (params.binarySignals.aiGeneratorMarkers.length > 0) {
    aiProbability = Math.max(aiProbability, 92.5);
    modelConfidence = Math.max(modelConfidence, 91.0);
  }

  const authenticProbability = clampPercentage(100 - aiProbability);
  const status = classifyStatus(aiProbability, modelConfidence);
  const suspiciousFrames = allFrames.filter((f) => f.suspicious);

  const validFaceRisks = new Set(['None Detected', 'Low', 'Moderate', 'High']);
  const faceManipulationRisk = validFaceRisks.has(parsed.faceManipulationRisk)
    ? parsed.faceManipulationRisk
    : 'None Detected';

  const metadata: MediaMetadataSummary = {
    fileSizeBytes: params.fileSizeBytes,
    mimeType: params.canonicalMimeType,
    detectedFormat: params.detectedFormat,
    width: params.width,
    height: params.height,
    durationSeconds: params.durationSeconds,
    fps: params.fps,
    framesAnalyzed: allFrames.length,
    hasExifCameraMarkers: params.binarySignals.hasExifCameraMarkers,
    aiGeneratorMarkers: params.binarySignals.aiGeneratorMarkers,
    sha256Prefix: params.sha256Prefix,
  };

  return {
    id: crypto.randomUUID(),
    fileName: params.fileName,
    mediaType: 'video',
    createdAt: new Date().toISOString(),
    aiProbability,
    authenticProbability,
    modelConfidence,
    status,
    summary: parsed.summary,
    faceManipulationRisk,
    artifactsDetected: (parsed.artifactsDetected || []).slice(0, 8),
    forensicIndicators: normalizeIndicators(parsed.forensicIndicators),
    suspiciousFrames,
    allFrames,
    metadata,
    thumbnailDataUrl: params.thumbnailDataUrl,
    modelEngine: 'Temporal Keyframe Extraction + Multimodal Deepfake Forensics',
    disclaimer: PROBABILITY_DISCLAIMER,
  };
}
