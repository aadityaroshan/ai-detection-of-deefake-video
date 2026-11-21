import { jsPDF } from 'jspdf';
import type { AnalysisReport } from '../types/forensics';
import { formatBytes, formatDateTime } from './format';

export function downloadForensicPdf(report: AnalysisReport): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 18;
  const contentWidth = pageWidth - margin * 2;
  let y = 18;

  const ensureSpace = (neededMm: number) => {
    if (y + neededMm > pageHeight - 18) {
      doc.addPage();
      y = 18;
    }
  };

  // Top dark header band
  doc.setFillColor(8, 13, 26);
  doc.rect(0, 0, pageWidth, 34, 'F');

  doc.setTextColor(34, 211, 238);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('AI TRUTH DETECTOR', margin, 15);

  doc.setTextColor(203, 213, 225);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.text("Forensic Media Authenticity Report  |  Discover What's Real. Detect What's AI.", margin, 22);

  doc.setTextColor(148, 163, 184);
  doc.setFontSize(8.5);
  doc.text(`Report ID: ${report.id}`, margin, 29);
  doc.text(`Generated: ${formatDateTime(report.createdAt)}`, pageWidth - margin, 29, {
    align: 'right',
  });

  y = 44;

  // Detection Verdict Summary Box
  doc.setDrawColor(203, 213, 225);
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(margin, y, contentWidth, 32, 2, 2, 'FD');

  doc.setTextColor(71, 85, 105);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text('DETECTION STATUS', margin + 5, y + 7);
  doc.text('AI-GENERATED PROB.', margin + 62, y + 7);
  doc.text('LIKELY AUTHENTIC', margin + 108, y + 7);
  doc.text('MODEL CONFIDENCE', margin + 146, y + 7);

  if (report.status === 'AI-Generated') {
    doc.setTextColor(225, 29, 72);
  } else if (report.status === 'Likely Authentic') {
    doc.setTextColor(5, 150, 105);
  } else {
    doc.setTextColor(217, 119, 6);
  }
  doc.setFontSize(13);
  doc.text(report.status, margin + 5, y + 16);

  doc.setTextColor(15, 23, 42);
  doc.setFontSize(14);
  doc.text(`${report.aiProbability.toFixed(1)}%`, margin + 62, y + 16);
  doc.text(`${report.authenticProbability.toFixed(1)}%`, margin + 108, y + 16);
  doc.text(`${report.modelConfidence.toFixed(1)}%`, margin + 146, y + 16);

  doc.setTextColor(71, 85, 105);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text(
    `Face Manipulation Risk: ${report.faceManipulationRisk}   |   Engine: ${report.modelEngine}`,
    margin + 5,
    y + 26
  );

  y += 40;

  // Media File Information
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('1. File & Provenance Metadata', margin, y);
  y += 6;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(51, 65, 85);

  const resolution =
    report.metadata.width && report.metadata.height
      ? `${report.metadata.width} x ${report.metadata.height} px`
      : 'Not reported';

  const metaLines = [
    `File Name: ${report.fileName}`,
    `Media Type: ${report.mediaType.toUpperCase()} (${report.metadata.detectedFormat})   |   Size: ${formatBytes(report.metadata.fileSizeBytes)}   |   Resolution: ${resolution}`,
    `SHA-256 Prefix: ${report.metadata.sha256Prefix}   |   EXIF Camera Markers: ${report.metadata.hasExifCameraMarkers ? 'Present' : 'Not present'}`,
  ];
  if (report.mediaType === 'video' && report.metadata.durationSeconds) {
    metaLines.push(
      `Video Duration: ${report.metadata.durationSeconds.toFixed(2)}s   |   FPS: ${report.metadata.fps ?? 'N/A'}   |   Keyframes Inspected: ${report.metadata.framesAnalyzed ?? 0}`
    );
  }
  if (report.metadata.aiGeneratorMarkers.length > 0) {
    metaLines.push(
      `Embedded AI Provenance Markers: ${report.metadata.aiGeneratorMarkers.join(', ')}`
    );
  }

  for (const line of metaLines) {
    const wrapped = doc.splitTextToSize(line, contentWidth);
    ensureSpace(wrapped.length * 5);
    doc.text(wrapped, margin, y);
    y += wrapped.length * 4.8 + 1;
  }

  y += 4;

  // Executive Forensic Summary
  ensureSpace(22);
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('2. Forensic Analysis Summary', margin, y);
  y += 6;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(51, 65, 85);
  const summaryLines = doc.splitTextToSize(report.summary, contentWidth);
  ensureSpace(summaryLines.length * 5 + 4);
  doc.text(summaryLines, margin, y);
  y += summaryLines.length * 4.8 + 5;

  // Forensic Indicators
  if (report.forensicIndicators.length > 0) {
    ensureSpace(16);
    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('3. Multi-Axis Forensic Signal Breakdown', margin, y);
    y += 6;

    for (const ind of report.forensicIndicators) {
      const obsLines = doc.splitTextToSize(ind.observation, contentWidth - 6);
      ensureSpace(obsLines.length * 4.5 + 10);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.setTextColor(15, 23, 42);
      doc.text(`${ind.category}`, margin, y);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(71, 85, 105);
      doc.text(
        `Anomaly Score: ${ind.score.toFixed(1)}% (${ind.verdict})`,
        pageWidth - margin,
        y,
        { align: 'right' }
      );
      y += 4.5;

      doc.setFontSize(9);
      doc.text(obsLines, margin + 3, y);
      y += obsLines.length * 4.3 + 3.5;
    }
  }

  // Video Frame Timestamps
  if (report.mediaType === 'video' && report.allFrames && report.allFrames.length > 0) {
    ensureSpace(18);
    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('4. Video Keyframe & Suspicious Timestamp Log', margin, y);
    y += 6;

    for (const frame of report.allFrames) {
      const noteLines = doc.splitTextToSize(frame.temporalAnomaly, contentWidth - 4);
      ensureSpace(noteLines.length * 4.5 + 9);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      if (frame.suspicious) {
        doc.setTextColor(225, 29, 72);
      } else {
        doc.setTextColor(15, 23, 42);
      }
      doc.text(
        `Frame #${frame.frameIndex}  @  ${frame.timestamp}   —   AI Prob: ${frame.aiProbability.toFixed(1)}%   ${frame.suspicious ? '[SUSPICIOUS]' : '[NORMAL]'}`,
        margin,
        y
      );
      y += 4.5;

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(71, 85, 85);
      doc.text(noteLines, margin + 3, y);
      y += noteLines.length * 4.3 + 3;
    }
  }

  // Scientific Disclaimer Footer Box
  const disclaimerLines = doc.splitTextToSize(report.disclaimer, contentWidth - 8);
  ensureSpace(disclaimerLines.length * 4.5 + 16);
  y += 3;
  doc.setFillColor(241, 245, 249);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(margin, y, contentWidth, disclaimerLines.length * 4.5 + 10, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(30, 41, 59);
  doc.text('IMPORTANT STATISTICAL INTERPRETATION NOTE', margin + 4, y + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  doc.text(disclaimerLines, margin + 4, y + 11);

  const safeSlug = report.fileName
    .replace(/[^a-z0-9._-]+/gi, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40);
  doc.save(`AI-Truth-Detector-Report-${safeSlug || report.id.slice(0, 8)}.pdf`);
}
