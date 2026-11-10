import { useEffect, useRef, useState } from "react";
import client from "../api/client";
import { useLanguage } from "../context/LanguageContext";

// General2 GEN_03: when the assistant can't answer from its FAQs it forwards
// the question to staff and hands back a reference code (AQ-XXXXXX). Codes are
// remembered on this device; whenever the chat is opened the assistant checks
// them and shows any answer that has arrived. Typing a code also works.
const STORE_KEY = "tgk_assistant_codes";
const CODE_RE = /\bAQ-[0-9A-F]{6}\b/i;

const TXT = {
  en: {
    update: (code, q, a) => `Update on your question (${code}) — "${q}"\n\n${a}`,
    answered: (code, a) => `Answer to ${code}:\n\n${a}`,
    waiting: (code) => `${code} is still with our team — no answer yet. Please check again a little later.`,
    unknown: (code) => `I couldn't find a question with the reference ${code}.`,
    down: "Sorry, I couldn't reach the assistant just now.",
    hello: "Hello! I'm the Tanga Igitekerezo assistant. Ask me how to submit, track or reply to a case, how privacy works, or how to use the system without a smartphone.",
    thanks: "Thanks for your feedback!",
  },
  rw: {
    update: (code, q, a) => `Amakuru ku kibazo cyawe (${code}) — "${q}"\n\n${a}`,
    answered: (code, a) => `Igisubizo kuri ${code}:\n\n${a}`,
    waiting: (code) => `${code} iracyari ku itsinda ryacu — nta gisubizo kiraboneka. Ongera ugerageze nyuma gato.`,
    unknown: (code) => `Sinabonye ikibazo gifite nimero ${code}.`,
    down: "Mbabarira, ntabashije kugera ku mufasha ubu.",
    hello: "Muraho! Ndi umufasha wa Tanga Igitekerezo. Mbaza uko wohereza, ukurikirana cyangwa usubiza ikirego, uko ibanga ririndwa, cyangwa uko wakoresha sisitemu udafite telefoni igezweho.",
    thanks: "Urakoze ku bitekerezo byawe!",
  },
  fr: {
    update: (code, q, a) => `Mise à jour de votre question (${code}) — « ${q} »\n\n${a}`,
    answered: (code, a) => `Réponse à ${code} :\n\n${a}`,
    waiting: (code) => `${code} est toujours auprès de notre équipe — pas encore de réponse. Revenez un peu plus tard.`,
    unknown: (code) => `Je n'ai trouvé aucune question avec la référence ${code}.`,
    down: "Désolé, je n'ai pas pu joindre l'assistant pour le moment.",
    hello: "Bonjour ! Je suis l'assistant de Tanga Igitekerezo. Demandez-moi comment soumettre, suivre ou répondre à un dossier, comment fonctionne la confidentialité, ou comment utiliser le système sans smartphone.",
    thanks: "Merci pour votre retour !",
  },
};

const CHIPS = {
  rw: { how_submit: "Nohereza nte?", track: "Nkurikirana nte?", ussd: "Nta telefoni igezweho? Koresha USSD" },
  fr: { how_submit: "Comment soumettre ?", track: "Comment suivre mon dossier ?", ussd: "Pas de smartphone ? USSD" },
};

function loadCodes() {
  try { return JSON.parse(localStorage.getItem(STORE_KEY)) || []; } catch { return []; }
}
function saveCodes(codes) {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(codes)); } catch { /* storage unavailable */ }
}

