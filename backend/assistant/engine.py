"""General2 GEN_06: the assistant's language engine — pure Python, no
dependencies, no Django imports (so it is easy to test).

It is a small retrieval model:
  * text is normalised (lower-case, accents removed) and stemmed lightly;
  * every knowledge item / FAQ entry becomes a TF-IDF vector over words plus
    word pairs, in English, Kinyarwanda and French together;
  * a question is scored against all of them by cosine similarity, with a
    little help from synonyms and from how people rated past answers
    (thumbs up / down) — so it keeps improving as staff add FAQs and users
    give feedback.
"""
import math
import re
import unicodedata
from collections import Counter

STOPWORDS = {
    # English
    "a", "an", "the", "is", "are", "was", "were", "do", "does", "did", "i", "my", "me", "we", "you", "your",
    "to", "of", "in", "on", "for", "and", "or", "it", "this", "that", "can", "will", "would", "should", "could",
    "be", "with", "about", "please", "there", "any", "if", "am", "have", "has", "at", "by", "from", "as", "so",
    "what", "when", "where", "who", "why", "how", "which", "tell", "need", "want", "know", "get",
    # French
    "le", "la", "les", "un", "une", "des", "du", "de", "et", "ou", "est", "sont", "je", "mon", "ma", "mes",
    "vous", "votre", "nous", "pour", "dans", "sur", "que", "qui", "quoi", "comment", "quand", "ou", "pas", "ce",
    "cette", "ces", "au", "aux", "en", "il", "elle", "on", "si", "avec", "peut", "puis", "dois", "veux",
    # Kinyarwanda
    "ni", "na", "mu", "ku", "wa", "ya", "cya", "bya", "rya", "za", "ba", "a", "se", "nde", "iki", "uyu", "uru",
    "ibi", "izi", "nka", "kandi", "ariko", "kuko", "niba", "ese", "nta", "ntabwo",
}

# Words that mean the same thing for our purposes -> one canonical token.
SYNONYMS = {
    "suggestion": "idea", "suggest": "idea", "proposal": "idea", "igitekerezo": "idea", "ibitekerezo": "idea",
    "gitekerezo": "idea", "suggestions": "idea", "idee": "idea",
    "complaint": "complain", "complaints": "complain", "grievance": "complain", "ikirego": "complain",
    "ibirego": "complain", "plainte": "complain", "plaintes": "complain", "problem": "complain",
    "issue": "complain", "ikibazo": "complain", "probleme": "complain",
    "send": "submit", "post": "submit", "file": "submit", "lodge": "submit", "ohereza": "submit",
    "kohereza": "submit", "gutanga": "submit", "tanga": "submit", "soumettre": "submit", "envoyer": "submit",
    "deposer": "submit", "register": "submit",
    "follow": "track", "check": "track", "monitor": "track", "kurikirana": "track", "gukurikirana": "track",
    "suivre": "track", "suivi": "track", "status": "track", "progress": "track", "state": "track",
    "code": "code", "number": "code", "reference": "code", "nimero": "code", "numero": "code",
    "ticket": "code", "kode": "code", "referans": "code",
    "anonymous": "anonymous", "anonymously": "anonymous", "anonyme": "anonymous", "utazwi": "anonymous",
    "anonim": "anonymous", "nameless": "anonymous", "untraceable": "anonymous",
    "secret": "confidential", "private": "confidential", "confidentiel": "confidential",
    "ibanga": "confidential", "privacy": "confidential", "confidentiality": "confidential",
    "prive": "confidential", "privee": "confidential",
    "answer": "reply", "response": "reply", "respond": "reply", "igisubizo": "reply", "gusubiza": "reply",
    "reponse": "reply", "repondre": "reply", "feedback": "reply",
    "phone": "phone", "smartphone": "phone", "telephone": "phone", "mobile": "phone", "telefoni": "phone",
    "telephoneportable": "phone", "feature": "phone", "basic": "phone", "kinyarwanda": "language",
    "ikinyarwanda": "language", "french": "language", "francais": "language", "ikinyafaransa": "language",
    "english": "language", "icyongereza": "language", "langue": "language", "language": "language",
    "ururimi": "language", "langage": "language",
    "free": "cost", "gratuit": "cost", "price": "cost", "fee": "cost", "pay": "cost", "payer": "cost",
    "amafaranga": "cost", "ubuntu": "cost", "kwishyura": "cost", "cost": "cost", "charge": "cost",
    "urgent": "priority", "emergency": "priority", "important": "priority", "priorite": "priority",
    "ihutirwa": "priority", "serious": "priority",
    "password": "password", "mot": "password", "passe": "password", "ijambo": "password", "banga": "password",
    "login": "signin", "signin": "signin", "connexion": "signin", "connect": "signin", "kwinjira": "signin",
    "account": "account", "compte": "account", "konti": "account", "signup": "account", "inscription": "account",
    "register": "account",
    "scan": "qr", "qr": "qr", "qrcode": "qr", "code-qr": "qr", "camera": "qr",
    "ussd": "ussd", "dial": "ussd", "502": "ussd", "composer": "ussd", "gukanda": "ussd",
    "rate": "rating", "rating": "rating", "satisfaction": "rating", "satisfied": "rating", "ishimwe": "praise",
    "appreciation": "praise", "thanks": "praise", "compliment": "praise", "praise": "praise",
    "remerciement": "praise", "gushimira": "praise", "thank": "praise", "merci": "praise", "feliciter": "praise",
    "time": "duration", "long": "duration", "duration": "duration", "delay": "duration", "delai": "duration",
    "igihe": "duration", "days": "duration", "quand": "duration", "vuba": "duration", "fast": "duration",
    "close": "close", "closed": "close", "closing": "close", "cloture": "close", "gufunga": "close",
    "attachment": "attach", "attach": "attach", "upload": "attach", "photo": "attach", "document": "attach",
    "pdf": "attach", "fichier": "attach", "dosiye": "attach", "pj": "attach",
    "edit": "edit", "change": "edit", "modify": "edit", "withdraw": "edit", "delete": "edit", "modifier": "edit",
    "gukosora": "edit", "guhindura": "edit",
    "lost": "lost", "forgot": "lost", "forget": "lost", "forgotten": "lost", "perdu": "lost", "oublie": "lost",
    "nibagiwe": "lost", "yazimiye": "lost", "missing": "lost",
    "staff": "staff", "officer": "staff", "employee": "staff", "personnel": "staff", "abakozi": "staff",
    "agent": "staff",
    "contact": "contact", "email": "contact", "call": "contact", "support": "contact", "help": "contact",
    "twandikire": "contact", "aide": "contact", "adresse": "contact",
}

