import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Clock, FileDown, FileCode, Trash2, RefreshCw } from "lucide-react";
import { listHistory, historyPdfUrl, historyHtmlUrl, deleteHistory, friendlyError } from "@/lib/api";

const badge = (status) => {
  if (status === "match") return "text-emerald-400";
  if (status === "warning") return "text-amber-400";
  return "text-rose-400";
};

function fmt(dt) {
  try {
    const d = new Date(dt);
    return d.toLocaleString(undefined, {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
    });
  } catch {
    return dt;
  }
}

export default function HistorySidebar({ refreshKey, onSelect, activeId }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const data = await listHistory(50);
      setItems(data);
    } catch (e) {
      // silent — offline server may not be up yet
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [refreshKey]);

  const remove = async (e, id) => {
    e.stopPropagation();
    try {
      await deleteHistory(id);
      setItems((prev) => prev.filter((i) => i.id !== id));
      toast.success("Removed from history");
    } catch (e) {
      toast.error(friendlyError(e));
    }
  };

  return (
    <aside
      className="w-[320px] shrink-0 border-l border-zinc-800 bg-[#0f0f10] flex flex-col"
      data-testid="history-sidebar"
    >
      <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="w-3.5 h-3.5 text-zinc-500" />
          <span className="text-[11px] font-mono uppercase tracking-widest text-zinc-400">
            History
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono text-zinc-600">{items.length}</span>
          <button
            onClick={load}
            className="text-zinc-500 hover:text-white transition-colors"
            data-testid="history-refresh-btn"
            title="Reload"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        {items.length === 0 ? (
          <div className="p-6 text-xs text-zinc-500 text-center font-mono">
            No runs yet. Run a comparison to build history.
          </div>
        ) : (
          items.map((it) => {
            const isActive = it.id === activeId;
            return (
              <div
                key={it.id}
                onClick={() => onSelect && onSelect(it.id)}
                data-testid={`history-item-${it.id}`}
                className={`group px-4 py-3 border-b border-zinc-900 cursor-pointer transition-colors ${
                  isActive
                    ? "bg-zinc-900 border-l-2 border-l-white"
                    : "hover:bg-zinc-900/60"
                }`}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <div className={`text-lg font-semibold ${badge(it.overall_status)}`}>
                    {Number(it.overall_score).toFixed(2)}%
                  </div>
                  <div className="text-[10px] font-mono text-zinc-500 shrink-0">
                    {fmt(it.created_at)}
                  </div>
                </div>
                <div className="text-[11px] font-mono text-zinc-300 mt-1 truncate">
                  {it.mockup_name}
                </div>
                <div className="text-[11px] font-mono text-zinc-500 truncate">
                  ↔ {it.output_name}
                </div>
                <div className="mt-2 flex items-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                  <a
                    href={historyPdfUrl(it.id)}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    data-testid={`history-pdf-${it.id}`}
                    className="text-[10px] font-mono uppercase tracking-widest inline-flex items-center gap-1 px-2 py-1 rounded border border-zinc-800 text-zinc-300 hover:bg-zinc-800"
                  >
                    <FileDown className="w-3 h-3" /> PDF
                  </a>
                  <a
                    href={historyHtmlUrl(it.id)}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    data-testid={`history-html-${it.id}`}
                    className="text-[10px] font-mono uppercase tracking-widest inline-flex items-center gap-1 px-2 py-1 rounded border border-zinc-800 text-zinc-300 hover:bg-zinc-800"
                  >
                    <FileCode className="w-3 h-3" /> HTML
                  </a>
                  <button
                    onClick={(e) => remove(e, it.id)}
                    data-testid={`history-delete-${it.id}`}
                    className="ml-auto text-[10px] inline-flex items-center gap-1 px-2 py-1 rounded border border-zinc-800 text-zinc-400 hover:text-rose-400 hover:border-rose-500/40"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
}
