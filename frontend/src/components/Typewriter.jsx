import { useEffect, useState } from "react";

/** Types `text` out one character at a time, then loops after a pause —
 * used for the *502# demo. Shows the full text straight away when the reader
 * prefers reduced motion. */
export default function Typewriter({ text, speed = 220, pause = 2200, className = "" }) {
  const reduce = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const [n, setN] = useState(reduce ? text.length : 0);

  useEffect(() => {
    if (reduce) return undefined;
    const timer = setTimeout(() => setN((c) => (c >= text.length ? 0 : c + 1)), n >= text.length ? pause : speed);
    return () => clearTimeout(timer);
  }, [n, text, speed, pause, reduce]);

  return (
    <span className={`typewriter ${className}`} aria-label={text}>
      <span aria-hidden="true">{text.slice(0, n)}</span>
      <span className="typewriter-caret" aria-hidden="true" />
    </span>
  );
}
