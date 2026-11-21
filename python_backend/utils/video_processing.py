"""
OpenCV video frame extraction & temporal face-crop preprocessing utilities.
"""
from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import List, Tuple

import cv2
from PIL import Image


@dataclass
class SampledFrame:
    frame_index: int
    timestamp_seconds: float
    timestamp_formatted: str
    pil_image: Image.Image


def format_timestamp(seconds: float) -> str:
    safe = max(0.0, seconds)
    mins = int(safe // 60)
    secs = safe - mins * 60
    return f"{mins:02d}:{secs:04.1f}"


def extract_video_frames(
    video_path: Path, max_frames: int = 12, max_duration_seconds: float = 120.0
) -> Tuple[List[SampledFrame], dict]:
    cap = cv2.VideoCapture(str(video_path))
    if not cap.isOpened():
        raise ValueError("Unable to open video container with OpenCV.")

    try:
        fps = float(cap.get(cv2.CAP_PROP_FPS) or 30.0)
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH) or 0)
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT) or 0)

        if total_frames <= 0 or fps <= 0:
            raise ValueError("Video stream contains no readable frames.")

        duration = total_frames / fps
        if duration > max_duration_seconds:
            raise ValueError(
                f"Video duration ({duration:.1f}s) exceeds maximum limit of {max_duration_seconds:.0f}s."
            )

        sample_count = min(max_frames, max(3, int(duration * 1.5)))
        step = max(1, total_frames // sample_count)

        sampled: List[SampledFrame] = []
        idx = 0
        for frame_no in range(0, total_frames, step):
            if len(sampled) >= sample_count:
                break
            cap.set(cv2.CAP_PROP_POS_FRAMES, frame_no)
            ok, frame_bgr = cap.read()
            if not ok or frame_bgr is None:
                continue
            idx += 1
            frame_rgb = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)
            ts = frame_no / fps
            sampled.append(
                SampledFrame(
                    frame_index=idx,
                    timestamp_seconds=round(ts, 2),
                    timestamp_formatted=format_timestamp(ts),
                    pil_image=Image.fromarray(frame_rgb),
                )
            )

        if not sampled:
            raise ValueError("No decodable frames could be extracted from video.")

        meta = {
            "durationSeconds": round(duration, 2),
            "width": width,
            "height": height,
            "fps": round(fps, 2),
            "framesAnalyzed": len(sampled),
        }
        return sampled, meta
    finally:
        cap.release()
