import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import client from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { useLanguage } from "../context/LanguageContext";

export default function Settings() {
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { lang, changeLang } = useLanguage();
  // General3 GEN_03: admin switches for the non-anonymous ways of submitting.
  const [options, setOptions] = useState(null);
  const [optionsError, setOptionsError] = useState("");

  useEffect(() => {
    if (user.role === "admin") client.get("/submission-options/").then((r) => setOptions(r.data)).catch(() => {});
  }, [user.role]);

  async function toggleOption(key) {
    setOptionsError("");
    try {
      const { data } = await client.patch("/submission-options/", { [key]: !options[key] });
      setOptions(data);
    } catch {
      setOptionsError("Could not change this setting. Please try again.");
    }
  }

  return (
    <div>
      <p className="muted">Manage your account and how the system looks for you.</p>

      {user.role === "admin" && options && (
        <div className="card" style={{ marginBottom: 24 }}>
          <h3 style={{ marginTop: 0 }}>🛡 Ways of submitting</h3>
          <p className="muted" style={{ fontSize: "0.9rem" }}>
            Anonymous is the default and main purpose of this system, so it is always on. Choose whether people may also
            submit as Confidential or Identified.
          </p>
          {optionsError && <div className="alert alert-error">{optionsError}</div>}
          <div className="option-switches">
            <div className="option-switch is-locked">
              <div><strong>Anonymous</strong><span>No identity is ever collected. Always available.</span></div>
              <span className="switch is-on" aria-label="Anonymous is always on"><i /></span>
            </div>
            {[["confidential", "Confidential", "Identity is recorded but shown only to authorised staff."],
              ["identified", "Identified", "A normal submission under the person's name."]].map(([key, title, body]) => (
              <div className="option-switch" key={key}>
                <div><strong>{title}</strong><span>{body}</span></div>
                <button
                  type="button" role="switch" aria-checked={options[key]} aria-label={`${title} submissions`}
                  className={`switch ${options[key] ? "is-on" : ""}`} onClick={() => toggleOption(key)}
                ><i /></button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="settings-grid">
        <Link to="/staff/profile" className="settings-tile">
          <h4>👤 Profile</h4>
          <p>Update your name, contact details, and profile photo.</p>
        </Link>
        <Link to="/staff/settings/password" className="settings-tile">
          <h4>🔒 Change password</h4>
          <p>Update the password used to sign in.</p>
        </Link>
        <Link to="/staff/reports" className="settings-tile">
          <h4>🧾 Reports</h4>
          <p>Export analytics, a single case, or the full case list.</p>
        </Link>
        {user.role === "admin" && (
          <Link to="/staff/users" className="settings-tile">
            <h4>👥 Manage users</h4>
            <p>Add staff accounts and edit roles, departments, and access.</p>
          </Link>
        )}
        {user.role === "admin" && (
          <Link to="/staff/categories" className="settings-tile">
            <h4>🗂 Categories</h4>
            <p>Add, rename or remove the categories people can submit under.</p>
          </Link>
        )}
        {user.role === "admin" && (
          <Link to="/staff/departments" className="settings-tile">
            <h4>🏢 Departments</h4>
            <p>Create, edit and delete departments and see who belongs to each.</p>
          </Link>
        )}
        {user.role === "admin" && (
          <Link to="/staff/groups" className="settings-tile">
            <h4>🔐 Permission groups</h4>
            <p>Organize staff into groups with specific permissions.</p>
          </Link>
        )}
        <div className="settings-tile" style={{ cursor: "default" }}>
          <h4>🌓 Appearance</h4>
          <p style={{ marginBottom: 12 }}>Switch between light and dark mode.</p>
          <button className="theme-toggle" onClick={toggleTheme} aria-label="Toggle dark mode" />
          <span style={{ marginLeft: 10, fontSize: "0.82rem" }}>{theme === "light" ? "Light" : "Dark"} mode</span>
        </div>
        <div className="settings-tile" style={{ cursor: "default" }}>
          <h4>🌐 Language</h4>
          <p style={{ marginBottom: 12 }}>Choose your preferred language.</p>
          <select
            value={lang} onChange={(e) => changeLang(e.target.value)}
            style={{ padding: "8px 10px", border: "1px solid var(--line)", borderRadius: 3, background: "var(--paper-raised)", color: "var(--ink)" }}
          >
            <option value="en">English</option>
            <option value="rw">Kinyarwanda</option>
            <option value="fr">Français</option>
          </select>
        </div>
      </div>
    </div>
  );
}
