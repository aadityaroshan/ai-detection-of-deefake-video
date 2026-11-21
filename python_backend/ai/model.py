"""
PyTorch pretrained AI-image & deepfake model loader with temperature calibration.
Does NOT simulate results: raises a clear configuration error if weights cannot be loaded.
"""
from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Dict, Tuple

import numpy as np
import torch
from PIL import Image
from transformers import AutoImageProcessor, AutoModelForImageClassification

DEFAULT_IMAGE_MODEL = os.getenv("AI_IMAGE_MODEL_ID", "umm-maybe/AI-image-detector")
DEFAULT_DEEPFAKE_MODEL = os.getenv(
    "DEEPFAKE_MODEL_ID", "dima806/deepfake_vs_real_image_detection"
)
CALIBRATION_TEMPERATURE = float(os.getenv("CALIBRATION_TEMPERATURE", "1.15"))


@dataclass
class PredictionResult:
    ai_probability: float
    authentic_probability: float
    model_confidence: float
    raw_label_scores: Dict[str, float]


class ForensicTorchModel:
    def __init__(self, model_id: str) -> None:
        self.model_id = model_id
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.processor = None
        self.model = None

    def load(self) -> None:
        if self.model is not None:
            return
        try:
            self.processor = AutoImageProcessor.from_pretrained(self.model_id)
            self.model = AutoModelForImageClassification.from_pretrained(self.model_id)
            self.model.to(self.device)
            self.model.eval()
        except Exception as exc:
            raise RuntimeError(
                f"Failed to load pretrained PyTorch weights for '{self.model_id}'. "
                "Verify internet access or place local HuggingFace weights in ./models/ "
                "and configure AI_IMAGE_MODEL_ID / DEEPFAKE_MODEL_ID in .env."
            ) from exc

    @torch.inference_mode()
    def predict_pil(self, image: Image.Image) -> PredictionResult:
        self.load()
        assert self.processor is not None and self.model is not None

        rgb = image.convert("RGB")
        inputs = self.processor(images=rgb, return_tensors="pt").to(self.device)
        logits = self.model(**inputs).logits

        # Temperature-scaled softmax for calibrated probability estimation
        scaled_logits = logits / max(0.25, CALIBRATION_TEMPERATURE)
        probs = torch.softmax(scaled_logits, dim=-1).squeeze(0).cpu().numpy()

        id2label = self.model.config.id2label
        label_scores: Dict[str, float] = {}
        ai_prob = 0.0
        real_prob = 0.0

        for idx, prob in enumerate(probs):
            label = str(id2label.get(idx, str(idx))).lower()
            label_scores[label] = round(float(prob) * 100.0, 2)
            if any(k in label for k in ("artificial", "fake", "ai", "deepfake", "synthetic")):
                ai_prob += float(prob)
            elif any(k in label for k in ("human", "real", "authentic", "natural")):
                real_prob += float(prob)

        total = ai_prob + real_prob
        if total <= 0.0:
            raise RuntimeError(
                f"Model '{self.model_id}' labels ({list(id2label.values())}) do not map to AI/Real classes."
            )

        ai_pct = round((ai_prob / total) * 100.0, 1)
        real_pct = round(100.0 - ai_pct, 1)

        # Model confidence derived from entropy margin (separate from AI probability)
        p_vec = np.clip(np.array([ai_pct / 100.0, real_pct / 100.0]), 1e-6, 1.0)
        normalized_entropy = float(-np.sum(p_vec * np.log2(p_vec)))
        confidence = round((1.0 - normalized_entropy) * 100.0, 1)

        return PredictionResult(
            ai_probability=ai_pct,
            authentic_probability=real_pct,
            model_confidence=max(0.0, min(100.0, confidence)),
            raw_label_scores=label_scores,
        )


def classify_verdict(ai_probability: float, model_confidence: float) -> Tuple[str, str]:
    if model_confidence < 55.0:
        return (
            "Inconclusive",
            "Signal entropy indicates insufficient classification certainty.",
        )
    if ai_probability >= 62.0:
        return (
            "AI-Generated",
            "Calibrated neural features align strongly with synthetic or manipulated patterns.",
        )
    if ai_probability <= 38.0:
        return (
            "Likely Authentic",
            "Spatial and frequency cues align with natural optical camera capture.",
        )
    return (
        "Inconclusive",
        "Estimated probability sits within the ambiguous 38%–62% decision band.",
    )
