import { SkeletonRows } from "../components/Skeleton";
import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import client, { API_ROOT } from "../api/client";
import Modal from "../components/Modal";
import SearchField from "../components/SearchField";
import Pagination from "../components/Pagination";


function imageUrl(path) {
  if (!path) return null;
  return path.startsWith("http") ? path : `${API_ROOT}${path}`;
}

export default function Users() {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [departments, setDepartments] = useState([]);
  // Admin3 ADM_01: the role filter lists every permission group, including ones an admin created.
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ role: "", department: "", is_active: "", search: "" });
  const [selected, setSelected] = useState([]);
  const [quickView, setQuickView] = useState(null);
  // General3 GEN_03: the API already paginates staff-users (PAGE_SIZE=20) —
  // this page was silently throwing away everything past page 1 with no
  // way to see it. Wire up real pagination instead.
  const [page, setPage] = useState(1);
  const [pageInfo, setPageInfo] = useState({ count: 0, next: null, previous: null });

  useEffect(() => {
    client.get("/departments/").then((res) => setDepartments(res.data.results || res.data));
    client.get("/groups/").then((res) => setGroups(res.data.results || res.data)).catch(() => {});
  }, []);

  function load() {
    setLoading(true);
    const params = { all: "true", page };
    Object.entries(filters).forEach(([k, v]) => {
      if (!v) return;
      if (k === "role") {
        if (v.startsWith("g:")) params.group = v.slice(2);
        else params.role = v;
      } else params[k] = v;
    });
    client.get("/staff-users/", { params })
      .then((res) => {
        if (Array.isArray(res.data)) {
          setUsers(res.data);
          setPageInfo({ count: res.data.length, next: null, previous: null });
        } else {
          setUsers(res.data.results);
          setPageInfo({ count: res.data.count, next: res.data.next, previous: res.data.previous });
        }
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    const timeout = setTimeout(load, 250);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, page]);

  // Any filter change should jump back to page 1, not stay on a page that
  // might no longer exist for the new filter set.
  useEffect(() => { setPage(1); }, [filters.role, filters.department, filters.is_active, filters.search]);

  function toggleSelect(id) {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }

  // Admin2 ADM_02: the system refuses to disable/delete its last admin; show why.
  const [actionError, setActionError] = useState("");

  async function bulkDelete() {
    if (!window.confirm(`Delete ${selected.length} user(s)? This cannot be undone.`)) return;
    setActionError("");
    const results = await Promise.allSettled(selected.map((id) => client.delete(`/staff-users/${id}/`)));
    const failed = results.find((r) => r.status === "rejected");
    if (failed) setActionError(failed.reason?.response?.data?.detail || "Some users could not be deleted.");
    setSelected([]);
    load();
  }

  async function quickToggleActive(user) {
    setActionError("");
    try {
      await client.post(`/staff-users/${user.id}/set_active/`, { is_active: !user.is_active });
    } catch (err) {
      setActionError(err.response?.data?.detail || "Could not change this account.");
    }
    setQuickView(null);
    load();
  }

  async function quickDelete(user) {
    if (!window.confirm(`Delete ${user.username}? This cannot be undone.`)) return;
    setActionError("");
    try {
      await client.delete(`/staff-users/${user.id}/`);
    } catch (err) {
      setActionError(err.response?.data?.detail || "Could not delete this user.");
    }
    setQuickView(null);
    load();
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
        <p className="muted" style={{ marginBottom: 0 }}>Everyone with an account — citizens, officers, department heads, and administrators.</p>
        <Link to="/staff/users/new" className="btn btn-primary">+ Add new user</Link>
      </div>

      {actionError && <div className="alert alert-error" style={{ marginTop: 16 }}>{actionError}</div>}

      <div className="filters" style={{ marginTop: 20 }}>
        <SearchField
          placeholder="Search name, username, or email…"
          value={filters.search}
          onChange={(v) => setFilters((f) => ({ ...f, search: v }))}
          onSearch={load}
        />
        <select value={filters.role} onChange={(e) => setFilters((f) => ({ ...f, role: e.target.value }))}>
          <option value="">All roles</option>
          <option value="citizen">Citizen / Employee</option>
          {groups.map((g) => <option key={g.id} value={`g:${g.id}`}>{g.name}</option>)}
        </select>
        <select value={filters.department} onChange={(e) => setFilters((f) => ({ ...f, department: e.target.value }))}>
          <option value="">All departments</option>
          {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <select value={filters.is_active} onChange={(e) => setFilters((f) => ({ ...f, is_active: e.target.value }))}>
          <option value="">Any status</option>
          <option value="true">Active</option>
          <option value="false">Disabled / Pending</option>
        </select>
      </div>

      {selected.length > 0 && (
        <div className="bulk-toolbar">
          <span>{selected.length} selected</span>
          <button className="btn btn-danger btn-sm" onClick={bulkDelete}>Delete selected</button>
          <button className="btn btn-outline btn-sm" onClick={() => setSelected([])}>Clear</button>
        </div>
      )}

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <table>
          <thead>
            <tr>
              <th style={{ width: 32 }}>
                <input type="checkbox" checked={users.length > 0 && selected.length === users.length} onChange={() => setSelected(selected.length === users.length ? [] : users.map((u) => u.id))} />
              </th>
              <th>Name</th>
              <th>Username</th>
              <th>Role</th>
              <th>Department</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {loading && <SkeletonRows rows={6} cols={6} />}
            {!loading && users.length === 0 && <tr><td colSpan={6} className="muted" style={{ padding: 20 }}>No users match these filters.</td></tr>}
            {users.map((u) => (
              <tr key={u.id} className="row-link">
                <td onClick={(e) => e.stopPropagation()}>
                  <input type="checkbox" checked={selected.includes(u.id)} onChange={() => toggleSelect(u.id)} />
                </td>
                <td onClick={() => setQuickView(u)}>{u.first_name || u.last_name ? `${u.first_name} ${u.last_name}`.trim() : "—"}</td>
                <td onClick={() => setQuickView(u)}>{u.username}</td>
                <td onClick={() => setQuickView(u)} >{u.group_names?.[0] || u.role.replace("_", " ")}</td>
                <td onClick={() => setQuickView(u)}>{u.department_name || "—"}</td>
                <td onClick={() => setQuickView(u)}>
                  <span className={`badge ${u.is_active ? "badge-resolved" : "badge-closed"}`}>
                    {u.is_active ? "Active" : "Disabled"}
                  </span>
                </td>
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

      {quickView && (
        <Modal title="User details" onClose={() => setQuickView(null)}>
          <div style={{ display: "flex", gap: 14, alignItems: "center", marginBottom: 16 }}>
            <span className="avatar-circle avatar-md">
              {quickView.profile_image ? <img src={imageUrl(quickView.profile_image)} alt="" /> : (quickView.first_name?.[0] || quickView.username[0]).toUpperCase()}
            </span>
            <div>
              <div style={{ fontWeight: 600 }}>{quickView.first_name || quickView.last_name ? `${quickView.first_name} ${quickView.last_name}`.trim() : quickView.username}</div>
              <div className="muted" style={{ fontSize: "0.85rem" }}>@{quickView.username} · {quickView.email || "no email"}</div>
            </div>
          </div>
          <p style={{ fontSize: "0.9rem" }}>
            <strong>Role:</strong> {quickView.group_names?.[0] || quickView.role.replace("_", " ")}<br />
            <strong>Department:</strong> {quickView.department_name || "—"}<br />
            <strong>Status:</strong> {quickView.is_active ? "Active" : "Disabled / pending approval"}
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button className="btn btn-warning btn-sm" onClick={() => navigate(`/staff/users/${quickView.id}`)}>Edit / check-up →</button>
            <button className="btn btn-danger btn-sm" onClick={() => quickToggleActive(quickView)}>
              {quickView.is_active ? "Disable account" : "Approve / activate"}
            </button>
            <button className="btn btn-danger btn-sm" onClick={() => quickDelete(quickView)}>Delete user</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
