import { Download, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { prdDocUrl } from "@/lib/api";

export default function GuidePage() {
  return (
    <div>
      <div className="px-8 py-6 max-w-5xl space-y-8" data-testid="guide-page">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight mb-1">Guide &amp; PRD</h1>
            <p className="text-xs text-zinc-500 font-mono uppercase tracking-widest">
              Offline localhost setup · mac / windows · GitHub
            </p>
          </div>
          <a
            href={prdDocUrl()}
            target="_blank"
            rel="noreferrer"
            data-testid="download-prd-btn"
          >
            <Button className="bg-white text-black hover:bg-zinc-200">
              <Download className="w-4 h-4 mr-2" /> Download PRD (.docx)
            </Button>
          </a>
        </div>

        <Section title="1 · What it does">
          <p>
            <b>UAT Text Comparator</b> is a Python + React tool that does an apple-to-apple UAT
            check between a marketing-email <b>mockup (.docx)</b> and its rendered{" "}
            <b>output (.eml / .msg)</b>. It scores each section (subject, greeting, body, CTA,
            URLs, images, footer) with a weighted overall score, stores every run in a local
            history, and exports PDF, HTML or CSV — all without ever hitting the internet.
          </p>
          <ul className="list-disc pl-5 space-y-1 text-zinc-300">
            <li>Strikethrough text in the mockup is <b>automatically excluded</b>.</li>
            <li>Glossary rules (e.g. <span className="font-mono">Hi</span> ↔ <span className="font-mono">Hey</span>) apply in SMART mode.</li>
            <li>Every run is stored to a local SQLite DB and re-exportable.</li>
            <li>Zero network calls at runtime.</li>
          </ul>
        </Section>

        <Section title="2 · Local setup — macOS">
          <Ol>
            <li><b>Install</b> Python 3.10+ and Node 18+ (Homebrew: <code className="font-mono">brew install python@3.11 node</code>). Install Yarn: <code className="font-mono">npm install -g yarn</code>.</li>
            <li>Clone / download this repo:
              <Pre>{`git clone https://github.com/<your-user>/uat-text-comparator.git
cd uat-text-comparator`}</Pre>
            </li>
            <li>Backend:
              <Pre>{`cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn server:app --host 127.0.0.1 --port 8001`}</Pre>
            </li>
            <li>Frontend (new terminal):
              <Pre>{`cd frontend
yarn install
yarn start           # http://localhost:3000`}</Pre>
            </li>
            <li>Open <a className="underline text-white inline-flex items-center gap-1" href="http://localhost:3000" target="_blank" rel="noreferrer">http://localhost:3000 <ExternalLink className="w-3 h-3"/></a>. Turn off Wi-Fi — everything still works.</li>
          </Ol>
        </Section>

        <Section title="3 · Local setup — Windows">
          <Ol>
            <li>Install Python 3.10+ from python.org and Node.js 18+ LTS from nodejs.org. Then <code className="font-mono">npm install -g yarn</code> (one-time).</li>
            <li>Download the repo ZIP or <code className="font-mono">git clone</code> it. Open PowerShell in the folder.</li>
            <li>Backend:
              <Pre>{`cd backend
python -m venv .venv
.venv\\Scripts\\activate
pip install -r requirements.txt
uvicorn server:app --host 127.0.0.1 --port 8001`}</Pre>
            </li>
            <li>Frontend (new PowerShell):
              <Pre>{`cd frontend
yarn install
yarn start`}</Pre>
            </li>
            <li>Browse <code className="font-mono">http://localhost:3000</code>.</li>
          </Ol>
        </Section>

        <Section title="4 · Push to GitHub">
          <Pre>{`# from project root
git init
git add .
git commit -m "UAT Text Comparator"
git branch -M main
git remote add origin https://github.com/<your-user>/uat-text-comparator.git
git push -u origin main`}</Pre>
          <p>Teammates run the exact same setup steps above.</p>
        </Section>

        <Section title="5 · Offline guarantee">
          <ul className="list-disc pl-5 space-y-1 text-zinc-300">
            <li>Frontend auto-detects <code className="font-mono">localhost</code> hostname and talks to <code className="font-mono">http://localhost:8001</code> — no env change needed.</li>
            <li>All DOCX / EML / MSG parsing and PDF / HTML generation happen inside Python.</li>
            <li>Glossary: <code className="font-mono">backend/glossary.json</code>. History: <code className="font-mono">backend/data/history.db</code> (SQLite).</li>
            <li>Backed test: disconnect the network cable, run again — no "Network error".</li>
          </ul>
        </Section>

        <Section title="6 · Folder structure">
          <Pre>{`uat-text-comparator/
├── backend/
│   ├── server.py              FastAPI app + endpoints
│   ├── comparator.py          Parsers + diff (strikethrough-aware)
│   ├── pdf_report.py          ReportLab PDF builder
│   ├── html_report.py         Self-contained HTML report
│   ├── history.py             SQLite history store
│   ├── generate_prd.py        Regenerates PRD.docx
│   ├── glossary.json          Editable case rules
│   ├── data/history.db        (auto-created)
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── App.js
│   │   ├── pages/{Compare, Batch, Glossary, Guide}.jsx
│   │   ├── components/{Layout, UploadZone, DiffReport, HistorySidebar}.jsx
│   │   └── lib/api.js         Auto-detects localhost
│   ├── .env
│   └── package.json
├── docs/UAT_Text_Comparator_PRD.docx
└── README.md`}</Pre>
        </Section>
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div>
      <h2 className="text-base font-semibold tracking-tight text-white mb-3">{title}</h2>
      <div className="text-sm text-zinc-300 leading-relaxed space-y-2">{children}</div>
    </div>
  );
}

function Ol({ children }) {
  return <ol className="list-decimal pl-5 space-y-3">{children}</ol>;
}

function Pre({ children }) {
  return (
    <pre className="mt-2 mb-1 bg-zinc-950 border border-zinc-800 rounded-md p-4 text-xs font-mono text-zinc-200 overflow-auto break-anywhere whitespace-pre-wrap">
      {children}
    </pre>
  );
}
