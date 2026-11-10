import { ROWS } from "./dictionary.part1";
import { ROWS2 } from "./dictionary.part2";
import { ROWS3 } from "./dictionary.part3";

const normalise = (s) => s.replace(/\s+/g, " ").trim();

export const DICTIONARY = { rw: new Map(), fr: new Map() };

for (const [en, rw, fr] of [...ROWS, ...ROWS2, ...ROWS3]) {
  const key = normalise(en);
  DICTIONARY.rw.set(key, rw);
  DICTIONARY.fr.set(key, fr);
}

// Texts that contain a number or name that changes, e.g. "3 selected".
// Each entry: [pattern on the English text, (matches) => {rw, fr}].
export const PATTERNS = [
  [/^(\d+) selected$/, (m) => ({ rw: `${m[1]} byahiswemo`, fr: `${m[1]} sélectionné(s)` })],
  [/^(\d+) rating(s)?$/, (m) => ({ rw: `Amanota ${m[1]}`, fr: `${m[1]} note(s)` })],
  [/^(\d+) files?$/, (m) => ({ rw: `Dosiye ${m[1]}`, fr: `${m[1]} fichier(s)` })],
  [/^Page (\d+)$/, (m) => ({ rw: `Urupapuro rwa ${m[1]}`, fr: `Page ${m[1]}` })],
  [/^Hi, (.+)$/, (m) => ({ rw: `Muraho, ${m[1]}`, fr: `Bonjour, ${m[1]}` })],
  [/^Open case (TG[KC]-[\w-]+) →$/, (m) => ({ rw: `Fungura ikirego ${m[1]} →`, fr: `Ouvrir le dossier ${m[1]} →` })],
  [/^(\d+) pinned messages?$/, (m) => ({ rw: `Ubutumwa ${m[1]} bufite akarango`, fr: `${m[1]} message(s) épinglé(s)` })],
  [/^📌 (\d+) pinned messages?$/, (m) => ({ rw: `📌 Ubutumwa ${m[1]} bufite akarango`, fr: `📌 ${m[1]} message(s) épinglé(s)` })],
  [/^Replying to (.+)$/, (m) => ({ rw: `Usubiza ${m[1]}`, fr: `Réponse à ${m[1]}` })],
  [/^Dial (\*\d+#)$/, (m) => ({ rw: `Kanda ${m[1]}`, fr: `Composer ${m[1]}` })],
  [/^No smartphone\? Dial (\*\d+#)$/, (m) => ({ rw: `Nta telefoni igezweho? Kanda ${m[1]}`, fr: `Pas de smartphone ? Composez ${m[1]}` })],
  [/^No smartphone\? Just dial (\*\d+#)$/, (m) => ({ rw: `Nta telefoni igezweho? Kanda gusa ${m[1]}`, fr: `Pas de smartphone ? Composez simplement ${m[1]}` })],
  [/^Type (\*\d+#) and press the green call button\.$/, (m) => ({ rw: `Andika ${m[1]} ukande akabuto k'icyatsi ko guhamagara.`, fr: `Tapez ${m[1]} et appuyez sur le bouton vert d'appel.` })],
  [/^⚑ (high|medium|low)( priority)?$/i, (m) => {
    const lvl = m[1].toLowerCase();
    const rw = { high: "Hejuru", medium: "Hagati", low: "Hasi" }[lvl];
    const fr = { high: "Haute", medium: "Moyenne", low: "Basse" }[lvl];
    return { rw: `⚑ ${rw}`, fr: `⚑ ${fr}` };
  }],
];

export { normalise };
