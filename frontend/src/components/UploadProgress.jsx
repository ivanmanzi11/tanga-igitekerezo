import { useEffect, useRef, useState } from "react";

// General2 GEN_06: shows a file really being uploaded — a rounded bar that fills
// with the true percentage sent to the server, labelled "Uploading…", like a
// loading bar. Pass `percent` (0-100) while uploading; null hides it.
export default function UploadProgress({ percent, label = "Uploading…", fileCount = 0 }) {
  if (percent === null || percent === undefined) return null;
  const pct = Math.max(0, Math.min(100, Math.round(percent)));
  const done = pct >= 100;
  return (
    <div className="upload-progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
      <div className="upload-progress-title">{done ? "Finishing…" : label}</div>
      <div className="upload-progress-track">
        <div className="upload-progress-fill" style={{ width: `${pct}%` }} />
      </div>
      <div className="upload-progress-meta">
        {fileCount > 0 && <span>{fileCount} file{fileCount > 1 ? "s" : ""}</span>}
        <span>{pct}%</span>
      </div>
    </div>
  );
}

/** Small hook: `const { percent, config, reset } = useUploadProgress()`;
 * pass `config` to an axios request and render <UploadProgress percent={percent} />. */
export function useUploadProgress() {
  const [percent, setPercent] = useState(null);
  const alive = useRef(true);
  useEffect(() => () => { alive.current = false; }, []);
  return {
    percent,
    config: {
      onUploadProgress: (e) => {
        if (alive.current && e.total) setPercent((e.loaded / e.total) * 100);
      },
    },
    start: () => setPercent(0),
    reset: () => alive.current && setPercent(null),
  };
}
