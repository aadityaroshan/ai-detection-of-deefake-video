import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export const TMP_UPLOAD_ROOT = path.resolve(process.cwd(), 'tmp_uploads');
export const MAX_IMAGE_SIZE_BYTES = 20 * 1024 * 1024; // 20 MB
export const MAX_VIDEO_SIZE_BYTES = 60 * 1024 * 1024; // 60 MB
export const MAX_VIDEO_DURATION_SECONDS = 120; // 2 minutes

export const ALLOWED_IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp']);
export const ALLOWED_VIDEO_EXTENSIONS = new Set(['.mp4', '.mov', '.avi']);

export interface SignatureValidationResult {
  valid: boolean;
  detectedFormat: string;
  canonicalMimeType: string;
  error?: string;
}

export function ensureTempRoot(): void {
  fs.mkdirSync(TMP_UPLOAD_ROOT, { recursive: true });
}

export function purgeOrphanedTempUploads(): void {
  ensureTempRoot();
  try {
    for (const entry of fs.readdirSync(TMP_UPLOAD_ROOT)) {
      safeCleanupPath(path.join(TMP_UPLOAD_ROOT, entry));
    }
  } catch {
    // Best-effort startup cleanup
  }
}

export function assertPathInsideTempRoot(targetPath: string): string {
  const resolved = path.resolve(targetPath);
  if (
    resolved !== TMP_UPLOAD_ROOT &&
    !resolved.startsWith(TMP_UPLOAD_ROOT + path.sep)
  ) {
    throw new Error('Blocked unsafe file path outside temporary workspace.');
  }
  return resolved;
}

export function createTempSessionDir(): string {
  ensureTempRoot();
  const dir = path.join(TMP_UPLOAD_ROOT, crypto.randomUUID());
  const safeDir = assertPathInsideTempRoot(dir);
  fs.mkdirSync(safeDir, { recursive: true });
  return safeDir;
}

export function safeCleanupPath(targetPath: string | null | undefined): void {
  if (!targetPath) return;
  try {
    const safePath = assertPathInsideTempRoot(targetPath);
    if (fs.existsSync(safePath)) {
      fs.rmSync(safePath, { recursive: true, force: true });
    }
  } catch {
    // Best-effort cleanup; never throw during teardown
  }
}

