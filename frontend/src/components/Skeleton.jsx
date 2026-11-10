/** General3 GEN_08: shimmering placeholders shown while data loads,
 * instead of a bare "Loading…" line. */
export function SkeletonLine({ width = "100%", style }) {
  return <div className="skeleton skeleton-line" style={{ width, ...style }} />;
}

export function SkeletonCard({ style }) {
  return <div className="skeleton skeleton-card" style={style} />;
}

export function SkeletonGrid({ count = 4 }) {
  return (
    <div className="kpi-grid">
      {Array.from({ length: count }, (_, i) => <SkeletonCard key={i} />)}
    </div>
  );
}

export function SkeletonRows({ rows = 5, cols = 4 }) {
  return Array.from({ length: rows }, (_, r) => (
    <tr key={r}>
      {Array.from({ length: cols }, (_, c) => (
        <td key={c}><SkeletonLine width={c === 0 ? "70%" : "90%"} /></td>
      ))}
    </tr>
  ));
}
