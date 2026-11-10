import { useEffect, useRef, useState } from "react";

/** General3 GEN_02: clamp text to a number of lines and only show a
 * "Read more" toggle when it's actually being truncated (measured, not
 * guessed from character count — line height varies with font/width). */
export default function ReadMore({ text, lines = 3, as: Tag = "div", className, textStyle, style }) {
  const [expanded, setExpanded] = useState(false);
  const [overflowing, setOverflowing] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    setExpanded(false);
    // Measure against the clamped state, one frame after layout.
    requestAnimationFrame(() => {
      setOverflowing(el.scrollHeight > el.clientHeight + 1);
    });
  }, [text, lines]);

  if (!text) return null;

  return (
    <div className={className} style={style}>
      <Tag
        ref={ref}
        style={{
          ...textStyle,
          ...(expanded
            ? {}
            : { display: "-webkit-box", WebkitLineClamp: lines, WebkitBoxOrient: "vertical", overflow: "hidden" }),
        }}
      >
        {text}
      </Tag>
      {overflowing && (
        <button type="button" className="read-more-btn" onClick={() => setExpanded((e) => !e)}>
          {expanded ? "Read less" : "Read more"}
        </button>
      )}
    </div>
  );
}
