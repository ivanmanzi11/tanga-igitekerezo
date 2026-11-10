import { Link } from "react-router-dom";
import { useLanguage } from "../context/LanguageContext";
import { useTheme } from "../context/ThemeContext";
import LanguageSwitcher from "./LanguageSwitcher";
import coatOfArms from "../assets/coat-of-arms.webp";

export default function Footer() {
  const { t } = useLanguage();
  const { theme, toggleTheme } = useTheme();

  return (
    <footer className="site-footer">
      <div className="site-footer-grid">
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
            <img src={coatOfArms} alt="Coat of arms of Rwanda" className="footer-logo" />
            <span className="brand-name">Tanga Igitekerezo</span>
          </div>
          <p style={{ fontSize: "0.85rem", maxWidth: "32ch" }}>{t("footerTagline")}</p>
        </div>
        <div>
          <h5>{t("footerQuickLinks")}</h5>
          <Link to="/">{t("home")}</Link>
          <Link to="/submit">{t("submit")}</Link>
          <Link to="/track">{t("track")}</Link>
          <Link to="/access">Ways to access</Link>
          <Link to="/login">{t("signIn")}</Link>
        </div>
        <div>
          <h5>{t("footerAbout")}</h5>
          <a href="#">How it works</a>
          <a href="#">Privacy &amp; confidentiality</a>
          <a href="#">Accessibility</a>
        </div>
        <div>
          <h5>{t("footerContact")}</h5>
          <a href="mailto:info@minijust.gov.rw">info@minijust.gov.rw</a>
          <a href="tel:3936">3936</a>
          <a href="#">Kigali, Rwanda</a>
        </div>
      </div>
      <div className="footer-prefs">
        <span>Language</span>
        <LanguageSwitcher variant="icon-btn" />
        <span>Appearance</span>
        <button type="button" className="icon-btn" onClick={toggleTheme} aria-label="Toggle dark mode"
          title={theme === "light" ? "Switch to dark mode" : "Switch to light mode"}>
          {theme === "light" ? "🌙" : "☀️"}
        </button>
      </div>
      <div className="site-footer-bottom">
        <span>&copy; {new Date().getFullYear()} Tanga Igitekerezo. {t("rights")}</span>
        <span>{t("footerLegal")}</span>
      </div>
    </footer>
  );
}
