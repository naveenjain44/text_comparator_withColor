"""UAT Text Comparator - offline FastAPI backend."""
from __future__ import annotations

import csv
import io
import json
import logging
import os
import zipfile
from pathlib import Path
from typing import List, Optional

from dotenv import load_dotenv
from fastapi import FastAPI, APIRouter, UploadFile, File, HTTPException, Body, Form, Query
from fastapi.responses import StreamingResponse, FileResponse, HTMLResponse
from pydantic import BaseModel
from starlette.middleware.cors import CORSMiddleware

from comparator import parse_mockup, parse_output, compare, ParsedEmail
from pdf_report import generate_pdf
from html_report import generate_html
import history as history_store

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

GLOSSARY_PATH = ROOT_DIR / "glossary.json"
DOCS_DIR = ROOT_DIR.parent / "docs"

logger = logging.getLogger("uat_comparator")
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")

app = FastAPI(title="UAT Text Comparator")
api = APIRouter(prefix="/api")


# ---------- Glossary storage ----------

class GlossaryRule(BaseModel):
    original: str
    variation: str


class GlossaryPayload(BaseModel):
    rules: List[GlossaryRule]


def _read_glossary() -> List[dict]:
    if not GLOSSARY_PATH.exists():
        return []
    try:
        data = json.loads(GLOSSARY_PATH.read_text(encoding="utf-8"))
        return data.get("rules", [])
    except Exception:
        return []


def _write_glossary(rules: List[dict]):
    GLOSSARY_PATH.write_text(json.dumps({"rules": rules}, indent=2), encoding="utf-8")


# ---------- Routes ----------

@api.get("/")
def root():
    return {"app": "UAT Text Comparator", "status": "ok", "offline": True}


@api.get("/glossary")
def get_glossary():
    return {"rules": _read_glossary()}


@api.post("/glossary")
def save_glossary(payload: GlossaryPayload):
    rules = [r.model_dump() for r in payload.rules]
    _write_glossary(rules)
    return {"ok": True, "rules": rules}


def _pair_files(mockup: UploadFile, output: UploadFile):
    m_bytes = mockup.file.read()
    o_bytes = output.file.read()
    try:
        parsed_mockup = parse_mockup(mockup.filename or "mockup.docx", m_bytes)
    except Exception as e:
        raise HTTPException(400, f"Failed to parse mockup ({mockup.filename}): {e}")
    try:
        parsed_output = parse_output(output.filename or "output.eml", o_bytes)
    except Exception as e:
        raise HTTPException(400, f"Failed to parse output ({output.filename}): {e}")
    return parsed_mockup, parsed_output


@api.post("/compare")
async def compare_single(
    mockup: UploadFile = File(...),
    output: UploadFile = File(...),
    mode: str = Form("smart"),
    use_glossary: bool = Form(True),
    save_history: bool = Form(True),
):
    parsed_mockup, parsed_output = _pair_files(mockup, output)
    glossary = _read_glossary() if use_glossary else []
    result = compare(parsed_mockup, parsed_output, glossary, mode=mode, use_glossary=use_glossary)
    result["mockup_filename"] = mockup.filename
    result["output_filename"] = output.filename
    if save_history:
        entry = history_store.add(mockup.filename or "mockup.docx", output.filename or "output.eml", result)
        result["history_id"] = entry["id"]
        result["history_created_at"] = entry["created_at"]
    return result


@api.post("/export/pdf")
async def export_pdf(payload: dict = Body(...)):
    report = payload.get("report") or {}
    mockup_name = payload.get("mockup_filename") or "mockup.docx"
    output_name = payload.get("output_filename") or "output.eml"
    if not report:
        raise HTTPException(400, "Missing 'report' in body")
    pdf_bytes = generate_pdf(report, mockup_name, output_name)
    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": 'attachment; filename="uat_report.pdf"'},
    )


@api.post("/export/html")
async def export_html(payload: dict = Body(...)):
    report = payload.get("report") or {}
    mockup_name = payload.get("mockup_filename") or "mockup.docx"
    output_name = payload.get("output_filename") or "output.eml"
    if not report:
        raise HTTPException(400, "Missing 'report' in body")
    html_str = generate_html(report, mockup_name, output_name)
    return StreamingResponse(
        io.BytesIO(html_str.encode("utf-8")),
        media_type="text/html",
        headers={"Content-Disposition": 'attachment; filename="uat_report.html"'},
    )


def _csv_row(name_a: str, name_b: str, report: dict) -> dict:
    s = report.get("summary", {})
    sc = report.get("scores", {})
    return {
        "mockup": name_a,
        "output": name_b,
        "overall": s.get("overall", ""),
        "overall_score": s.get("overall_score", 0),
        "subject_pct": sc.get("subject", 0),
        "body_pct": sc.get("body", 0),
        "cta_pct": sc.get("cta", 0),
        "links_pct": sc.get("links", 0),
        "images_pct": sc.get("images", 0),
        "footer_pct": sc.get("footer", 0),
        "match_count": s.get("match", 0),
        "warning_count": s.get("warning", 0),
        "mismatch_count": s.get("mismatch", 0),
    }


