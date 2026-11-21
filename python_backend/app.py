"""
FastAPI REST API entry point for AI Truth Detector (Local Python + PyTorch + OpenCV Edition).
Implements identical REST contract:
  POST   /api/analyze/image
  POST   /api/analyze/video
  GET    /api/history
  GET    /api/history/{id}
  DELETE /api/history/{id}
"""
from __future__ import annotations

import hashlib
import shutil
import tempfile
import uuid
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image

from ai.model import (
    DEFAULT_DEEPFAKE_MODEL,
    DEFAULT_IMAGE_MODEL,
    ForensicTorchModel,
    classify_verdict,
)
from database.db import delete_report, get_report, init_db, list_history, save_report
from utils.video_processing import extract_video_frames

app = FastAPI(title="AI Truth Detector API (PyTorch / OpenCV)", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_methods=["GET", "POST", "DELETE"],
    allow_headers=["*"],
)

MAX_IMAGE_BYTES = 20 * 1024 * 1024
MAX_VIDEO_BYTES = 60 * 1024 * 1024
ALLOWED_IMG_EXT = {".jpg", ".jpeg", ".png", ".webp"}
ALLOWED_VID_EXT = {".mp4", ".mov", ".avi"}

DISCLAIMER = (
    "This score represents an estimated statistical probability derived from trained "
    "neural forensic models — NOT the exact percentage of AI tools used to create the media."
)

image_model = ForensicTorchModel(DEFAULT_IMAGE_MODEL)
video_model = ForensicTorchModel(DEFAULT_DEEPFAKE_MODEL)


@app.on_event("startup")
def on_startup() -> None:
    init_db()


def _validate_image_header(header: bytes) -> str:
    if header[:3] == b"\xff\xd8\xff":
        return "JPEG"
    if header[:8] == b"\x89PNG\r\n\x1a\n":
        return "PNG"
    if header[:4] == b"RIFF" and header[8:12] == b"WEBP":
        return "WEBP"
    raise HTTPException(
        status_code=400, detail="File header does not match a valid JPEG, PNG, or WEBP image."
    )


def _validate_video_header(header: bytes, ext: str) -> str:
    if header[4:8] == b"ftyp":
        return "MOV" if ext == ".mov" else "MP4"
    if header[:4] == b"RIFF" and header[8:12] == b"AVI ":
        return "AVI"
    raise HTTPException(
        status_code=400, detail="File header does not match a valid MP4, MOV, or AVI container."
    )


@app.post("/api/analyze/image")
async def analyze_image(file: UploadFile = File(...)):
    safe_name = Path(file.filename or "image.jpg").name
    ext = Path(safe_name).suffix.lower()
    if ext not in ALLOWED_IMG_EXT:
        raise HTTPException(status_code=400, detail="Allowed image formats: JPG, JPEG, PNG, WEBP.")

    tmp_dir = Path(tempfile.mkdtemp(prefix="aitd_img_"))
    tmp_path = tmp_dir / f"{uuid.uuid4().hex}.bin"
    try:
        content = await file.read()
        if len(content) > MAX_IMAGE_BYTES:
            raise HTTPException(status_code=413, detail="Image exceeds 20 MB limit.")

        detected_format = _validate_image_header(content[:16])
        tmp_path.write_bytes(content)
        sha_prefix = hashlib.sha256(content).hexdigest()[:16]

        with Image.open(tmp_path) as img:
            width, height = img.size
            pred = image_model.predict_pil(img)

        status, note = classify_verdict(pred.ai_probability, pred.model_confidence)
        report = {
            "id": str(uuid.uuid4()),
            "fileName": safe_name,
            "mediaType": "image",
            "createdAt": datetime.now(timezone.utc).isoformat(),
            "aiProbability": pred.ai_probability,
            "authenticProbability": pred.authentic_probability,
            "modelConfidence": pred.model_confidence,
            "status": status,
            "summary": note,
            "faceManipulationRisk": "Moderate" if pred.ai_probability >= 62 else "None Detected",
            "artifactsDetected": [
                f"PyTorch model ({image_model.model_id}) calibrated class scores: {pred.raw_label_scores}"
            ],
            "forensicIndicators": [],
            "suspiciousFrames": [],
            "metadata": {
                "fileSizeBytes": len(content),
                "mimeType": file.content_type or "application/octet-stream",
                "detectedFormat": detected_format,
                "width": width,
                "height": height,
                "hasExifCameraMarkers": False,
                "aiGeneratorMarkers": [],
                "sha256Prefix": sha_prefix,
            },
            "modelEngine": f"PyTorch ({image_model.model_id})",
            "disclaimer": DISCLAIMER,
        }
        save_report(report)
        return report
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)


