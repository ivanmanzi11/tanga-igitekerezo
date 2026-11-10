import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import client from "../api/client";
import UploadProgress, { useUploadProgress } from "../components/UploadProgress";
import StatusBadge from "../components/StatusBadge";
import Modal from "../components/Modal";
import ReadMore from "../components/ReadMore";
import FileUploader from "../components/FileUploader";
import SatisfactionSurvey from "../components/SatisfactionSurvey";

const RESPONSES_PREVIEW_COUNT = 3;

function ChatBubble({ r }) {
  const side = r.is_from_owner ? "from-staff" : "from-owner";
  // On the owner's own tracking page, flip the sides so *their* messages
  // appear on the right, like a normal chat from their point of view.
  return (
    <div className={`chat-row ${side}`}>
      <div className="chat-bubble">
        <p>{r.message}</p>
        {r.attachment && <a className="chat-attachment" href={r.attachment} target="_blank" rel="noreferrer">📎 Attachment</a>}
        <div className="chat-meta">{r.is_from_owner ? "You" : r.responder_name} · {new Date(r.created_at).toLocaleString()}</div>
      </div>
    </div>
  );
}

export default function Track() {
  const upload = useUploadProgress();
  const [params] = useSearchParams();
  const [code, setCode] = useState(params.get("code") || "");
  const [submission, setSubmission] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showAllResponses, setShowAllResponses] = useState(false);
  const [reply, setReply] = useState("");
  const [replyFile, setReplyFile] = useState(null);
  const [sending, setSending] = useState(false);

  async function lookup(e) {
    e?.preventDefault();
    if (!code.trim()) return;
    setError("");
    setLoading(true);
    setSubmission(null);
    try {
      const { data } = await client.get(`/track/${code.trim()}/`);
      setSubmission(data);
    } catch (err) {
      setError(err.response?.status === 404
        ? "No submission found with that tracking code. Double-check and try again."
        : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function sendReply(e) {
    e.preventDefault();
    if (!reply.trim()) return;
    setSending(true);
    if (replyFile) upload.start();
    try {
      const fd = new FormData();
      fd.append("message", reply);
      if (replyFile) fd.append("attachment", replyFile);
      const { data } = await client.post(`/track/${code.trim()}/reply/`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
        ...(replyFile ? upload.config : {}),
      });
      setSubmission(data);
      setReply("");
      setReplyFile(null);
    } catch {
      upload.reset();
      setError("Could not send your reply. Please try again.");
    } finally {
      setSending(false);
    }
  }

  useEffect(() => {
    if (params.get("code")) lookup();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="section container" style={{ maxWidth: 720 }}>
      <h1>Track a submission</h1>
      <p className="muted">Enter the tracking code you received when you submitted.</p>

      <form className="card" onSubmit={lookup} style={{ display: "flex", gap: 12, alignItems: "flex-end", marginTop: 20 }}>
        <div className="field" style={{ flex: 1, marginBottom: 0 }}>
          <label>Tracking code</label>
          <input type="text" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} autoCapitalize="characters" autoCorrect="off" spellCheck={false} placeholder="TGC-2026-10-05-0127" />
        </div>
        <button className="btn btn-primary" type="submit" disabled={loading}>
          {loading ? "Looking up…" : "Track"}
        </button>
      </form>

      {error && <div className="alert alert-error" style={{ marginTop: 20 }}>{error}</div>}

      {submission && (
        <div className="card" style={{ marginTop: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
            <div>
              <div className="muted" style={{ fontSize: "0.85rem" }}>{submission.tracking_code} · {submission.category}</div>
              <ReadMore as="h2" text={submission.title} lines={2} style={{ marginBottom: 4 }} textStyle={{ margin: 0 }} />
            </div>
            <StatusBadge status={submission.status} />
          </div>

          {submission.status === "needs_info" && (
            <div className="alert" style={{ background: "#fdf1de", color: "#93611c", border: "1px solid #f0dcae" }}>
              The institution has asked for more information — see the conversation below and reply when ready.
            </div>
          )}

          {submission.can_rate && (
            <SatisfactionSurvey
              code={submission.tracking_code}
              rating={submission.satisfaction_rating}
              comment={submission.satisfaction_comment}
              onRated={(data) => setSubmission(data)}
            />
          )}

          <hr className="divider" />

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h3 style={{ fontSize: "1rem", margin: 0 }}>Progress</h3>
            {submission.status_history.length > 3 && (
              <button className="btn btn-info btn-sm" onClick={() => setShowHistory(true)}>View full history</button>
            )}
          </div>
          <ul className="timeline" style={{ marginTop: 12 }}>
            {submission.status_history.slice(-3).map((h) => (
              <li key={h.id}>
                <StatusBadge status={h.new_status} />
                {h.note && <p style={{ margin: "6px 0 2px" }}>{h.note}</p>}
                <div className="timeline-time">{new Date(h.changed_at).toLocaleString()}</div>
              </li>
            ))}
          </ul>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 24 }}>
            <h3 style={{ fontSize: "1rem", margin: 0 }}>Conversation</h3>
          </div>

          {submission.responses.length === 0 && <p className="muted" style={{ fontSize: "0.9rem", marginTop: 10 }}>No messages yet.</p>}

          <div className="chat-thread" style={{ marginTop: 12 }}>
            {submission.responses.slice(-RESPONSES_PREVIEW_COUNT).map((r) => <ChatBubble key={r.id} r={r} />)}
          </div>
          {submission.responses.length > RESPONSES_PREVIEW_COUNT && (
            <button className="btn btn-info btn-sm" style={{ marginTop: 10 }} onClick={() => setShowAllResponses(true)}>
              View {submission.responses.length - RESPONSES_PREVIEW_COUNT} earlier message(s)
            </button>
          )}

          <form onSubmit={sendReply} style={{ marginTop: 16 }}>
            <div className="field">
              <label>Add a message</label>
              <textarea value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Write a reply…" />
            </div>
            <div className="field">
              <label>Attach a file (optional)</label>
              <FileUploader files={replyFile ? [replyFile] : []} multiple={false} onChange={(f) => setReplyFile(f[0] || null)} label="Attach a file to your reply" />
            </div>
            <UploadProgress percent={upload.percent} fileCount={replyFile ? 1 : 0} />
            <button className="btn btn-success" disabled={sending}>{sending ? (replyFile ? "Uploading…" : "Sending…") : "Send"}</button>
          </form>
        </div>
      )}

      {submission && showHistory && (
        <Modal title="Full history" onClose={() => setShowHistory(false)}>
          <ul className="timeline">
            {submission.status_history.map((h) => (
              <li key={h.id}>
                <StatusBadge status={h.new_status} />
                {h.note && <p style={{ margin: "6px 0 2px" }}>{h.note}</p>}
                <div className="timeline-time">{new Date(h.changed_at).toLocaleString()}</div>
              </li>
            ))}
          </ul>
        </Modal>
      )}

      {submission && showAllResponses && (
        <Modal title="Full conversation" onClose={() => setShowAllResponses(false)}>
          <div className="chat-thread">
            {submission.responses.map((r) => <ChatBubble key={r.id} r={r} />)}
          </div>
        </Modal>
      )}
    </div>
  );
}
