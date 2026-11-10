import { useEffect, useMemo, useRef, useState } from "react";
import Modal from "./Modal";
import { UploadFileIcon } from "./Icons";

// General3 GEN_06: a proper web-form uploader — drag & drop or browse,
// multiple files of the accepted types, a list showing each file, a preview
// so the person can read what they picked, a remove button, and "add more"
// as long as each file stays within 10 MB.
export const MAX_FILE_MB = 10;
const MAX_BYTES = MAX_FILE_MB * 1024 * 1024;
const TYPES = {
  pdf: { icon: "📕", label: "PDF" },
  doc: { icon: "📘", label: "Word" }, docx: { icon: "📘", label: "Word" },
  xls: { icon: "📗", label: "Excel" }, xlsx: { icon: "📗", label: "Excel" },
  png: { icon: "🖼️", label: "PNG" }, webp: { icon: "🖼️", label: "WebP" },
  jpg: { icon: "🖼️", label: "JPG" }, jpeg: { icon: "🖼️", label: "JPG" },
  mp3: { icon: "🎧", label: "MP3" }, mp4: { icon: "🎬", label: "MP4" },
};
const ACCEPT = Object.keys(TYPES).map((e) => `.${e}`).join(",");

const extOf = (name) => (name.split(".").pop() || "").toLowerCase();
function prettySize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function Preview({ file, url }) {
  const ext = extOf(file.name);
  if (["png", "webp", "jpg", "jpeg"].includes(ext)) return <img src={url} alt={file.name} style={{ maxWidth: "100%", maxHeight: "70vh", display: "block", margin: "0 auto" }} />;
  if (ext === "pdf") return <iframe title={file.name} src={url} style={{ width: "100%", height: "70vh", border: "1px solid var(--line)" }} />;
  if (ext === "mp3") return <audio controls src={url} style={{ width: "100%" }} />;
  if (ext === "mp4") return <video controls src={url} style={{ width: "100%", maxHeight: "70vh" }} />;
  return (
    <div>
      <p className="muted">Word and Excel files can't be shown inside the browser. Open it to read it in your own app:</p>
      <a className="btn btn-outline btn-sm" href={url} download={file.name}>Open “{file.name}”</a>
    </div>
  );
}

/**
 * files: File[] (controlled) · onChange(File[]) · multiple (default true)
 */
export default function FileUploader({ files, onChange, multiple = true, label = "Attach files" }) {
  const inputRef = useRef(null);
  const [drag, setDrag] = useState(false);
  const [error, setError] = useState("");
  const [previewing, setPreviewing] = useState(null);

  // Object URLs for previews, cleaned up when files change.
  const urls = useMemo(() => new Map(files.map((f) => [f, URL.createObjectURL(f)])), [files]);
  useEffect(() => () => urls.forEach((u) => URL.revokeObjectURL(u)), [urls]);

  function addFiles(list) {
    const incoming = Array.from(list);
    const problems = [];
    const accepted = [];
    incoming.forEach((f) => {
      if (!TYPES[extOf(f.name)]) problems.push(`“${f.name}” isn't an accepted type.`);
      else if (f.size > MAX_BYTES) problems.push(`“${f.name}” is ${prettySize(f.size)} — the limit is ${MAX_FILE_MB} MB.`);
      else if (files.some((x) => x.name === f.name && x.size === f.size)) problems.push(`“${f.name}” is already added.`);
      else accepted.push(f);
    });
    setError(problems.join(" "));
    if (accepted.length) onChange(multiple ? [...files, ...accepted] : [accepted[0]]);
    if (inputRef.current) inputRef.current.value = "";
  }

  function remove(file) {
    onChange(files.filter((f) => f !== file));
    setError("");
  }

  return (
    <div className="uploader">
      <div
        className={`uploader-drop ${drag ? "is-drag" : ""}`}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); addFiles(e.dataTransfer.files); }}
        role="button" tabIndex={0}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") inputRef.current?.click(); }}
      >
        <span className="uploader-drop-icon"><UploadFileIcon size={44} /></span>
        <strong>{label}</strong>
        <span className="muted" style={{ fontSize: "0.8rem" }}>
          Drag &amp; drop, or click to browse · PDF, Word, Excel, PNG, WebP, JPG, MP3, MP4 · up to {MAX_FILE_MB} MB each
        </span>
        <input ref={inputRef} type="file" hidden multiple={multiple} accept={ACCEPT} onChange={(e) => addFiles(e.target.files)} />
      </div>

      {error && <div className="alert alert-error" style={{ marginTop: 10, marginBottom: 0 }}>{error}</div>}

      {files.length > 0 && (
        <ul className="uploader-list">
          {files.map((f) => {
            const t = TYPES[extOf(f.name)];
            return (
              <li key={`${f.name}-${f.size}`} className="uploader-item">
                <span className="uploader-item-icon">{t?.icon || "📄"}</span>
                <div className="uploader-item-meta">
                  <div className="uploader-item-name" title={f.name}>{f.name}</div>
                  <div className="muted" style={{ fontSize: "0.75rem" }}>{t?.label} · {prettySize(f.size)}</div>
                </div>
                <button type="button" className="btn btn-info btn-sm" onClick={() => setPreviewing(f)}>Read</button>
                <button type="button" className="uploader-remove" onClick={() => remove(f)} aria-label={`Remove ${f.name}`} title="Remove this file">✕</button>
              </li>
            );
          })}
        </ul>
      )}

      {files.length > 0 && multiple && (
        <button type="button" className="btn btn-info btn-sm" style={{ marginTop: 8 }} onClick={() => inputRef.current?.click()}>
          + Add more files
        </button>
      )}

      {previewing && (
        <Modal title={previewing.name} width={900} onClose={() => setPreviewing(null)}>
          <Preview file={previewing} url={urls.get(previewing)} />
        </Modal>
      )}
    </div>
  );
}