TOKEN_RE = re.compile(r"[a-z0-9]+")


def strip_accents(text):
    return "".join(c for c in unicodedata.normalize("NFKD", text or "") if not unicodedata.combining(c))


def stem(word):
    if len(word) > 4:
        for suffix in ("ing", "ed", "es", "ly", "s", "x"):
            if word.endswith(suffix) and len(word) - len(suffix) >= 3:
                return word[: -len(suffix)]
    return word


def tokenize(text):
    text = strip_accents((text or "").lower()).replace("'", "")
    out = []
    for raw in TOKEN_RE.findall(text):
        if raw in STOPWORDS:
            continue
        tok = SYNONYMS.get(raw) or SYNONYMS.get(stem(raw)) or stem(raw)
        if len(tok) > 1 or tok.isdigit():
            out.append(tok)
    return out


def features(text):
    """Words plus adjacent word pairs (pairs reward matching phrases)."""
    toks = tokenize(text)
    feats = list(toks)
    feats += [f"{a}_{b}" for a, b in zip(toks, toks[1:])]
    return feats


class Index:
    """TF-IDF index over (key, text) documents."""

    def __init__(self, docs):
        self.keys = []
        self.vectors = []
        counts = []
        for key, text in docs:
            self.keys.append(key)
            counts.append(Counter(features(text)))
        n = max(len(counts), 1)
        df = Counter()
        for c in counts:
            df.update(c.keys())
        self.idf = {t: math.log((1 + n) / (1 + d)) + 1.0 for t, d in df.items()}
        for c in counts:
            vec = {t: (1 + math.log(f)) * self.idf[t] for t, f in c.items()}
            norm = math.sqrt(sum(v * v for v in vec.values())) or 1.0
            self.vectors.append({t: v / norm for t, v in vec.items()})

    def search(self, query, top=3):
        q = Counter(features(query))
        qvec = {t: (1 + math.log(f)) * self.idf.get(t, 0.0) for t, f in q.items() if t in self.idf}
        norm = math.sqrt(sum(v * v for v in qvec.values()))
        if not qvec or norm == 0:
            return []
        scored = []
        for key, vec in zip(self.keys, self.vectors):
            dot = sum(w * vec.get(t, 0.0) for t, w in qvec.items())
            if dot > 0:
                # Coverage: how much of the question the document actually explains.
                matched = sum(w for t, w in qvec.items() if t in vec)
                coverage = matched / sum(qvec.values())
                scored.append((key, dot / norm * (0.5 + 0.5 * coverage)))
        scored.sort(key=lambda kv: kv[1], reverse=True)
        return scored[:top]


# --- language detection (just enough to answer in the asker's language) -----
_RW = {"nigute", "ndashaka", "nshaka", "ni", "mu", "ku", "kandi", "igitekerezo", "ikirego", "ohereza", "kurikirana",
       "nimero", "murakoze", "muraho", "mwiriwe", "ese", "gute", "uko", "nabona", "nshobora", "nta", "ubwo",
       "igihe", "igisubizo", "ibanga", "abakozi", "telefoni", "yanjye", "wanjye", "nkeneye", "bimeze", "bite"}
_FR = {"comment", "je", "mon", "ma", "mes", "pour", "est", "une", "des", "les", "vous", "puis", "peut", "où", "quand",
       "bonjour", "merci", "suivre", "soumettre", "plainte", "suggestion", "avoir", "dois", "veux", "pas", "quel"}


def detect_language(text):
    words = set(TOKEN_RE.findall(strip_accents((text or "").lower())))
    rw = len(words & _RW)
    fr = len(words & {strip_accents(w) for w in _FR})
    if rw >= 2 or (rw == 1 and fr == 0 and rw > 0 and len(words) <= 3):
        return "rw"
    if fr >= 2:
        return "fr"
    return None
