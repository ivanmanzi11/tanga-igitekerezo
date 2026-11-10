import { SkeletonRows } from "../components/Skeleton";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import client from "../api/client";
import StatusBadge from "../components/StatusBadge";
import Pagination from "../components/Pagination";

export default function MySubmissions() {
  const navigate = useNavigate();
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  // General3 GEN_03: the API paginates submissions (PAGE_SIZE=20) — this
  // page was silently dropping anything past page 1 with no way to see it.
  const [page, setPage] = useState(1);
  const [pageInfo, setPageInfo] = useState({ count: 0, next: null, previous: null });

  // General3 GEN_04: anonymous cases are never linked to an account. Their tracking codes
  // live only in this browser (saved when you submit) — the server doesn't know whose they are.
  const [local, setLocal] = useState(() => {
    try { return JSON.parse(localStorage.getItem("tgk_my_codes")) || []; } catch { return []; }
  });
  const [localStatus, setLocalStatus] = useState({});

  useEffect(() => {
    local.forEach((c) => {
      client.get(`/track/${c.code}/`).then((res) => setLocalStatus((m) => ({ ...m, [c.code]: res.data.status }))).catch(() => {});
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function forget(code) {
    const next = local.filter((c) => c.code !== code);
    setLocal(next);
    try { localStorage.setItem("tgk_my_codes", JSON.stringify(next)); } catch { /* ignore */ }
  }

  useEffect(() => {
    setLoading(true);
    client.get("/submissions/", { params: { page } })
      .then((res) => {
        if (Array.isArray(res.data)) {
          setSubmissions(res.data);
          setPageInfo({ count: res.data.length, next: null, previous: null });
        } else {
          setSubmissions(res.data.results);
          setPageInfo({ count: res.data.count, next: res.data.next, previous: res.data.previous });
        }
      })
      .finally(() => setLoading(false));
  }, [page]);

  return (
    <div>
      <p className="muted">
        Everything you've submitted under your name while signed in, with your tracking codes.
      </p>

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <table>
          <thead>
            <tr><th>Tracking code</th><th>Title</th><th>Status</th><th>Submitted</th></tr>
          </thead>
          <tbody>
            {loading && <SkeletonRows rows={5} cols={4} />}
            {!loading && submissions.length === 0 && (
              <tr><td colSpan={4} className="muted" style={{ padding: 20 }}>You haven't submitted anything under this account yet.</td></tr>
            )}
            {submissions.map((s) => (
              <tr key={s.id} className="row-link" onClick={() => navigate(`/track?code=${s.tracking_code}`)}>
                <td>{s.tracking_code}</td>
                <td>{s.title}</td>
                <td><StatusBadge status={s.status} /></td>
                <td>{new Date(s.created_at).toLocaleDateString()}</td>
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

      <h3 style={{ marginTop: 32 }}>Anonymous submissions on this device</h3>
      <p className="muted" style={{ fontSize: "0.88rem" }}>
        To keep anonymous cases truly anonymous, their tracking codes are kept only in this browser — never on the server,
        and never linked to your account. Clearing your browser data removes them, so keep a copy of important codes.
      </p>
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <table>
          <thead>
            <tr><th>Tracking code</th><th>Title</th><th>Status</th><th>Submitted</th><th></th></tr>
          </thead>
          <tbody>
            {local.length === 0 && (
              <tr><td colSpan={5} className="muted" style={{ padding: 20 }}>No anonymous submissions saved on this device.</td></tr>
            )}
            {local.map((c) => (
              <tr key={c.code} className="row-link" onClick={() => navigate(`/track?code=${c.code}`)}>
                <td>{c.code}</td>
                <td>{c.title}</td>
                <td>{localStatus[c.code] ? <StatusBadge status={localStatus[c.code]} /> : "—"}</td>
                <td>{new Date(c.at).toLocaleDateString()}</td>
                <td>
                  <button className="btn btn-danger btn-sm" onClick={(e) => { e.stopPropagation(); forget(c.code); }}>
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
