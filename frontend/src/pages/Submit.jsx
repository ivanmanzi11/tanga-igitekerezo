import FileUploader from "../components/FileUploader";
import UploadProgress, { useUploadProgress } from "../components/UploadProgress";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import client from "../api/client";
import { useAuth } from "../context/AuthContext";

const TYPES = [
  { value: "anonymous", title: "Anonymous", body: "No name collected. Use your tracking code to follow up." },
  { value: "confidential", title: "Confidential", body: "Your identity is recorded but restricted to authorized staff only." },
  { value: "identified", title: "Identified", body: "A normal submission under your name." },
];

// General3 GEN_04: the tracking code of an anonymous case is remembered ONLY on this
// device (never on the server), so the person can find it again under My submissions.
function rememberCode(code, title) {
  try {
    const list = JSON.parse(localStorage.getItem("tgk_my_codes")) || [];
    if (!list.some((c) => c.code === code)) {
      list.unshift({ code, title: title.slice(0, 80), at: new Date().toISOString() });
      localStorage.setItem("tgk_my_codes", JSON.stringify(list.slice(0, 100)));
    }
  } catch { /* storage unavailable — the code is still shown on screen */ }
}

export default function Submit() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [categories, setCategories] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [form, setForm] = useState({
    submission_type: "anonymous",
    category: "",
    department: "",
    title: "",
    description: "",
    submitter_name: "",
    submitter_email: "",
    submitter_phone: "",
  });
  const [files, setFiles] = useState([]);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const upload = useUploadProgress();
  const [result, setResult] = useState(null);
  // General3 GEN_03: the admin can switch Confidential / Identified off; anonymous is always on.
  const [enabledTypes, setEnabledTypes] = useState(["anonymous"]);

  useEffect(() => {
    client.get("/submission-options/").then((res) => setEnabledTypes(res.data.enabled_types)).catch(() => {});
    client.get("/categories/").then((res) => setCategories(res.data.results || res.data));
    client.get("/departments/").then((res) => setDepartments(res.data.results || res.data));
  }, []);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    if (files.length > 0) upload.start();
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([key, value]) => {
        if (form.submission_type === "anonymous" && ["submitter_name", "submitter_email", "submitter_phone"].includes(key)) {
          return;
        }
        if (value !== "" && value !== null && value !== undefined) fd.append(key, value);
      });
      files.forEach((f) => fd.append("attachments", f));

      const anonymous = form.submission_type === "anonymous";
      const { data } = await client.post("/submissions/", fd, {
        headers: { "Content-Type": "multipart/form-data" },
        skipAuth: anonymous, // General3 GEN_04: an anonymous case never carries the account token
        ...(files.length > 0 ? upload.config : {}),
      });
      if (anonymous) rememberCode(data.tracking_code, form.title);
      setResult(data);
    } catch (err) {
      const data = err.response?.data;
      setError(
        typeof data === "object" ? Object.values(data).flat().join(" ") : "Something went wrong. Please try again."
      );
    } finally {
      setSubmitting(false);
      upload.reset();
    }
  }

  if (result) {
    return (
      <div className="section container" style={{ maxWidth: 640 }}>
        {/* General2 GEN_01: the confirmation is always readable — the ticket has
            its own fixed dark background and light text in both themes. */}
        <div className="ticket" role="status" aria-live="polite">
          <h2 className="submit-success-title"><span className="tick" aria-hidden="true">✓</span>Submitted successfully</h2>
          <p className="ticket-note" style={{ marginBottom: 18 }}>Thank you — we've received your submission.</p>
          <div className="ticket-label">YOUR TRACKING CODE</div>
          <div className="ticket-code">{result.tracking_code}</div>
          <p className="ticket-note">
            {user && user.role === "citizen"
              ? "This code is also saved under “My submissions” in your account — even if you sent it anonymously (staff still can't see who you are)."
              : "Save this code — it's the only way to follow an anonymous submission's progress. We'll show you every status update and response here."}
          </p>
        </div>
        <div style={{ display: "flex", gap: 12, marginTop: 24 }}>
          <button className="btn btn-primary" onClick={() => navigate(`/track?code=${result.tracking_code}`)}>
            Track this submission
          </button>
          <button className="btn btn-outline" onClick={() => { setResult(null); setForm({ ...form, title: "", description: "" }); }}>
            Submit another
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="section container" style={{ maxWidth: 720 }}>
      <h1>Submit a suggestion, complaint, appreciation, or anything else</h1>
      <p className="muted">Choose how much you'd like to share. All three options are answered the same way.</p>
      <p className="muted" style={{ fontSize: "0.88rem", marginTop: -6 }}>
        No smartphone? You can also dial <strong>*502#</strong> on any phone — <Link to="/access#ussd">see how</Link>.
      </p>

      <form className="card" onSubmit={handleSubmit} style={{ marginTop: 24 }}>
        {error && <div className="alert alert-error">{error}</div>}

        <div className="field">
          <label>{enabledTypes.length > 1 ? "How would you like to submit?" : "Submitting anonymously"}</label>
          <div className="radio-cards">
            {TYPES.filter((t) => enabledTypes.includes(t.value)).map((t) => (
              <div
                key={t.value}
                className={`radio-card ${form.submission_type === t.value ? "selected" : ""}`}
                onClick={() => update("submission_type", t.value)}
              >
                <h4>{t.title}</h4>
                <p>{t.body}</p>
              </div>
            ))}
          </div>
        </div>

        {form.submission_type === "anonymous" && (
          <div className="privacy-panel" role="note">
            <strong>🔒 Your anonymity is protected</strong>
            <ul>
              <li>No name, email, phone number or account is stored with your case.</li>
              <li>Your IP address, browser and device details are not recorded.</li>
              <li>Photos are stripped of hidden location and camera data, and every file is renamed.</li>
              <li>Documents (Word, PDF) can contain your name inside them — remove it before attaching.</li>
              <li>Avoid writing details in the text that would identify you.</li>
            </ul>
          </div>
        )}

        <div className="field">
          <label>Category</label>
          <select required value={form.category} onChange={(e) => update("category", e.target.value)}>
            <option value="">Select a category</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        <div className="field">
          <label>Department or service (if known)</label>
          <select value={form.department} onChange={(e) => update("department", e.target.value)}>
            <option value="">Not sure / general</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </div>

        <div className="field">
          <label>Title</label>
          <input
            type="text" required maxLength={200}
            value={form.title} onChange={(e) => update("title", e.target.value)}
            placeholder="A short summary"
          />
        </div>

        <div className="field">
          <label>Description</label>
          <textarea
            required value={form.description}
            onChange={(e) => update("description", e.target.value)}
            placeholder="Explain the idea, problem, or feedback in as much detail as helps."
          />
        </div>

        <div className="field">
          <label>Attachments (optional)</label>
          <FileUploader files={files} onChange={setFiles} label="Attach supporting files" />
          {files.length > 0 && (
            <div className="field-hint">{files.length} file(s) ready — they'll be submitted together with your report.</div>
          )}
        </div>

        {form.submission_type !== "anonymous" && (
          <>
            <hr className="divider" />
            <div className="field">
              <label>Your name</label>
              <input type="text" required value={form.submitter_name} onChange={(e) => update("submitter_name", e.target.value)} />
            </div>
            <div className="field">
              <label>Email</label>
              <input type="email" value={form.submitter_email} onChange={(e) => update("submitter_email", e.target.value)} />
            </div>
            <div className="field">
              <label>Phone</label>
              <input type="tel" value={form.submitter_phone} onChange={(e) => update("submitter_phone", e.target.value)} />
              <div className="field-hint">Provide at least an email or a phone number.</div>
            </div>
            {form.submission_type === "confidential" && (
              <div className="field-hint">
                Your name and contact details will be visible only to the department head or officer
                authorized to handle this submission — never published or shared more widely.
              </div>
            )}
          </>
        )}

        <UploadProgress percent={upload.percent} fileCount={files.length} />

        <button className="btn btn-primary btn-block" type="submit" disabled={submitting}>
          {submitting ? (files.length > 0 ? "Uploading…" : "Submitting…") : "Submit"}
        </button>
      </form>
    </div>
  );
}
