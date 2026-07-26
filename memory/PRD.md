# UAT Text Comparator — PRD

## Original Problem Statement
Python-based **text comparator** tool for UAT. Input: mockup as `.docx`, output as `.eml` or `.msg` (Outlook). Apple-to-apple match on content, URLs, links, subject line, body, greetings, CTA, footer, logo/card art images. Required features:
- Batch mode (many DOCX↔email pairs → CSV summary)
- PDF export in addition to HTML report
- Case-rule / glossary editor for allowed variations
- URL should include CTA if available; extract link + linked text
- Images in mockup may have alt text; show alongside output for naked-eye review
- Compile and use through GitHub
- Downloaded code must run on localhost **without any API calls** (fully offline, no internet)

## User Choices (confirmed)
- App: **Flask/FastAPI local web app** (implemented as FastAPI + React)
- Report scope: Subject, Greeting, CTA text+URL, Body paragraphs diff, Footer, Images (alt+count+filename), Hyperlinks
- Glossary rules example: `Hi = Hey`; image-alt equivalence
- Batch: **folder + ZIP** (both supported)

## Architecture
- **Backend**: FastAPI @ `/api/*`
  - `comparator.py` — DOCX / EML / MSG parsers + section splitter + best-match diff (SequenceMatcher)
  - `pdf_report.py` — ReportLab PDF builder
  - `server.py` — endpoints: `/compare`, `/batch`, `/export/pdf`, `/export/csv`, `/glossary` GET/POST
  - Glossary stored in **local JSON file** (`backend/glossary.json`) — **no MongoDB dependency**, fully offline
- **Frontend**: React (CRACO) with shadcn/ui + Tailwind, dark high-contrast QA-dashboard theme
  - Pages: Compare, Batch, Glossary, Guide
  - Sidebar layout with sticky header + action buttons

## Personas
- **QA/UAT engineer** running email-campaign checks pre-launch
- **Marketing manager** verifying rendered emails match approved mockups
- **Dev team lead** integrating into a repeatable CI/UAT workflow via GitHub

## Core Requirements (static)
- 100% offline runtime (no external HTTP calls, no LLM, no cloud PDF)
- DOCX + EML + MSG parsing
- Six diff sections with Match / Warning / Mismatch statuses
- Batch mode with filename auto-pairing (also unzips)
- PDF + CSV + JSON outputs
- Glossary editable via UI, persisted to disk

## Implemented (2026-02, iteration 2)
- **Strikethrough exclusion** — `w:strike`/`w:dstrike` runs skipped in DOCX parsing (validated: strikethrough draft text no longer inflates mismatch count)
- **Weighted per-section scoring** — subject 15% / greeting 5% / body 40% / cta 15% / links 10% / images 10% / footer 5%; overall thresholds MATCH ≥ 98%, WARNING 80–97%, MISMATCH < 80%
- **STRICT vs SMART mode** toggle (glossary applies only in SMART)
- **Local SQLite history** at `backend/data/history.db` — every run saved with id/score/timestamp; right-side history sidebar lists 50 latest, click to re-open, per-row PDF/HTML/delete actions
- **HTML export** (self-contained offline HTML) + PDF export unchanged
- **Downloadable PRD** (`docs/UAT_Text_Comparator_PRD.docx`) covering features, tech stack, folder tree, and Mac + Windows setup steps
- **Redesigned Compare UI** with score cards + sub-tabs (Subject / Body Diff / CTA / URLs / Images / Footer) matching the user's reference screenshot
- **Offline-first frontend** — `lib/api.js::detectBackendUrl()` auto-selects `http://localhost:8001` when hostname is `localhost`/`127.0.0.1`, falls back to `REACT_APP_BACKEND_URL` on preview
- Backend regression suite added at `/app/backend/tests/backend_test.py` (14/14 pass)

## Implemented (2026-02, iteration 1)
- FastAPI backend with all endpoints (verified by testing agent — 100% pass)
- DOCX parser extracts paragraphs, hyperlinks (linked text + URL), images (filename + alt from `docPr descr`)
- EML parser (stdlib email + BeautifulSoup) — subject, HTML body, `<a>` text+href, `<img>` src+alt
- MSG parser via `extract-msg` (offline)
- Comparator: subject/greeting/CTA/footer field diff, paragraph best-match alignment, link pair diff, image name+alt diff, weighted summary + score%
- ReportLab PDF report with per-section tables + status colour badges
- Glossary rules applied bi-directionally (variation → canonical) with `re.IGNORECASE`
- Batch endpoint accepts loose files + `.zip`, pairs by filename stem, returns per-pair reports + CSV rows + unmatched lists
- React UI: 4 pages, sidebar nav, drag-drop uploads, side-by-side diff, PDF/CSV downloads, glossary editor
- README with GitHub push + localhost run instructions (also mirrored in in-app Guide tab)

## Prioritised Backlog
### P1
- Support **inline image extraction** from EML (embed thumbnails in report for naked-eye review)
- Rich diff highlighting inside paragraphs (word-level colored inserts/deletions)
- History / audit log of past comparisons (SQLite, still offline)

### P2
- Standalone one-click desktop bundle (PyInstaller) with embedded frontend build
- Multiple mockup formats (Google Docs export .html, .pdf mockup)
- Configurable "sections schema" per project (override greeting/footer detection heuristics)

## Test Credentials
None — tool is auth-less by design (offline localhost workflow).
