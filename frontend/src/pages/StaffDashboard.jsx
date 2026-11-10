import { SkeletonGrid } from "../components/Skeleton";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import client from "../api/client";
import { useAuth } from "../context/AuthContext";
import StatusBadge from "../components/StatusBadge";

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

// Admin2 ADM_02 / General2 ADM_04: the core six KPI cards every staff role
// gets, scoped to whatever submissions they have access to.
const CORE_KPI_CARDS = [
  { key: "total_submissions", icon: "📥", label: "Total submissions", color: "kpi-teal" },
  { key: "all_unresolved", icon: "⏳", label: "All Unresolved", color: "kpi-clay" },
  { key: "all_resolved", icon: "✅", label: "All Resolved", color: "kpi-green" },
  { key: "today_new", icon: "🆕", label: "Today's new submissions", color: "kpi-blue" },
  { key: "today_unresolved", icon: "🕓", label: "Today's unresolved submissions", color: "kpi-amber" },
  { key: "today_solved", icon: "🎯", label: "Today's solved submissions", color: "kpi-purple" },
];

// Admin-only extra KPI cards (Admin2 ADM_02).
const ADMIN_KPI_CARDS = [
  { key: "avg_resolution_hours", icon: "⏱", label: "Avg. resolution (hrs)", color: "kpi-slate", fallback: "—" },
  { key: "departments_active", icon: "🏢", label: "Departments active", color: "kpi-red" },
  { key: "total_users", icon: "👥", label: "Total users", color: "kpi-gold" },
  { key: "avg_satisfaction", icon: "⭐", label: "Avg. satisfaction (/10)", color: "kpi-amber", fallback: "—" },
];

function KpiGrid({ data }) {
  const cards = data.total_users !== undefined ? [...CORE_KPI_CARDS, ...ADMIN_KPI_CARDS] : CORE_KPI_CARDS;
  return (
    <div className="kpi-grid animate-in delay-1">
      {cards.map((c) => (
        <div key={c.key} className={`kpi-card ${c.color}`}>
          <div className="kpi-card-icon">{c.icon}</div>
          <div className="kpi-card-value">{data[c.key] ?? c.fallback ?? "—"}</div>
          <div className="kpi-card-label">{c.label}</div>
        </div>
      ))}
    </div>
  );
}

export default function StaffDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [dashboard, setDashboard] = useState(null);
  const [clusters, setClusters] = useState([]);
  const [showClusters, setShowClusters] = useState(false);

  useEffect(() => {
    if (user.role === "citizen") return;
    client.get("/dashboard/summary/").then((res) => setDashboard(res.data));
    client.get("/submissions/similar/").then((res) => setClusters(res.data.clusters)).catch(() => {});
  }, [user.role]);

  if (user.role === "citizen") {
    return (
      <div>
        <div className="greeting-banner animate-in">
          <div>
            <h2>{greeting()}, {user.first_name || user.username}</h2>
            <p className="muted" style={{ margin: 0 }}>Track everything you've submitted, or send in something new.</p>
          </div>
        </div>
        <div className="quick-actions-grid animate-in delay-1">
          <button className="quick-action-btn" onClick={() => navigate("/submit")}>
            <span className="quick-action-icon">📝</span> Submit something new
          </button>
          <button className="quick-action-btn" onClick={() => navigate("/staff/my-submissions")}>
            <span className="quick-action-icon">📋</span> My submissions
          </button>
          <button className="quick-action-btn" onClick={() => navigate("/track")}>
            <span className="quick-action-icon">🔎</span> Track by code
          </button>
        </div>
      </div>
    );
  }

  // Admin2 ADM_02 / General2 ADM_04: Recent Submissions and Quick Actions
  // are gone from here — both already live in the sidebar — replaced by
  // KPI/metric cards below.
  return (
    <div>
      <div className="greeting-banner animate-in">
        <div>
          <h2>
            {greeting()}, {user.first_name || user.username}
            <span className="role-pill">{user.role.replace("_", " ")}</span>
          </h2>
          <p className="muted" style={{ margin: 0 }}>
            {user.role === "admin" ? "Here's what's happening across the system today." : "Here's what's happening with your assigned cases today."}
          </p>
        </div>
        <button className="btn btn-info" onClick={() => navigate("/staff/submissions")}>View submissions →</button>
      </div>

      {!dashboard ? (
        <SkeletonGrid count={6} />
      ) : (
        <KpiGrid data={dashboard} />
      )}

      {clusters.length > 0 && (
        <div className="card" style={{ marginBottom: 24, borderColor: "var(--gold)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h3 style={{ margin: 0 }}>💡 Possibly related submissions</h3>
            <button className="btn btn-outline btn-sm" onClick={() => setShowClusters((s) => !s)}>
              {showClusters ? "Hide" : `Review ${clusters.length} group(s)`}
            </button>
          </div>
          {showClusters && (
            <div style={{ marginTop: 12 }}>
              {clusters.map((group, i) => (
                <div key={i} style={{ marginBottom: 12, paddingBottom: 12, borderBottom: "1px solid var(--line)" }}>
                  {group.map((s) => (
                    <div key={s.id} style={{ fontSize: "0.85rem", marginBottom: 4, cursor: "pointer" }} onClick={() => navigate(`/staff/submissions/${s.id}`)}>
                      <StatusBadge status={s.status} /> {s.tracking_code} — {s.title}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
