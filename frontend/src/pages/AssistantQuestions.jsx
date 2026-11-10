import { useEffect, useState } from "react";
import client from "../api/client";

// General2 GEN_03 / Admin3 ADM_02: everything about what the AI assistant knows.
//  - Waiting / Answered: questions it couldn't answer and forwarded to staff.
//  - FAQ entries: the admin adds, edits, switches off and deletes questions and
//    answers (in English, Kinyarwanda and French). The assistant uses every change
//    immediately.
//  - Built-in topics: what it already knows; "Customise" copies one into an
//    editable FAQ entry that replaces the built-in answer.
const BLANK = { question: "", question_rw: "", question_fr: "", answer: "", answer_rw: "", answer_fr: "", is_active: true };

export default function AssistantQuestions() {
  const [tab, setTab] = useState("pending");
  const [items, setItems] = useState([]);
  const [faqs, setFaqs] = useState([]);
  const [builtin, setBuiltin] = useState([]);
  const [drafts, setDrafts] = useState({});
  const [addToFaq, setAddToFaq] = useState({});
  const [form, setForm] = useState(BLANK);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);

  function load() {
    setLoading(true);
    const done = () => setLoading(false);
    if (tab === "pending" || tab === "answered") {
      client.get("/assistant/questions/", { params: { status: tab } }).then((r) => setItems(r.data)).catch(() => setError("Could not load the questions.")).finally(done);
    } else if (tab === "faq") {
      client.get("/assistant/faq/").then((r) => setFaqs(r.data)).catch(() => setError("Could not load the FAQ entries.")).finally(done);
    } else {
      Promise.all([client.get("/assistant/builtin/"), client.get("/assistant/faq/")])
        .then(([b, f]) => { setBuiltin(b.data); setFaqs(f.data); })
        .catch(() => setError("Could not load the built-in topics.")).finally(done);
    }
  }
  useEffect(load, [tab]);

  function switchTab(t) { setTab(t); setError(""); setNotice(""); }

  async function answer(q, e) {
    e.preventDefault();
    setError(""); setNotice("");
    try {
      await client.post(`/assistant/questions/${q.id}/answer/`, { answer: drafts[q.id] ?? q.answer ?? "", add_to_faq: !!addToFaq[q.id] });
      setNotice(`Answer saved for ${q.code}.${addToFaq[q.id] ? " It was also added to the assistant's FAQs." : ""}`);
      setDrafts((d) => ({ ...d, [q.id]: undefined }));
      load();
    } catch (err) {
      setError(err.response?.data?.detail || "Could not send the answer.");
    }
  }

  async function deleteQuestion(q) {
    if (!window.confirm(`Delete question ${q.code}?`)) return;
    setError(""); setNotice("");
    try { await client.delete(`/assistant/questions/${q.id}/`); load(); } catch { setError("Could not delete this question."); }
  }

  async function saveFaq(e) {
    e.preventDefault();
    setError(""); setNotice("");
    try {
      if (editingId) await client.patch(`/assistant/faq/${editingId}/`, form);
      else await client.post("/assistant/faq/", form);
      setNotice("Saved — the assistant will use this straight away.");
      setForm(BLANK); setEditingId(null); load();
    } catch (err) {
      setError(err.response?.data?.detail || "Could not save this FAQ entry.");
    }
  }

  async function toggleFaq(f) {
    try { await client.patch(`/assistant/faq/${f.id}/`, { is_active: !f.is_active }); load(); } catch { setError("Could not change this entry."); }
  }

  async function deleteFaq(f) {
    if (!window.confirm("Delete this FAQ entry? The assistant will stop using it.")) return;
    try { await client.delete(`/assistant/faq/${f.id}/`); if (editingId === f.id) { setForm(BLANK); setEditingId(null); } load(); } catch { setError("Could not delete this entry."); }
  }

  async function customise(topic) {
    setError(""); setNotice("");
    try {
      const { data } = await client.post("/assistant/builtin/", { key: topic.key });
      setNotice("Copied into FAQ entries — edit it there. Your version now replaces the built-in answer.");
      setEditingId(data.id); setForm({ ...BLANK, ...data });
      setTab("faq");
    } catch {
      setError("Could not customise this topic.");
    }
  }

  return (
    <div>
      <div className="chat-widget-tabs tabs-wrap" role="tablist" style={{ maxWidth: 640, marginBottom: 16 }}>
        {[["pending", "Waiting"], ["answered", "Answered"], ["faq", "FAQ entries"], ["builtin", "Built-in topics"]].map(([key, label]) => (
          <button key={key} role="tab" aria-selected={tab === key}
            className={`chat-widget-tab ${tab === key ? "is-active" : ""}`} onClick={() => switchTab(key)}>{label}</button>
        ))}
      </div>
      {error && <div className="alert alert-error">{error}</div>}
      {notice && <div className="alert alert-success">{notice}</div>}
      {loading && <p className="muted">Loading…</p>}

      {(tab === "pending" || tab === "answered") && (
        <>
          {!loading && items.length === 0 && (
            <p className="muted">{tab === "pending" ? "Nothing is waiting — the assistant has answered everything itself." : "No answered questions yet."}</p>
          )}
          {items.map((q) => (
            <div className="card" key={q.id} style={{ marginBottom: 14 }}>
              <div className="muted" style={{ fontSize: "0.8rem" }}>{q.code} · {new Date(q.created_at).toLocaleString()}</div>
              <p style={{ fontWeight: 600, margin: "6px 0 10px" }}>{q.question}</p>
              <form onSubmit={(e) => answer(q, e)}>
                <div className="field">
                  <textarea rows={3} placeholder="Write the answer the person will see…"
                    value={drafts[q.id] ?? q.answer ?? ""} onChange={(e) => setDrafts((d) => ({ ...d, [q.id]: e.target.value }))} />
                </div>
                <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: "0.85rem", marginBottom: 12 }}>
                  <input type="checkbox" checked={!!addToFaq[q.id]} onChange={(e) => setAddToFaq((f) => ({ ...f, [q.id]: e.target.checked }))} />
                  Also add to the assistant's FAQs so it can answer this next time
                </label>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button className="btn btn-success btn-sm" disabled={!(drafts[q.id] ?? q.answer ?? "").trim()}>
                    {q.status === "answered" ? "Update answer" : "Send answer"}
                  </button>
                  <button type="button" className="btn btn-danger btn-sm" onClick={() => deleteQuestion(q)}>Delete</button>
                </div>
                {q.status === "answered" && <div className="muted" style={{ fontSize: "0.78rem", marginTop: 6 }}>Answered by {q.answered_by || "staff"}</div>}
              </form>
            </div>
          ))}
        </>
      )}

      {tab === "faq" && (
        <div className="two-col">
          <div>
            {!loading && faqs.length === 0 && <p className="muted">No FAQ entries yet. Add one on the right.</p>}
            {faqs.map((f) => (
              <div className="card" key={f.id} style={{ marginBottom: 12, opacity: f.is_active ? 1 : 0.6 }}>
                <strong>{f.question}</strong>
                <p style={{ margin: "6px 0", fontSize: "0.9rem" }}>{f.answer}</p>
                <div className="muted" style={{ fontSize: "0.78rem" }}>
                  {f.source_key ? "Customised built-in topic · " : ""}{f.answer_rw ? "RW ✓ " : ""}{f.answer_fr ? "FR ✓" : ""}
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
                  <button className="btn btn-warning btn-sm" onClick={() => { setEditingId(f.id); setForm({ ...BLANK, ...f }); }}>Edit</button>
                  <button className="btn btn-warning btn-sm" onClick={() => toggleFaq(f)}>{f.is_active ? "Switch off" : "Switch on"}</button>
                  <button className="btn btn-danger btn-sm" onClick={() => deleteFaq(f)}>Delete</button>
                </div>
              </div>
            ))}
          </div>
          <form className="card" onSubmit={saveFaq}>
            <h3 style={{ marginTop: 0 }}>{editingId ? "Edit FAQ entry" : "Add a FAQ entry"}</h3>
            <div className="field"><label>Question</label>
              <input required value={form.question} maxLength={500} onChange={(e) => setForm({ ...form, question: e.target.value })} /></div>
            <div className="field"><label>Answer</label>
              <textarea required rows={3} value={form.answer} onChange={(e) => setForm({ ...form, answer: e.target.value })} /></div>
            <details>
              <summary className="muted" style={{ cursor: "pointer", marginBottom: 10 }}>Kinyarwanda and French versions (optional)</summary>
              <div className="field"><label>Question in Kinyarwanda</label>
                <input value={form.question_rw} onChange={(e) => setForm({ ...form, question_rw: e.target.value })} /></div>
              <div className="field"><label>Answer in Kinyarwanda</label>
                <textarea rows={2} value={form.answer_rw} onChange={(e) => setForm({ ...form, answer_rw: e.target.value })} /></div>
              <div className="field"><label>Question in French</label>
                <input value={form.question_fr} onChange={(e) => setForm({ ...form, question_fr: e.target.value })} /></div>
              <div className="field"><label>Answer in French</label>
                <textarea rows={2} value={form.answer_fr} onChange={(e) => setForm({ ...form, answer_fr: e.target.value })} /></div>
            </details>
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <button className="btn btn-success" disabled={!form.question.trim() || !form.answer.trim()}>{editingId ? "Save changes" : "Add entry"}</button>
              {editingId && <button type="button" className="btn btn-outline" onClick={() => { setForm(BLANK); setEditingId(null); }}>Cancel</button>}
            </div>
          </form>
        </div>
      )}

      {tab === "builtin" && (
        <div>
          <p className="muted" style={{ maxWidth: "72ch" }}>
            These are the topics the assistant already knows, in English, Kinyarwanda and French. To change one, customise it —
            your version then replaces the built-in answer.
          </p>
          {builtin.map((t) => (
            <div className="card" key={t.key} style={{ marginBottom: 10 }}>
              <strong>{t.question}</strong>
              <p style={{ margin: "6px 0", fontSize: "0.88rem" }} className="muted">{t.answer}</p>
              {t.customised_entry
                ? <span className="muted" style={{ fontSize: "0.8rem" }}>✔ Customised — edit it under FAQ entries.</span>
                : <button className="btn btn-warning btn-sm" onClick={() => customise(t)}>Customise</button>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