export default function AssistantWidget() {
  const { lang } = useLanguage();
  const T = TXT[lang] || TXT.en;
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([
    { from: "bot", text: "Hi! I'm here to help you use Tanga Igitekerezo. Ask me how to submit, track, or reply to a case.", greeting: true,
      suggestions: [
        { label: "How do I submit?", text: "How do I submit?", topic: "how_submit" },
        { label: "How do I track my case?", text: "How do I track my case?", topic: "track" },
        { label: "No smartphone? Use USSD", text: "No smartphone? Use USSD", topic: "ussd" },
      ] },
  ]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ block: "end" }); }, [messages, sending]);

  // Deliver answers to previously forwarded questions.
  useEffect(() => {
    if (!open) return;
    const codes = loadCodes();
    if (codes.length === 0) return;
    let cancelled = false;
    Promise.all(codes.map((c) => client.get(`/assistant/questions/${c}/`).then((r) => r.data).catch(() => null))).then((results) => {
      if (cancelled) return;
      const answered = results.filter((r) => r && r.status === "answered");
      if (answered.length === 0) return;
      saveCodes(codes.filter((c) => !answered.some((a) => a.code === c)));
      setMessages((m) => [
        ...m,
        ...answered.map((a) => ({ from: "bot", text: T.update(a.code, a.question, a.answer) })),
      ]);
    });
    return () => { cancelled = true; };
  }, [open]);

  // `topic` is set when a suggestion chip is tapped, so the assistant answers
  // exactly that topic instead of guessing from the chip's wording.
  async function ask(text, topic) {
    const body = (text || "").trim();
    if (!body || sending) return;
    setMessages((m) => [...m.map((x) => (x.suggestions ? { ...x, suggestions: undefined } : x)), { from: "user", text: body }]);
    setDraft("");
    setSending(true);
    try {
      const typedCode = body.match(CODE_RE);
      if (typedCode) {
        const code = typedCode[0].toUpperCase();
        try {
          const { data } = await client.get(`/assistant/questions/${code}/`);
          const reply = data.status === "answered" ? T.answered(code, data.answer) : T.waiting(code);
          setMessages((m) => [...m, { from: "bot", text: reply }]);
        } catch {
          setMessages((m) => [...m, { from: "bot", text: T.unknown(code) }]);
        }
        return;
      }
      const history = messages.slice(-6).map((m) => ({ from: m.from, text: m.text }));
      const { data } = await client.post("/assistant/", { message: body, lang, topic, history });
      if (data.code) saveCodes([...new Set([...loadCodes(), data.code])]);
      setMessages((m) => [...m, {
        from: "bot", text: data.reply, key: data.key, question: body, suggestions: data.suggestions,
      }]);
    } catch {
      setMessages((m) => [...m, { from: "bot", text: T.down }]);
    } finally {
      setSending(false);
    }
  }

  function send(e) {
    e.preventDefault();
    ask(draft);
  }

  // Thumbs up / down teaches the assistant which answers help people.
  async function rate(index, helpful) {
    const msg = messages[index];
    if (!msg?.key || msg.rated) return;
    setMessages((list) => list.map((m, i) => (i === index ? { ...m, rated: helpful ? "up" : "down" } : m)));
    client.post("/assistant/feedback/", { key: msg.key, helpful, question: msg.question }).catch(() => {});
  }

  return (
    <>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Open assistant"
        style={{
          position: "fixed", bottom: "calc(24px + env(safe-area-inset-bottom))", right: 16, width: 56, height: 56, borderRadius: "50%",
          background: "var(--hills)", color: "#fff", border: "none", fontSize: "1.4rem", cursor: "pointer",
          boxShadow: "var(--shadow)", zIndex: 60,
        }}
      >
        {open ? "✕" : "💬"}
      </button>

      {open && (
        <div style={{
          position: "fixed", bottom: 90, right: 16, width: "min(340px, calc(100vw - 32px))", maxHeight: "min(460px, calc(100dvh - 120px))",
          background: "var(--paper-raised)", border: "1px solid var(--line)", borderRadius: "var(--radius)",
          boxShadow: "var(--shadow)", display: "flex", flexDirection: "column", zIndex: 60, overflow: "hidden",
        }}>
          <div style={{ padding: 14, borderBottom: "1px solid var(--line)", fontWeight: 600 }}>
            Tanga Igitekerezo Assistant
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
            {messages.map((m, i) => (
              <div key={i} className={`chat-row ${m.from === "user" ? "from-staff" : "from-owner"}`}>
                <div className="chat-bubble assistant-bubble" style={{ maxWidth: "90%" }}>
                  <p style={{ fontSize: "0.85rem", whiteSpace: "pre-wrap" }}>{m.greeting ? T.hello : m.text}</p>
                  {m.from === "bot" && m.key && (
                    <div className="assistant-rate">
                      {m.rated ? (
                        <span>{T.thanks}</span>
                      ) : (
                        <>
                          <button type="button" onClick={() => rate(i, true)} aria-label="Helpful">👍</button>
                          <button type="button" onClick={() => rate(i, false)} aria-label="Not helpful">👎</button>
                        </>
                      )}
                    </div>
                  )}
                  {m.suggestions && m.suggestions.length > 0 && (
                    <div className="assistant-chips">
                      {m.suggestions.map((sg) => (
                        <button type="button" key={sg.label} className="assistant-chip" onClick={() => ask(sg.topic && m.greeting ? (CHIPS[lang]?.[sg.topic] || sg.text) : sg.text, sg.topic)}>{sg.topic && m.greeting ? (CHIPS[lang]?.[sg.topic] || sg.label) : sg.label}</button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {sending && <div className="muted" style={{ fontSize: "0.8rem" }}>Thinking…</div>}
            <div ref={bottomRef} />
          </div>
          <form onSubmit={send} style={{ display: "flex", borderTop: "1px solid var(--line)" }}>
            <input
              type="text" value={draft} onChange={(e) => setDraft(e.target.value)}
              placeholder="Ask a question…"
              style={{ flex: 1, border: "none", padding: 12, background: "transparent", color: "var(--ink)" }}
            />
            <button className="btn btn-success btn-sm" style={{ margin: 6 }} disabled={sending}>Send</button>
          </form>
        </div>
      )}
    </>
  );
}
