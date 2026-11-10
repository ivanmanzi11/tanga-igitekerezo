import { useEffect, useState } from "react";
import client from "../api/client";
import Modal from "../components/Modal";

// Admin3 ADM_01: create, update and delete departments, and read everyone
// allocated to each one.
const EMPTY = { name: "", description: "" };
const ROLE = { admin: "Administrator", dept_head: "Department Head", officer: "Officer", citizen: "Citizen" };

export default function Departments() {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [viewing, setViewing] = useState(null);
  const [members, setMembers] = useState([]);

  function load() {
    client.get("/departments/").then((r) => setItems(r.data.results || r.data)).catch(() => setError("Could not load the departments."));
  }
  useEffect(load, []);

  function reset() { setForm(EMPTY); setEditing(null); }

  async function save(e) {
    e.preventDefault();
    setError(""); setNotice("");
    try {
      if (editing) await client.patch(`/departments/${editing.id}/`, form);
      else await client.post("/departments/", form);
      setNotice(editing ? "Department updated." : "Department added.");
      reset(); load();
    } catch (err) {
      const d = err.response?.data;
      setError(d?.name?.[0] || d?.detail || "Could not save this department.");
    }
  }

  async function remove(d) {
    if (!window.confirm(`Delete “${d.name}”? This cannot be undone.`)) return;
    setError(""); setNotice("");
    try {
      const res = await client.delete(`/departments/${d.id}/`);
      if (res.data?.archived) setNotice(res.data.detail);
      if (editing?.id === d.id) reset();
      load();
    } catch (err) {
      setError(err.response?.data?.detail || "Could not delete this department.");
    }
  }

  async function openMembers(d) {
    setViewing(d); setMembers([]);
    try {
      const { data } = await client.get(`/departments/${d.id}/members/`);
      setMembers(data);
    } catch {
      setError("Could not load the members.");
    }
  }

  return (
    <div>
      <p className="muted" style={{ maxWidth: "72ch" }}>
        Departments are where cases are routed and staff belong. Open a department to see everyone allocated to it.
        A department that still has staff can't be deleted — move them first.
      </p>
      {error && <div className="alert alert-error">{error}</div>}
      {notice && <div className="alert alert-success">{notice}</div>}

      <div className="two-col">
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <table>
            <thead><tr><th>Department</th><th>Staff</th><th>Cases</th><th></th></tr></thead>
            <tbody>
              {items.length === 0 && <tr><td colSpan={4} className="muted" style={{ padding: 20 }}>No departments yet.</td></tr>}
              {items.map((d) => (
                <tr key={d.id}>
                  <td><strong>{d.name}</strong>{d.description && <div className="muted" style={{ fontSize: "0.8rem" }}>{d.description}</div>}</td>
                  <td><button className="link-button" onClick={() => openMembers(d)}>{d.member_count} member(s)</button></td>
                  <td>{d.case_count}</td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    <button className="btn btn-warning btn-sm" onClick={() => { setEditing(d); setForm({ name: d.name, description: d.description }); }}>Edit</button>{" "}
                    <button className="btn btn-danger btn-sm" onClick={() => remove(d)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <form className="card" onSubmit={save}>
          <h3 style={{ marginTop: 0 }}>{editing ? `Edit “${editing.name}”` : "Add a department"}</h3>
          <div className="field"><label>Name</label>
            <input required value={form.name} maxLength={150} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div className="field"><label>Description (optional)</label>
            <textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-success" disabled={!form.name.trim()}>{editing ? "Save changes" : "Add department"}</button>
            {editing && <button type="button" className="btn btn-outline" onClick={reset}>Cancel</button>}
          </div>
        </form>
      </div>

      {viewing && (
        <Modal title={`${viewing.name} — members`} onClose={() => setViewing(null)}>
          {members.length === 0 ? (
            <p className="muted">No staff members belong to this department yet.</p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Name</th><th>Role</th><th>Email</th><th>Status</th></tr></thead>
                <tbody>
                  {members.map((m) => (
                    <tr key={m.id}>
                      <td>{m.name}<div className="muted" style={{ fontSize: "0.78rem" }}>@{m.username}</div></td>
                      <td>{ROLE[m.role] || m.role}</td>
                      <td>{m.email || "—"}</td>
                      <td>{m.is_active ? "Active" : "Disabled"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}
