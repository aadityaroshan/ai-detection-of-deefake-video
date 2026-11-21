"""
SQLite persistence module for AI Truth Detector (Python FastAPI backend).
Uses strictly parameterized SQL queries.
"""
from __future__ import annotations

import json
import sqlite3
from pathlib import Path
from typing import Any, Dict, List, Optional

DB_PATH = Path(__file__).resolve().parent.parent / "data" / "truth_detector_py.db"


def get_connection() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    with get_connection() as conn:
        conn.execute(
            """
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
                report_json TEXT NOT NULL
            )
            """
        )
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_py_analyses_created_at ON analyses (created_at DESC)"
        )
        conn.commit()


def save_report(report: Dict[str, Any]) -> None:
    with get_connection() as conn:
        conn.execute(
            """
            INSERT INTO analyses (
                id, file_name, media_type, created_at,
                ai_probability, authentic_probability, model_confidence,
                status, file_size_bytes, detected_format, report_json
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                report["id"],
                report["fileName"],
                report["mediaType"],
                report["createdAt"],
                report["aiProbability"],
                report["authenticProbability"],
                report["modelConfidence"],
                report["status"],
                report["metadata"]["fileSizeBytes"],
                report["metadata"]["detectedFormat"],
                json.dumps(report),
            ),
        )
        conn.commit()


def list_history(limit: int = 100) -> List[Dict[str, Any]]:
    safe_limit = max(1, min(200, int(limit)))
    with get_connection() as conn:
        rows = conn.execute(
            """
            SELECT id, file_name, media_type, created_at, ai_probability,
                   authentic_probability, model_confidence, status,
                   file_size_bytes, detected_format
            FROM analyses
            ORDER BY created_at DESC
            LIMIT ?
            """,
            (safe_limit,),
        ).fetchall()

    return [
        {
            "id": row["id"],
            "fileName": row["file_name"],
            "mediaType": row["media_type"],
            "createdAt": row["created_at"],
            "aiProbability": row["ai_probability"],
            "authenticProbability": row["authentic_probability"],
            "modelConfidence": row["model_confidence"],
            "status": row["status"],
            "fileSizeBytes": row["file_size_bytes"],
            "detectedFormat": row["detected_format"],
        }
        for row in rows
    ]


def get_report(report_id: str) -> Optional[Dict[str, Any]]:
    with get_connection() as conn:
        row = conn.execute(
            "SELECT report_json FROM analyses WHERE id = ?",
            (report_id,),
        ).fetchone()
    if row is None:
        return None
    return json.loads(row["report_json"])


def delete_report(report_id: str) -> bool:
    with get_connection() as conn:
        cursor = conn.execute("DELETE FROM analyses WHERE id = ?", (report_id,))
        conn.commit()
        return cursor.rowcount > 0
