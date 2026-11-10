import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import client from "../api/client";
import { useAuth } from "../context/AuthContext";
import ChatPanel from "./ChatPanel";

function initials(name) {
  return (name || "?").split(" ").filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join("");
}

// General3 GEN_09: the internal conversation is one icon in the header
// (alongside dark/light mode, language, notifications and profile/logout),
// opening a WhatsApp-style popup with a top tab bar: All, DM, Groups, and
// Case groups — the group chat that forms automatically for everyone
// working a given case the moment they're assigned it.
const TABS = [
  { key: "all", label: "All" },
  { key: "dm", label: "DM" },
  { key: "group", label: "Groups" },
  { key: "case", label: "Case groups" },
];

export default function InternalChatWidget() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState("all");
  const [view, setView] = useState("list"); // list | thread | new
  const [conversations, setConversations] = useState([]);
  const [active, setActive] = useState(null);
  const [messages, setMessages] = useState([]);
  const [directory, setDirectory] = useState([]);
  const [newType, setNewType] = useState("dm");
  const [groupName, setGroupName] = useState("");
  const [picked, setPicked] = useState([]);
  const [error, setError] = useState("");

  function loadConversations() {
    client.get("/conversations/").then((res) => setConversations(res.data.results || res.data)).catch(() => {});
  }

  useEffect(() => {
    if (!user || user.role === "citizen") return;
    loadConversations();
    const interval = setInterval(loadConversations, 15000);
    return () => clearInterval(interval);
  }, [user]);

  useEffect(() => {
    if (view !== "thread" || !active) return;
    let cancelled = false;
    function poll() {
      client.get(`/conversations/${active.id}/messages/`).then((res) => {
        if (!cancelled) setMessages(res.data);
      }).catch(() => {});
    }
    poll();
    const interval = setInterval(poll, 4000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [view, active]);

  const filtered = useMemo(() => {
    if (tab === "all") return conversations;
    if (tab === "dm") return conversations.filter((c) => c.kind === "dm");
    if (tab === "group") return conversations.filter((c) => c.kind === "group");
    return conversations.filter((c) => c.kind === "case");
  }, [conversations, tab]);

  function openConversation(conv) {
    setActive(conv);
    setMessages([]);
    setError("");
    setView("thread");
  }

  function openNewChat() {
    setNewType(tab === "group" ? "group" : "dm");
    setGroupName("");
    setPicked([]);
    setError("");
    client.get("/chat-directory/").then((res) => setDirectory(res.data)).catch(() => {});
    setView("new");
  }

  function togglePick(id) {
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : newType === "dm" ? [id] : [...p, id]));
  }

  async function startConversation() {
    if (picked.length === 0) return;
    const payload = { is_group: newType === "group", participant_ids: picked };
    if (newType === "group") payload.name = groupName.trim();
    if (newType === "group" && !payload.name) return;
    setError("");
    try {
      const res = await client.post("/conversations/", payload);
      loadConversations();
      openConversation(res.data);
    } catch (err) {
      setError(err.response?.data?.detail || "Could not start this conversation. Please try again.");
    }
  }

  // General2 GEN_02: send (optionally as a reply), edit, delete and pin.
  // Each one rethrows so the composer keeps what the person typed on failure.
  async function sendMessage(body, replyToId) {
    setError("");
    try {
      const res = await client.post(`/conversations/${active.id}/send/`, { text: body, reply_to: replyToId });
      setMessages((m) => [...m, res.data]);
      loadConversations();
    } catch (err) {
      setError(err.response?.data?.detail || "Your message could not be sent. Please try again.");
      throw err;
    }
  }

  async function messageOp(id, op, payload = {}) {
    setError("");
    try {
      const res = await client.post(`/conversations/${active.id}/messages/${id}/${op}/`, payload);
      setMessages((list) => list.map((m) => (m.id === res.data.id ? res.data : m)));
      loadConversations();
    } catch (err) {
      setError(err.response?.data?.detail || "That didn't work. Please try again.");
      throw err;
    }
  }

  if (!user || user.role === "citizen") return null;

  const totalUnread = conversations.reduce((sum, c) => sum + (c.unread_count || 0), 0);

  return (
    <>
      <div className="chat-widget-trigger">
        <button
          type="button"
          className="icon-btn"
          onClick={() => setOpen((o) => !o)}
          title="Internal conversation"
          aria-label="Internal conversation"
        >
          💬
        </button>
        {totalUnread > 0 && <span className="chat-widget-badge">{totalUnread > 9 ? "9+" : totalUnread}</span>}
      </div>

      {/* General2 GEN_02: the panel is rendered on <body>. The sticky header uses
          backdrop-filter, which makes it the containing block for anything
          `position: fixed` inside it — the popup was being placed relative to the
          header bar and pushed off-screen. */}
      {open && createPortal(
        <div className="chat-widget-panel animate-in">
          <div className="chat-widget-header">
            {view !== "list" && (
              <button className="chat-widget-back" onClick={() => { setView("list"); setActive(null); }} aria-label="Back">←</button>
            )}
            <h4>
              {view === "list" && "Internal conversation"}
              {view === "thread" && active?.display_name}
              {view === "new" && "New conversation"}
            </h4>
            {view === "list" && tab !== "case" && (
              <button onClick={openNewChat} title="New conversation" aria-label="New conversation">➕</button>
            )}
            <button onClick={() => setOpen(false)} aria-label="Close">✕</button>
          </div>

          {view === "list" && (
            <>
              <div className="chat-widget-tabs" role="tablist">
                {TABS.map((t) => (
                  <button
                    key={t.key}
                    role="tab"
                    aria-selected={tab === t.key}
                    className={`chat-widget-tab ${tab === t.key ? "is-active" : ""}`}
                    onClick={() => setTab(t.key)}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              <div className="chat-widget-body">
                {filtered.length === 0 && (
                  <div className="chat-widget-empty">
                    {tab === "case"
                      ? "No case groups yet — one forms automatically as soon as you're assigned a case."
                      : "No conversations yet. Tap ➕ to message a colleague or start a group."}
                  </div>
                )}
                {filtered.map((c) => (
                  <div
                    key={c.id}
                    className={`chat-widget-list-item ${c.kind !== "dm" ? "is-group" : ""}`}
                    onClick={() => openConversation(c)}
                  >
                    <div className="chat-widget-avatar">{c.kind === "case" ? "🗂" : c.kind === "group" ? "👥" : initials(c.display_name)}</div>
                    <div className="chat-widget-list-meta">
                      <div className="chat-widget-list-name">
                        {c.display_name}
                        {c.kind === "case" && <span className="meta-chip" style={{ marginLeft: 6 }}>Case</span>}
                      </div>
                      <div className="chat-widget-list-preview">
                        {c.last_message ? (c.last_message.deleted ? "🚫 Message deleted" : c.last_message.text) : "No messages yet"}
                      </div>
                    </div>
                    {c.unread_count > 0 && <span className="chat-widget-unread">{c.unread_count}</span>}
                  </div>
                ))}
              </div>
            </>
          )}

          {view === "thread" && (
            <>
              {active?.kind === "case" && (
                <button
                  type="button"
                  className="chat-widget-case-link"
                  onClick={() => { setOpen(false); navigate(`/staff/submissions/${active.submission}`); }}
                >
                  Open case {active.tracking_code} →
                </button>
              )}
              <ChatPanel
                messages={messages}
                userId={user.id}
                isAdmin={user.role === "admin"}
                showSender={active?.kind !== "dm"}
                error={error}
                onSend={sendMessage}
                onEdit={(id, text) => messageOp(id, "edit", { text })}
                onDelete={(id) => messageOp(id, "delete")}
                onPin={(id) => messageOp(id, "pin")}
              />
            </>
          )}

          {view === "new" && (
            <div className="chat-widget-new">
              {error && <div className="alert alert-error" style={{ padding: "6px 10px", fontSize: "0.8rem" }}>{error}</div>}
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  type="button"
                  className={`btn btn-sm ${newType === "dm" ? "btn-primary" : "btn-outline"}`}
                  onClick={() => { setNewType("dm"); setPicked([]); }}
                >
                  Direct message
                </button>
                <button
                  type="button"
                  className={`btn btn-sm ${newType === "group" ? "btn-primary" : "btn-outline"}`}
                  onClick={() => { setNewType("group"); setPicked([]); }}
                >
                  Group
                </button>
              </div>

              {newType === "group" && (
                <div className="field" style={{ margin: 0 }}>
                  <input placeholder="Group name" value={groupName} onChange={(e) => setGroupName(e.target.value)} />
                </div>
              )}

              <p className="muted" style={{ fontSize: "0.78rem", margin: 0 }}>
                {newType === "dm" ? "Pick one person to message." : "Pick everyone who should be in this group."}
              </p>

              <div className="chat-widget-people-list">
                {directory.map((p) => (
                  <label key={p.id} className="chat-widget-person">
                    <input
                      type={newType === "dm" ? "radio" : "checkbox"}
                      checked={picked.includes(p.id)}
                      onChange={() => togglePick(p.id)}
                    />
                    {p.display_name} <span className="muted">· {p.role?.replace("_", " ")}</span>
                  </label>
                ))}
                {directory.length === 0 && <div className="chat-widget-empty" style={{ padding: 14 }}>No colleagues found.</div>}
              </div>

              <button
                className="btn btn-primary btn-block"
                disabled={picked.length === 0 || (newType === "group" && !groupName.trim())}
                onClick={startConversation}
              >
                Start conversation
              </button>
            </div>
          )}
        </div>,
        document.body
      )}
    </>
  );
}
