import { useEffect } from "react";
import { useLanguage } from "../context/LanguageContext";
import { DICTIONARY, PATTERNS, normalise } from "../i18n";

// General2 GEN_04: translates the whole interface — every page, button, label,
// placeholder and message — into Kinyarwanda or French from one dictionary
// (src/i18n). It works on the text the page renders, so it also covers pages
// and components added later; any text not in the dictionary simply stays in
// English. Content people typed (case titles, messages…) is never touched
// because it will not match a dictionary entry.
//
// To fix or add a translation edit src/i18n/dictionary.part*.js. While
// developing, run  window.__tgkMissingStrings()  in the browser console to list
// the English texts currently on screen that still have no translation.

const ATTRS = ["placeholder", "title", "aria-label", "alt"];
const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "TEXTAREA", "CODE", "PRE", "NOSCRIPT"]);
const missing = new Set();

function translateValue(raw, lang) {
  const key = normalise(raw);
  if (!key) return null;
  const hit = DICTIONARY[lang].get(key);
  if (hit) return hit;
  for (const [re, make] of PATTERNS) {
    const m = key.match(re);
    if (m) return make(m)[lang];
  }
  return null;
}

export default function AutoTranslate() {
  const { lang } = useLanguage();

  useEffect(() => {
    document.documentElement.lang = lang;
    const textState = new WeakMap(); // text node -> { orig, shown }
    const attrState = new WeakMap(); // element -> { attr: { orig, shown } }
    let scheduled = false;
    let observer;

    function skip(node) {
      for (let el = node.parentElement; el; el = el.parentElement) {
        if (SKIP_TAGS.has(el.tagName) || el.hasAttribute("data-notranslate") || el.isContentEditable) return true;
      }
      return false;
    }

    function doText(node) {
      const value = node.nodeValue;
      const st = textState.get(node);
      // React re-rendered the node with new text: that text is the new original.
      const orig = st && st.shown === value ? st.orig : value;
      if (skip(node)) return;
      if (lang === "en") {
        if (st && st.shown === value) {
          node.nodeValue = st.orig;
          textState.delete(node);
        }
        return;
      }
      const out = translateValue(orig, lang);
      if (out) {
        const lead = orig.match(/^\s*/)[0];
        const trail = orig.match(/\s*$/)[0];
        const shown = `${lead}${out}${trail}`;
        if (node.nodeValue !== shown) node.nodeValue = shown;
        textState.set(node, { orig, shown });
      } else if (normalise(orig) && /[A-Za-z]{3}/.test(orig)) {
        missing.add(normalise(orig));
      }
    }

    function doAttrs(el) {
      for (const attr of ATTRS) {
        if (!el.hasAttribute(attr)) continue;
        const value = el.getAttribute(attr);
        const states = attrState.get(el) || {};
        const st = states[attr];
        const orig = st && st.shown === value ? st.orig : value;
        if (lang === "en") {
          if (st && st.shown === value) el.setAttribute(attr, st.orig);
          if (st) { delete states[attr]; }
          continue;
        }
        const out = translateValue(orig, lang);
        if (out) {
          if (value !== out) el.setAttribute(attr, out);
          states[attr] = { orig, shown: out };
          attrState.set(el, states);
        }
      }
    }

    function pass() {
      scheduled = false;
      observer?.disconnect();
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      for (let n = walker.nextNode(); n; n = walker.nextNode()) doText(n);
      document.body.querySelectorAll(ATTRS.map((a) => `[${a}]`).join(",")).forEach(doAttrs);
      observe();
    }

    function schedule() {
      if (scheduled) return;
      scheduled = true;
      requestAnimationFrame(pass);
    }

    function observe() {
      observer?.observe(document.body, {
        childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS,
      });
    }

    observer = new MutationObserver(schedule);
    pass();

    window.__tgkMissingStrings = () => [...missing].sort();
    return () => {
      observer.disconnect();
      // Put the page back to English; the next language's effect translates afresh.
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        const st = textState.get(n);
        if (st && st.shown === n.nodeValue) n.nodeValue = st.orig;
      }
      document.body.querySelectorAll(ATTRS.map((a) => `[${a}]`).join(",")).forEach((el) => {
        const states = attrState.get(el);
        if (!states) return;
        for (const [attr, st] of Object.entries(states)) {
          if (el.getAttribute(attr) === st.shown) el.setAttribute(attr, st.orig);
        }
      });
    };
  }, [lang]);

  return null;
}
