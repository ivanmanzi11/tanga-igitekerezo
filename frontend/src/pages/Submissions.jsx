import { SkeletonRows } from "../components/Skeleton";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import client from "../api/client";
import { useAuth } from "../context/AuthContext";
import StatusBadge from "../components/StatusBadge";
import Pagination from "../components/Pagination";
import SearchField from "../components/SearchField";

const STATUSES = ["received", "under_review", "assigned", "needs_info", "resolved", "responded", "closed"];
const DATE_RANGES = [
  { key: "", label: "All time" },
  { key: "today", label: "Today" },
  { key: "7d", label: "7 Days" },
  { key: "month", label: "This Month" },
  { key: "year", label: "This Year" },
  { key: "date", label: "Choose a date" },
];

export default function Submissions() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [submissions, setSubmissions] = useState([]);
  const [categories, setCategories] = useState([]);
  const [filters, setFilters] = useState({ status: "", category: "", search: "", range: "" });
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState([]);
  const [page, setPage] = useState(1);
  const [pageInfo, setPageInfo] = useState({ count: 0, next: null, previous: null });

  useEffect(() => {
    client.get("/categories/", { params: { all: 1 } }).then((res) => setCategories(res.data.results || res.data));
  }, []);

  useEffect(() => {
    setLoading(true);
    setSelected([]);
    const params = { page };
    Object.entries(filters).forEach(([k, v]) => { if (v) params[k] = v; });
    if (filters.range === "date") {
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo) params.date_to = dateTo;
      if (!dateFrom) return; // wait until a date is actually picked
    }
    client.get("/submissions/", { params }).then((res) => {
      const data = res.data;
      setSubmissions(data.results || data);
      setPageInfo({ count: data.count, next: data.next, previous: data.previous });
    }).finally(() => setLoading(false));
  }, [filters, page, dateFrom, dateTo]);

  function updateFilter(patch) {
    setPage(1);
    setFilters((f) => ({ ...f, ...patch }));
  }

  function toggleSelect(id) {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }

  async function bulkDelete() {
    if (!window.confirm(`Delete ${selected.length} submission(s)? This cannot be undone.`)) return;
    await Promise.all(selected.map((id) => client.delete(`/submissions/${id}/`)));
    setSubmissions((subs) => subs.filter((s) => !selected.includes(s.id)));
    setSelected([]);
  }

  return (
    <div>
      <p className="muted">Every case received, in progress, or resolved.</p>

      <div className="filters">
        {DATE_RANGES.map((r) => (
          <button
            key={r.key}
            className={`btn btn-sm ${filters.range === r.key ? "btn-primary" : "btn-outline"}`}
            onClick={() => updateFilter({ range: r.key })}
          >
            {r.label}
          </button>
        ))}
        <select value={filters.status} onChange={(e) => updateFilter({ status: e.target.value })}>
          <option value="">All statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
        </select>
        <select value={filters.category} onChange={(e) => updateFilter({ category: e.target.value })}>
          <option value="">All categories</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <SearchField
          placeholder="Search title or tracking code…"
          value={filters.search}
          onChange={(v) => updateFilter({ search: v })}
          onSearch={(v) => updateFilter({ search: v })}
        />
      </div>

      {filters.range === "date" && (
        <div className="filters" style={{ marginTop: -6 }}>
          <label style={{ fontSize: "0.82rem", alignSelf: "center" }}>From</label>
          <input type="date" value={dateFrom} onChange={(e) => { setPage(1); setDateFrom(e.target.value); }} />
          <label style={{ fontSize: "0.82rem", alignSelf: "center" }}>To (optional)</label>
          <input type="date" value={dateTo} onChange={(e) => { setPage(1); setDateTo(e.target.value); }} />
          {!dateFrom && <span className="muted" style={{ fontSize: "0.8rem", alignSelf: "center" }}>Pick a start date to filter.</span>}
        </div>
      )}

      {selected.length > 0 && (
        <div className="bulk-toolbar">
          <span>{selected.length} selected</span>
          {user.role === "admin" && (
            <button className="btn btn-danger btn-sm" onClick={bulkDelete}>Delete selected</button>
          )}
          <button className="btn btn-outline btn-sm" onClick={() => setSelected([])}>Clear</button>
        </div>
      )}

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <table>
          <thead>
            <tr>
              <th style={{ width: 32 }}>
                <input type="checkbox" checked={submissions.length > 0 && selected.length === submissions.length} onChange={() => setSelected(selected.length === submissions.length ? [] : submissions.map((s) => s.id))} />
              </th>
              <th>Tracking code</th>
              <th>Title</th>
              <th>Category</th>
              <th>Department</th>
              <th>Priority</th>
              <th>Status</th>
              <th>Received</th>
            </tr>
          </thead>
          <tbody>
            {loading && <SkeletonRows rows={6} cols={8} />}
            {!loading && submissions.length === 0 && (
              <tr><td colSpan={8} className="muted" style={{ padding: 20 }}>No submissions match these filters.</td></tr>
            )}
            {submissions.map((s) => (
              <tr key={s.id} className="row-link">
                <td onClick={(e) => e.stopPropagation()}>
                  <input type="checkbox" checked={selected.includes(s.id)} onChange={() => toggleSelect(s.id)} />
                </td>
                <td onClick={() => navigate(`/staff/submissions/${s.id}`)}>{s.tracking_code}</td>
                <td onClick={() => navigate(`/staff/submissions/${s.id}`)}>{s.title}</td>
                <td onClick={() => navigate(`/staff/submissions/${s.id}`)}>{s.category_name}</td>
                <td onClick={() => navigate(`/staff/submissions/${s.id}`)}>{s.department_name || "—"}</td>
                <td onClick={() => navigate(`/staff/submissions/${s.id}`)}>
                  {s.priority !== "low" && <span className={`meta-chip priority-${s.priority}`}>⚑ {s.priority}</span>}
                </td>
                <td onClick={() => navigate(`/staff/submissions/${s.id}`)}><StatusBadge status={s.status} /></td>
                <td onClick={() => navigate(`/staff/submissions/${s.id}`)}>{new Date(s.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Pagination
        page={page} count={pageInfo.count}
        hasNext={!!pageInfo.next} hasPrevious={!!pageInfo.previous}
        onChange={setPage}
      />
    </div>
  );
}
