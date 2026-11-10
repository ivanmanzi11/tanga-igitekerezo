import { createPortal } from "react-dom";

// General2 GEN_03: rendered through a portal on <body>. Pages sit inside a
// `.page-transition` wrapper whose finished animation leaves a transform on
// it; that turns it into the containing block for `position: fixed`, which
// pushed every modal (incl. the case's internal conversation) out of view
// or underneath the sticky header.
export default function Modal({ title, onClose, children, width = 560 }) {
  return createPortal(
    <div
      className="modal-backdrop"
      style={{
        position: "fixed", inset: 0, background: "rgba(18, 36, 31, 0.55)",
        display: "flex", alignItems: "center", justifyContent: "center",
        zIndex: 1000, padding: 20,
      }}
      onClick={onClose}
    >
      <div
        className="card modal-panel"
        style={{ maxWidth: width, width: "100%", maxHeight: "80vh", overflowY: "auto" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h3 style={{ margin: 0 }}>{title}</h3>
          <button className="btn btn-outline btn-sm" onClick={onClose}>Close</button>
        </div>
        {children}
      </div>
    </div>,
    document.body
  );
}
