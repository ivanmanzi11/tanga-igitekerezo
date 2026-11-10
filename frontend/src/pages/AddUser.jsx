import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import client from "../api/client";

export default function AddUser() {
  const navigate = useNavigate();
  const [departments, setDepartments] = useState([]);
  const [form, setForm] = useState({
    username: "", password: "", first_name: "", last_name: "",
    email: "", phone_number: "", role_group: "", department: "",
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  // Admin3 ADM_01: roles are permission groups — built-in and admin-created.
  const [groups, setGroups] = useState([]);

  useEffect(() => {
    client.get("/departments/").then((res) => setDepartments(res.data.results || res.data));
    client.get("/groups/").then((res) => {
      const list = res.data.results || res.data;
      setGroups(list);
      setForm((f) => (f.role_group ? f : { ...f, role_group: list.find((g) => g.name === "Officer")?.id ?? list[0]?.id ?? "" }));
    });
  }, []);

  const selectedGroup = groups.find((g) => String(g.id) === String(form.role_group));
  const needsDepartment = ["officer", "dept_head"].includes(selectedGroup?.access_level);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const payload = { ...form, role_group: Number(form.role_group) };
      if (!needsDepartment) payload.department = null;
      await client.post("/staff-users/", payload);
      navigate("/staff/users");
    } catch (err) {
      const data = err.response?.data;
      setError(typeof data === "object" ? Object.values(data).flat().join(" ") : "Could not create this user.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ maxWidth: 520 }}>
      <button className="btn btn-outline btn-sm" onClick={() => navigate(-1)} style={{ marginBottom: 16 }}>← Back to Users</button>
      <h1>Add a new user</h1>
      <p className="muted">Create a staff account and assign a role and department, the same way you would in the Django admin.</p>

      <form className="card" onSubmit={handleSubmit}>
        {error && <div className="alert alert-error">{error}</div>}

        <div className="field">
          <label>Username</label>
          <input type="text" required value={form.username} onChange={(e) => update("username", e.target.value)} />
        </div>
        <div className="field">
          <label>Temporary password</label>
          <input type="password" required value={form.password} onChange={(e) => update("password", e.target.value)} />
          <div className="field-hint">Share this with the user so they can sign in and change it.</div>
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          <div className="field" style={{ flex: 1 }}>
            <label>First name</label>
            <input type="text" value={form.first_name} onChange={(e) => update("first_name", e.target.value)} />
          </div>
          <div className="field" style={{ flex: 1 }}>
            <label>Last name</label>
            <input type="text" value={form.last_name} onChange={(e) => update("last_name", e.target.value)} />
          </div>
        </div>
        <div className="field">
          <label>Email</label>
          <input type="email" value={form.email} onChange={(e) => update("email", e.target.value)} />
        </div>
        <div className="field">
          <label>Phone</label>
          <input type="tel" value={form.phone_number} onChange={(e) => update("phone_number", e.target.value)} />
        </div>
        <div className="field">
          <label>Role</label>
          <select required value={form.role_group} onChange={(e) => update("role_group", e.target.value)}>
            {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        </div>
        {needsDepartment && (
          <div className="field">
            <label>Department</label>
            <select required value={form.department} onChange={(e) => update("department", e.target.value)}>
              <option value="">Select a department</option>
              {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
        )}
        <p className="muted" style={{ fontSize: "0.82rem" }}>
          The role you pick above is this user's permission group too — whatever "{selectedGroup?.name}"
          is allowed to do on the{" "}
          <a href="/staff/groups" target="_blank" rel="noreferrer">Permission groups</a> page is exactly
          what this account will be able to do.
        </p>
        <button className="btn btn-success" disabled={saving}>{saving ? "Creating…" : "Create user"}</button>
      </form>
    </div>
  );
}