@api.post("/batch")
async def batch_compare(
    files: List[UploadFile] = File(...),
    mode: str = Form("smart"),
    use_glossary: bool = Form(True),
):
    docx_files: dict[str, bytes] = {}
    output_files: dict[str, tuple[str, bytes]] = {}

    def _add_file(name: str, data: bytes):
        low = name.lower()
        stem = Path(name).stem
        if low.endswith(".docx"):
            docx_files[stem] = data
        elif low.endswith(".eml") or low.endswith(".msg"):
            output_files[stem] = (name, data)

    for f in files:
        data = await f.read()
        low = (f.filename or "").lower()
        if low.endswith(".zip"):
            try:
                with zipfile.ZipFile(io.BytesIO(data)) as z:
                    for info in z.infolist():
                        if info.is_dir():
                            continue
                        raw = z.read(info.filename)
                        _add_file(Path(info.filename).name, raw)
            except Exception as e:
                raise HTTPException(400, f"Bad zip {f.filename}: {e}")
        else:
            _add_file(f.filename or "", data)

    glossary = _read_glossary() if use_glossary else []
    reports = []
    csv_rows = []
    unmatched = {"mockups_without_output": [], "outputs_without_mockup": []}

    for stem, docx_bytes in docx_files.items():
        out = output_files.get(stem)
        if not out:
            unmatched["mockups_without_output"].append(f"{stem}.docx")
            continue
        try:
            pm = parse_mockup(f"{stem}.docx", docx_bytes)
            po = parse_output(out[0], out[1])
            rep = compare(pm, po, glossary, mode=mode, use_glossary=use_glossary)
            rep["mockup_filename"] = f"{stem}.docx"
            rep["output_filename"] = out[0]
            history_store.add(f"{stem}.docx", out[0], rep)
            reports.append(rep)
            csv_rows.append(_csv_row(f"{stem}.docx", out[0], rep))
        except Exception as e:
            reports.append({"error": str(e), "mockup_filename": f"{stem}.docx", "output_filename": out[0]})

    for stem, out in output_files.items():
        if stem not in docx_files:
            unmatched["outputs_without_mockup"].append(out[0])

    return {"reports": reports, "csv_rows": csv_rows, "unmatched": unmatched}


@api.post("/export/csv")
async def export_csv(payload: dict = Body(...)):
    rows = payload.get("rows") or []
    if not rows:
        raise HTTPException(400, "No rows to export")
    buf = io.StringIO()
    fieldnames = list(rows[0].keys())
    writer = csv.DictWriter(buf, fieldnames=fieldnames)
    writer.writeheader()
    for r in rows:
        writer.writerow(r)
    return StreamingResponse(
        io.BytesIO(buf.getvalue().encode("utf-8")),
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="uat_batch_summary.csv"'},
    )


# ---------- History ----------

@api.get("/history")
def history_list(limit: int = Query(50, ge=1, le=500)):
    return {"items": history_store.list_(limit=limit)}


@api.get("/history/{hid}")
def history_get(hid: str):
    entry = history_store.get(hid)
    if not entry:
        raise HTTPException(404, "History entry not found")
    return entry


@api.delete("/history/{hid}")
def history_delete(hid: str):
    ok = history_store.delete(hid)
    if not ok:
        raise HTTPException(404, "History entry not found")
    return {"ok": True}


@api.delete("/history")
def history_clear():
    n = history_store.clear()
    return {"ok": True, "deleted": n}


@api.get("/history/{hid}/pdf")
def history_pdf(hid: str):
    entry = history_store.get(hid)
    if not entry:
        raise HTTPException(404, "History entry not found")
    pdf_bytes = generate_pdf(entry["report"], entry["mockup_name"], entry["output_name"])
    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="uat_{hid[:8]}.pdf"'},
    )


@api.get("/history/{hid}/html")
def history_html(hid: str):
    entry = history_store.get(hid)
    if not entry:
        raise HTTPException(404, "History entry not found")
    html_str = generate_html(entry["report"], entry["mockup_name"], entry["output_name"])
    return StreamingResponse(
        io.BytesIO(html_str.encode("utf-8")),
        media_type="text/html",
        headers={"Content-Disposition": f'attachment; filename="uat_{hid[:8]}.html"'},
    )


# ---------- PRD document ----------

@api.get("/docs/prd")
def download_prd():
    path = DOCS_DIR / "UAT_Text_Comparator_PRD.docx"
    if not path.exists():
        raise HTTPException(404, "PRD not generated yet")
    return FileResponse(str(path), media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                        filename="UAT_Text_Comparator_PRD.docx")


app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def _startup():
    history_store.init()
