import { useEffect, useState } from "react";
import client from "../api/client";

// Admin3 ADM_03 / ADM_04: view, create, update and delete the categories people
// submit under. Deleting or renaming a category that already has submissions
// keeps those submissions (and their statistics) under the old category; "Others"
// is the catch-all and always comes last.
const EMPTY = { name: "", name_rw: "", name_fr: "" };

export default function Categories() {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [showArchived, setShowArchived] = useState(false);

  function load() {
    client.get("/categories/", { params: { all: 1 } }).then((r) => setItems(r.data.results || r.data)).catch(() => setError("Could not load the categories."));
  }
  useEffect(load, []);

  function reset() { setForm(EMPTY); setEditing(null); }

  async function save(e) {
    e.preventDefault();
    setError(""); setNotice("");
    try {
      if (editing) {
        const { data } = await client.patch(`/categories/${editing.id}/`, form);
        if (data.id !== editing.id) {
          setNotice(`“${editing.name}” already had submissions, so it was archived — they keep that name in their history. “${data.name}” is now the category offered for new submissions.`);
        } else {
          setNotice("Category updated.");
        }
      } else {
        await client.post("/categories/", form);
        setNotice("Category added.");
      }
      reset(); load();
    } catch (err) {
      const d = err.response?.data;
      setError(d?.name?.[0] || d?.detail || "Could not save this category.");
    }
  }

  async function remove(c) {
    const msg = c.submission_count
      ? `“${c.name}” has ${c.submission_count} submission(s). It will be archived: they keep it in their history and statistics, but it won't be offered any more. Continue?`
      : `Delete “${c.name}”? This cannot be undone.`;
    if (!window.confirm(msg)) return;
    setError(""); setNotice("");
    try {
      const res = await client.delete(`/categories/${c.id}/`);
      if (res.data?.archived) setNotice(res.data.detail);
      if (editing?.id === c.id) reset();
      load();
    } catch (err) {
      setError(err.response?.data?.detail || "Could not delete this category.");
    }
  }

  const active = items.filter((c) => c.is_active);
  const archived = items.filter((c) => !c.is_active);

  return (
    <div>
      <p className="muted" style={{ maxWidth: "72ch" }}>
        These are the categories people choose when they submit. Changes appear everywhere automatically. Submissions already
        filed under a category you rename or delete keep it, so history and statistics stay accurate.
      </p>
      {error && <div className="alert alert-error">{error}</div>}
      {notice && <div className="alert alert-success">{notice}</div>}

      <div className="two-col">
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <table>
            <thead><tr><th>Category</th><th>Kinyarwanda</th><th>Français</th><th>Submissions</th><th></th></tr></thead>
            <tbody>
              {active.length === 0 && <tr><td colSpan={5} className="muted" style={{ padding: 20 }}>No categories yet.</td></tr>}
              {active.map((c) => (
                <tr key={c.id}>
                  <td><strong>{c.name}</strong>{c.is_other && <span className="muted"> · always last</span>}</td>
                  <td>{c.name_rw || "—"}</td>
                  <td>{c.name_fr || "—"}</td>
                  <td>{c.submission_count}</td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    <button className="btn btn-warning btn-sm" onClick={() => { setEditing(c); setForm({ name: c.name, name_rw: c.name_rw, name_fr: c.name_fr }); }}>Edit</button>{" "}
                    {!c.is_other && <button className="btn btn-danger btn-sm" onClick={() => remove(c)}>Delete</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <form className="card" onSubmit={save}>
          <h3 style={{ marginTop: 0 }}>{editing ? `Edit “${editing.name}”` : "Add a category"}</h3>
          <div className="field"><label>Name</label>
            <input required value={form.name} maxLength={100} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div className="field"><label>Name in Kinyarwanda (optional)</label>
            <input value={form.name_rw} maxLength={100} onChange={(e) => setForm({ ...form, name_rw: e.target.value })} /></div>
          <div className="field"><label>Name in French (optional)</label>
            <input value={form.name_fr} maxLength={100} onChange={(e) => setForm({ ...form, name_fr: e.target.value })} /></div>
          {editing && editing.submission_count > 0 && !editing.is_other && (
            <p className="muted" style={{ fontSize: "0.82rem" }}>
              If you change the name, the old name is kept for its {editing.submission_count} existing submission(s) and the new name is used from now on.
            </p>
          )}
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-success" disabled={!form.name.trim()}>{editing ? "Save changes" : "Add category"}</button>
            {editing && <button type="button" className="btn btn-outline" onClick={reset}>Cancel</button>}
          </div>
        </form>
      </div>

      {archived.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <button className="btn btn-info btn-sm" onClick={() => setShowArchived((v) => !v)}>
            {showArchived ? "Hide" : "Show"} archived categories ({archived.length})
          </button>
          {showArchived && (
            <div className="card" style={{ marginTop: 12, padding: 0, overflow: "hidden" }}>
              <table>
                <thead><tr><th>Archived category</th><th>Submissions kept</th></tr></thead>
                <tbody>
                  {archived.map((c) => <tr key={c.id}><td>{c.name}</td><td>{c.submission_count}</td></tr>)}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
