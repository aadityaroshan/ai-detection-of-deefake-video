import 'dotenv/config';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import express, { type NextFunction, type Request, type Response } from 'express';
import multer from 'multer';
import { createServer as createViteServer } from 'vite';
import {
  deleteAnalysisById,
  getAnalysisById,
  listHistoryRecords,
  saveAnalysisReport,
} from './server/db.ts';
import {
  analyzeImageForensics,
  analyzeVideoForensics,
} from './server/detector.ts';
import {
  assertPathInsideTempRoot,
  computeSha256Prefix,
  createTempSessionDir,
  ensureTempRoot,
  inspectBinaryMetadata,
  isValidReportId,
  MAX_IMAGE_SIZE_BYTES,
  MAX_VIDEO_SIZE_BYTES,
  purgeOrphanedTempUploads,
  safeCleanupPath,
  sanitizeDisplayFileName,
  TMP_UPLOAD_ROOT,
  validateImageMagicBytes,
  validateVideoMagicBytes,
} from './server/security.ts';
import {
  createImageThumbnailDataUrl,
  extractVideoKeyframes,
  prepareAnalysisImagePayload,
} from './server/videoProcessor.ts';

purgeOrphanedTempUploads();

function createSafeUploadMiddleware(maxSizeBytes: number) {
  const storage = multer.diskStorage({
    destination: (_req, _file, cb) => {
      ensureTempRoot();
      cb(null, TMP_UPLOAD_ROOT);
    },
    filename: (_req, _file, cb) => {
      // Strictly server-generated safe random filename with no executable extension
      cb(null, `upload_${crypto.randomUUID()}.bin`);
    },
  });

  return multer({
    storage,
    limits: {
      fileSize: maxSizeBytes,
      files: 1,
    },
  });
}

const imageUpload = createSafeUploadMiddleware(MAX_IMAGE_SIZE_BYTES);
const videoUpload = createSafeUploadMiddleware(MAX_VIDEO_SIZE_BYTES);

function handleMulterError(
  err: unknown,
  maxMb: number,
  res: Response
): boolean {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      res.status(413).json({
        error: `Uploaded file exceeds the maximum allowed size of ${maxMb} MB.`,
      });
      return true;
    }
    res.status(400).json({
      error: 'Invalid file upload payload. Please upload a single supported media file.',
    });
    return true;
  }
  return false;
}