@app.post("/api/analyze/video")
async def analyze_video(file: UploadFile = File(...)):
    safe_name = Path(file.filename or "video.mp4").name
    ext = Path(safe_name).suffix.lower()
    if ext not in ALLOWED_VID_EXT:
        raise HTTPException(status_code=400, detail="Allowed video formats: MP4, MOV, AVI.")

    tmp_dir = Path(tempfile.mkdtemp(prefix="aitd_vid_"))
    tmp_path = tmp_dir / f"{uuid.uuid4().hex}{ext}"
    try:
        content = await file.read()
        if len(content) > MAX_VIDEO_BYTES:
            raise HTTPException(status_code=413, detail="Video exceeds 60 MB limit.")

        detected_format = _validate_video_header(content[:16], ext)
        tmp_path.write_bytes(content)
        sha_prefix = hashlib.sha256(content).hexdigest()[:16]

        frames, vid_meta = extract_video_frames(tmp_path)
        frame_results = []
        probs = []
        confs = []

        for frame in frames:
            pred = video_model.predict_pil(frame.pil_image)
            probs.append(pred.ai_probability)
            confs.append(pred.model_confidence)
            is_suspicious = pred.ai_probability >= 60.0
            frame_results.append(
                {
                    "frameIndex": frame.frame_index,
                    "timestamp": frame.timestamp_formatted,
                    "timestampSeconds": frame.timestamp_seconds,
                    "aiProbability": pred.ai_probability,
                    "suspicious": is_suspicious,
                    "faceManipulationDetected": is_suspicious,
                    "temporalAnomaly": (
                        "Frame probability exceeded suspicious threshold."
                        if is_suspicious
                        else "Consistent with natural frame distribution."
                    ),
                }
            )

        sorted_p = sorted(probs)
        mean_p = float(np.mean(sorted_p))
        top_p = float(np.mean(sorted_p[max(0, int(len(sorted_p) * 0.65)) :]))
        overall_ai = round(mean_p * 0.65 + top_p * 0.35, 1)
        overall_auth = round(100.0 - overall_ai, 1)
        overall_conf = round(float(np.mean(confs)), 1)

        status, note = classify_verdict(overall_ai, overall_conf)
        suspicious_frames = [f for f in frame_results if f["suspicious"]]

        report = {
            "id": str(uuid.uuid4()),
            "fileName": safe_name,
            "mediaType": "video",
            "createdAt": datetime.now(timezone.utc).isoformat(),
            "aiProbability": overall_ai,
            "authenticProbability": overall_auth,
            "modelConfidence": overall_conf,
            "status": status,
            "summary": f"{note} Inspected {len(frame_results)} keyframes via OpenCV.",
            "faceManipulationRisk": "High" if len(suspicious_frames) >= 2 else "Low",
            "artifactsDetected": [
                f"Flagged {len(suspicious_frames)} suspicious keyframes out of {len(frame_results)} analyzed."
            ],
            "forensicIndicators": [],
            "suspiciousFrames": suspicious_frames,
            "allFrames": frame_results,
            "metadata": {
                "fileSizeBytes": len(content),
                "mimeType": file.content_type or "video/mp4",
                "detectedFormat": detected_format,
                **vid_meta,
                "hasExifCameraMarkers": False,
                "aiGeneratorMarkers": [],
                "sha256Prefix": sha_prefix,
            },
            "modelEngine": f"OpenCV + PyTorch ({video_model.model_id})",
            "disclaimer": DISCLAIMER,
        }
        save_report(report)
        return report
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)


@app.get("/api/history")
def api_list_history():
    return {"items": list_history()}


@app.get("/api/history/{report_id}")
def api_get_history(report_id: str):
    report = get_report(report_id)
    if report is None:
        raise HTTPException(status_code=404, detail="Analysis report not found.")
    return report


@app.delete("/api/history/{report_id}")
def api_delete_history(report_id: str):
    if not delete_report(report_id):
        raise HTTPException(status_code=404, detail="Analysis report not found.")
    return {"deleted": True, "id": report_id}
