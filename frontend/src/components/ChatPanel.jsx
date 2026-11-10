import { useEffect, useRef, useState } from "react";

// General2 GEN_02: the shared WhatsApp-style thread + composer used by the
// internal-conversation popup and by the case page. Every message has a
// downward chevron that opens its actions: reply, edit (your own), delete
// (your own — admins can delete any) and pin / unpin.
//
// Messages are expected in one shape: { id, sender, sender_name, text,
// attachment, created_at, reply_to: {id, sender_name, text, deleted} | null,
// edited, deleted, pinned }.
export default function ChatPanel({
  messages, userId, isAdmin = false, showSender = true, error = "",
  onSend, onEdit, onDelete, onPin, style,
}) {
  const [draft, setDraft] = useState("");
  const [replyTo, setReplyTo] = useState(null);
  const [editing, setEditing] = useState(null);
  const [menuFor, setMenuFor] = useState(null);
  const [showPins, setShowPins] = useState(false);
  const [busy, setBusy] = useState(false);
  const threadRef = useRef(null);
  const stickToBottom = useRef(true);

  // Keep the view pinned to the newest message unless the reader scrolled up.
  useEffect(() => {
    const el = threadRef.current;
    if (el && stickToBottom.current) el.scrollTop = el.scrollHeight;
  }, [messages]);

  useEffect(() => {
    if (menuFor === null) return;
    function close() { setMenuFor(null); }
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [menuFor]);

  function onScroll(e) {
    const el = e.currentTarget;
    stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
  }

  function jumpTo(id) {
    const el = threadRef.current?.querySelector(`[data-mid="${id}"]`);
    if (!el) return;
    el.scrollIntoView({ block: "center", behavior: "smooth" });
    el.classList.add("is-flash");
    setTimeout(() => el.classList.remove("is-flash"), 1400);
  }

  function startReply(m) { setEditing(null); setReplyTo(m); setMenuFor(null); }
  function startEdit(m) { setReplyTo(null); setEditing(m); setDraft(m.text); setMenuFor(null); }
  function cancelCompose() { setReplyTo(null); setEditing(null); setDraft(""); }

  async function submit(e) {
    e.preventDefault();
    const body = draft.trim();
    if (!body || busy) return;
    setBusy(true);
    try {
      if (editing) {
        await onEdit(editing.id, body);
      } else {
        stickToBottom.current = true;
        await onSend(body, replyTo ? replyTo.id : null);
      }
      cancelCompose();
    } catch {
      /* the parent shows the error; keep the draft so nothing is lost */
    } finally {
      setBusy(false);
    }
  }

  async function remove(m) {
    setMenuFor(null);
    if (!window.confirm("Delete this message for everyone?")) return;
    try { await onDelete(m.id); } catch { /* parent shows the error */ }
  }

  const pinned = messages.filter((m) => m.pinned && !m.deleted);

  return (
    <div className="chatpanel" style={style}>
      {pinned.length > 0 && (
        <div className="chatpanel-pins">
          <button type="button" className="chatpanel-pin-bar" onClick={() => setShowPins((v) => !v)}>
            <span>📌 {pinned.length} pinned message{pinned.length > 1 ? "s" : ""}</span>
            <span className={`chatpanel-chevron ${showPins ? "is-open" : ""}`}>▾</span>
          </button>
          {showPins ? (
            <div className="chatpanel-pin-list">
              {pinned.map((m) => (
                <button type="button" key={m.id} className="chatpanel-pin-item" onClick={() => jumpTo(m.id)}>
                  <strong>{m.sender_name}</strong>: {m.text.slice(0, 90)}
                </button>
              ))}
            </div>
          ) : (
            <button type="button" className="chatpanel-pin-item" onClick={() => jumpTo(pinned[pinned.length - 1].id)}>
              <strong>{pinned[pinned.length - 1].sender_name}</strong>: {pinned[pinned.length - 1].text.slice(0, 90)}
            </button>
          )}
        </div>
      )}

      <div className="chatpanel-thread" ref={threadRef} onScroll={onScroll}>
        <div className="chat-thread">
          {messages.length === 0 && <p className="muted" style={{ fontSize: "0.85rem" }}>No messages yet — say hello.</p>}
          {messages.map((m) => {
            const mine = m.sender === userId;
            const canEdit = mine && !m.deleted;
            const canDelete = (mine || isAdmin) && !m.deleted;
            return (
              <div key={m.id} data-mid={m.id} className={`chat-row ${mine ? "from-staff" : "from-owner"}`}>
                <div className={`chat-bubble chatpanel-bubble ${m.deleted ? "is-deleted" : ""}`}>
                  {!m.deleted && (
                    <button
                      type="button"
                      className="chatpanel-chevron-btn"
                      aria-label="Message options"
                      aria-haspopup="menu"
                      onMouseDown={(e) => e.stopPropagation()}
                      onClick={() => setMenuFor((cur) => (cur === m.id ? null : m.id))}
                    >
                      ▾
                    </button>
                  )}
                  {menuFor === m.id && (
                    <div className="chatpanel-menu" role="menu" onMouseDown={(e) => e.stopPropagation()}>
                      <button role="menuitem" type="button" onClick={() => startReply(m)}>↩ Reply</button>
                      {canEdit && <button role="menuitem" type="button" onClick={() => startEdit(m)}>✎ Edit</button>}
                      <button role="menuitem" type="button" onClick={() => { setMenuFor(null); onPin(m.id).catch(() => {}); }}>
                        📌 {m.pinned ? "Unpin" : "Pin"}
                      </button>
                      {canDelete && <button role="menuitem" type="button" className="is-danger" onClick={() => remove(m)}>🗑 Delete</button>}
                    </div>
                  )}

                  {showSender && !mine && (
                    <div className="chat-meta" style={{ marginTop: 0, marginBottom: 2, fontWeight: 600 }}>{m.sender_name}</div>
                  )}
                  {m.reply_to && (
                    <button type="button" className="chatpanel-quote" onClick={() => jumpTo(m.reply_to.id)}>
                      <strong>{m.reply_to.sender_name}</strong>
                      <span>{m.reply_to.deleted ? "Message deleted" : m.reply_to.text}</span>
                    </button>
                  )}
                  {m.deleted ? (
                    <p className="chatpanel-deleted">🚫 This message was deleted</p>
                  ) : (
                    <>
                      {m.text && <p>{m.text}</p>}
                      {m.attachment && <a className="chat-attachment" href={m.attachment} target="_blank" rel="noreferrer">📎 Attachment</a>}
                    </>
                  )}
                  <div className="chat-meta">
                    {m.pinned && !m.deleted && "📌 "}
                    {new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    {m.edited && !m.deleted && " · edited"}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {error && <div className="alert alert-error" style={{ margin: "0 10px 6px", padding: "6px 10px", fontSize: "0.8rem" }}>{error}</div>}

      {(replyTo || editing) && (
        <div className="chatpanel-compose-bar">
          <div>
            <strong>{editing ? "Editing message" : `Replying to ${replyTo.sender_name}`}</strong>
            {!editing && <span>{replyTo.text.slice(0, 80)}</span>}
          </div>
          <button type="button" onClick={cancelCompose} aria-label="Cancel">✕</button>
        </div>
      )}
      <form className="chat-widget-composer" onSubmit={submit}>
        <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={editing ? "Edit your message…" : "Type a message…"} />
        <button type="submit" disabled={!draft.trim() || busy} aria-label={editing ? "Save" : "Send"}>{editing ? "✓" : "➤"}</button>
      </form>
    </div>
  );
}
