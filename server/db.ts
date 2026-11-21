import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type { AnalysisReport, HistoryRecord } from '../src/types/forensics.ts';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_PATH = path.join(DATA_DIR, 'truth_detector.db');

let dbInstance: DatabaseSync | null = null;

function getDb(): DatabaseSync {
  if (dbInstance) {
    return dbInstance;
  }

  fs.mkdirSync(DATA_DIR, { recursive: true });
  const db = new DatabaseSync(DB_PATH);
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec(`
    CREATE TABLE IF NOT EXISTS analyses (
      id TEXT PRIMARY KEY,
      file_name TEXT NOT NULL,
      media_type TEXT NOT NULL CHECK (media_type IN ('image', 'video')),
      created_at TEXT NOT NULL,
      ai_probability REAL NOT NULL,
      authentic_probability REAL NOT NULL,
      model_confidence REAL NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('AI-Generated', 'Likely Authentic', 'Inconclusive')),
      file_size_bytes INTEGER NOT NULL,
      detected_format TEXT NOT NULL,
      thumbnail_data_url TEXT,
      report_json TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_analyses_created_at ON analyses (created_at DESC);
  `);

  dbInstance = db;
  return db;
}

export function saveAnalysisReport(report: AnalysisReport): void {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO analyses (
      id,
      file_name,
      media_type,
      created_at,
      ai_probability,
      authentic_probability,
      model_confidence,
      status,
      file_size_bytes,
      detected_format,
      thumbnail_data_url,
      report_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    report.id,
    report.fileName,
    report.mediaType,
    report.createdAt,
    report.aiProbability,
    report.authenticProbability,
    report.modelConfidence,
    report.status,
    report.metadata.fileSizeBytes,
    report.metadata.detectedFormat,
    report.thumbnailDataUrl ?? null,
    JSON.stringify(report)
  );
}

interface HistoryRow {
  id: string;
  file_name: string;
  media_type: 'image' | 'video';
  created_at: string;
  ai_probability: number;
  authentic_probability: number;
  model_confidence: number;
  status: 'AI-Generated' | 'Likely Authentic' | 'Inconclusive';
  file_size_bytes: number;
  detected_format: string;
  thumbnail_data_url: string | null;
}

export function listHistoryRecords(limit = 100): HistoryRecord[] {
  const db = getDb();
  const safeLimit = Math.max(1, Math.min(200, Math.floor(limit)));
  const stmt = db.prepare(`
    SELECT
      id,
      file_name,
      media_type,
      created_at,
      ai_probability,
      authentic_probability,
      model_confidence,
      status,
      file_size_bytes,
      detected_format,
      thumbnail_data_url
    FROM analyses
    ORDER BY created_at DESC
    LIMIT ?
  `);

  const rows = stmt.all(safeLimit) as unknown as HistoryRow[];
  return rows.map((row) => ({
    id: row.id,
    fileName: row.file_name,
    mediaType: row.media_type,
    createdAt: row.created_at,
    aiProbability: row.ai_probability,
    authenticProbability: row.authentic_probability,
    modelConfidence: row.model_confidence,
    status: row.status,
    fileSizeBytes: row.file_size_bytes,
    detectedFormat: row.detected_format,
    thumbnailDataUrl: row.thumbnail_data_url,
  }));
}

export function getAnalysisById(id: string): AnalysisReport | null {
  const db = getDb();
  const stmt = db.prepare('SELECT report_json FROM analyses WHERE id = ?');
  const row = stmt.get(id) as unknown as { report_json: string } | undefined;
  if (!row) {
    return null;
  }
  return JSON.parse(row.report_json) as AnalysisReport;
}

export function deleteAnalysisById(id: string): boolean {
  const db = getDb();
  const stmt = db.prepare('DELETE FROM analyses WHERE id = ?');
  const result = stmt.run(id);
  return Number(result.changes) > 0;
}
