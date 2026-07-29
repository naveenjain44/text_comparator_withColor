import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Play, FileDown, FileCode, Loader2, RotateCcw, ArrowRight, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import UploadZone from "@/components/UploadZone";
import DiffReport from "@/components/DiffReport";
import HistorySidebar from "@/components/HistorySidebar";
import {
  compareFiles, downloadPdf, downloadHtml, getHistory,
  pingBackend, friendlyError, BACKEND_URL,
} from "@/lib/api";

const SUPPORTED_EXTS = ".pdf,.txt,.docx,.msg,.htm,.html,.eml,.pptx,.xlsx,.csv";

export default function ComparePage() {
  const [mockup, setMockup] = useState(null);
  const [output, setOutput] = useState(null);
  const [report, setReport] = useState(null);
  const [meta, setMeta] = useState({ mockupName: "", outputName: "" });
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(null);
  const [mode, setMode] = useState("smart");
  const [useGlossary, setUseGlossary] = useState(true);
  const [historyKey, setHistoryKey] = useState(0);
  const [activeId, setActiveId] = useState(null);
  const [backendOk, setBackendOk] = useState(null); // null=checking, true=ok, false=down

  const checkBackend = async () => {
    setBackendOk(null);
    const ok = await pingBackend();
    setBackendOk(ok);
    return ok;
  };
  useEffect(() => { checkBackend(); }, []);

  const reset = () => {
    setMockup(null);
    setOutput(null);
    setReport(null);
    setActiveId(null);
    setMeta({ mockupName: "", outputName: "" });
  };

  const run = async () => {
    if (!mockup || !output) {
      toast.error("Upload both a mockup (.docx) and an output (.eml / .msg).");
      return;
    }
    setLoading(true);
    try {
      const r = await compareFiles(mockup, output, { mode, use_glossary: useGlossary });
      setReport(r);
      setMeta({ mockupName: mockup.name, outputName: output.name });
      setActiveId(r.history_id || null);
      setHistoryKey((k) => k + 1);
      setBackendOk(true);
      toast.success(`Score ${(r.summary?.overall_score ?? 0).toFixed(2)}% · ${r.summary?.overall}`);
    } catch (e) {
      if (e.code === "ERR_NETWORK") setBackendOk(false);
      toast.error(friendlyError(e, "start it and click Retry"));
    } finally {
      setLoading(false);
    }
  };

  const doExport = async (kind) => {
    if (!report) return;
    setExporting(kind);
    try {
      if (kind === "pdf") await downloadPdf(report, meta.mockupName, meta.outputName);
      else await downloadHtml(report, meta.mockupName, meta.outputName);
      toast.success(`${kind.toUpperCase()} downloaded`);
    } catch (e) {
      toast.error(friendlyError(e));
    } finally {
      setExporting(null);
    }
  };

  const openHistory = async (id) => {
    try {
      const entry = await getHistory(id);
      setReport(entry.report);
      setMeta({ mockupName: entry.mockup_name, outputName: entry.output_name });
      setActiveId(id);
    } catch (e) {
      toast.error(friendlyError(e));
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-64px)]">
      <div className="flex-1 min-w-0 px-8 py-6 space-y-6" data-testid="compare-page">

        {/* Backend status banner */}
        {backendOk === false && (
          <div
            className="border border-rose-500/40 bg-rose-500/10 rounded-md p-4 flex items-start gap-3"
            data-testid="backend-down-banner"
          >
            <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-rose-200">Backend unreachable</div>
              <div className="text-xs text-zinc-300 mt-1 font-mono break-anywhere">
                Trying: <span className="text-white">{BACKEND_URL}</span>
              </div>
              <div className="text-xs text-zinc-400 mt-2 leading-relaxed">
                Start the FastAPI server:
                <pre className="mt-1 bg-black/50 border border-rose-500/20 rounded px-3 py-2 text-[11px] font-mono text-zinc-200 overflow-auto whitespace-pre-wrap">
{`cd backend
python -m venv .venv && source .venv/bin/activate     # Windows: .venv\\Scripts\\activate
pip install -r requirements.txt
uvicorn server:app --host 127.0.0.1 --port 8001`}
                </pre>
                <span className="block mt-1 text-[11px] text-zinc-500">
                  Or override the URL in the browser DevTools console:{" "}
                  <code className="text-zinc-300">localStorage.setItem('backendUrl','http://127.0.0.1:8001')</code>{" "}
                  then reload.
                </span>
              </div>
            </div>
            <Button
              onClick={checkBackend}
              variant="outline"
              size="sm"
              data-testid="retry-backend-btn"
              className="border-zinc-700 bg-zinc-900 hover:bg-zinc-800 text-white shrink-0"
            >
              Retry
            </Button>
          </div>
        )}
        {/* Upload row */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto_1fr] items-stretch gap-4">
          <div className="border border-zinc-800 rounded-md bg-[#141416] p-4">
            <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-zinc-500 mb-3 flex items-center justify-between">
              <span>Mockup source</span>
              <span className="text-zinc-600 truncate ml-2">docx · pdf · html · txt · pptx · xlsx · csv · eml · msg</span>
            </div>
            <UploadZone
              label=""
              accept={SUPPORTED_EXTS}
              file={mockup}
              onFile={setMockup}
              onClear={() => setMockup(null)}
              testid="upload-mockup"
            />
          </div>
          <div className="hidden lg:flex items-center justify-center px-1">
            <ArrowRight className="w-5 h-5 text-zinc-600" />
          </div>
          <div className="border border-zinc-800 rounded-md bg-[#141416] p-4">
            <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-zinc-500 mb-3 flex items-center justify-between">
              <span>Email / rendered output</span>
              <span className="text-zinc-600 truncate ml-2">eml · msg · html · pdf · docx · txt · pptx · xlsx · csv</span>
            </div>
            <UploadZone
              label=""
              accept={SUPPORTED_EXTS}
              file={output}
              onFile={setOutput}
              onClear={() => setOutput(null)}
              testid="upload-output"
            />
          </div>
        </div>

        {/* Toggles + actions row */}
        <div className="border border-zinc-800 rounded-md bg-[#141416] p-3 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-3 pr-4 border-r border-zinc-800">
            <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-zinc-500">
              Mode
            </span>
            <span className={`text-[11px] font-mono uppercase tracking-wider ${mode === "strict" ? "text-white" : "text-zinc-600"}`}>
              Strict
            </span>
            <Switch
              checked={mode === "smart"}
              onCheckedChange={(v) => setMode(v ? "smart" : "strict")}
              data-testid="mode-toggle"
            />
            <span className={`text-[11px] font-mono uppercase tracking-wider ${mode === "smart" ? "text-white" : "text-zinc-600"}`}>
              Smart
            </span>
          </div>

          <div className="flex items-center gap-3 pr-4 border-r border-zinc-800">
            <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-zinc-500">
              Use glossary
            </span>
            <Switch
              checked={useGlossary}
              onCheckedChange={setUseGlossary}
              data-testid="glossary-toggle"
            />
          </div>

          <div className="text-[10px] font-mono text-zinc-500 tracking-[0.14em] uppercase">
            Strikethrough auto-excluded
          </div>

          <div className="ml-auto flex items-center gap-2">
            <Button
              onClick={reset}
              variant="outline"
              data-testid="reset-btn"
              className="border-zinc-700 bg-zinc-900 hover:bg-zinc-800 text-white"
            >
              <RotateCcw className="w-4 h-4 mr-2" /> Reset
            </Button>
            <Button
              onClick={run}
              disabled={loading || !mockup || !output}
              data-testid="run-compare-btn"
              className="bg-white text-black hover:bg-zinc-200"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Play className="w-4 h-4 mr-2" />
              )}
              Run Comparison
            </Button>
          </div>
        </div>

        {/* Export row (visible only with report) */}
        {report && (
          <div className="flex items-center justify-end gap-2" data-testid="export-row">
            <Button
              onClick={() => doExport("pdf")}
              disabled={exporting === "pdf"}
              variant="outline"
              data-testid="export-pdf-btn"
              className="border-zinc-700 bg-zinc-900 hover:bg-zinc-800 text-white"
            >
              {exporting === "pdf" ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <FileDown className="w-4 h-4 mr-2" />
              )}
              PDF
            </Button>
            <Button
              onClick={() => doExport("html")}
              disabled={exporting === "html"}
              variant="outline"
              data-testid="export-html-btn"
              className="border-zinc-700 bg-zinc-900 hover:bg-zinc-800 text-white"
            >
              {exporting === "html" ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <FileCode className="w-4 h-4 mr-2" />
              )}
              HTML
            </Button>
          </div>
        )}

        {report ? (
          <DiffReport
            report={report}
            mockupName={meta.mockupName || report.mockup_filename}
            outputName={meta.outputName || report.output_filename}
          />
        ) : (
          <div className="border border-dashed border-zinc-800 rounded-md p-12 text-center text-sm text-zinc-500">
            No report yet. Upload files and click{" "}
            <span className="text-white font-medium">Run Comparison</span>. Or pick a past run
            from the history panel on the right.
          </div>
        )}
      </div>

      <HistorySidebar
        refreshKey={historyKey}
        onSelect={openHistory}
        activeId={activeId}
      />
    </div>
  );
}
