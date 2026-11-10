import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import client from "../api/client";
import { useAuth } from "../context/AuthContext";
import StatusBadge from "../components/StatusBadge";
import Modal from "../components/Modal";
import ReadMore from "../components/ReadMore";
import FileUploader from "../components/FileUploader";
import ChatPanel from "../components/ChatPanel";
import UploadProgress, { useUploadProgress } from "../components/UploadProgress";

const MANUAL_STATUSES = [
  { value: "resolved", label: "Mark as resolved" },
  { value: "needs_info", label: "Request more information" },
];

const RESPONSES_PREVIEW_COUNT = 3;

function ChatBubble({ r }) {
  const side = r.is_from_owner ? "from-owner" : "from-staff";
  return (
    <div className={`chat-row ${side}`}>
      <div className="chat-bubble">
        <p>{r.message}</p>
        {r.attachment && (
          <a className="chat-attachment" href={r.attachment} target="_blank" rel="noreferrer">📎 Attachment</a>
        )}
        <div className="chat-meta">{r.responder_name} · {new Date(r.created_at).toLocaleString()}</div>
      </div>
    </div>
  );
}

export default function SubmissionDetail() {
  const upload = useUploadProgress();
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, hasPermission } = useAuth();
  const [submission, setSubmission] = useState(null);
  const [departments, setDepartments] = useState([]);
  const [staffUsers, setStaffUsers] = useState([]);
  const [message, setMessage] = useState("");
  const [responseFile, setResponseFile] = useState(null);
  const [isInfoRequest, setIsInfoRequest] = useState(false);
  const [assignDept, setAssignDept] = useState("");
  const [assignUser, setAssignUser] = useState("");
  const [statusChoice, setStatusChoice] = useState("resolved");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const [showAllResponses, setShowAllResponses] = useState(false);
  const [showInternalChat, setShowInternalChat] = useState(false);
  const [internalMessages, setInternalMessages] = useState([]);
  const [internalError, setInternalError] = useState("");
  const [downloading, setDownloading] = useState(false);

  function load() {
    client.get(`/submissions/${id}/`).then((res) => setSubmission(res.data));
  }

  useEffect(() => {
    load();
    client.get("/departments/").then((res) => setDepartments(res.data.results || res.data));
    if (user?.role === "admin" || hasPermission("can_assign_cases")) {
      client.get("/staff-users/", { params: { all: "true", page_size: 500 } }).then((res) => setStaffUsers(res.data.results || res.data)).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const effectiveDeptId = assignDept || submission?.department || "";
  const filteredStaff = useMemo(() => {
    if (!effectiveDeptId) return staffUsers.filter((u) => u.role !== "citizen");
    return staffUsers.filter((u) => String(u.department) === String(effectiveDeptId));
  }, [staffUsers, effectiveDeptId]);

  function handleDeptChange(value) {
    setAssignDept(value);
    setAssignUser("");
  }

  async function handleAssign(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const payload = {};
      if (assignDept) payload.department = assignDept;
      if (assignUser) payload.assigned_to = assignUser;
      await client.post(`/submissions/${id}/assign/`, payload);
      setNotice("Assigned.");
      setAssignDept("");
      setAssignUser("");
      load();
    } catch (err) {
      setNotice(err.response?.data?.assigned_to?.[0] || err.response?.data?.detail || "Could not assign.");
    } finally {
      setBusy(false);
    }
  }

  async function handleStatus(e) {
    e.preventDefault();
    setBusy(true);
    try {
      await client.post(`/submissions/${id}/set_status/`, { status: statusChoice });
      setNotice("Status updated.");
      load();
    } finally {
      setBusy(false);
    }
  }

  async function handleRespond(e) {
    e.preventDefault();
    if (!message.trim()) return;
    setBusy(true);
    if (responseFile) upload.start();
    try {
      const fd = new FormData();
      fd.append("message", message);
      fd.append("is_request_for_info", isInfoRequest);
      if (responseFile) fd.append("attachment", responseFile);
      await client.post(`/submissions/${id}/respond/`, fd, { headers: { "Content-Type": "multipart/form-data" }, ...(responseFile ? upload.config : {}) });
      setMessage("");
      setResponseFile(null);
      setIsInfoRequest(false);
      setNotice("Response sent.");
      load();
    } finally {
      setBusy(false);
      upload.reset();
    }
  }

  async function loadInternalMessages() {
    try {
      const { data } = await client.get(`/submissions/${id}/messages/`);
      setInternalMessages(data);
    } catch (err) {
      setInternalError(err.response?.data?.detail || "Could not load the conversation.");
    }
  }

  async function openInternalChat() {
    setInternalError("");
    setShowInternalChat(true);
  }

  // General2 GEN_03: while the conversation is open it refreshes on its own,
  // so colleagues' messages appear without closing and re-opening it.
  useEffect(() => {
    if (!showInternalChat) return;
    loadInternalMessages();
    const interval = setInterval(loadInternalMessages, 4000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showInternalChat, id]);

  // General2 GEN_02: same reply / edit / delete / pin actions as the popup.
  async function sendInternalMessage(body, replyToId) {
    setInternalError("");
    try {
      await client.post(`/submissions/${id}/messages/`, { message: body, reply_to: replyToId });
      loadInternalMessages();
    } catch (err) {
      setInternalError(err.response?.data?.detail || "Your message could not be sent. Please try again.");
      throw err;
    }
  }

  async function internalMessageOp(messageId, op, payload = {}) {
    setInternalError("");
    try {
      const { data } = await client.post(`/submissions/${id}/messages/${messageId}/${op}/`, payload);
      setInternalMessages((list) => list.map((m) => (m.id === data.id ? data : m)));
    } catch (err) {
      setInternalError(err.response?.data?.detail || "That didn't work. Please try again.");
      throw err;
    }
  }

  async function downloadReport() {
    setDownloading(true);
    try {
      const res = await client.get(`/reports/cases/${id}/`, { params: { filetype: "pdf" }, responseType: "blob" });
      const url = window.URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${submission.tracking_code}_report.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } finally {
      setDownloading(false);
    }
  }

  if (!submission) return <div className="container section">Loading…</div>;

  // Admin2 ADM_01: assigning/responding now requires the matching group
  // permission (admins always have it) rather than just being a dept head.
  const canAssign = hasPermission("can_assign_cases");
  const canRespond = hasPermission("can_respond_to_cases");
  const visibleResponses = submission.responses.slice(0, RESPONSES_PREVIEW_COUNT);
  const extraResponsesCount = submission.responses.length - RESPONSES_PREVIEW_COUNT;
  const latestHistory = submission.status_history[submission.status_history.length - 1];

  return (
    <div>
      <button className="btn btn-outline btn-sm" onClick={() => navigate(-1)} style={{ marginBottom: 16 }}>
        ← Back
      </button>

      {notice && <div className="alert alert-success">{notice}</div>}

      <div className="two-col">
        <div>
          <div className="card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <div className="muted" style={{ fontSize: "0.85rem" }}>{submission.tracking_code}</div>
                <ReadMore as="h2" text={submission.title} lines={2} style={{ margin: "4px 0" }} textStyle={{ margin: 0 }} />
                <div className="submission-meta-chips">
                  <span className="meta-chip">📁 {submission.submission_type}</span>
                  {submission.category_detail?.name && <span className="meta-chip">🏷 {submission.category_detail.name}</span>}
                  {submission.priority !== "low" && (
                    <span className={`meta-chip priority-${submission.priority}`}>⚑ {submission.priority} priority</span>
                  )}
                </div>
              </div>
              <StatusBadge status={submission.status} />
            </div>
            <div className="submission-content-box">
              <span className="label">Description</span>
              <ReadMore text={submission.description} lines={3} />
            </div>

            {submission.attachments.length > 0 && (
              <div style={{ marginTop: 12 }}>
                <strong style={{ fontSize: "0.85rem" }}>Attachments:</strong>{" "}
                {submission.attachments.map((a) => (
                  <a key={a.id} href={a.file} target="_blank" rel="noreferrer" style={{ marginRight: 10 }}>
                    {a.original_name || "file"}
                  </a>
                ))}
              </div>
            )}

            <hr className="divider" />
            <h3 style={{ fontSize: "0.95rem" }}>Submitter identity</h3>
            {submission.identity_visible ? (
              <p style={{ fontSize: "0.9rem" }}>
                {submission.submitter_name} — {submission.submitter_email || "no email"}
                {submission.submitter_phone ? ` — ${submission.submitter_phone}` : ""}
              </p>
            ) : (
              <p className="muted" style={{ fontSize: "0.9rem" }}>
                {submission.submission_type === "anonymous"
                  ? "This submission is anonymous — no identity was collected."
                  : "This is confidential; you are not currently authorized to view the submitter's identity."}
              </p>
            )}
          </div>

          <div className="card" style={{ marginTop: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ margin: 0, fontSize: "0.95rem" }}>Responses</h3>
            </div>
            {submission.responses.length === 0 && <p className="muted" style={{ fontSize: "0.9rem", marginTop: 10 }}>No responses yet.</p>}
            <div className="chat-thread" style={{ marginTop: 10 }}>
              {visibleResponses.map((r) => <ChatBubble key={r.id} r={r} />)}
            </div>
            {extraResponsesCount > 0 && (
              <button className="btn btn-info btn-sm" style={{ marginTop: 10 }} onClick={() => setShowAllResponses(true)}>
                Read {extraResponsesCount} more response{extraResponsesCount > 1 ? "s" : ""}
              </button>
            )}
            {canRespond ? (
              <form onSubmit={handleRespond} style={{ marginTop: 14 }}>
                <div className="field">
                  <label>Write a response</label>
                  <textarea value={message} onChange={(e) => setMessage(e.target.value)} />
                </div>
                <div className="field">
                  <label>Attach a file (optional)</label>
                  <FileUploader files={responseFile ? [responseFile] : []} multiple={false} onChange={(f) => setResponseFile(f[0] || null)} label="Attach a file to your response" />
                </div>
                <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: "0.85rem", marginBottom: 12 }}>
                  <input type="checkbox" checked={isInfoRequest} onChange={(e) => setIsInfoRequest(e.target.checked)} />
                  This is a request for more information
                </label>
                <UploadProgress percent={upload.percent} fileCount={responseFile ? 1 : 0} />
                <button className="btn btn-success" disabled={busy}>Send response</button>
              </form>
            ) : (
              <p className="muted" style={{ fontSize: "0.82rem", marginTop: 12 }}>
                You don't have permission to respond to cases. Ask an administrator to add you to a group with that permission.
              </p>
            )}
          </div>

          <div className="card" style={{ marginTop: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ margin: 0, fontSize: "0.95rem" }}>History</h3>
              <button className="btn btn-info btn-sm" onClick={() => setShowHistory(true)}>View full history</button>
            </div>
            {latestHistory && (
              <div style={{ marginTop: 12 }}>
                <StatusBadge status={latestHistory.new_status} />
                {latestHistory.note && <p style={{ margin: "6px 0 2px" }}>{latestHistory.note}</p>}
                <div className="timeline-time">{latestHistory.changed_by_name} · {new Date(latestHistory.changed_at).toLocaleString()}</div>
              </div>
            )}
          </div>
        </div>

        <div>
          {submission.can_message_internally && (
            <div className="card" style={{ marginBottom: 20 }}>
              <h3 style={{ marginTop: 0, fontSize: "0.95rem" }}>Internal conversation</h3>
              <p className="muted" style={{ fontSize: "0.85rem" }}>
                A group channel for everyone working this case — the admin, whoever it's assigned to, and
                anyone in a department it's been routed to. Never visible to the case owner.
              </p>
              <button className="btn btn-info btn-block" onClick={openInternalChat}>💬 Open conversation</button>
            </div>
          )}

          {canAssign && (
            <div className="card">
              <h3 style={{ marginTop: 0, fontSize: "0.95rem" }}>Assign</h3>
              <form onSubmit={handleAssign}>
                <div className="field">
                  <label>Department</label>
                  <select value={assignDept} onChange={(e) => handleDeptChange(e.target.value)}>
                    <option value="">Keep current ({submission.department_detail?.name || "none"})</option>
                    {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label>Assign to staff member</label>
                  <select value={assignUser} onChange={(e) => setAssignUser(e.target.value)}>
                    <option value="">Unassigned</option>
                    {filteredStaff.map((u) => (
                      <option key={u.id} value={u.id}>{u.first_name || u.username} ({u.role})</option>
                    ))}
                  </select>
                  {effectiveDeptId && filteredStaff.length === 0 && (
                    <div className="field-hint">No staff members belong to this department yet.</div>
                  )}
                </div>
                <button className="btn btn-success btn-block" disabled={busy}>Assign</button>
              </form>
            </div>
          )}

          {canRespond && (
            <div className="card" style={{ marginTop: 20 }}>
              <h3 style={{ marginTop: 0, fontSize: "0.95rem" }}>Status</h3>
              <p className="muted" style={{ fontSize: "0.82rem" }}>
                Received, Under Review, Assigned, Responded, and Closed are set automatically by
                the system. You only ever choose between the two below.
              </p>
              <form onSubmit={handleStatus}>
                <div className="field">
                  <select value={statusChoice} onChange={(e) => setStatusChoice(e.target.value)}>
                    {MANUAL_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>
                <button className="btn btn-success btn-block" disabled={busy}>Update status</button>
              </form>
            </div>
          )}

          <div className="card" style={{ marginTop: 20 }}>
            <h3 style={{ marginTop: 0, fontSize: "0.95rem" }}>Details</h3>
            <p style={{ fontSize: "0.85rem" }} className="muted">
              Received: {new Date(submission.created_at).toLocaleString()}
            </p>
            <button className="btn btn-info btn-block" onClick={downloadReport} disabled={downloading}>
              {downloading ? "Preparing…" : "📄 Download case report (PDF)"}
            </button>
          </div>
        </div>
      </div>

      {showHistory && (
        <Modal title="Full history" onClose={() => setShowHistory(false)}>
          <ul className="timeline">
            {submission.status_history.map((h) => (
              <li key={h.id}>
                <StatusBadge status={h.new_status} />
                {h.note && <p style={{ margin: "6px 0 2px" }}>{h.note}</p>}
                <div className="timeline-time">{h.changed_by_name} · {new Date(h.changed_at).toLocaleString()}</div>
              </li>
            ))}
          </ul>
        </Modal>
      )}

      {showAllResponses && (
        <Modal title="All responses" onClose={() => setShowAllResponses(false)}>
          <div className="chat-thread">
            {submission.responses.map((r) => <ChatBubble key={r.id} r={r} />)}
          </div>
        </Modal>
      )}

      {showInternalChat && (
        <Modal title="Internal conversation" onClose={() => setShowInternalChat(false)}>
          <ChatPanel
            style={{ height: 420, border: "1px solid var(--line)", borderRadius: 8 }}
            messages={internalMessages}
            userId={user.id}
            isAdmin={user.role === "admin"}
            error={internalError}
            onSend={sendInternalMessage}
            onEdit={(mid, text) => internalMessageOp(mid, "edit", { text })}
            onDelete={(mid) => internalMessageOp(mid, "delete")}
            onPin={(mid) => internalMessageOp(mid, "pin")}
          />
        </Modal>
      )}
    </div>
  );
}
