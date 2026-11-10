import { useState } from "react";
import client from "../api/client";

// General3 GEN_07: an interactive survey shown to the case owner once their
// case is resolved — rank satisfaction with the answer from 1 to 10.
const MOODS = ["😞", "😞", "🙁", "🙁", "😐", "😐", "🙂", "🙂", "😀", "🤩"];

export default function SatisfactionSurvey({ code, rating, comment, onRated }) {
  const [hover, setHover] = useState(0);
  const [pick, setPick] = useState(rating || 0);
  const [text, setText] = useState(comment || "");
  const [editing, setEditing] = useState(!rating);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e) {
    e.preventDefault();
    if (!pick) return;
    setBusy(true);
    setError("");
    try {
      const { data } = await client.post(`/track/${code}/rate/`, { rating: pick, comment: text });
      setEditing(false);
      onRated?.(data);
    } catch (err) {
      setError(err.response?.data?.detail || "Could not save your rating. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (!editing && rating) {
    return (
      <div className="survey-card animate-in">
        <div style={{ fontSize: "2rem" }}>{MOODS[rating - 1]}</div>
        <strong>Thank you — you rated this answer {rating}/10.</strong>
        {comment && <p className="muted" style={{ margin: "6px 0 0" }}>“{comment}”</p>}
        <button type="button" className="btn btn-outline btn-sm" style={{ marginTop: 10 }} onClick={() => setEditing(true)}>Change my rating</button>
      </div>
    );
  }

  const shown = hover || pick;
  return (
    <form className="survey-card animate-in" onSubmit={submit}>
      <strong>How satisfied are you with the answer?</strong>
      <p className="muted" style={{ margin: "4px 0 12px", fontSize: "0.85rem" }}>1 = not at all · 10 = completely satisfied</p>
      <div className="survey-scale" onMouseLeave={() => setHover(0)}>
        {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
          <button
            key={n} type="button" aria-label={`Rate ${n} out of 10`}
            className={`survey-dot ${n <= shown ? "is-on" : ""} ${n === pick ? "is-picked" : ""}`}
            onMouseEnter={() => setHover(n)} onClick={() => setPick(n)}
          >
            {n}
          </button>
        ))}
      </div>
      <div className="survey-mood" aria-live="polite">{shown ? `${MOODS[shown - 1]} ${shown}/10` : "Choose a number"}</div>
      <div className="field" style={{ marginTop: 10 }}>
        <textarea rows={2} value={text} onChange={(e) => setText(e.target.value)} placeholder="Anything you'd like to add? (optional)" maxLength={1000} />
      </div>
      {error && <div className="alert alert-error">{error}</div>}
      <button className="btn btn-success" disabled={!pick || busy}>{busy ? "Saving…" : "Send my rating"}</button>
    </form>
  );
}
