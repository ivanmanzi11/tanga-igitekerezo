export default function Pagination({ page, hasNext, hasPrevious, onChange, count }) {
  if (!hasNext && !hasPrevious && page === 1) return null;
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 14, fontSize: "0.85rem" }}>
      <span className="muted">{count != null ? `${count} total` : ""}</span>
      <div style={{ display: "flex", gap: 8 }}>
        <button className="btn btn-outline btn-sm" disabled={!hasPrevious} onClick={() => onChange(page - 1)}>← Previous</button>
        <span className="muted" style={{ alignSelf: "center" }}>Page {page}</span>
        <button className="btn btn-outline btn-sm" disabled={!hasNext} onClick={() => onChange(page + 1)}>Next →</button>
      </div>
    </div>
  );
}
