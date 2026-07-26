import axios from "axios";

// Runtime detection: when the user runs the downloaded copy locally,
// hostname === "localhost" (or 127.0.0.1) → talk to the local backend on :8001.
// In hosted preview environments the built-in REACT_APP_BACKEND_URL is used.
function detectBackendUrl() {
  // 1. Explicit runtime override wins: user can set localStorage.setItem("backendUrl", "http://x:8001")
  if (typeof window !== "undefined") {
    try {
      const override = window.localStorage.getItem("backendUrl");
      if (override) return override.replace(/\/+$/, "");
    } catch {}
    const host = window.location.hostname;
    if (host === "localhost" || host === "127.0.0.1" || host === "0.0.0.0") {
      return "http://localhost:8001";
    }
  }
  // 2. Env baked at build time (works on preview / production frontends)
  const env = (process.env.REACT_APP_BACKEND_URL || "").replace(/\/+$/, "");
  if (env) return env;
  // 3. Same-origin fallback (works when frontend is served by the FastAPI backend itself)
  if (typeof window !== "undefined") {
    return `${window.location.protocol}//${window.location.host}`;
  }
  return "http://localhost:8001";
}

export const BACKEND_URL = detectBackendUrl();
export const API = `${BACKEND_URL}/api`;

export const api = axios.create({
  baseURL: API,
  timeout: 60000,
});

// One-shot health check — resolves true/false without throwing.
export async function pingBackend() {
  try {
    const { data } = await api.get("/", { timeout: 5000 });
    return !!(data && (data.status === "ok" || data.app));
  } catch {
    return false;
  }
}

// Convert axios error → helpful message that references the ACTUAL backend URL.
export function friendlyError(e, actionHint = "") {
  if (e && e.code === "ERR_NETWORK") {
    return `Cannot reach backend at ${BACKEND_URL} — make sure the backend is running${actionHint ? ` (${actionHint})` : ""}.`;
  }
  return e?.response?.data?.detail || e?.message || "Something went wrong.";
}

export async function compareFiles(mockup, output, opts = {}) {
  const form = new FormData();
  form.append("mockup", mockup);
  form.append("output", output);
  form.append("mode", opts.mode || "smart");
  form.append("use_glossary", opts.use_glossary === false ? "false" : "true");
  form.append("save_history", opts.save_history === false ? "false" : "true");
  const { data } = await api.post("/compare", form);
  return data;
}

export async function batchFiles(files, opts = {}) {
  const form = new FormData();
  files.forEach((f) => form.append("files", f));
  form.append("mode", opts.mode || "smart");
  form.append("use_glossary", opts.use_glossary === false ? "false" : "true");
  const { data } = await api.post("/batch", form);
  return data;
}

export async function getGlossary() {
  const { data } = await api.get("/glossary");
  return data.rules || [];
}

export async function saveGlossary(rules) {
  const { data } = await api.post("/glossary", { rules });
  return data.rules;
}

export async function downloadPdf(report, mockupName, outputName) {
  const { data } = await api.post(
    "/export/pdf",
    { report, mockup_filename: mockupName || report.mockup_filename, output_filename: outputName || report.output_filename },
    { responseType: "blob" }
  );
  triggerDownload(data, `uat_${(mockupName || "report").replace(/\.[^.]+$/, "")}.pdf`);
}

export async function downloadHtml(report, mockupName, outputName) {
  const { data } = await api.post(
    "/export/html",
    { report, mockup_filename: mockupName || report.mockup_filename, output_filename: outputName || report.output_filename },
    { responseType: "blob" }
  );
  triggerDownload(data, `uat_${(mockupName || "report").replace(/\.[^.]+$/, "")}.html`);
}

export async function downloadCsv(rows) {
  const { data } = await api.post("/export/csv", { rows }, { responseType: "blob" });
  triggerDownload(data, "uat_batch_summary.csv");
}

// History
export async function listHistory(limit = 50) {
  const { data } = await api.get("/history", { params: { limit } });
  return data.items || [];
}

export async function getHistory(id) {
  const { data } = await api.get(`/history/${id}`);
  return data;
}

export async function deleteHistory(id) {
  await api.delete(`/history/${id}`);
}

export async function clearHistory() {
  await api.delete("/history");
}

export function historyPdfUrl(id) {
  return `${API}/history/${id}/pdf`;
}

export function historyHtmlUrl(id) {
  return `${API}/history/${id}/html`;
}

export function prdDocUrl() {
  return `${API}/docs/prd`;
}

function triggerDownload(blob, filename) {
  const url = window.URL.createObjectURL(new Blob([blob]));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}
