# UAT Text Comparator

A **100% offline** Python + React web tool that performs an apple-to-apple UAT
comparison between a marketing-email **mockup (.docx)** and its rendered
**output (.eml / .msg)**.

It checks:

- **Subject line**
- **Greeting**
- **CTA text + URL**
- **Body paragraphs** (paragraph-by-paragraph diff)
- **Footer**
- **Hyperlinks** — linked text **and** URL
- **Images** — filename **and** alt text

Extras:

- **Batch mode** — many .docx + .eml/.msg pairs, or a `.zip`, → per-pair report + **CSV summary**
- **PDF export** of any single report
- **Glossary / case-rule editor** — allowed variations (e.g. `Hi` ↔ `Hey`)
- **No API keys, no cloud, no internet.** Everything runs on `localhost`.

---

## Quick start (localhost)

### 1. Clone

```bash
git clone https://github.com/<your-user>/uat-text-comparator.git
cd uat-text-comparator
```

### 2. Backend — FastAPI (Python 3.10+)

```bash
cd backend
python -m venv .venv
source .venv/bin/activate            # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn server:app --host 127.0.0.1 --port 8001
```

> The backend uses only local files — **MongoDB is NOT required**. The glossary
> is persisted in `backend/glossary.json`.

### 3. Frontend — React (Node 18+)

Open a second terminal:

```bash
cd frontend
# Point UI to your local backend:
echo "REACT_APP_BACKEND_URL=http://127.0.0.1:8001" > .env
yarn install
yarn start                           # opens http://localhost:3000
```

Now visit **http://localhost:3000**.

---

## How to use

1. **Compare** tab → drop the mockup `.docx` on the left, the `.eml`/`.msg`
   output on the right, click **Run comparison**.
   The report shows every section with **Match / Warning / Mismatch** badges.
2. **Batch** tab → drop many pairs (or a ZIP). Pairs are auto-matched by
   filename stem (e.g. `campaign1.docx` ↔ `campaign1.eml`). Export CSV summary.
3. **Glossary** tab → add allowed variations like `Hi = Hey`. Saved locally
   in `backend/glossary.json`.
4. **Guide** tab → in-app version of this document.

---

## Push to your own GitHub

```bash
# from project root
git init
git add .
git commit -m "UAT Text Comparator"
git branch -M main
git remote add origin https://github.com/<your-user>/uat-text-comparator.git
git push -u origin main
```

Share the repo with your team. Every teammate follows the **Quick start**
above — no keys, no accounts.

---

## Offline guarantee

- DOCX parsed with `python-docx` (extracts paragraphs, hyperlinks, image
  `descr` alt text and image filenames from relationships).
- EML parsed with Python's stdlib `email` + `BeautifulSoup` (extracts subject,
  HTML body, `<a href>` links with linked text, `<img src alt>` images).
- MSG parsed with `extract-msg` (pure Python).
- PDF generated with `reportlab` (no cloud PDF service).
- Glossary stored in a local JSON file.
- **Zero outbound HTTP calls** at runtime.

---

## Project layout

```
uat-text-comparator/
├── backend/
│   ├── server.py              # FastAPI app, endpoints
│   ├── comparator.py          # DOCX / EML / MSG parsers + diff logic
│   ├── pdf_report.py          # ReportLab PDF builder
│   ├── glossary.json          # Local glossary rules
│   └── requirements.txt
└── frontend/
    ├── src/
    │   ├── App.js
    │   ├── pages/             # Compare, Batch, Glossary, Guide
    │   ├── components/        # Layout, UploadZone, DiffReport
    │   └── lib/api.js
    └── package.json
```

---

## API endpoints (for advanced users / CI)

| Method | Path                | Body                                     | Returns          |
|--------|---------------------|------------------------------------------|------------------|
| POST   | `/api/compare`      | multipart: `mockup`, `output`            | full report JSON |
| POST   | `/api/batch`        | multipart: `files[]` (docx/eml/msg/zip)  | list of reports  |
| POST   | `/api/export/pdf`   | `{report, mockup_filename, output_filename}` | PDF stream  |
| POST   | `/api/export/csv`   | `{rows}`                                 | CSV stream       |
| GET    | `/api/glossary`     | —                                        | `{rules}`        |
| POST   | `/api/glossary`     | `{rules: [{original, variation}]}`       | `{ok, rules}`    |

---

## License

Internal / MIT — adapt as needed for your team.
