import { useEffect, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { useLanguage } from "../context/LanguageContext";
import LanguageSwitcher from "./LanguageSwitcher";
import { MenuSquareIcon, CloseSquareIcon } from "./Icons";
import { SignInIcon } from "./Icons";
import coatOfArms from "../assets/coat-of-arms.webp";

export default function TopNav() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { t } = useLanguage();
  const navigate = useNavigate();
  // General3 GEN_01: on phones the links fold into a menu opened by a hamburger button.
  const [open, setOpen] = useState(false);
  const location = useLocation();
  useEffect(() => setOpen(false), [location.pathname]);

  return (
    <header className="topnav">
      <div className="topnav-inner">
        <NavLink to="/" className="brand">
          <img src={coatOfArms} alt="Coat of arms of Rwanda" className="brand-logo" />
          <span className="brand-name">Tanga Igitekerezo</span>
        </NavLink>
        <button
          type="button" className="nav-toggle" aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open} aria-controls="main-nav"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <CloseSquareIcon size={24} /> : <MenuSquareIcon size={24} />}
        </button>
        <nav className={`nav-links ${open ? "is-open" : ""}`} id="main-nav">
          <NavLink to="/" end className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}>
            {t("home")}
          </NavLink>
          <NavLink to="/about" className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}>
            About
          </NavLink>
          <NavLink to="/submit" className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}>
            {t("submit")}
          </NavLink>
          <NavLink to="/track" className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}>
            {t("track")}
          </NavLink>
          <NavLink to="/access" className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}>
            Ways to access
          </NavLink>
          {user ? (
            <>
              <NavLink to="/staff" className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}>
                {t("dashboard")}
              </NavLink>
              <button
                className="btn btn-outline btn-sm"
                onClick={() => {
                  logout();
                  navigate("/");
                }}
              >
                {t("signOut")}
              </button>
            </>
          ) : (
            <NavLink to="/login" className="btn btn-primary btn-sm btn-with-icon">
              <SignInIcon width={16} height={16} /> {t("signIn")}
            </NavLink>
          )}

          <LanguageSwitcher variant="nav-icon-btn" />

          <button
            className="theme-toggle"
            onClick={toggleTheme}
            aria-label="Toggle dark mode"
            title={theme === "light" ? "Switch to dark mode" : "Switch to light mode"}
          />
        </nav>
      </div>
    </header>
  );
}
