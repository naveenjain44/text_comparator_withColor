import { useMemo, useState } from "react";
import { CheckCircle2, AlertTriangle, XCircle, Link2, Image as ImgIcon, ChevronDown, ChevronUp } from "lucide-react";

const badgeClass = (status) => {
  switch (status) {
    case "match":
      return "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";
    case "warning":
      return "bg-amber-500/15 text-amber-400 border-amber-500/30";
    case "mismatch":
    default:
      return "bg-rose-500/15 text-rose-400 border-rose-500/30";
  }
};

const badgeIcon = (status) =>
  status === "match" ? CheckCircle2 : status === "warning" ? AlertTriangle : XCircle;

export function StatusBadge({ status, testid }) {
  const Icon = badgeIcon(status);
  return (
    <span
      data-testid={testid}
      className={`inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-mono uppercase tracking-wider rounded-sm border ${badgeClass(
        status
      )}`}
    >
      <Icon className="w-3 h-3" />
      {status}
    </span>
  );
}

function WordStream({ words, kind = "mockup" }) {
  if (!words || words.length === 0) {
    return <span className="text-zinc-600 italic">—</span>;
  }
  return (
    <span className="text-sm text-zinc-100 whitespace-pre-wrap break-anywhere leading-relaxed">
      {words.map((w, i) => {
        const s = w.status;
        // On mockup side we only care about "match" vs "del"; ignore "add"
        // On output side we only care about "match" vs "add"; ignore "del"
        const show =
          kind === "mockup"
            ? s === "match" || s === "del"
            : s === "match" || s === "add";
        if (!show) return null;
        const cls =
          s === "match"
            ? "text-emerald-300"
            : s === "del"
            ? "bg-rose-500/25 text-rose-200 rounded px-0.5"
            : s === "add"
            ? "bg-rose-500/25 text-rose-200 rounded px-0.5"
            : "text-zinc-200";
        return (
          <span key={i} className={cls}>
            {w.text}
            {i < words.length - 1 ? " " : ""}
          </span>
        );
      })}
    </span>
  );
}

function DiffRow({ label, mockup, output, status, testid, extra, mockupWords, outputWords, placement, mockupExt, outputExt }) {
  const useWords = Array.isArray(mockupWords) || Array.isArray(outputWords);
  const mLabel = `Mockup (.${(mockupExt || "docx").replace(/^\./, "")})`;
  const oLabel = `Output (.${(outputExt || "eml").replace(/^\./, "")})`;
  return (
    <div className="border-b border-zinc-800 last:border-b-0" data-testid={testid}>
      <div className="flex items-start justify-between gap-4 px-4 py-3 bg-zinc-900/40">
        <div className="text-xs font-mono uppercase tracking-widest text-zinc-400 flex items-center gap-2">
          {label}
          {placement === "incorrect" && (
            <span
              className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-mono uppercase tracking-wider rounded-sm border bg-amber-500/15 text-amber-400 border-amber-500/30"
              data-testid={`${testid}-placement`}
              title="Text matches but position differs from mockup"
            >
              Placement Incorrect
            </span>
          )}
          {placement === "correct" && useWords && (
            <span
              className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-mono uppercase tracking-wider rounded-sm border bg-emerald-500/10 text-emerald-400/70 border-emerald-500/20"
              title="Position matches mockup"
            >
              Placement OK
            </span>
          )}
        </div>
        <StatusBadge status={status} testid={`${testid}-badge`} />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2">
        <div className="px-4 py-3 border-r border-zinc-800 min-w-0">
          <div className="text-[10px] font-mono uppercase tracking-widest text-zinc-500 mb-1">
            {mLabel}
          </div>
          {useWords ? (
            <WordStream words={mockupWords} kind="mockup" />
          ) : (
            <div className="text-sm text-zinc-100 whitespace-pre-wrap break-anywhere">
              {mockup || <span className="text-zinc-600 italic">—</span>}
            </div>
          )}
        </div>
        <div className="px-4 py-3 min-w-0">
          <div className="text-[10px] font-mono uppercase tracking-widest text-zinc-500 mb-1">
            {oLabel}
          </div>
          {useWords ? (
            <WordStream words={outputWords} kind="output" />
          ) : (
            <div className="text-sm text-zinc-100 whitespace-pre-wrap break-anywhere">
              {output || <span className="text-zinc-600 italic">—</span>}
            </div>
          )}
        </div>
      </div>
      {extra ? (
        <div className="px-4 py-2 bg-zinc-950 border-t border-zinc-800 text-[11px] font-mono text-zinc-500">
          {extra}
        </div>
      ) : null}
    </div>
  );
}

