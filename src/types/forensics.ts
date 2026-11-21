export type DetectionStatus = 'AI-Generated' | 'Likely Authentic' | 'Inconclusive';
export type MediaType = 'image' | 'video';

export interface ForensicIndicator {
  category: string;
  score: number; // 0-100 synthetic anomaly intensity
  verdict: 'Normal' | 'Suspicious' | 'Anomalous';
  observation: string;
}

export interface VideoFrameAssessment {
  frameIndex: number;
  timestamp: string; // e.g. "00:02.4"
  timestampSeconds: number;
  aiProbability: number; // 0-100
  suspicious: boolean;
  faceManipulationDetected: boolean;
  temporalAnomaly: string;
}

export interface MediaMetadataSummary {
  fileSizeBytes: number;
  mimeType: string;
  detectedFormat: string;
  width?: number;
  height?: number;
  durationSeconds?: number;
  fps?: number;
  framesAnalyzed?: number;
  hasExifCameraMarkers: boolean;
  aiGeneratorMarkers: string[];
  sha256Prefix: string;
}

export interface AnalysisReport {
  id: string;
  fileName: string;
  mediaType: MediaType;
  createdAt: string;
  aiProbability: number; // 0-100
  authenticProbability: number; // 0-100
  modelConfidence: number; // 0-100
  status: DetectionStatus;
  summary: string;
  faceManipulationRisk: 'None Detected' | 'Low' | 'Moderate' | 'High';
  artifactsDetected: string[];
  forensicIndicators: ForensicIndicator[];
  suspiciousFrames: VideoFrameAssessment[];
  allFrames?: VideoFrameAssessment[];
  metadata: MediaMetadataSummary;
  thumbnailDataUrl?: string | null;
  modelEngine: string;
  disclaimer: string;
}

export interface HistoryRecord {
  id: string;
  fileName: string;
  mediaType: MediaType;
  createdAt: string;
  aiProbability: number;
  authenticProbability: number;
  modelConfidence: number;
  status: DetectionStatus;
  fileSizeBytes: number;
  detectedFormat: string;
  thumbnailDataUrl?: string | null;
}
