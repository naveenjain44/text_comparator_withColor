"""Local SQLite history store for comparison runs (fully offline)."""
from __future__ import annotations

import json
import sqlite3
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Optional

DB_PATH = Path(__file__).parent / "data" / "history.db"


def _conn():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    c = sqlite3.connect(DB_PATH)
    c.row_factory = sqlite3.Row
    return c


def init():
    with _conn() as c:
        c.execute("""
            CREATE TABLE IF NOT EXISTS history (
              id TEXT PRIMARY KEY,
              created_at TEXT NOT NULL,
              mockup_name TEXT NOT NULL,
              output_name TEXT NOT NULL,
              mode TEXT NOT NULL,
              use_glossary INTEGER NOT NULL,
              overall_score REAL NOT NULL,
              overall_status TEXT NOT NULL,
              report_json TEXT NOT NULL
            )
        """)
        c.execute("CREATE INDEX IF NOT EXISTS idx_hist_created ON history(created_at DESC)")


def add(mockup_name: str, output_name: str, report: dict) -> dict:
    init()
    hid = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    summary = report.get("summary", {})
    with _conn() as c:
        c.execute(
            "INSERT INTO history VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (
                hid, now, mockup_name, output_name,
                report.get("mode", "smart"),
                1 if report.get("use_glossary") else 0,
                float(summary.get("overall_score", 0)),
                summary.get("overall", "warning"),
                json.dumps(report),
            ),
        )
    return {
        "id": hid,
        "created_at": now,
        "mockup_name": mockup_name,
        "output_name": output_name,
        "mode": report.get("mode", "smart"),
        "use_glossary": bool(report.get("use_glossary")),
        "overall_score": float(summary.get("overall_score", 0)),
        "overall_status": summary.get("overall", "warning"),
    }


def list_(limit: int = 50) -> List[dict]:
    init()
    with _conn() as c:
        rows = c.execute(
            "SELECT id, created_at, mockup_name, output_name, mode, use_glossary, overall_score, overall_status "
            "FROM history ORDER BY created_at DESC LIMIT ?",
            (limit,),
        ).fetchall()
    return [dict(r) for r in rows]


def get(hid: str) -> Optional[dict]:
    init()
    with _conn() as c:
        row = c.execute("SELECT * FROM history WHERE id = ?", (hid,)).fetchone()
    if not row:
        return None
    d = dict(row)
    d["report"] = json.loads(d.pop("report_json"))
    return d


def delete(hid: str) -> bool:
    init()
    with _conn() as c:
        cur = c.execute("DELETE FROM history WHERE id = ?", (hid,))
    return cur.rowcount > 0


def clear() -> int:
    init()
    with _conn() as c:
        cur = c.execute("DELETE FROM history")
    return cur.rowcount
