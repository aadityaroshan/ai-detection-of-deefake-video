# AI Truth Detector
### Discover What's Real. Detect What's AI.

AI Truth Detector is a production-style digital media forensics web platform that analyzes uploaded images (`JPG`, `JPEG`, `PNG`, `WEBP`) and videos (`MP4`, `MOV`, `AVI`) to estimate **AI-Generated Probability**, **Likely Authentic Probability**, and **Model Confidence**, with an explicit **Inconclusive** safeguard when signals are ambiguous.

---

## Architecture Overview

This repository provides:

1. **Live Full-Stack Web Application (Port 3000)**
   - **Frontend (`src/`)**: React + TypeScript + Tailwind CSS futuristic dark cybersecurity interface with 5 pages (`Home`, `Detect Media`, `Results`, `History`, `About`), live drag-and-drop upload telemetry, animated calibrated probability gauge, suspicious video timestamp table, and downloadable PDF forensic reports (`jsPDF`).
   - **Backend (`server.ts` & `server/`)**: Express REST API exposing `POST /api/analyze/image`, `POST /api/analyze/video`, `GET /api/history`, `GET /api/history/:id`, and `DELETE /api/history/:id`. Includes binary magic-byte header validation, raw EXIF & C2PA/AI-generator provenance scanning, FFmpeg/FFprobe temporal keyframe extraction, server-side multimodal neural forensic inference, SQLite persistence (`data/truth_detector.db`), and automatic cleanup of temporary uploads.

2. **Local Python + FastAPI + PyTorch + OpenCV Reference Backend (`python_backend/`)**
   - Included for local GPU workstation / BTech CSE viva demonstrations using HuggingFace pretrained PyTorch models (`umm-maybe/AI-image-detector` and `dima806/deepfake_vs_real_image_detection`), OpenCV keyframe extraction, Pillow, NumPy, and SQLite.

---

## Quick Start (Live Web App — Node.js 22+)

```bash
npm install
npm run dev
```

Open `http://localhost:3000` in your browser. Ensure `GEMINI_API_KEY` is configured in `.env` (or Settings > Secrets in AI Studio).

---

## Windows 11 & VS Code Setup (Local Python + PyTorch + OpenCV Backend)

1. **Install Prerequisites**
   - Install **Python 3.11** (check *"Add Python to PATH"* during installation).
   - Install **VS Code** with the official **Python** extension.
   - *(Optional GPU acceleration)* Install CUDA-compatible PyTorch from `https://pytorch.org/get-started/locally/`.

2. **Create & Activate Virtual Environment in VS Code Terminal (PowerShell)**
   ```powershell
   cd python_backend
   python -m venv .venv
   .\.venv\Scripts\Activate.ps1
   pip install --upgrade pip
   pip install -r requirements.txt
   ```

3. **Obtain Pretrained Model Weights**
   The Python backend **never simulates or hardcodes predictions** — it loads real pretrained PyTorch classifiers via `transformers`:
   - **Image AI Detector**: `umm-maybe/AI-image-detector`
   - **Video Deepfake Detector**: `dima806/deepfake_vs_real_image_detection`

   On first run with internet access, weights download automatically to your HuggingFace cache. For offline demos, pre-download them into a local `models/` folder:
   ```powershell
   python -c "from transformers import AutoImageProcessor, AutoModelForImageClassification; [ (AutoImageProcessor.from_pretrained(m), AutoModelForImageClassification.from_pretrained(m)) for m in ['umm-maybe/AI-image-detector', 'dima806/deepfake_vs_real_image_detection'] ]"
   ```
   You can override the model path via `.env`:
   ```env
   AI_IMAGE_MODEL_ID=./models/ai-image-detector
   DEEPFAKE_MODEL_ID=./models/deepfake-detector
   CALIBRATION_TEMPERATURE=1.15
   ```

4. **Run the FastAPI Backend**
   ```powershell
   uvicorn app:app --host 127.0.0.1 --port 8000 --reload
   ```
   Interactive Swagger API docs are immediately available at `http://127.0.0.1:8000/docs`.

---

## Security Controls

- **Binary Magic-Byte Validation**: Rejects renamed or spoofed files by verifying JPEG (`FF D8 FF`), PNG (`89 50 4E 47`), WEBP (`RIFF....WEBP`), MP4/MOV (`ftyp`), and AVI (`RIFF....AVI `) signatures.
- **Upload Limits**: Enforces 20 MB max for images, 60 MB max and 120 seconds max duration for videos.
- **Isolated Temporary Storage**: Assigns cryptographically random UUID server filenames, prevents execution, enforces directory path confinement, and deletes temporary uploads immediately after inference.
- **Parameterized SQLite Queries**: Prevents SQL injection across all history lookups and deletions.

---

## Testing Checklist

1. Upload a camera photograph (JPG/PNG) on **Detect Media** and verify calibrated probabilities (`AI + Authentic = 100%`) and separate **Model Confidence**.
2. Upload an AI-generated artwork or portrait and verify multi-axis forensic indicators and **Download PDF Report**.
3. Upload a short MP4/MOV clip (`< 120s`) and verify extracted keyframes and **Suspicious Frame Timestamps**.
4. Open **History**, filter by media type or status, reopen a stored report, and test deleting a record.
5. Attempt uploading a `.txt` renamed to `.jpg` and verify that server-side magic-byte validation rejects it safely.
