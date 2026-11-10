import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import client, { API_ROOT } from "../api/client";
import StatusBadge from "../components/StatusBadge";

const RANGES = [
  { key: "", label: "All time" },
  { key: "today", label: "Today" },
  { key: "7d", label: "7 Days" },
  { key: "month", label: "This Month" },
  { key: "year", label: "This Year" },
];

export default function UserDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [departments, setDepartments] = useState([]);
  const [groups, setGroups] = useState([]);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [noticeIsError, setNoticeIsError] = useState(false);
  const [casework, setCasework] = useState(null);
  const [range, setRange] = useState("");

  useEffect(() => {
    client.get(`/staff-users/${id}/`).then((res) => {
      setUser(res.data);
      setForm({
        // "citizen" or "g:<group id>" — roles are permission groups (Admin3 ADM_01).
        roleChoice: res.data.role === "citizen" ? "citizen" : `g:${res.data.current_group ?? ""}`,
        department: res.data.department || "", is_active: res.data.is_active,
      });
    });
    client.get("/departments/").then((res) => setDepartments(res.data.results || res.data));
    client.get("/groups/").then((res) => setGroups(res.data.results || res.data));
  }, [id]);

  const chosenGroup = form?.roleChoice?.startsWith("g:") ? groups.find((g) => String(g.id) === form.roleChoice.slice(2)) : null;
  const needsDepartment = ["officer", "dept_head"].includes(chosenGroup?.access_level);

  useEffect(() => {
    const params = {};
    if (range) params.range = range;
    client.get(`/staff-users/${id}/casework/`, { params }).then((res) => setCasework(res.data)).catch(() => setCasework(null));
  }, [id, range]);

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setNotice("");
    try {
      const payload = {
        department: needsDepartment ? form.department || null : null,
        is_active: form.is_active,
      };
      if (form.roleChoice === "citizen") payload.role = "citizen";
      else payload.role_group = Number(form.roleChoice.slice(2));
      const { data } = await client.patch(`/staff-users/${id}/`, payload);
      setUser(data);
      setNotice("User updated.");
      setNoticeIsError(false);
    } catch (err) {
      const data = err.response?.data;
      setNotice(typeof data === "object" ? Object.values(data).flat().join(" ") : "Could not update this user.");
      setNoticeIsError(true);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!window.confirm(`Delete ${user.username}? This cannot be undone.`)) return;
    try {
      await client.delete(`/staff-users/${id}/`);
      navigate("/staff/users");
    } catch (err) {
      // Admin2 ADM_02: the last admin can't be deleted — say why.
      setNotice(err.response?.data?.detail || "Could not delete this user.");
      setNoticeIsError(true);
    }
  }

  if (!user || !form) return <div>Loading…</div>;

  const imageSrc = user.profile_image
    ? (user.profile_image.startsWith("http") ? user.profile_image : `${API_ROOT}${user.profile_image}`)
    : null;

  return (
    <div>
      <button className="btn btn-outline btn-sm" onClick={() => navigate("/staff/users")} style={{ marginBottom: 16 }}>← Back to Users</button>
      <div className="two-col">
        <div>
          <div className="card" style={{ display: "flex", gap: 16, alignItems: "center", marginBottom: 20 }}>
            <span className="avatar-circle avatar-md">
              {imageSrc ? <img src={imageSrc} alt="" /> : (user.first_name?.[0] || user.username[0]).toUpperCase()}
            </span>
            <div>
              <h2 style={{ margin: 0 }}>{user.first_name || user.last_name ? `${user.first_name} ${user.last_name}`.trim() : user.username}</h2>
              <div className="muted" style={{ fontSize: "0.85rem" }}>@{user.username} · {user.email || "no email"}</div>
            </div>
          </div>

          {notice && <div className={`alert ${noticeIsError ? "alert-error" : "alert-success"}`}>{notice}</div>}

          <form className="card" onSubmit={handleSave} style={{ marginBottom: 20 }}>
            <div className="field">
              <label>Role</label>
              <select value={form.roleChoice} onChange={(e) => setForm((f) => ({ ...f, roleChoice: e.target.value }))}>
                <option value="citizen">Citizen / Employee</option>
                {groups.map((g) => <option key={g.id} value={`g:${g.id}`}>{g.name}</option>)}
              </select>
            </div>
            {needsDepartment && (
              <div className="field">
                <label>Department</label>
                <select value={form.department} onChange={(e) => setForm((f) => ({ ...f, department: e.target.value }))}>
                  <option value="">Select a department</option>
                  {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
            )}
            <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: "0.9rem", marginBottom: 18 }}>
              <input type="checkbox" checked={form.is_active} onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))} />
              Account is active
            </label>
            <p className="muted" style={{ fontSize: "0.82rem" }}>
              Permission group: <strong>{chosenGroup?.name || "none (citizen)"}</strong>. Whatever that group can
              do is set on the <a href="/staff/groups" target="_blank" rel="noreferrer">Permission groups</a> page — it
              follows the role automatically, so changing the role above changes the group too.
            </p>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn btn-success" disabled={saving}>{saving ? "Saving…" : "Save changes"}</button>
              <button type="button" className="btn btn-danger" onClick={handleDelete}>Delete user</button>
            </div>
          </form>
        </div>

        <div>
          <div className="card">
            <h3 style={{ marginTop: 0, marginBottom: 10 }}>Check-up</h3>
            <div className="filters" style={{ marginBottom: 14 }}>
              {RANGES.map((r) => (
                <button key={r.key} className={`btn btn-sm ${range === r.key ? "btn-primary" : "btn-outline"}`} onClick={() => setRange(r.key)}>
                  {r.label}
                </button>
              ))}
            </div>
            {!casework ? (
              <p className="muted" style={{ fontSize: "0.85rem" }}>Loading…</p>
            ) : (
              <>
                <div className="stat-value" style={{ fontSize: "1.6rem" }}>{casework.total_cases}</div>
                <div className="stat-label" style={{ marginBottom: 14 }}>Cases worked on</div>
                {casework.by_status.map((s) => (
                  <div key={s.status} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", marginBottom: 6 }}>
                    <StatusBadge status={s.status} />
                    <span>{s.count}</span>
                  </div>
                ))}
                <hr className="divider" />
                <div className="muted" style={{ fontSize: "0.8rem", marginBottom: 8 }}>Recent cases</div>
                {casework.cases.slice(0, 8).map((c) => (
                  <div key={c.id} style={{ fontSize: "0.82rem", marginBottom: 6, cursor: "pointer" }} onClick={() => navigate(`/staff/submissions/${c.id}`)}>
                    {c.tracking_code} — {c.title}
                  </div>
                ))}
                {casework.cases.length === 0 && <p className="muted" style={{ fontSize: "0.82rem" }}>No cases in this range.</p>}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
