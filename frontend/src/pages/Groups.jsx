import { SkeletonGrid } from "../components/Skeleton";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import client from "../api/client";

// Admin3 ADM_01: permission groups ARE the roles. An admin can create as many
// as needed, choose what each may do, and then hand them out as roles — they
// show up in every "Role" dropdown (Add user, Edit user, Users filter).
// Admin2 ADM_01 / ADM_02: no "Built in" / "Custom" marks — every group looks
// the same and every group has a delete button.
export default function Groups() {
  const navigate = useNavigate();
  const [groups, setGroups] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", base_role: "officer", permissions: [] });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [listError, setListError] = useState("");

  function load() {
    client.get("/groups/").then((res) => setGroups(res.data.results || res.data));
  }

  useEffect(() => {
    load();
    client.get("/permissions/").then((res) => setPermissions(res.data.filter((p) => p.codename.startsWith("can_"))));
  }, []);

  async function removeGroup(e, g) {
    e.stopPropagation();
    setNotice("");
    setListError("");
    if (!window.confirm(`Delete the "${g.name}" group?`)) return;
    try {
      await client.delete(`/groups/${g.id}/`);
      setNotice(`"${g.name}" was deleted.`);
      load();
    } catch (err) {
      setListError(err.response?.data?.detail || "Could not delete this group.");
    }
  }

  function togglePerm(codename) {
    setForm((f) => ({
      ...f,
      permissions: f.permissions.includes(codename) ? f.permissions.filter((c) => c !== codename) : [...f.permissions, codename],
    }));
  }

  async function createGroup(e) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const { data } = await client.post("/groups/", form);
      setShowForm(false);
      setForm({ name: "", base_role: "officer", permissions: [] });
      load();
      navigate(`/staff/groups/${data.id}`);
    } catch (err) {
      const d = err.response?.data;
      setError(typeof d === "object" ? Object.values(d).flat().join(" ") : "Could not create this group.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ marginBottom: 6 }}>Permission groups</h1>
          <p className="muted" style={{ marginTop: 0, maxWidth: 640 }}>
            A group is a role. Give someone a role and they're placed in that group straight away, with exactly the
            permissions it carries. Create your own groups below — they appear wherever a role is chosen.
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowForm((s) => !s)}>
          {showForm ? "Cancel" : "+ New permission group"}
        </button>
      </div>

      {notice && <div className="alert alert-success">{notice}</div>}
      {listError && <div className="alert alert-error">{listError}</div>}

      {showForm && (
        <form className="card animate-in" onSubmit={createGroup} style={{ marginBottom: 24, maxWidth: 560 }}>
          <h3 style={{ marginTop: 0 }}>New permission group</h3>
          {error && <div className="alert alert-error">{error}</div>}
          <div className="field">
            <label>Group / role name</label>
            <input required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Senior Case Reviewer" />
          </div>
          <div className="field">
            <label>Access level</label>
            <select value={form.base_role} onChange={(e) => setForm((f) => ({ ...f, base_role: e.target.value }))}>
              <option value="officer">Officer level — sees the cases assigned to them</option>
              <option value="dept_head">Department head level — sees their department's cases</option>
            </select>
          </div>
          <div className="field">
            <label>Permissions</label>
            {permissions.map((p) => (
              <label key={p.codename} style={{ display: "flex", gap: 8, alignItems: "center", fontSize: "0.85rem", marginBottom: 6 }}>
                <input type="checkbox" checked={form.permissions.includes(p.codename)} onChange={() => togglePerm(p.codename)} />
                {p.name}
              </label>
            ))}
          </div>
          <button className="btn btn-success" disabled={saving}>{saving ? "Creating…" : "Create group"}</button>
        </form>
      )}

      {groups.length === 0 && <SkeletonGrid count={3} />}

      <div className="kpi-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
        {groups.map((g) => (
          <div className="card hover-lift" key={g.id} style={{ cursor: "pointer" }} onClick={() => navigate(`/staff/groups/${g.id}`)}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
              <strong>{g.name}</strong>
            </div>
            <div className="muted" style={{ fontSize: "0.8rem", marginTop: 6 }}>
              {g.member_count} member(s) · {g.permissions.length} permission(s)
            </div>
            <div className="muted" style={{ fontSize: "0.82rem", marginTop: 8 }}>
              {g.permissions.length === 0 ? "No permissions granted yet." : g.permissions.join(", ")}
            </div>
            <div style={{ marginTop: 12 }}>
              <button type="button" className="btn btn-danger btn-sm" onClick={(e) => removeGroup(e, g)}>Delete</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
