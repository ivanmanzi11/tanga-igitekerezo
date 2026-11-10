import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import client, { API_ROOT } from "../api/client";


function imageUrl(path) {
  if (!path) return null;
  return path.startsWith("http") ? path : `${API_ROOT}${path}`;
}

function initials(user) {
  const name = `${user.first_name || ""} ${user.last_name || ""}`.trim() || user.username;
  return name.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase();
}

export default function Profile() {
  const { user, setUser } = useAuth();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    first_name: user.first_name || "",
    last_name: user.last_name || "",
    email: user.email || "",
    phone_number: user.phone_number || "",
  });
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(imageUrl(user.profile_image));
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");

  function onFileChange(e) {
    const f = e.target.files[0];
    setFile(f);
    if (f) setPreview(URL.createObjectURL(f));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setNotice("");
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => fd.append(k, v));
      if (file) fd.append("profile_image", file);
      const { data } = await client.patch("/auth/me/", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setUser(data);
      setNotice("Profile updated.");
      setEditing(false);
    } catch {
      setNotice("Could not update your profile.");
    } finally {
      setSaving(false);
    }
  }

  const displayName = (user.first_name || user.last_name)
    ? `${user.first_name} ${user.last_name}`.trim() : user.username;

  return (
    <div style={{ maxWidth: 640 }}>
      <Link to="/staff/settings" className="btn btn-outline btn-sm" style={{ marginBottom: 16, display: "inline-flex" }}>
        ← Back to Settings
      </Link>
      {notice && <div className="alert alert-success">{notice}</div>}

      <div className="card" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap", marginBottom: 20 }}>
        <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
          <span className="avatar-circle avatar-lg">
            {preview ? <img src={preview} alt="" /> : initials(user)}
          </span>
          <div>
            <h2 style={{ margin: "0 0 4px" }}>{displayName}</h2>
            <div className="muted" style={{ fontSize: "0.88rem", marginBottom: 8 }}>@{user.username}</div>
            <span className="role-pill" style={{ marginLeft: 0 }}>{user.role.replace("_", " ")}</span>
            <span className="role-pill status-pill">{user.is_active ? "Active" : "Disabled"}</span>
          </div>
        </div>
        <button className="btn btn-warning btn-sm" onClick={() => setEditing((e) => !e)}>
          {editing ? "Cancel" : "✎ Edit Profile"}
        </button>
      </div>

      {editing ? (
        <form className="card" onSubmit={handleSubmit} style={{ marginBottom: 20 }}>
          <div className="field">
            <label>Photo</label>
            <input type="file" accept="image/*" onChange={onFileChange} />
          </div>
          <div className="field">
            <label>First name</label>
            <input type="text" value={form.first_name} onChange={(e) => setForm((f) => ({ ...f, first_name: e.target.value }))} />
          </div>
          <div className="field">
            <label>Last name</label>
            <input type="text" value={form.last_name} onChange={(e) => setForm((f) => ({ ...f, last_name: e.target.value }))} />
          </div>
          <div className="field">
            <label>Email</label>
            <input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
          </div>
          <div className="field">
            <label>Phone</label>
            <input type="tel" value={form.phone_number} onChange={(e) => setForm((f) => ({ ...f, phone_number: e.target.value }))} />
          </div>
          <button className="btn btn-success" disabled={saving}>{saving ? "Saving…" : "Save changes"}</button>
        </form>
      ) : (
        <div className="card" style={{ marginBottom: 20 }}>
          <h3 style={{ marginTop: 0 }}>Personal Information</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
            <div>
              <div className="muted" style={{ fontSize: "0.78rem" }}>Full name</div>
              <div style={{ fontWeight: 600 }}>{displayName}</div>
            </div>
            <div>
              <div className="muted" style={{ fontSize: "0.78rem" }}>Email</div>
              <div style={{ fontWeight: 600 }}>{user.email || "—"}</div>
            </div>
            <div>
              <div className="muted" style={{ fontSize: "0.78rem" }}>Username</div>
              <div style={{ fontWeight: 600 }}>@{user.username}</div>
            </div>
            <div>
              <div className="muted" style={{ fontSize: "0.78rem" }}>Phone</div>
              <div style={{ fontWeight: 600 }}>{user.phone_number || "—"}</div>
            </div>
            <div>
              <div className="muted" style={{ fontSize: "0.78rem" }}>Department</div>
              <div style={{ fontWeight: 600 }}>{user.department_name || "—"}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
