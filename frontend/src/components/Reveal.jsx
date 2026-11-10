import { useEffect, useRef, useState } from "react";

/** General3 GEN_08: fades/slides a section in once it scrolls into view.
 * Uses IntersectionObserver; degrades to always-visible with no observer
 * support and respects prefers-reduced-motion via CSS. */
export default function Reveal({ children, as: Tag = "div", className = "", style, delay = 0, from = "up" }) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          obs.disconnect();
        }
      },
      { threshold: 0.15 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <Tag ref={ref} className={`reveal reveal-${from} ${visible ? "is-visible" : ""} ${className}`} style={{ transitionDelay: `${delay}ms`, ...style }}>
      {children}
    </Tag>
  );
}
