import { useLayoutEffect } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import TopNav from "./components/TopNav";
import Footer from "./components/Footer";
import AssistantWidget from "./components/AssistantWidget";
import StaffLayout from "./components/StaffLayout";
import Home from "./pages/Home";
import About from "./pages/About";
import Submit from "./pages/Submit";
import Track from "./pages/Track";
import Login from "./pages/Login";
import StaffDashboard from "./pages/StaffDashboard";
import Submissions from "./pages/Submissions";
import SubmissionDetail from "./pages/SubmissionDetail";
import Analytics from "./pages/Analytics";
import Profile from "./pages/Profile";
import Settings from "./pages/Settings";
import ChangePassword from "./pages/ChangePassword";
import Users from "./pages/Users";
import UserDetail from "./pages/UserDetail";
import AddUser from "./pages/AddUser";
import Reports from "./pages/Reports";
import Groups from "./pages/Groups";
import GroupDetail from "./pages/GroupDetail";
import StaffSignup from "./pages/StaffSignup";
import CitizenSignup from "./pages/CitizenSignup";
import MySubmissions from "./pages/MySubmissions";
import Access from "./pages/Access";
import AutoTranslate from "./components/AutoTranslate";
import TableLabels from "./components/TableLabels";
import PriorityKeywords from "./pages/PriorityKeywords";
import Categories from "./pages/Categories";
import Departments from "./pages/Departments";
import AssistantQuestions from "./pages/AssistantQuestions";

// Admin2 ADM_01 / General2: a direct URL visit shouldn't reach a section the
// user's group hasn't granted them — same rule the sidebar uses to hide links.
function RequirePermission({ codename, children }) {
  const { user, loading, hasPermission } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (!hasPermission(codename)) return <Navigate to="/staff" replace />;
  return children;
}

// Admin3 ADM_01: managing permission groups (which is what a role now is)
// stays admin-only, same as user management.
function RequireAdmin({ children }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== "admin") return <Navigate to="/staff" replace />;
  return children;
}

// General2 GEN_03: every page change starts at the top of the new page — even
// when the reader was at the bottom of the previous one (and on browser Back).
// Only the path matters, so changing a ?query on the same page doesn't jump.
function ScrollToTop() {
  const { pathname, hash } = useLocation();
  useLayoutEffect(() => {
    if ("scrollRestoration" in window.history) window.history.scrollRestoration = "manual";
  }, []);
  useLayoutEffect(() => {
    if (hash) {
      document.getElementById(hash.slice(1))?.scrollIntoView();
      return;
    }
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, [pathname, hash]);
  return null;
}

export default function App() {
  const location = useLocation();
  const isStaffArea = location.pathname.startsWith("/staff");
  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <ScrollToTop />
      <AutoTranslate />
      <TableLabels />
      {!isStaffArea && <TopNav />}
      <div style={{ flex: 1 }} className="page-transition" key={location.pathname}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/about" element={<About />} />
          <Route path="/access" element={<Access />} />
          <Route path="/submit" element={<Submit />} />
          <Route path="/track" element={<Track />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<CitizenSignup />} />
          <Route path="/staff-signup" element={<StaffSignup />} />
          <Route path="/staff" element={<StaffLayout />}>
            <Route index element={<StaffDashboard />} />
            <Route path="submissions" element={<Submissions />} />
            <Route path="submissions/:id" element={<SubmissionDetail />} />
            <Route path="analytics" element={<RequirePermission codename="can_view_analytics"><Analytics /></RequirePermission>} />
            <Route path="profile" element={<Profile />} />
            <Route path="settings" element={<Settings />} />
            <Route path="settings/password" element={<ChangePassword />} />
            <Route path="users" element={<Users />} />
            <Route path="users/new" element={<AddUser />} />
            <Route path="users/:id" element={<UserDetail />} />
            <Route path="groups" element={<RequireAdmin><Groups /></RequireAdmin>} />
            <Route path="groups/:id" element={<RequireAdmin><GroupDetail /></RequireAdmin>} />
            <Route path="reports" element={<RequirePermission codename="can_export_reports"><Reports /></RequirePermission>} />
            <Route path="categories" element={<RequirePermission codename="can_manage_categories_departments"><Categories /></RequirePermission>} />
            <Route path="departments" element={<RequirePermission codename="can_manage_categories_departments"><Departments /></RequirePermission>} />
            <Route path="priority" element={<RequireAdmin><PriorityKeywords /></RequireAdmin>} />
            <Route path="assistant-questions" element={<RequirePermission codename="can_answer_assistant_questions"><AssistantQuestions /></RequirePermission>} />
            <Route path="my-submissions" element={<MySubmissions />} />
          </Route>
        </Routes>
      </div>
      {!isStaffArea && <Footer />}
      {!isStaffArea && <AssistantWidget />}
    </div>
  );
}
