import { useState, useRef, useEffect } from "react";
import { NavLink, Outlet, Navigate, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import LanguageSwitcher from "./LanguageSwitcher";
import InternalChatWidget from "./InternalChatWidget";
import client, { API_ROOT } from "../api/client";
import coatOfArms from "../assets/coat-of-arms.webp";
import { MenuSquareIcon, CloseSquareIcon } from "./Icons";
import useMediaQuery from "../hooks/useMediaQuery";


function imageUrl(path) {
  if (!path) return null;
  return path.startsWith("http") ? path : `${API_ROOT}${path}`;
}

function initials(user) {
  const name = `${user.first_name || ""} ${user.last_name || ""}`.trim() || user.username;
  return name.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase();
}

const NAV_GROUPS = (role, hasPermission) => {
  const groups = [
    {
      label: "Overview",
      items: [
        { to: "/", end: true, icon: "🏠", label: "Home" },
        { to: "/about", icon: "ℹ️", label: "About" },
        { to: "/submit", icon: "📝", label: "Submit" },
        { to: "/track", icon: "🔎", label: "Track" },
        { to: "/staff", end: true, icon: "📊", label: "Dashboard" },
      ],
    },
  ];
  if (role === "citizen") {
    groups.push({
      label: "My Cases",
      items: [
        { to: "/staff/my-submissions", icon: "📋", label: "My Submissions" },
      ],
    });
  } else {
    // Admin2 ADM_01 / General2: a staff member only sees the sections their
    // group permissions actually allow them to use — Submissions is always
    // visible (read access), Analytics/Reports require the matching permission.
    const caseItems = [{ to: "/staff/submissions", icon: "📋", label: "Submissions" }];
    if (hasPermission("can_view_analytics")) {
      caseItems.push({ to: "/staff/analytics", icon: "📈", label: "Analytics" });
    }
    if (hasPermission("can_export_reports")) {
      caseItems.push({ to: "/staff/reports", icon: "🗂", label: "Reports" });
    }
    if (hasPermission("can_answer_assistant_questions")) {
      caseItems.push({ to: "/staff/assistant-questions", icon: "🤖", label: "Assistant & FAQs" });
    }
    groups.push({ label: "Case Management", items: caseItems });
  }
  if (role === "admin") {
    groups.push({
      label: "Administration",
      items: [
        { to: "/staff/users", icon: "👥", label: "Users" },
        { to: "/staff/groups", icon: "🔐", label: "Permission groups" },
        { to: "/staff/departments", icon: "🏢", label: "Departments" },
        { to: "/staff/categories", icon: "🗂", label: "Categories" },
        { to: "/staff/priority", icon: "⚑", label: "Priority keywords" },
      ],
    });
  }
  groups.push({
    label: "Account",
    items: [
      { to: "/staff/settings", icon: "⚙️", label: "Settings" },
    ],
  });
  return groups;
};

const PAGE_META = {
  "/staff": { title: "Dashboard", subtitle: "An overview of what's happening across the system." },
  "/staff/submissions": { title: "Submissions", subtitle: "Every case received, in progress, or resolved." },
  "/staff/my-submissions": { title: "My Submissions", subtitle: "Cases you've submitted and their tracking codes." },
  "/staff/analytics": { title: "Analytics", subtitle: "How submissions are moving through the system." },
  "/staff/reports": { title: "Reports", subtitle: "Export data for institutional record-keeping." },
  "/staff/users": { title: "Users", subtitle: "Everyone with an account." },
  "/staff/groups": { title: "Permission groups", subtitle: "Organize staff into groups with specific permissions." },
  "/staff/priority": { title: "Priority keywords", subtitle: "Words the AI uses to decide how urgent a case is." },
  "/staff/assistant-questions": { title: "Assistant & FAQs", subtitle: "Answer forwarded questions and manage what the AI assistant knows." },
  "/staff/departments": { title: "Departments", subtitle: "Create, edit and delete departments and see who belongs to each." },
  "/staff/categories": { title: "Categories", subtitle: "The categories people can submit under." },
  "/staff/settings": { title: "Settings", subtitle: "Manage your account and appearance." },
  "/staff/settings/password": { title: "Change password", subtitle: "Update the password used to sign in." },
  "/staff/profile": { title: "Profile", subtitle: "Your account information." },
};

export default function StaffLayout() {
  const { user, loading, logout, hasPermission } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  // General3 GEN_01: on phones the sidebar is a slide-in drawer opened from the top bar.
  const [drawer, setDrawer] = useState(false);
  const isMobile = useMediaQuery("(max-width: 860px)");
  // General2 GEN_02: on phones the second bar (menu button, dark/light, language, conversations) slips away
  // after 3 seconds of not touching the screen and comes back as soon as the person touches, scrolls,
  // taps or types — then goes again after 3 more quiet seconds. It stays while the menu or one of its
  // pop-ups (language list, conversations) is open.
  const [barVisible, setBarVisible] = useState(true);
  const barTimer = useRef(null);
  useEffect(() => {
    if (!isMobile) { setBarVisible(true); return undefined; }
    const arm = () => {
      clearTimeout(barTimer.current);
      barTimer.current = setTimeout(function hide() {
        const busy = document.querySelector(".staff-subbar .dropdown-panel, .chat-widget-panel, .staff-shell.drawer-open")
          || document.activeElement?.closest?.(".staff-subbar");
        if (busy) { barTimer.current = setTimeout(hide, 3000); return; }
        setBarVisible(false);
      }, 3000);
    };
    const wake = () => { setBarVisible(true); arm(); };
    const events = ["touchstart", "touchmove", "pointerdown", "scroll", "wheel", "keydown", "click", "mousemove"];
    events.forEach((e) => window.addEventListener(e, wake, { passive: true, capture: true }));
    arm();
    return () => {
      events.forEach((e) => window.removeEventListener(e, wake, { capture: true }));
      clearTimeout(barTimer.current);
    };
  }, [isMobile]);
  useEffect(() => setDrawer(false), [location.pathname]);
  useEffect(() => {
    document.documentElement.classList.toggle("drawer-lock", drawer && isMobile);
    document.body.classList.toggle("drawer-lock", drawer && isMobile);
    const onKey = (e) => e.key === "Escape" && setDrawer(false);
    document.addEventListener("keydown", onKey);
    return () => {
      document.documentElement.classList.remove("drawer-lock");
      document.body.classList.remove("drawer-lock");
      document.removeEventListener("keydown", onKey);
    };
  }, [drawer, isMobile]);
  useEffect(() => { if (!isMobile) setDrawer(false); }, [isMobile]);
  // General2 GEN_05: the menu headings (Overview, Case Management, Administration,
  // Account) are dropdowns. Whatever you open or close is remembered; the group
  // you are currently inside opens by itself.
  const [navOpen, setNavOpen] = useState(() => {
    try { return JSON.parse(localStorage.getItem("tgk_nav_open")) || {}; } catch { return {}; }
  });
  const [menuOpen, setMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const menuRef = useRef(null);
  const notifRef = useRef(null);

  useEffect(() => {
    function onClick(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
      if (notifRef.current && !notifRef.current.contains(e.target)) setNotifOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  function itemIsActive(item) {
    return item.end ? location.pathname === item.to : location.pathname.startsWith(item.to);
  }

  function toggleGroup(label, currentlyOpen) {
    setNavOpen((m) => {
      const next = { ...m, [label]: !currentlyOpen };
      try { localStorage.setItem("tgk_nav_open", JSON.stringify(next)); } catch { /* storage unavailable */ }
      return next;
    });
  }

  useEffect(() => {
    if (!user) return;
    const active = NAV_GROUPS(user.role, hasPermission).find((g) => g.items.some(itemIsActive));
    if (active) setNavOpen((m) => (m[active.label] === false || !(active.label in m) ? { ...m, [active.label]: true } : m));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, user]);

  useEffect(() => {
    if (!user) return;
    const group = NAV_GROUPS(user.role, hasPermission).find((g) => g.items.some(itemIsActive));
    if (group) setNavOpen((m) => (m[group.label] === false ? { ...m, [group.label]: true } : m));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  useEffect(() => {
    if (user) {
      client.get("/notifications/").then((res) => setNotifications(res.data.results || res.data)).catch(() => {});
    }
  }, [user]);

  async function openNotification(n) {
    if (!n.is_read) {
      client.post(`/notifications/${n.id}/mark_read/`).catch(() => {});
      setNotifications((ns) => ns.map((x) => (x.id === n.id ? { ...x, is_read: true } : x)));
    }
    setNotifOpen(false);
    if (n.link) {
      const path = n.link.startsWith("/track/") ? `/track?code=${n.link.split("/track/")[1]}` : n.link;
      navigate(path);
    }
  }

  if (loading) return <div className="container section">Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;

  const avatar = imageUrl(user.profile_image);
  const meta = PAGE_META[location.pathname] || { title: "", subtitle: "" };
  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return (
    <div className={`staff-shell ${collapsed ? "sidebar-collapsed" : ""} ${drawer ? "drawer-open" : ""}`}>
      <div className="staff-drawer-backdrop" onClick={() => setDrawer(false)} aria-hidden="true" />
      <aside className="staff-sidenav">
        <div className="staff-sidenav-topbar">
          <button
            type="button"
            className="sidebar-toggle-btn"
            onClick={() => setCollapsed((c) => !c)}
            title={collapsed ? "Expand menu" : "Collapse menu"}
            aria-label={collapsed ? "Expand menu" : "Collapse menu"}
          >
            <MenuSquareIcon size={26} />
          </button>
          <button type="button" className="drawer-close-btn" onClick={() => setDrawer(false)} aria-label="Close menu">
            <CloseSquareIcon size={24} /> <span>Close menu</span>
          </button>
        </div>

        <nav className="staff-sidenav-nav">
          {NAV_GROUPS(user.role, hasPermission).map((group) => {
            const containsActive = group.items.some(itemIsActive);
            const isOpen = group.label in navOpen ? !!navOpen[group.label] : containsActive;
            return (
              <div className={`staff-nav-group ${isOpen ? "is-open" : ""}`} key={group.label}>
                <button
                  type="button"
                  className="staff-nav-group-toggle"
                  aria-expanded={isOpen}
                  onClick={() => toggleGroup(group.label, isOpen)}
                >
                  <span className="staff-nav-group-label">{group.label}</span>
                  <span className="staff-nav-chevron" aria-hidden="true">▾</span>
                </button>
                <div className="staff-nav-items">
                  <div className="staff-nav-items-inner">
                    {group.items.map((item) => (
                      <NavLink
                        key={item.to} to={item.to} end={item.end}
                        className={({ isActive }) => `staff-nav-link ${isActive ? "active" : ""}`}
                      >
                        <span className="staff-nav-icon">{item.icon}</span>
                        <span className="staff-nav-label">{item.label}</span>
                      </NavLink>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </nav>
      </aside>

      <div className="staff-main">
        <header className="staff-topbar">
          <NavLink to="/staff" className="staff-brand" aria-label="Tanga Igitekerezo — dashboard">
            <img src={coatOfArms} alt="" />
            <span className="staff-brand-text">
              <span className="staff-brand-name">Tanga Igitekerezo</span>
              <span className="staff-brand-sub">Management Portal</span>
            </span>
          </NavLink>
          <div className="staff-topbar-actions">
            {!isMobile && (
              <>
                <button className="icon-btn" onClick={toggleTheme} title="Toggle dark mode" aria-label="Toggle dark mode">
                  {theme === "light" ? "🌙" : "☀️"}
                </button>
                <LanguageSwitcher variant="icon-btn" />
                {user.role !== "citizen" && <InternalChatWidget />}
              </>
            )}

            <div style={{ position: "relative" }} ref={notifRef}>
              <button className="icon-btn" onClick={() => setNotifOpen((o) => !o)} title="Notifications" aria-label="Notifications">
                🔔{unreadCount > 0 && <span className="icon-btn-badge" />}
              </button>
              {notifOpen && (
                <div className="dropdown-panel" style={{ width: 300 }}>
                  <div className="dropdown-header">Notifications</div>
                  {notifications.length === 0 && <div className="dropdown-empty">You're all caught up.</div>}
                  {notifications.slice(0, 8).map((n) => (
                    <div
                      key={n.id}
                      className="dropdown-item"
                      style={{ display: "block", opacity: n.is_read ? 0.6 : 1, cursor: "pointer" }}
                      onClick={() => openNotification(n)}
                    >
                      <div style={{ fontSize: "0.85rem", fontWeight: n.is_read ? 400 : 600 }}>{n.message}</div>
                      <div className="timeline-time">{new Date(n.created_at).toLocaleString()}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ position: "relative" }} ref={menuRef}>
              <button className="account-chip" onClick={() => setMenuOpen((o) => !o)}>
                <span className="avatar-circle avatar-sm">
                  {avatar ? <img src={avatar} alt="" /> : initials(user)}
                </span>
                <span className="account-chip-name">{user.first_name || user.username}</span>
              </button>
              {menuOpen && (
                <div className="dropdown-panel">
                  <div className="dropdown-header" style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    <span className="avatar-circle avatar-sm">{avatar ? <img src={avatar} alt="" /> : initials(user)}</span>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: "0.9rem" }}>{user.first_name || user.username} {user.last_name}</div>
                      <div className="muted" style={{ fontSize: "0.78rem" }}>{user.email || `@${user.username}`}</div>
                    </div>
                  </div>
                  <button className="dropdown-item" onClick={() => { setMenuOpen(false); navigate("/staff/profile"); }}>
                    👤 My Profile
                  </button>
                  <button
                    className="dropdown-item dropdown-item-danger"
                    onClick={() => { logout(); navigate("/"); }}
                  >
                    ⎋ Sign Out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {isMobile && (
          <div className={`staff-subbar ${barVisible ? "" : "is-hidden"}`} aria-hidden={!barVisible}>
            <button
              type="button" className="staff-menu-btn" aria-expanded={drawer}
              aria-label={drawer ? "Close menu" : "Open menu"} onClick={() => setDrawer((d) => !d)}
            >
              {drawer ? <CloseSquareIcon size={24} /> : <MenuSquareIcon size={24} />}
            </button>
            <span className="staff-subbar-label" />
            <div className="staff-subbar-actions">
              <button className="icon-btn" onClick={toggleTheme} title="Toggle dark mode" aria-label="Toggle dark mode">
                {theme === "light" ? "🌙" : "☀️"}
              </button>
              <LanguageSwitcher variant="icon-btn" />
              {user.role !== "citizen" && <InternalChatWidget />}
            </div>
          </div>
        )}

        <main className="staff-content">
          {meta.title && (
            <div className="staff-page-heading">
              <h1>{meta.title}</h1>
              {meta.subtitle && <p>{meta.subtitle}</p>}
            </div>
          )}
          <Outlet />
        </main>
      </div>
    </div>
  );
}
