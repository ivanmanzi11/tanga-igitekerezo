import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import client from "../api/client";

export default function CitizenSignup() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [form, setForm] = useState({
    username: "", password: "", first_name: "", last_name: "", email: "", phone_number: "",
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      await client.post("/auth/register/", form);
      await login(form.username, form.password);
      navigate("/staff/my-submissions");
    } catch (err) {
      const data = err.response?.data;
      setError(typeof data === "object" ? Object.values(data).flat().join(" ") : "Could not create your account.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="section container" style={{ maxWidth: 440 }}>
      <h1>Create an account</h1>
      <p className="muted">
        For citizens and employees who want to keep track of everything they've submitted in one
        place. You can still submit anonymously any time — an account just makes it easier to find
        your tracking codes again. No approval needed; you can sign in right away.
      </p>

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
          <label>Phone</label>
          <input type="tel" value={form.phone_number} onChange={(e) => update("phone_number", e.target.value)} />
        </div>
        <button className="btn btn-primary btn-block" disabled={saving}>{saving ? "Creating…" : "Create account"}</button>
        <p className="muted" style={{ fontSize: "0.85rem", textAlign: "center", marginTop: 14, marginBottom: 0 }}>
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </form>
    </div>
  );
}