function formatSafeApiError(err: unknown): { status: number; message: string } {
  let raw = err instanceof Error ? err.message : 'Unexpected forensic analysis error.';

  // Unwrap nested JSON error messages from upstream SDK responses
  if (raw.trim().startsWith('{')) {
    try {
      const parsed = JSON.parse(raw) as { error?: { message?: string; code?: number } };
      if (parsed?.error?.message) {
        raw = parsed.error.message;
      }
    } catch {
      // Keep raw string if not valid JSON
    }
  }

  if (/API_KEY_INVALID|PERMISSION_DENIED|403/i.test(raw)) {
    return {
      status: 502,
      message:
        'Forensic AI service authentication failed. Please verify the API key in Settings > Secrets.',
    };
  }
  if (/RESOURCE_EXHAUSTED|429/i.test(raw)) {
    return {
      status: 429,
      message:
        'Forensic AI service quota limit reached. Please wait briefly or check API quota in Settings > Secrets.',
    };
  }
  if (/503|UNAVAILABLE|high demand|overloaded/i.test(raw)) {
    return {
      status: 503,
      message:
        'The forensic AI model is temporarily experiencing high demand. Please click "Analyze Now" to retry in a few seconds.',
    };
  }
  if (/exceeds the maximum allowed limit|Unsupported|does not match|No decodable video/i.test(raw)) {
    return {
      status: 400,
      message: raw,
    };
  }
  if (/GEMINI_API_KEY/i.test(raw)) {
    return {
      status: 503,
      message: raw,
    };
  }

  // Never expose raw filesystem paths or internal stack traces
  const sanitized = raw.replace(/\/[^\s]+/g, '[redacted-path]');
  return {
    status: 500,
    message: sanitized || 'Media forensic analysis failed. Please retry with another file.',
  };
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.disable('x-powered-by');
  app.use(express.json({ limit: '1mb' }));

  // Health check
  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', service: 'AI Truth Detector API' });
  });

  // POST /api/analyze/image
  app.post('/api/analyze/image', (req: Request, res: Response) => {
    imageUpload.single('file')(req, res, async (uploadErr: unknown) => {
      if (uploadErr) {
        if (handleMulterError(uploadErr, 20, res)) return;
        res.status(400).json({ error: 'Unable to process image upload.' });
        return;
      }

      const uploadedFile = req.file;
      if (!uploadedFile) {
        res.status(400).json({ error: 'No image file provided. Attach a file in the "file" field.' });
        return;
      }

      const uploadedPath = assertPathInsideTempRoot(uploadedFile.path);
      let sessionDir: string | null = null;

      try {
        const displayFileName = sanitizeDisplayFileName(uploadedFile.originalname);
        const validation = validateImageMagicBytes(uploadedPath, displayFileName);
        if (!validation.valid) {
          res.status(400).json({ error: validation.error });
          return;
        }

        const sha256Prefix = computeSha256Prefix(uploadedPath);
        const binarySignals = inspectBinaryMetadata(
          uploadedPath,
          validation.detectedFormat
        );

        sessionDir = createTempSessionDir();
        const [thumbnailDataUrl, normalizedPayload] = await Promise.all([
          createImageThumbnailDataUrl(uploadedPath, sessionDir),
          prepareAnalysisImagePayload(
            uploadedPath,
            validation.canonicalMimeType,
            sessionDir
          ),
        ]);

        const report = await analyzeImageForensics({
          filePath: uploadedPath,
          fileName: displayFileName,
          fileSizeBytes: uploadedFile.size,
          detectedFormat: validation.detectedFormat,
          canonicalMimeType: validation.canonicalMimeType,
          analysisBase64: normalizedPayload.base64,
          analysisMimeType: normalizedPayload.mimeType,
          sha256Prefix,
          binarySignals,
          thumbnailDataUrl,
        });

        saveAnalysisReport(report);
        res.status(200).json(report);
      } catch (err) {
        console.error('[analyze/image] error:', err);
        const safeErr = formatSafeApiError(err);
        res.status(safeErr.status).json({ error: safeErr.message });
      } finally {
        safeCleanupPath(uploadedPath);
        safeCleanupPath(sessionDir);
      }
    });
  });

  // POST /api/analyze/video
  app.post('/api/analyze/video', (req: Request, res: Response) => {
    videoUpload.single('file')(req, res, async (uploadErr: unknown) => {
      if (uploadErr) {
        if (handleMulterError(uploadErr, 60, res)) return;
        res.status(400).json({ error: 'Unable to process video upload.' });
        return;
      }

      const uploadedFile = req.file;
      if (!uploadedFile) {
        res.status(400).json({ error: 'No video file provided. Attach a file in the "file" field.' });
        return;
      }

      const uploadedPath = assertPathInsideTempRoot(uploadedFile.path);
      let sessionDir: string | null = null;

      try {
        const displayFileName = sanitizeDisplayFileName(uploadedFile.originalname);
        const validation = validateVideoMagicBytes(uploadedPath, displayFileName);
        if (!validation.valid) {
          res.status(400).json({ error: validation.error });
          return;
        }

        const sha256Prefix = computeSha256Prefix(uploadedPath);
        const binarySignals = inspectBinaryMetadata(
          uploadedPath,
          validation.detectedFormat
        );

        sessionDir = createTempSessionDir();
        const extracted = await extractVideoKeyframes(
          uploadedPath,
          sessionDir,
          6
        );

        const report = await analyzeVideoForensics({
          fileName: displayFileName,
          fileSizeBytes: uploadedFile.size,
          detectedFormat: validation.detectedFormat,
          canonicalMimeType: validation.canonicalMimeType,
          sha256Prefix,
          binarySignals,
          durationSeconds: extracted.durationSeconds,
          width: extracted.width,
          height: extracted.height,
          fps: extracted.fps,
          frames: extracted.frames,
          thumbnailDataUrl: extracted.thumbnailDataUrl,
        });

        saveAnalysisReport(report);
        res.status(200).json(report);
      } catch (err) {
        console.error('[analyze/video] error:', err);
        const safeErr = formatSafeApiError(err);
        res.status(safeErr.status).json({ error: safeErr.message });
      } finally {
        safeCleanupPath(uploadedPath);
        safeCleanupPath(sessionDir);
      }
    });
  });

  // GET /api/history
  app.get('/api/history', (_req: Request, res: Response) => {
    try {
      const records = listHistoryRecords(100);
      res.status(200).json({ items: records });
    } catch (err) {
      console.error('[history/list] error:', err);
      res.status(500).json({ error: 'Failed to load analysis history.' });
    }
  });

  // GET /api/history/:id
  app.get('/api/history/:id', (req: Request, res: Response) => {
    const id = String(req.params.id || '');
    if (!isValidReportId(id)) {
      res.status(400).json({ error: 'Invalid analysis report identifier.' });
      return;
    }

    try {
      const report = getAnalysisById(id);
      if (!report) {
        res.status(404).json({ error: 'Analysis report not found.' });
        return;
      }
      res.status(200).json(report);
    } catch (err) {
      console.error('[history/get] error:', err);
      res.status(500).json({ error: 'Failed to retrieve analysis report.' });
    }
  });

  // DELETE /api/history/:id
  app.delete('/api/history/:id', (req: Request, res: Response) => {
    const id = String(req.params.id || '');
    if (!isValidReportId(id)) {
      res.status(400).json({ error: 'Invalid analysis report identifier.' });
      return;
    }

    try {
      const deleted = deleteAnalysisById(id);
      if (!deleted) {
        res.status(404).json({ error: 'Analysis report not found.' });
        return;
      }
      res.status(200).json({ deleted: true, id });
    } catch (err) {
      console.error('[history/delete] error:', err);
      res.status(500).json({ error: 'Failed to delete analysis report.' });
    }
  });

  // Global error handler for API routes
  app.use((err: unknown, req: Request, res: Response, next: NextFunction) => {
    if (req.path.startsWith('/api/')) {
      const safeErr = formatSafeApiError(err);
      res.status(safeErr.status).json({ error: safeErr.message });
      return;
    }
    next(err);
  });

  const isProd = process.env.NODE_ENV === 'production';
  const distDir = path.resolve(process.cwd(), 'dist');

  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else if (fs.existsSync(distDir)) {
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`AI Truth Detector server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
