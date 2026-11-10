import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import client from "../api/client";

// Admin3 ADM_01: edit a permission group (a role). Admin2 ADM_01 / ADM_02:
// there is no "Built in" distinction any more — every group can be renamed,
// re-levelled and deleted (once nobody holds it).
export default function GroupDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [group, setGroup] = useState(null);
  const [permissions, setPermissions] = useState([]);
  const [selectedPerms, setSelectedPerms] = useState([]);
  const [name, setName] = useState("");
  const [baseRole, setBaseRole] = useState("officer");
  const [members, setMembers] = useState([]);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  function load() {
    client.get(`/groups/${id}/`).then((res) => {
      setGroup(res.data);
      setSelectedPerms(res.data.permissions);
      setName(res.data.name);
      setBaseRole(res.data.access_level);
    });
    client.get("/staff-users/", { params: { all: "true", group: id, page_size: 500 } })
      .then((res) => setMembers(res.data.results || res.data));
  }

  useEffect(() => {
    load();
    client.get("/permissions/").then((res) => setPermissions(res.data));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  function togglePerm(codename) {
    setSelectedPerms((p) => (p.includes(codename) ? p.filter((c) => c !== codename) : [...p, codename]));
  }

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const payload = { permissions: selectedPerms, name };
      // Administrator-level groups keep their access level; the others can change it.
      if (baseRole !== "admin") payload.base_role = baseRole;
      await client.patch(`/groups/${id}/`, payload);
      setNotice("Saved — everyone in this group has these permissions right away.");
      load();
    } catch (err) {
      const d = err.response?.data;
      setError(typeof d === "object" ? Object.values(d).flat().join(" ") : "Could not save this group.");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!window.confirm(`Delete the "${group.name}" group?`)) return;
    try {
      await client.delete(`/groups/${id}/`);
      navigate("/staff/groups");
    } catch (err) {
      setError(err.response?.data?.detail || "Could not delete this group.");
    }
  }

  if (!group) return <div>Loading…</div>;
  const relevantPerms = permissions.filter((p) => p.codename.startsWith("can_"));

  return (
    <div>
      <button className="btn btn-outline btn-sm" onClick={() => navigate("/staff/groups")} style={{ marginBottom: 16 }}>← Back to Groups</button>
      {notice && <div className="alert alert-success">{notice}</div>}
      {error && <div className="alert alert-error">{error}</div>}

      <div className="two-col">
        <form className="card" onSubmit={save}>
          <h3 style={{ marginTop: 0 }}>{group.name}</h3>
          <div className="field">
            <label>Group / role name</label>
            <input required value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="field">
            <label>Access level</label>
            {baseRole === "admin" ? (
              <input value="Administrator level — full access" disabled readOnly />
            ) : (
              <select value={baseRole} onChange={(e) => setBaseRole(e.target.value)}>
                <option value="officer">Officer level — sees the cases assigned to them</option>
                <option value="dept_head">Department head level — sees their department's cases</option>
              </select>
            )}
          </div>
          <div className="field">
            <label>Permissions</label>
            {relevantPerms.map((p) => (
              <label key={p.codename} style={{ display: "flex", gap: 8, alignItems: "center", fontSize: "0.85rem", marginBottom: 6 }}>
                <input type="checkbox" checked={selectedPerms.includes(p.codename)} onChange={() => togglePerm(p.codename)} />
                {p.name}
              </label>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-success" disabled={saving}>{saving ? "Saving…" : "Save group"}</button>
            <button type="button" className="btn btn-danger" onClick={remove}>Delete group</button>
          </div>
        </form>

        <div className="card">
          <h3 style={{ marginTop: 0 }}>Members ({members.length})</h3>
          <p className="muted" style={{ fontSize: "0.8rem" }}>To move someone in or out of this group, change their role on the Users page.</p>
          {members.length === 0 && <p className="muted" style={{ fontSize: "0.85rem" }}>No one holds this role yet.</p>}
          {members.map((u) => (
            <div key={u.id} style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, fontSize: "0.85rem", cursor: "pointer" }}
                 onClick={() => navigate(`/staff/users/${u.id}`)}>
              <span>{u.first_name || u.username}</span><span className="muted">→</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