export function sanitizeDisplayFileName(originalName: string): string {
  const base = path.basename(originalName || 'uploaded_media');
  const cleaned = base
    .replace(/[\x00-\x1F\x7F<>:"/\\|?*]/g, '_')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned.slice(0, 140) || 'uploaded_media';
}

export function isValidReportId(id: string): boolean {
  return /^[a-f0-9-]{8,64}$/i.test(id);
}

export function computeSha256Prefix(filePath: string): string {
  const safePath = assertPathInsideTempRoot(filePath);
  const hash = crypto.createHash('sha256');
  const fd = fs.openSync(safePath, 'r');
  try {
    const chunk = Buffer.alloc(64 * 1024);
    let bytesRead = 0;
    while ((bytesRead = fs.readSync(fd, chunk, 0, chunk.length, null)) > 0) {
      hash.update(chunk.subarray(0, bytesRead));
    }
  } finally {
    fs.closeSync(fd);
  }
  return hash.digest('hex').slice(0, 16);
}

function readHeaderBytes(filePath: string, length = 32): Buffer {
  const safePath = assertPathInsideTempRoot(filePath);
  const fd = fs.openSync(safePath, 'r');
  try {
    const buffer = Buffer.alloc(length);
    const bytesRead = fs.readSync(fd, buffer, 0, length, 0);
    return buffer.subarray(0, bytesRead);
  } finally {
    fs.closeSync(fd);
  }
}

/**
 * Validates actual file magic bytes (binary header) rather than trusting client-declared MIME types.
 */
export function validateImageMagicBytes(
  filePath: string,
  originalName: string
): SignatureValidationResult {
  const ext = path.extname(originalName).toLowerCase();
  if (!ALLOWED_IMAGE_EXTENSIONS.has(ext)) {
    return {
      valid: false,
      detectedFormat: 'UNKNOWN',
      canonicalMimeType: 'application/octet-stream',
      error: 'Unsupported image file extension. Allowed formats: JPG, JPEG, PNG, WEBP.',
    };
  }

  const header = readHeaderBytes(filePath, 16);
  if (header.length < 12) {
    return {
      valid: false,
      detectedFormat: 'UNKNOWN',
      canonicalMimeType: 'application/octet-stream',
      error: 'Uploaded file is too small or corrupted to be a valid image.',
    };
  }

  // JPEG: FF D8 FF
  if (header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff) {
    return { valid: true, detectedFormat: 'JPEG', canonicalMimeType: 'image/jpeg' };
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    header[0] === 0x89 &&
    header[1] === 0x50 &&
    header[2] === 0x4e &&
    header[3] === 0x47 &&
    header[4] === 0x0d &&
    header[5] === 0x0a &&
    header[6] === 0x1a &&
    header[7] === 0x0a
  ) {
    return { valid: true, detectedFormat: 'PNG', canonicalMimeType: 'image/png' };
  }

  // WEBP: RIFF....WEBP
  if (
    header.subarray(0, 4).toString('ascii') === 'RIFF' &&
    header.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return { valid: true, detectedFormat: 'WEBP', canonicalMimeType: 'image/webp' };
  }

  return {
    valid: false,
    detectedFormat: 'INVALID',
    canonicalMimeType: 'application/octet-stream',
    error: 'File content signature does not match a valid JPEG, PNG, or WEBP image.',
  };
}

export function validateVideoMagicBytes(
  filePath: string,
  originalName: string
): SignatureValidationResult {
  const ext = path.extname(originalName).toLowerCase();
  if (!ALLOWED_VIDEO_EXTENSIONS.has(ext)) {
    return {
      valid: false,
      detectedFormat: 'UNKNOWN',
      canonicalMimeType: 'application/octet-stream',
      error: 'Unsupported video file extension. Allowed formats: MP4, MOV, AVI.',
    };
  }

  const header = readHeaderBytes(filePath, 32);
  if (header.length < 12) {
    return {
      valid: false,
      detectedFormat: 'UNKNOWN',
      canonicalMimeType: 'application/octet-stream',
      error: 'Uploaded file is too small or corrupted to be a valid video.',
    };
  }

  // MP4 / MOV ISO Base Media File Format: bytes 4..8 == 'ftyp'
  const boxType = header.subarray(4, 8).toString('ascii');
  if (boxType === 'ftyp') {
    const majorBrand = header.subarray(8, 12).toString('ascii').trim().toLowerCase();
    if (majorBrand === 'qt' || ext === '.mov') {
      return { valid: true, detectedFormat: 'MOV', canonicalMimeType: 'video/quicktime' };
    }
    return { valid: true, detectedFormat: 'MP4', canonicalMimeType: 'video/mp4' };
  }

  // AVI: RIFF....AVI 
  if (
    header.subarray(0, 4).toString('ascii') === 'RIFF' &&
    header.subarray(8, 12).toString('ascii') === 'AVI '
  ) {
    return { valid: true, detectedFormat: 'AVI', canonicalMimeType: 'video/x-msvideo' };
  }

  return {
    valid: false,
    detectedFormat: 'INVALID',
    canonicalMimeType: 'application/octet-stream',
    error: 'File content signature does not match a valid MP4, MOV, or AVI video container.',
  };
}

export interface BinaryMetadataSignals {
  width?: number;
  height?: number;
  hasExifCameraMarkers: boolean;
  aiGeneratorMarkers: string[];
}

function parsePngDimensions(buf: Buffer): { width?: number; height?: number } {
  if (buf.length >= 24 && buf.subarray(12, 16).toString('ascii') === 'IHDR') {
    return {
      width: buf.readUInt32BE(16),
      height: buf.readUInt32BE(20),
    };
  }
  return {};
}

function parseJpegDimensions(buf: Buffer): { width?: number; height?: number } {
  let offset = 2;
  while (offset + 9 < buf.length) {
    if (buf[offset] !== 0xff) break;
    const marker = buf[offset + 1];
    if (marker === 0xd9 || marker === 0xda) break;
    const blockLength = buf.readUInt16BE(offset + 2);
    if (blockLength < 2) break;
    // SOF0..SOF3, SOF5..SOF7, SOF9..SOF11, SOF13..SOF15
    const isSof =
      (marker >= 0xc0 && marker <= 0xc3) ||
      (marker >= 0xc5 && marker <= 0xc7) ||
      (marker >= 0xc9 && marker <= 0xcb) ||
      (marker >= 0xcd && marker <= 0xcf);
    if (isSof && offset + 9 <= buf.length) {
      return {
        height: buf.readUInt16BE(offset + 5),
        width: buf.readUInt16BE(offset + 7),
      };
    }
    offset += 2 + blockLength;
  }
  return {};
}

function parseWebpDimensions(buf: Buffer): { width?: number; height?: number } {
  if (buf.length < 30) return {};
  const chunkHeader = buf.subarray(12, 16).toString('ascii');
  if (chunkHeader === 'VP8X' && buf.length >= 30) {
    const width = 1 + (buf[24] | (buf[25] << 8) | (buf[26] << 16));
    const height = 1 + (buf[27] | (buf[28] << 8) | (buf[29] << 16));
    return { width, height };
  }
  if (chunkHeader === 'VP8 ' && buf.length >= 30) {
    const width = buf.readUInt16LE(26) & 0x3fff;
    const height = buf.readUInt16LE(28) & 0x3fff;
    return { width, height };
  }
  if (chunkHeader === 'VP8L' && buf.length >= 25) {
    const bits = buf.readUInt32LE(21);
    const width = (bits & 0x3fff) + 1;
    const height = ((bits >> 14) & 0x3fff) + 1;
    return { width, height };
  }
  return {};
}

const AI_SIGNATURE_PATTERNS: Array<{ label: string; regex: RegExp }> = [
  { label: 'C2PA / Content Credentials (AI tag)', regex: /trainedAlgorithmicMedia|c2pa\.actions|digitalSourceType/i },
  { label: 'Stable Diffusion / Automatic1111 parameters', regex: /Negative prompt:|Steps:\s*\d+,\s*Sampler:/i },
  { label: 'ComfyUI workflow metadata', regex: /"class_type"\s*:\s*"KSampler"|ComfyUI/i },
  { label: 'Midjourney software metadata', regex: /Midjourney/i },
  { label: 'OpenAI DALL-E / ChatGPT Image signature', regex: /DALL-E|OpenAI.*Image|gpt-image/i },
  { label: 'Adobe Firefly generative tag', regex: /Adobe Firefly|firefly\.adobe/i },
  { label: 'Google Imagen / SynthID metadata', regex: /Google Imagen|Made with Google AI/i },
  { label: 'Flux / Black Forest Labs metadata', regex: /black-forest-labs|flux-dev|flux-schnell/i },
];

const CAMERA_EXIF_REGEX = /(Exif\x00\x00|Canon|NIKON|SONY|FUJIFILM|Apple\x00|iPhone|Pixel \d|Samsung|LEICA|OLYMPUS|Panasonic|HASSELBLAD)/;

/**
 * Scans header and trailing chunks of media files for verifiable EXIF camera markers
 * and embedded AI generation provenance strings.
 */
export function inspectBinaryMetadata(
  filePath: string,
  detectedFormat: string
): BinaryMetadataSignals {
  const safePath = assertPathInsideTempRoot(filePath);
  const stat = fs.statSync(safePath);
  const scanSize = Math.min(stat.size, 256 * 1024);

  const fd = fs.openSync(safePath, 'r');
  let headBuf: Buffer;
  let tailBuf = Buffer.alloc(0);
  try {
    headBuf = Buffer.alloc(scanSize);
    fs.readSync(fd, headBuf, 0, scanSize, 0);

    if (stat.size > scanSize) {
      const tailSize = Math.min(stat.size - scanSize, 64 * 1024);
      tailBuf = Buffer.alloc(tailSize);
      fs.readSync(fd, tailBuf, 0, tailSize, stat.size - tailSize);
    }
  } finally {
    fs.closeSync(fd);
  }

  let dims: { width?: number; height?: number } = {};
  if (detectedFormat === 'PNG') {
    dims = parsePngDimensions(headBuf);
  } else if (detectedFormat === 'JPEG') {
    dims = parseJpegDimensions(headBuf);
  } else if (detectedFormat === 'WEBP') {
    dims = parseWebpDimensions(headBuf);
  }

  const combinedText =
    headBuf.toString('latin1') + '\n' + tailBuf.toString('latin1');

  const aiGeneratorMarkers: string[] = [];
  for (const pattern of AI_SIGNATURE_PATTERNS) {
    if (pattern.regex.test(combinedText)) {
      aiGeneratorMarkers.push(pattern.label);
    }
  }

  const hasExifCameraMarkers = CAMERA_EXIF_REGEX.test(combinedText);

  return {
    width: dims.width,
    height: dims.height,
    hasExifCameraMarkers,
    aiGeneratorMarkers,
  };
}
