import { useEffect, useState } from "react";
import client from "../api/client";

// Admin2 ADM_01: the admin decides which words make the AI treat a case as
// High or Medium priority. Everything else is Low and isn't marked.
const LEVELS = [
  { key: "high", title: "High priority", hint: "One or more of these words makes a case High priority — visible to admins only." },
  { key: "medium", title: "Medium priority", hint: "If no High word is found, one or more of these makes it Medium — visible to admins and the department's Head." },
];

export default function PriorityKeywords() {
  const [keywords, setKeywords] = useState([]);
  const [drafts, setDrafts] = useState({ high: "", medium: "" });
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  function load() {
    client.get("/priority-keywords/").then((res) => setKeywords(res.data.results || res.data)).catch(() => setError("Could not load the keywords."));
  }
  useEffect(load, []);

  async function add(level, e) {
    e.preventDefault();
    const word = drafts[level].trim();
    if (!word) return;
    setError(""); setNotice("");
    try {
      await client.post("/priority-keywords/", { level, word });
      setDrafts((d) => ({ ...d, [level]: "" }));
      load();
    } catch (err) {
      const data = err.response?.data;
      setError(data?.word?.[0] || data?.detail || "Could not add that keyword.");
    }
  }

  async function remove(id) {
    setError(""); setNotice("");
    try {
      await client.delete(`/priority-keywords/${id}/`);
      setKeywords((k) => k.filter((x) => x.id !== id));
    } catch {
      setError("Could not remove that keyword.");
    }
  }

  async function rescan() {
    setBusy(true); setError(""); setNotice("");
    try {
      const { data } = await client.post("/priority-keywords/rescan/");
      setNotice(`Checked ${data.checked} open case${data.checked === 1 ? "" : "s"}; updated ${data.changed}.`);
    } catch {
      setError("The re-check could not run. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <p className="muted" style={{ maxWidth: "70ch" }}>
        The AI reads each new case and sets its priority from these words. Words are matched as whole words or phrases,
        ignoring capitals. Cases that match nothing are Low priority. New keywords apply to cases received from now on —
        use “Re-check open cases” to apply them to cases already open.
      </p>
      {error && <div className="alert alert-error">{error}</div>}
      {notice && <div className="alert alert-success">{notice}</div>}

      <div className="two-col">
        {LEVELS.map((lvl) => {
          const list = keywords.filter((k) => k.level === lvl.key);
          return (
            <div className="card" key={lvl.key}>
              <h3 style={{ marginTop: 0 }}><span className={`meta-chip priority-${lvl.key}`}>⚑ {lvl.title}</span></h3>
              <p className="muted" style={{ fontSize: "0.85rem" }}>{lvl.hint}</p>
              <form onSubmit={(e) => add(lvl.key, e)} style={{ display: "flex", gap: 8, marginBottom: 14 }}>
                <input
                  style={{ flex: 1 }} placeholder="Add a word or short phrase"
                  value={drafts[lvl.key]} maxLength={100}
                  onChange={(e) => setDrafts((d) => ({ ...d, [lvl.key]: e.target.value }))}
                />
                <button className="btn btn-success btn-sm" disabled={!drafts[lvl.key].trim()}>Add</button>
              </form>
              <div className="keyword-list">
                {list.length === 0 && <span className="muted" style={{ fontSize: "0.85rem" }}>No keywords yet.</span>}
                {list.map((k) => (
                  <span className="keyword-chip" key={k.id}>
                    {k.word}
                    <button type="button" onClick={() => remove(k.id)} aria-label={`Remove ${k.word}`}>✕</button>
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <button className="btn btn-info" style={{ marginTop: 16 }} onClick={rescan} disabled={busy}>
        {busy ? "Checking…" : "Re-check open cases"}
      </button>
    </div>
  );
}