function ScoreCard({ label, value, sub, tone = "default", testid }) {
  const toneClass =
    tone === "match"
      ? "text-emerald-400"
      : tone === "warning"
      ? "text-amber-400"
      : tone === "mismatch"
      ? "text-rose-400"
      : "text-white";
  return (
    <div
      className="border border-zinc-800 bg-[#141416] rounded-md p-4 min-w-0"
      data-testid={testid}
    >
      <div className="text-[10px] font-mono uppercase tracking-[0.16em] text-zinc-500 mb-1.5">
        {label}
      </div>
      <div className={`text-2xl font-semibold tracking-tight ${toneClass}`}>{value}</div>
      {sub ? (
        <div className="text-[11px] font-mono text-zinc-500 mt-1 truncate">{sub}</div>
      ) : null}
    </div>
  );
}

const TABS = [
  { key: "subject", label: "Subject", icon: null },
  { key: "body", label: "Body Diff", icon: null },
  { key: "cta", label: "CTA", icon: null },
  { key: "links", label: "URLs", icon: Link2 },
  { key: "images", label: "Images", icon: ImgIcon },
  { key: "footer", label: "Footer", icon: null },
];

export default function DiffReport({ report, mockupName, outputName }) {
  const [tab, setTab] = useState("body");
  const mockupExt = (mockupName || "").split(".").pop()?.toLowerCase() || "docx";
  const outputExt = (outputName || "").split(".").pop()?.toLowerCase() || "eml";

  const scores = report?.scores || {};
  const s = report?.summary || {};
  const ls = report?.link_stats || {};
  const ims = report?.image_stats || {};

  const overallTone = s.overall === "match" ? "match" : s.overall === "warning" ? "warning" : "mismatch";
  const subjTone = report?.subject?.status || "warning";
  const bodyTone = (scores.body ?? 0) >= 98 ? "match" : (scores.body ?? 0) >= 80 ? "warning" : "mismatch";
  const urlTone = (scores.links ?? 0) >= 98 ? "match" : (scores.links ?? 0) >= 80 ? "warning" : "mismatch";
  const imgTone = (scores.images ?? 0) >= 98 ? "match" : (scores.images ?? 0) >= 80 ? "warning" : "mismatch";

  return (
    <div className="space-y-5" data-testid="diff-report">
      <div className="flex items-center justify-between">
        <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-zinc-500">
          Comparison Result
        </div>
        <div className="text-[11px] font-mono text-zinc-400 truncate max-w-[60%]">
          {mockupName} <span className="text-zinc-600">↔</span> {outputName}
          <span className="ml-3 text-zinc-600">·</span>{" "}
          <span className="uppercase">{(report?.mode || "smart")}</span>
        </div>
      </div>

      {/* Score cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <ScoreCard
          label="Overall Match"
          value={`${(s.overall_score ?? 0).toFixed(2)}%`}
          sub={(s.overall || "").toUpperCase()}
          tone={overallTone}
          testid="score-overall"
        />
        <ScoreCard
          label="Subject Line"
          value={`${(scores.subject ?? 0).toFixed(0)}%`}
          sub={subjTone.toUpperCase()}
          tone={subjTone}
          testid="score-subject"
        />
        <ScoreCard
          label="Body Content"
          value={`${(scores.body ?? 0).toFixed(2)}%`}
          sub={`${(report?.body || []).length} segments`}
          tone={bodyTone}
          testid="score-body"
        />
        <ScoreCard
          label="URLs"
          value={`${ls.matched ?? 0}/${ls.total ?? 0}`}
          sub={`${(scores.links ?? 0).toFixed(0)}% match`}
          tone={urlTone}
          testid="score-urls"
        />
        <ScoreCard
          label="Images"
          value={`${ims.matched ?? 0}/${ims.total ?? 0}`}
          sub={`${(scores.images ?? 0).toFixed(0)}% match`}
          tone={imgTone}
          testid="score-images"
        />
      </div>

      {/* Sub-tabs */}
      <div className="border-b border-zinc-800 flex items-center gap-1 overflow-x-auto">
        {TABS.map((t) => {
          const active = tab === t.key;
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              data-testid={`result-tab-${t.key}`}
              className={`inline-flex items-center gap-1.5 px-3 py-2.5 text-[12px] font-mono uppercase tracking-wider border-b-2 transition-colors ${
                active
                  ? "border-white text-white"
                  : "border-transparent text-zinc-500 hover:text-zinc-200"
              }`}
            >
              {Icon ? <Icon className="w-3.5 h-3.5" /> : null}
              {t.label}
            </button>
          );
        })}
      </div>

      <div className="border border-zinc-800 rounded-md overflow-hidden bg-[#141416]" data-testid="result-panel">
        {tab === "subject" && (
          <DiffRow
              mockupExt={mockupExt} outputExt={outputExt}
            label="Subject"
            mockup={report?.subject?.mockup}
            output={report?.subject?.output}
            status={report?.subject?.status}
            testid="diff-subject"
            extra={`similarity: ${((report?.subject?.similarity ?? 0) * 100).toFixed(2)}%`}
          />
        )}
        {tab === "body" && (
          <div>
            <div className="px-4 py-3 border-b border-zinc-800 bg-zinc-950 flex items-center justify-between">
              <div className="text-[11px] font-mono uppercase tracking-widest text-zinc-400">
                Body paragraph diff
              </div>
              <div className="text-[11px] font-mono text-zinc-500">
                {(report?.body || []).length} segments · similarity {(scores.body ?? 0).toFixed(2)}%
              </div>
            </div>
            {(report?.body || []).map((row, i) => {
              const idx = row.mockup_index >= 0 ? row.mockup_index : row.output_index;
              const posLabel =
                row.mockup_index >= 0 && row.output_index >= 0
                  ? `Mockup #${row.mockup_index + 1} → Output #${row.output_index + 1}`
                  : row.mockup_index >= 0
                  ? `Mockup #${row.mockup_index + 1} (missing in output)`
                  : `Output #${row.output_index + 1} (not in mockup)`;
              return (
                <DiffRow
              mockupExt={mockupExt} outputExt={outputExt}
                  key={i}
                  label={`Para ${idx + 1}`}
                  mockup={row.mockup}
                  output={row.output}
                  mockupWords={row.mockup_words}
                  outputWords={row.output_words}
                  placement={row.placement}
                  status={row.status}
                  testid={`diff-body-${i}`}
                  extra={`similarity: ${((row.similarity ?? 0) * 100).toFixed(2)}% · ${posLabel}`}
                />
              );
            })}
            {(!report?.body || report.body.length === 0) && (
              <div className="p-6 text-sm text-zinc-500">No body paragraphs found.</div>
            )}
          </div>
        )}
        {tab === "cta" && (
          <DiffRow
              mockupExt={mockupExt} outputExt={outputExt}
            label="CTA — text + URL"
            mockup={`${report?.cta?.mockup_text || ""}\n${report?.cta?.mockup_url || ""}`.trim()}
            output={`${report?.cta?.output_text || ""}\n${report?.cta?.output_url || ""}`.trim()}
            status={report?.cta?.status}
            testid="diff-cta"
            extra={`url_match: ${report?.cta?.url_match ? "yes" : "no"} · text_sim: ${((report?.cta?.text_similarity ?? 0) * 100).toFixed(0)}%`}
          />
        )}
        {tab === "links" && (
          <div>
            {(report?.links || []).map((row, i) => (
              <DiffRow
              mockupExt={mockupExt} outputExt={outputExt}
                key={i}
                label={`Link ${i + 1}`}
                mockup={`${row.mockup_text}\n${row.mockup_url}`.trim()}
                output={`${row.output_text}\n${row.output_url}`.trim()}
                status={row.status}
                testid={`diff-link-${i}`}
                extra={`text_match: ${row.text_match ? "yes" : "no"} · url_match: ${row.url_match ? "yes" : "no"}`}
              />
            ))}
            {(!report?.links || report.links.length === 0) && (
              <div className="p-6 text-sm text-zinc-500">No hyperlinks found.</div>
            )}
          </div>
        )}
        {tab === "images" && (
          <div>
            {(report?.images || []).map((row, i) => {
              const outputLabel = row.rendered
                ? `${row.output_filename || "—"}\nalt: ${row.output_alt || (row.rendered_label && row.rendered_label !== row.output_filename ? row.rendered_label : "—")}`
                : "no rendered image";
              return (
                <DiffRow
              mockupExt={mockupExt} outputExt={outputExt}
                  key={i}
                  label={`Image ${i + 1}`}
                  mockup={`${row.mockup_filename || "—"}\nalt: ${row.mockup_alt || "—"}`}
                  output={outputLabel}
                  status={row.status}
                  testid={`diff-image-${i}`}
                  extra={`rendered: ${row.rendered ? "yes" : "no"} · alt_match: ${row.alt_match ? "yes" : "no"} · name_match: ${row.name_match ? "yes" : "no"}`}
                />
              );
            })}
            {(!report?.images || report.images.length === 0) && (
              <div className="p-6 text-sm text-zinc-500">No images found.</div>
            )}
          </div>
        )}
        {tab === "footer" && (
          <DiffRow
              mockupExt={mockupExt} outputExt={outputExt}
            label="Footer"
            mockup={report?.footer?.mockup}
            output={report?.footer?.output}
            status={report?.footer?.status}
            testid="diff-footer"
            extra={`similarity: ${((report?.footer?.similarity ?? 0) * 100).toFixed(2)}%`}
          />
        )}
      </div>

      {/* mini legend */}
      <div className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest flex gap-4">
        <span>Match {s.match ?? 0}</span>
        <span>Warning {s.warning ?? 0}</span>
        <span>Mismatch {s.mismatch ?? 0}</span>
        <span className="ml-auto text-zinc-600">
          Strikethrough text in mockup is automatically excluded.
        </span>
      </div>
    </div>
  );
}
