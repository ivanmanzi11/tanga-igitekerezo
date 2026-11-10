import { useState } from "react";
import client from "../api/client";

// General2 ADM_03: exports are limited to PDF and Excel only — CSV and Word removed.
const FORMATS = [
  { key: "pdf", label: "PDF" },
  { key: "xlsx", label: "Excel" },
];

function downloadBlob(blob, filename) {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}

const today = () => new Date().toISOString().slice(0, 10);

export default function Reports() {
  const [range, setRange] = useState("month");
  // General2 GEN_09: "Choose a period" lets the exporter pick their own from/to dates.
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [casesFormat, setCasesFormat] = useState("pdf");
  const [analyticsFormat, setAnalyticsFormat] = useState("pdf");
  const [caseFormat, setCaseFormat] = useState("pdf");
  const [trackingCode, setTrackingCode] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  // The params that describe the chosen time range, or null (with an error
  // shown) when a custom period is incomplete or backwards.
  function rangeParams() {
    if (range !== "date") return { range };
    if (!dateFrom) { setError("Choose the start date of the period first."); return null; }
    if (dateTo && dateTo < dateFrom) { setError("The end date can't be before the start date."); return null; }
    return { range: "date", date_from: dateFrom, ...(dateTo ? { date_to: dateTo } : {}) };
  }

  const rangeName = range === "date" ? `${dateFrom || "start"}_to_${dateTo || today()}` : range;

  async function downloadCasesReport() {
    setError("");
    const rp = rangeParams();
    if (!rp) return;
    setBusy("cases");
    try {
      const res = await client.get("/reports/cases/", { params: { ...rp, filetype: casesFormat }, responseType: "blob" });
      downloadBlob(res.data, `cases_report_${rangeName}.${casesFormat}`);
    } catch {
      setError("Could not generate the cases report.");
    } finally {
      setBusy("");
    }
  }

  async function downloadAnalyticsReport() {
    setError("");
    const rp = rangeParams();
    if (!rp) return;
    setBusy("analytics");
    try {
      const res = await client.get("/reports/analytics/", { params: { ...rp, filetype: analyticsFormat }, responseType: "blob" });
      downloadBlob(res.data, `analytics_report_${rangeName}.${analyticsFormat}`);
    } catch {
      setError("Could not generate the analytics report.");
    } finally {
      setBusy("");
    }
  }

  async function downloadCaseReport(e) {
    e.preventDefault();
    if (!trackingCode.trim()) return;
    setBusy("case");
    setError("");
    try {
      const { data: list } = await client.get("/submissions/", { params: { search: trackingCode.trim() } });
      const found = (list.results || list)[0];
      if (!found) throw new Error("not found");
      const res = await client.get(`/reports/cases/${found.id}/`, { params: { filetype: caseFormat }, responseType: "blob" });
      downloadBlob(res.data, `${trackingCode.trim()}_report.${caseFormat}`);
    } catch {
      setError("Could not find or export that case. Check the tracking code and that you have access to it.");
    } finally {
      setBusy("");
    }
  }

  function FormatPicker({ value, onChange }) {
    return (
      <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
        {FORMATS.map((f) => (
          <button
            key={f.key} type="button"
            className={`btn btn-sm ${value === f.key ? "btn-primary" : "btn-outline"}`}
            onClick={() => onChange(f.key)}
          >
            {f.label}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div>
      <p className="muted">Export data for institutional record-keeping or presentation, in PDF or Excel.</p>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="card" style={{ marginBottom: 20 }}>
        <h3 style={{ marginTop: 0 }}>Time range for the reports below</h3>
        <select value={range} onChange={(e) => setRange(e.target.value)} style={{ padding: "8px 10px", border: "1px solid var(--line)", borderRadius: 3 }}>
          <option value="today">Today</option>
          <option value="7d">Last 7 Days</option>
          <option value="month">This Month</option>
          <option value="year">This Year</option>
          <option value="date">Choose a period…</option>
        </select>
        {range === "date" && (
          <div className="period-picker">
            <label>
              <span>From</span>
              <input type="date" value={dateFrom} max={dateTo || today()} onChange={(e) => setDateFrom(e.target.value)} />
            </label>
            <label>
              <span>To <em>(optional — defaults to today)</em></span>
              <input type="date" value={dateTo} min={dateFrom || undefined} max={today()} onChange={(e) => setDateTo(e.target.value)} />
            </label>
            {!dateFrom && <p className="muted" style={{ fontSize: "0.82rem", margin: 0 }}>Pick a start date to export that period.</p>}
          </div>
        )}
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <h3 style={{ marginTop: 0 }}>All cases</h3>
        <p className="muted" style={{ fontSize: "0.9rem" }}>Every case you have access to within the selected range.</p>
        <FormatPicker value={casesFormat} onChange={setCasesFormat} />
        <button className="btn btn-info" onClick={downloadCasesReport} disabled={busy === "cases"}>
          {busy === "cases" ? "Preparing…" : "Download"}
        </button>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <h3 style={{ marginTop: 0 }}>Analytics summary</h3>
        <p className="muted" style={{ fontSize: "0.9rem" }}>Totals, unresolved count, and breakdowns by category/department/status for the selected range.</p>
        <FormatPicker value={analyticsFormat} onChange={setAnalyticsFormat} />
        <button className="btn btn-info" onClick={downloadAnalyticsReport} disabled={busy === "analytics"}>
          {busy === "analytics" ? "Preparing…" : "Download"}
        </button>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>A specific case</h3>
        <p className="muted" style={{ fontSize: "0.9rem" }}>Full history and conversation for one case, by tracking code.</p>
        <FormatPicker value={caseFormat} onChange={setCaseFormat} />
        <form onSubmit={downloadCaseReport} style={{ display: "flex", gap: 10 }}>
          <input type="text" placeholder="TGC-2026-10-05-0127" value={trackingCode} onChange={(e) => setTrackingCode(e.target.value)} style={{ flex: 1 }} />
          <button className="btn btn-info" disabled={busy === "case"}>{busy === "case" ? "Preparing…" : "Download"}</button>
        </form>
      </div>
    </div>
  );
}
