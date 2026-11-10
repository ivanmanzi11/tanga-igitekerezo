import { useState } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { SignInIcon, BadgeIcon, UserIcon, EyeIcon } from "../components/Icons";
import coatOfArms from "../assets/coat-of-arms.webp";

// General3 GEN_04: professional tabbed sign-in — one tab for staff users
// (officers, department heads, administrators and any custom role) and one
// for case owners (citizens / employees who submit cases). The server also
// enforces the split, so an account can only sign in through its own tab.
const TABS = {
  staff: {
    label: "Staff",
    icon: BadgeIcon,
    heading: "Staff sign in",
    blurb: "For officers, department heads, administrators and other staff roles.",
  },
  citizen: {
    label: "Case owner",
    icon: UserIcon,
    heading: "Case owner sign in",
    blurb: "For citizens and employees who submit cases and want to follow them.",
  },
};

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [tab, setTab] = useState(params.get("as") === "citizen" ? "citizen" : "staff");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function switchTab(next) {
    setTab(next);
    setError("");
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(username, password, tab);
      navigate("/staff");
    } catch (err) {
      setError(err.response?.data?.detail || "Incorrect username or password.");
    } finally {
      setLoading(false);
    }
  }

  const current = TABS[tab];

  return (
    <div className="section container login-shell">
      <div className="login-card card animate-in">
        <div className="login-brand">
          <img src={coatOfArms} alt="" width={44} height={44} />
          <div>
            <strong>Tanga Igitekerezo</strong>
            <div className="muted" style={{ fontSize: "0.8rem" }}>Secure sign in</div>
          </div>
        </div>

        <div className="tab-switcher" role="tablist" aria-label="Sign in as">
          {Object.entries(TABS).map(([key, t]) => {
            const Icon = t.icon;
            return (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={tab === key}
                className={`tab-switcher-btn ${tab === key ? "is-active" : ""}`}
                onClick={() => switchTab(key)}
              >
                <Icon width={16} height={16} /> {t.label}
              </button>
            );
          })}
        </div>

        <h1 className="login-heading">{current.heading}</h1>
        <p className="muted" style={{ marginTop: 4 }}>{current.blurb}</p>

        <form onSubmit={handleSubmit} key={tab} className="tab-panel">
          {error && <div className="alert alert-error">{error}</div>}
          <div className="field">
            <label>Username</label>
            <input type="text" required autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} />
          </div>
          <div className="field">
            <label>Password</label>
            <div className="password-wrap">
              <input
                type={showPassword ? "text" : "password"} required autoComplete="current-password"
                value={password} onChange={(e) => setPassword(e.target.value)}
              />
              <button type="button" className="password-toggle" onClick={() => setShowPassword((s) => !s)} aria-label={showPassword ? "Hide password" : "Show password"}>
                <EyeIcon off={showPassword} width={18} height={18} />
              </button>
            </div>
          </div>
          <button className="btn btn-primary btn-block btn-with-icon" type="submit" disabled={loading}>
            {loading ? <span className="spinner" aria-hidden /> : <SignInIcon />}
            {loading ? "Signing in…" : "Sign in"}
          </button>

          {tab === "staff" ? (
            <p className="muted login-foot">
              Officer or department head, but no account yet? <Link to="/staff-signup">Sign up</Link>
            </p>
          ) : (
            <p className="muted login-foot">
              New here? <Link to="/signup">Create a case owner account</Link> — or{" "}
              <Link to="/submit">submit anonymously</Link> without one.
            </p>
          )}
        </form>
      </div>
    </div>
  );
}
