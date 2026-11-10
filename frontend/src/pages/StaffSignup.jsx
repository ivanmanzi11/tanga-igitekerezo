import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import client from "../api/client";

export default function StaffSignup() {
  const navigate = useNavigate();
  const [departments, setDepartments] = useState([]);
  const [form, setForm] = useState({
    username: "", password: "", first_name: "", last_name: "",
    email: "", phone_number: "", role: "officer", department: "",
  });
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    client.get("/departments/").then((res) => setDepartments(res.data.results || res.data));
  }, []);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      await client.post("/auth/staff-signup/", form);
      setDone(true);
    } catch (err) {
      const data = err.response?.data;
      setError(typeof data === "object" ? Object.values(data).flat().join(" ") : "Could not create your account.");
    } finally {
      setSaving(false);
    }
  }

  if (done) {
    return (
      <div className="section container" style={{ maxWidth: 480 }}>
        <div className="card">
          <h2 style={{ marginTop: 0 }}>Account created</h2>
          <p>An administrator needs to approve your account before you can sign in. You'll be able to log in as soon as that happens.</p>
          <button className="btn btn-primary" onClick={() => navigate("/login")}>Go to sign in</button>
        </div>
      </div>
    );
  }

  return (
    <div className="section container" style={{ maxWidth: 480 }}>
      <h1>Staff sign-up</h1>
      <p className="muted">For officers and department heads. An administrator must approve your account before you can sign in.</p>

      <form className="card" onSubmit={handleSubmit}>
        {error && <div className="alert alert-error">{error}</div>}

        <div className="field">
          <label>Username</label>
          <input type="text" required value={form.username} onChange={(e) => update("username", e.target.value)} />
        </div>
        <div className="field">
          <label>Password</label>
          <input type="password" required value={form.password} onChange={(e) => update("password", e.target.value)} />
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
          <label>Role</label>
          <select value={form.role} onChange={(e) => update("role", e.target.value)}>
            <option value="officer">Officer</option>
            <option value="dept_head">Department Head</option>
          </select>
        </div>
        <div className="field">
          <label>Department</label>
          <select required value={form.department} onChange={(e) => update("department", e.target.value)}>
            <option value="">Select a department</option>
            {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>
        <button className="btn btn-primary btn-block" disabled={saving}>{saving ? "Creating…" : "Create account"}</button>
        <p className="muted" style={{ fontSize: "0.85rem", textAlign: "center", marginTop: 14, marginBottom: 0 }}>
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </form>
    </div>
  );
}
