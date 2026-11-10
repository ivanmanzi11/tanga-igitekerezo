import { SkeletonGrid } from "../components/Skeleton";
import { useEffect, useMemo, useState } from "react";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid,
} from "recharts";
import client from "../api/client";
import useMediaQuery from "../hooks/useMediaQuery";

const RANGES = [
  { key: "today", label: "Today" },
  { key: "7d", label: "Last 7 Days" },
  { key: "month", label: "This Month" },
  { key: "year", label: "This Year" },
  { key: "custom", label: "Choose Year" },
];

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const PALETTE = ["#1f4b43", "#b8863a", "#9c4f3c", "#3f7f8f", "#7a5ea8", "#c2703d", "#4c7a3f"];
const WEEKDAY_LABELS = ["Mon", "Tues", "Wed", "Thurs", "Fri", "Sat", "Sun"];

function isoDate(d) {
  return d.toISOString().slice(0, 10);
}

/** General2 ADM_02: the "Submission activity" graph, redesigned as a weekly
 * grid — Mon..Sun on the Y-axis (horizontal labels), the week's dates angled
 * along the X-axis, one column per week. Clicking a day cell drills the four
 * charts below into that single day. */
function WeeklyActivityGrid({ byDay, weeks = 10, selectedDay, onSelectDay }) {
  const counts = useMemo(() => Object.fromEntries((byDay || []).map((d) => [d.day, d.count])), [byDay]);
  const max = Math.max(1, ...Object.values(counts));

  const columns = useMemo(() => {
    const today = new Date();
    // Monday of the current week.
    const currentMonday = new Date(today);
    const dow = (currentMonday.getDay() + 6) % 7; // 0 = Monday
    currentMonday.setDate(currentMonday.getDate() - dow);

    const cols = [];
    for (let w = weeks - 1; w >= 0; w--) {
      const weekStart = new Date(currentMonday);
      weekStart.setDate(weekStart.getDate() - w * 7);
      const days = [];
      for (let d = 0; d < 7; d++) {
        const date = new Date(weekStart);
        date.setDate(date.getDate() + d);
        if (date > today) {
          days.push(null);
        } else {
          days.push(isoDate(date));
        }
      }
      cols.push({ weekStart: isoDate(weekStart), days });
    }
    return cols;
  }, [weeks]);

  function shade(count) {
    if (!count) return "var(--line)";
    const intensity = Math.min(1, count / max);
    const alpha = 0.25 + intensity * 0.75;
    return `rgba(31, 75, 67, ${alpha})`;
  }

  function weekStartLabel(iso) {
    const d = new Date(iso + "T00:00:00");
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }

  return (
    <div className="activity-grid-wrap">
      <div className="activity-grid-yaxis">
        {WEEKDAY_LABELS.map((label) => (
          <div key={label} className="activity-grid-ylabel">{label}</div>
        ))}
      </div>
      <div className="activity-grid-cols">
        {columns.map((col) => (
          <div key={col.weekStart} className="activity-grid-col">
            {col.days.map((day, i) => {
              if (!day) return <div key={i} className="activity-cell empty" />;
              const count = counts[day] || 0;
              const isSelected = selectedDay === day;
              return (
                <div
                  key={day}
                  className={`activity-cell ${isSelected ? "selected" : ""}`}
                  style={{ background: shade(count) }}
                  title={`${day}: ${count} submission(s) — click to filter the charts below`}
                  onClick={() => onSelectDay(isSelected ? null : day)}
                />
              );
            })}
            <div className="activity-grid-xlabel">{weekStartLabel(col.weekStart)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Analytics() {
  const isMobile = useMediaQuery("(max-width: 860px)");
  const chartH = isMobile ? 300 : 200; // General2 GEN_03: phones get taller charts
  const [data, setData] = useState(null);
  const [activityByDay, setActivityByDay] = useState(null);
  const [range, setRange] = useState("month");
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState("");
  const [selectedDay, setSelectedDay] = useState(null);
  const [dayData, setDayData] = useState(null);

  useEffect(() => {
    const params = { range };
    if (range === "custom") {
      params.year = year;
      if (month) params.month = month;
    }
    client.get("/analytics/summary/", { params }).then((res) => setData(res.data));
  }, [range, year, month]);

  // The activity grid always looks at the last several weeks, independent of
  // the range filter above, so the calendar it draws stays stable.
  useEffect(() => {
    client.get("/analytics/summary/", { params: { range: "all" } })
      .then((res) => setActivityByDay(res.data.by_day))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!selectedDay) {
      setDayData(null);
      return;
    }
    client.get("/analytics/summary/", { params: { range: "date", date: selectedDay } })
      .then((res) => setDayData(res.data));
  }, [selectedDay]);

  const years = Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - i);
  const drillData = dayData || data;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "flex-end", flexWrap: "wrap", gap: 6, marginBottom: 4 }}>
        {RANGES.map((r) => (
          <button
            key={r.key}
            className={`btn btn-sm ${range === r.key ? "btn-primary" : "btn-outline"}`}
            onClick={() => setRange(r.key)}
          >
            {r.label}
          </button>
        ))}
      </div>

      {range === "custom" && (
        <div className="filters" style={{ marginTop: 12, justifyContent: "flex-end" }}>
          <select value={year} onChange={(e) => setYear(e.target.value)}>
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          <select value={month} onChange={(e) => setMonth(e.target.value)}>
            <option value="">Whole year</option>
            {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
          </select>
        </div>
      )}

      {!data ? (
        <SkeletonGrid count={4} />
      ) : (
        <>
          <div className="stat-grid" style={{ marginTop: 20 }}>
            <div className="stat-card">
              <div className="stat-value">{data.total_submissions}</div>
              <div className="stat-label">Total submissions</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{data.unresolved}</div>
              <div className="stat-label">Unresolved</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{data.average_response_time_hours ?? "—"}</div>
              <div className="stat-label">Avg. resolution time (hrs)</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{data.satisfaction?.average ?? "—"}<span style={{ fontSize: "1rem" }}>{data.satisfaction?.average != null ? " /10" : ""}</span></div>
              <div className="stat-label">Avg. answer satisfaction ({data.satisfaction?.count || 0} rating{data.satisfaction?.count === 1 ? "" : "s"})</div>
            </div>
          </div>

          <div className="card" style={{ marginBottom: 20 }}>
            <h3 style={{ marginTop: 0 }}>Submission activity</h3>
            <p className="muted" style={{ fontSize: "0.82rem", marginTop: -6, marginBottom: 14 }}>
              Darker means more submissions that day. Click a day to filter the charts below to it.
            </p>
            <WeeklyActivityGrid byDay={activityByDay} selectedDay={selectedDay} onSelectDay={setSelectedDay} />
          </div>

          {selectedDay && (
            <div className="activity-selection-banner">
              📌 Showing <strong>Submissions over time</strong>, <strong>By status</strong>, <strong>By category</strong> and{" "}
              <strong>By department</strong> for <strong>{selectedDay}</strong> only.
              <button className="btn btn-outline btn-sm" onClick={() => setSelectedDay(null)}>Clear ✕</button>
            </div>
          )}

          {drillData && (
            <>
              <div className="chart-grid chart-grid-wide" style={{ marginBottom: 20 }}>
                <div className="card">
                  <h3 style={{ marginTop: 0 }}>Submissions over time</h3>
                  <ResponsiveContainer width="100%" height={chartH}>
                    <LineChart data={drillData.by_day}>
                      <CartesianGrid stroke="var(--line)" strokeWidth={1} />
                      <XAxis dataKey="day" tick={{ fontSize: 10 }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                      <Tooltip />
                      <Line type="monotone" dataKey="count" stroke="#1f4b43" strokeWidth={2} dot={{ r: 2 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <div className="card">
                  <h3 style={{ marginTop: 0 }}>By status</h3>
                  <ResponsiveContainer width="100%" height={chartH}>
                    <PieChart>
                      <Pie data={drillData.by_status} dataKey="count" nameKey="status" innerRadius={40} outerRadius={70} paddingAngle={2}>
                        {drillData.by_status.map((entry, i) => <Cell key={entry.status} fill={PALETTE[i % PALETTE.length]} />)}
                      </Pie>
                      <Legend wrapperStyle={{ fontSize: "0.75rem" }} />
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="chart-grid">
                <div className="card">
                  <h3 style={{ marginTop: 0 }}>By category</h3>
                  <ResponsiveContainer width="100%" height={chartH}>
                    <BarChart data={drillData.by_category}>
                      <CartesianGrid stroke="var(--line)" strokeWidth={1} />
                      <XAxis dataKey="category__name" tick={{ fontSize: 11 }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                      <Tooltip />
                      <Bar dataKey="count" radius={[3, 3, 0, 0]}>
                        {drillData.by_category.map((entry, i) => <Cell key={entry.category__name} fill={PALETTE[i % PALETTE.length]} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="card">
                  <h3 style={{ marginTop: 0 }}>By department</h3>
                  <ResponsiveContainer width="100%" height={chartH}>
                    <BarChart data={drillData.by_department}>
                      <CartesianGrid stroke="var(--line)" strokeWidth={1} />
                      <XAxis dataKey="department__name" tick={{ fontSize: 11 }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                      <Tooltip />
                      <Bar dataKey="count" radius={[3, 3, 0, 0]}>
                        {drillData.by_department.map((entry, i) => <Cell key={entry.department__name} fill={PALETTE[(i + 2) % PALETTE.length]} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="card" style={{ marginTop: 20 }}>
                <h3 style={{ marginTop: 0 }}>Answer satisfaction (survey)</h3>
                <p className="muted" style={{ fontSize: "0.82rem", marginTop: -6 }}>
                  How case owners ranked the answer they received, from 1 to 10
                  {drillData.satisfaction?.average != null && <> — average <strong>{drillData.satisfaction.average}/10</strong> from {drillData.satisfaction.count} rating(s)</>}.
                </p>
                {drillData.satisfaction?.count ? (
                  <ResponsiveContainer width="100%" height={chartH}>
                    <BarChart data={drillData.satisfaction.distribution}>
                      <CartesianGrid stroke="var(--line)" strokeWidth={1} />
                      <XAxis dataKey="rating" tick={{ fontSize: 11 }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                      <Tooltip />
                      <Bar dataKey="count" name="Ratings" radius={[3, 3, 0, 0]} fill="#b8863a" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="muted">No ratings yet for this period.</p>
                )}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
