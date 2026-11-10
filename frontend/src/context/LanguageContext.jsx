import { createContext, useContext, useState } from "react";

const TRANSLATIONS = {
  en: {
    home: "Home", submit: "Submit", track: "Track", dashboard: "Dashboard",
    signIn: "Staff sign in", signOut: "Sign out",
    heroTitle: "Every idea dropped in the box gets an answer.",
    footerAbout: "About", footerQuickLinks: "Quick Links", footerContact: "Contact", footerLegal: "Legal",
    footerTagline: "A digital Agasanduku k'Ibitekerezo — every voice reviewed, routed, and answered.",
    rights: "All rights reserved.",
  },
  rw: {
    home: "Ahabanza", submit: "Ohereza", track: "Kurikirana", dashboard: "Ikibaho",
    signIn: "Kwinjira k'abakozi", signOut: "Gusohoka",
    heroTitle: "Buri gitekerezo cyashyizwe mu kabati kigira igisubizo.",
    footerAbout: "Ibirebana natwe", footerQuickLinks: "Ihuza ryihuse", footerContact: "Twandikire", footerLegal: "Amategeko",
    footerTagline: "Agasanduku k'Ibitekerezo ka digitale — buri jwi risuzumwa, rikoherezwa, rikanasubizwa.",
    rights: "Uburenganzira bwose burarindwa.",
  },
  fr: {
    home: "Accueil", submit: "Soumettre", track: "Suivre", dashboard: "Tableau de bord",
    signIn: "Connexion du personnel", signOut: "Se déconnecter",
    heroTitle: "Chaque idée déposée dans la boîte reçoit une réponse.",
    footerAbout: "À propos", footerQuickLinks: "Liens rapides", footerContact: "Contact", footerLegal: "Mentions légales",
    footerTagline: "Une Agasanduku k'Ibitekerezo numérique — chaque avis examiné, orienté et traité.",
    rights: "Tous droits réservés.",
  },
};

const LanguageContext = createContext(null);

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState(() => localStorage.getItem("tgk_lang") || "en");

  function changeLang(next) {
    setLang(next);
    localStorage.setItem("tgk_lang", next);
  }

  function t(key) {
    return TRANSLATIONS[lang]?.[key] || TRANSLATIONS.en[key] || key;
  }

  return (
    <LanguageContext.Provider value={{ lang, changeLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
