import { useRef, useState, useEffect } from "react";
import { useLanguage } from "../context/LanguageContext";

const OPTIONS = [
  { code: "en", label: "English", short: "EN" },
  { code: "rw", label: "Ikinyarwanda", short: "RW" },
  { code: "fr", label: "Français", short: "FR" },
];

/** Universal globe-icon language switcher, used in both the public top nav
 * and the staff dashboard header (General2 ADM_06). */
export default function LanguageSwitcher({ variant = "icon-btn" }) {
  const { lang, changeLang } = useLanguage();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function onClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const current = OPTIONS.find((o) => o.code === lang) || OPTIONS[0];

  return (
    <div style={{ position: "relative" }} ref={ref}>
      <button
        type="button"
        className={variant}
        onClick={() => setOpen((o) => !o)}
        title="Change language"
        aria-label="Change language"
      >
        🌐
      </button>
      {open && (
        <div className="dropdown-panel" style={{ minWidth: 160 }}>
          <div className="dropdown-header">Language</div>
          {OPTIONS.map((opt) => (
            <button
              key={opt.code}
              className="dropdown-item"
              style={{ fontWeight: opt.code === current.code ? 700 : 500 }}
              onClick={() => {
                changeLang(opt.code);
                setOpen(false);
              }}
            >
              <span style={{ width: 22, display: "inline-block", fontSize: "0.72rem", opacity: 0.7 }}>{opt.short}</span>
              {opt.label}
              {opt.code === current.code && <span style={{ marginLeft: "auto" }}>✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
