import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Play, Loader2, FileDown, AlertTriangle } from "lucide-react";
import UploadZone from "@/components/UploadZone";
import { StatusBadge } from "@/components/DiffReport";
import { batchFiles, downloadCsv, friendlyError } from "@/lib/api";

export default function BatchPage() {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const run = async () => {
    if (files.length === 0) {
      toast.error("Add at least one .docx + .eml/.msg pair, or a .zip archive.");
      return;
    }
    setLoading(true);
    try {
      const r = await batchFiles(files);
      setResult(r);
      toast.success(`Batch complete — ${r.reports.length} pairs processed`);
    } catch (e) {
      toast.error(friendlyError(e));
    } finally {
      setLoading(false);
    }
  };

  const exportCsv = async () => {
    if (!result?.csv_rows?.length) {
      toast.error("Nothing to export yet");
      return;
    }
    await downloadCsv(result.csv_rows);
    toast.success("CSV exported");
  };

  return (
    <div>
      <div className="sticky top-0 z-40 border-b border-zinc-800 bg-[#0A0A0B]/95 backdrop-blur">
        <div className="px-8 py-4 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Batch Mode</h1>
            <p className="text-xs text-zinc-500 font-mono">
              Upload many .docx + .eml/.msg pairs (or a .zip) → CSV summary
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={run}
              disabled={loading || files.length === 0}
              data-testid="run-batch-btn"
              className="bg-white text-black hover:bg-zinc-200"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Play className="w-4 h-4 mr-2" />
              )}
              Run batch
            </Button>
            <Button
              onClick={exportCsv}
              disabled={!result}
              variant="outline"
              data-testid="export-csv-btn"
              className="border-zinc-700 bg-zinc-900 hover:bg-zinc-800 text-white"
            >
              <FileDown className="w-4 h-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </div>
      </div>

      <div className="px-8 py-6 space-y-6" data-testid="batch-page">
        <UploadZone
          label="Files (.docx / .eml / .msg / .pdf / .html / .txt / .pptx / .xlsx / .csv / .zip) — pairs auto-matched by filename"
          accept=".docx,.eml,.msg,.pdf,.htm,.html,.txt,.pptx,.xlsx,.csv,.zip"
          multiple
          onFiles={(fs) => setFiles((prev) => [...prev, ...fs])}
          testid="upload-batch"
        />

        {files.length > 0 && (
          <div className="border border-zinc-800 rounded-md bg-[#141416] p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm text-zinc-300">
                {files.length} file{files.length === 1 ? "" : "s"} queued
              </div>
              <button
                onClick={() => setFiles([])}
                data-testid="batch-clear-btn"
                className="text-xs text-zinc-500 hover:text-white transition-colors"
              >
                Clear all
              </button>
            </div>
            <ul className="text-xs font-mono text-zinc-400 space-y-1 max-h-40 overflow-auto">
              {files.map((f, i) => (
                <li key={i} className="flex justify-between gap-4 border-b border-zinc-900 py-1">
                  <span className="truncate">{f.name}</span>
                  <span className="text-zinc-600">{(f.size / 1024).toFixed(1)} KB</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {result && (
          <div className="space-y-4" data-testid="batch-results">
            {(result.unmatched?.mockups_without_output?.length > 0 ||
              result.unmatched?.outputs_without_mockup?.length > 0) && (
              <div className="border border-amber-500/30 bg-amber-500/10 text-amber-300 rounded-md p-4 text-sm flex gap-3">
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                <div className="space-y-1">
                  {result.unmatched.mockups_without_output.length > 0 && (
                    <div>
                      Mockups without output:{" "}
                      <span className="font-mono">{result.unmatched.mockups_without_output.join(", ")}</span>
                    </div>
                  )}
                  {result.unmatched.outputs_without_mockup.length > 0 && (
                    <div>
                      Outputs without mockup:{" "}
                      <span className="font-mono">{result.unmatched.outputs_without_mockup.join(", ")}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="border border-zinc-800 rounded-md overflow-hidden bg-[#141416]">
              <div className="px-4 py-3 border-b border-zinc-800 bg-zinc-950 text-sm font-semibold">
                Results ({result.csv_rows.length})
              </div>
              <div className="overflow-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-zinc-500 font-mono uppercase tracking-widest">
                      <th className="px-4 py-2">Mockup</th>
                      <th className="px-4 py-2">Output</th>
                      <th className="px-4 py-2">Overall</th>
                      <th className="px-4 py-2">Score</th>
                      <th className="px-4 py-2">Match</th>
                      <th className="px-4 py-2">Warn</th>
                      <th className="px-4 py-2">Mismatch</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.csv_rows.map((r, i) => (
                      <tr
                        key={i}
                        className="border-t border-zinc-800 hover:bg-zinc-900/60"
                        data-testid={`batch-row-${i}`}
                      >
                        <td className="px-4 py-2 font-mono">{r.mockup}</td>
                        <td className="px-4 py-2 font-mono">{r.output}</td>
                        <td className="px-4 py-2">
                          <StatusBadge status={r.overall} testid={`batch-status-${i}`} />
                        </td>
                        <td className="px-4 py-2">{r.score_percent}%</td>
                        <td className="px-4 py-2 text-emerald-400">{r.match_count}</td>
                        <td className="px-4 py-2 text-amber-400">{r.warning_count}</td>
                        <td className="px-4 py-2 text-rose-400">{r.mismatch_count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
