import { useState } from "react";
import { useNavigate } from "react-router-dom";
import client from "../api/client";

export default function ChangePassword() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ current_password: "", new_password: "", confirm_password: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setNotice("");
    if (form.new_password !== form.confirm_password) {
      setError("New password and confirmation don't match.");
      return;
    }
    setSaving(true);
    try {
      await client.post("/auth/change-password/", {
        current_password: form.current_password,
        new_password: form.new_password,
      });
      setNotice("Password changed successfully.");
      setForm({ current_password: "", new_password: "", confirm_password: "" });
    } catch (err) {
      const data = err.response?.data;
      setError(typeof data === "object" ? Object.values(data).flat().join(" ") : "Could not change your password.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ maxWidth: 440 }}>
      <button className="btn btn-outline btn-sm" onClick={() => navigate("/staff/settings")} style={{ marginBottom: 16 }}>
        ← Back to Settings
      </button>
      <h1>Change password</h1>
      <p className="muted">Update the password you use to sign in.</p>

      <form className="card" onSubmit={handleSubmit}>
        {error && <div className="alert alert-error">{error}</div>}
        {notice && <div className="alert alert-success">{notice}</div>}

        <div className="field">
          <label>Current password</label>
          <input
            type="password" required value={form.current_password}
            onChange={(e) => setForm((f) => ({ ...f, current_password: e.target.value }))}
          />
        </div>
        <div className="field">
          <label>New password</label>
          <input
            type="password" required value={form.new_password}
            onChange={(e) => setForm((f) => ({ ...f, new_password: e.target.value }))}
          />
        </div>
        <div className="field">
          <label>Confirm new password</label>
          <input
            type="password" required value={form.confirm_password}
            onChange={(e) => setForm((f) => ({ ...f, confirm_password: e.target.value }))}
          />
        </div>
        <button className="btn btn-primary" disabled={saving}>{saving ? "Updating…" : "Change password"}</button>
      </form>
    </div>
  );
}
