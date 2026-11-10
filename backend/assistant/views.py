"""
The public assistant (General2 ADM_05 / GEN_03 / GEN_06).

It answers from three sources, best first:
  1. FAQ entries staff have added (and answers they gave to forwarded questions);
  2. the built-in multilingual knowledge base (assistant/knowledge.py);
  3. live, public-safe facts from the system itself — the status of a tracking
     code, how many cases were received/resolved, the categories and departments.
Questions are understood with a small TF-IDF retrieval model (assistant/engine.py)
that also learns from thumbs up/down. Anything it cannot answer with confidence
is forwarded to staff instead of guessed, and the person gets a reference code.

It needs no external API key. If ANTHROPIC_API_KEY is set, `call_llm()` is the
one place to wire in a real model; everything else keeps working either way.
"""

import os
import re
from collections import defaultdict

from django.contrib.auth import get_user_model
from django.db.models import Q
from django.utils import timezone
from rest_framework import permissions
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from common.permissions import RequireGroupPermission
from notifications.models import Notification
from .models import AnswerFeedback, AssistantQuestion, FAQEntry
from . import engine
from .knowledge import FOLLOWUP_LABELS, KNOWLEDGE, KNOWLEDGE_BY_KEY, SMALL_TALK

User = get_user_model()


DEFAULT_REPLY = {
    "en": "I can help with how Tanga Igitekerezo works — submitting anonymously, confidentially or under your name; tracking a case; replying to staff; using the QR code or USSD. What would you like to know?",
    "rw": "Nshobora kugufasha ku buryo Tanga Igitekerezo ikora — kohereza utazwi, mu ibanga cyangwa uzwi; gukurikirana ikirego; gusubiza abakozi; gukoresha kode ya QR cyangwa USSD. Wifuza kumenya iki?",
    "fr": "Je peux vous aider sur le fonctionnement de Tanga Igitekerezo : soumettre anonymement, confidentiellement ou sous votre nom ; suivre un dossier ; répondre au personnel ; utiliser le code QR ou l'USSD. Que souhaitez-vous savoir ?",
}
FORWARDED = {
    "en": "I don't have a reliable answer to that yet, so I've passed your question to our team. Your reference is {code} — type it here later and I'll show you their answer.",
    "rw": "Nta gisubizo cyizewe mfite kuri ibyo, ni yo mpavuye mpa itsinda ryacu ikibazo cyawe. Nimero yawe ni {code} — yandike hano nyuma nkwereke igisubizo cyabo.",
    "fr": "Je n'ai pas encore de réponse fiable, alors j'ai transmis votre question à notre équipe. Votre référence est {code} : saisissez-la ici plus tard et je vous montrerai leur réponse.",
}
STATUS_LABEL = {
    "received": {"en": "Received", "rw": "Yakiriwe", "fr": "Reçu"},
    "under_review": {"en": "Under Review", "rw": "Iri gusuzumwa", "fr": "En examen"},
    "assigned": {"en": "Assigned", "rw": "Yahawe", "fr": "Assigné"},
    "needs_info": {"en": "More Information Needed", "rw": "Hakenewe andi makuru", "fr": "Informations requises"},
    "responded": {"en": "Responded", "rw": "Yasubijwe", "fr": "Répondu"},
    "resolved": {"en": "Resolved", "rw": "Yakemutse", "fr": "Résolu"},
    "closed": {"en": "Closed", "rw": "Yafunzwe", "fr": "Clos"},
}
CODE_RE = re.compile(r"\bTG[KC]-\d{4}-(?:\d{2}-\d{2}-)?\d{3,5}\b", re.I)
STATS_RE = re.compile(r"how many|number of|statistic|\bstats\b|combien|how much|ibingahe|imibare|angahe", re.I)
DEPT_RE = re.compile(r"department|departement|service|ishami|amashami|which office|who handles|zone", re.I)
CATEGORY_RE = re.compile(r"categor|types? of|kinds? of|icyiciro|ibyiciro|catégorie|categorie", re.I)
THRESHOLD = 0.24        # confident enough to answer
MAYBE_THRESHOLD = 0.15  # close enough to offer "did you mean…"


def pick_language(message, requested):
    detected = engine.detect_language(message)
    if detected:
        return detected
    return requested if requested in ("en", "rw", "fr") else "en"


def build_index():
    """Staff FAQ entries and built-in knowledge, indexed together."""
    entries = list(FAQEntry.objects.filter(is_active=True))
    overridden = {e.source_key for e in entries if e.source_key}
    docs = [(f"kb:{k['key']}", k["match"]) for k in KNOWLEDGE if k["key"] not in overridden]
    for entry in entries:
        questions = f"{entry.question} {entry.question_rw} {entry.question_fr}"
        # A customised built-in topic keeps the rich phrasing of the original so it is
        # still recognised in all three languages.
        original = KNOWLEDGE_BY_KEY.get(entry.source_key, {}).get("match", "")
        docs.append((f"faq:{entry.id}", f"{questions} {questions} {original} {entry.answer[:300]}"))
    return engine.Index(docs)


def faq_answer(entry, lang):
    """The entry's answer in the asker's language, falling back to the main one."""
    return (getattr(entry, f"answer_{lang}", "") if lang in ("rw", "fr") else "") or entry.answer


def feedback_bias():
    """+/-25% on a score from how helpful past answers were rated."""
    totals = defaultdict(lambda: [0, 0])
    for key, helpful in AnswerFeedback.objects.values_list("key", "helpful"):
        totals[key][0 if helpful else 1] += 1
    return {k: max(-0.25, min(0.25, (up - down) / (up + down + 4))) for k, (up, down) in totals.items()}


def suggestions_for(keys, lang):
    labels = FOLLOWUP_LABELS.get(lang, FOLLOWUP_LABELS["en"])
    out = []
    for k in keys:
        if k in labels:
            out.append({"label": labels[k], "text": labels[k], "topic": k})
    return out[:3]


def small_talk(message, lang):
    words = set(re.findall(r"[a-z]+", engine.strip_accents(message.lower())))
    if not words or len(words) > 4:
        return None
    for group in SMALL_TALK.values():
        if words & group["words"] and not (words - group["words"] - {"you", "so", "much", "very", "a", "lot", "to", "all", "good", "morning", "afternoon", "evening", "again"}):
            return group["answers"][lang]
    return None


def tracking_answer(code, lang):
    from submissions.models import Submission
    sub = Submission.objects.filter(tracking_code=code.upper()).first()
    if not sub:
        return {
            "en": f"I couldn't find a case with the code {code.upper()}. Please check it and try again — for anonymous cases, the code is the only way to find them.",
            "rw": f"Sinabonye ikirego gifite nimero {code.upper()}. Reba neza wongere ugerageze — ku birego bitazwi, nimero niyo nzira yonyine yo kubibona.",
            "fr": f"Je n'ai trouvé aucun dossier avec le code {code.upper()}. Vérifiez-le et réessayez : pour les cas anonymes, le code est le seul moyen de les retrouver.",
        }[lang]
    label = STATUS_LABEL.get(sub.status, {}).get(lang, sub.status)
    when = sub.updated_at.strftime("%d %b %Y")
    n = sub.responses.filter(is_from_owner=False).count()
    return {
        "en": f"Case {sub.tracking_code} is currently “{label}” (last updated {when}) and has {n} reply(ies) from the institution. Open the Track page with this code to read the full history.",
        "rw": f"Ikirego {sub.tracking_code} kiri ku rwego rwa «{label}» (cyavuguruwe {when}) kandi gifite ibisubizo {n} by'ikigo. Fungura «Kurikirana» ukoresheje iyi nimero usome amateka yose.",
        "fr": f"Le dossier {sub.tracking_code} est actuellement « {label} » (mis à jour le {when}) avec {n} réponse(s) de l'institution. Ouvrez la page Suivre avec ce code pour tout l'historique.",
    }[lang]


def stats_answer(lang):
    from submissions.models import Submission
    total = Submission.objects.count()
    done = Submission.objects.filter(status__in=["resolved", "closed"]).count()
    return {
        "en": f"So far {total} submission(s) have been received and {done} of them are resolved or closed.",
        "rw": f"Kugeza ubu hamaze kwakirwa ibyoherejwe {total}, muri byo {done} byakemutse cyangwa byafunzwe.",
        "fr": f"À ce jour, {total} soumission(s) ont été reçues et {done} sont résolues ou closes.",
    }[lang]


def categories_line(lang):
    from submissions.models import Category
    names = []
    for c in Category.objects.filter(is_active=True):
        names.append((getattr(c, f"name_{lang}", "") if lang != "en" else "") or c.name)
    if not names:
        return ""
    return {"en": "Categories available right now: ", "rw": "Ibyiciro biboneka ubu: ", "fr": "Catégories disponibles : "}[lang] + ", ".join(names) + "."


def departments_line(lang):
    from accounts.models import Department
    names = []
    for d in Department.objects.filter(is_active=True):
        names.append((getattr(d, f"name_{lang}", "") if lang != "en" else "") or d.name)
    if not names:
        return ""
    return {
        "en": "You can route a submission to one of these departments (or leave it blank and we will route it): ",
        "rw": "Ushobora kohereza ikirego ku rimwe muri aya mashami (cyangwa ukareka ubusa tukakohereza): ",
        "fr": "Vous pouvez orienter une soumission vers l'un de ces services (ou laisser vide, nous l'orienterons) : ",
    }[lang] + ", ".join(names) + "."


def call_llm(message, history):
    """Plug a real model in here if ANTHROPIC_API_KEY (or similar) is set.
    Returns None to fall back to the built-in assistant."""
    if not os.environ.get("ANTHROPIC_API_KEY"):
        return None
    # Intentionally left as an integration point rather than a live call.
    return None


ANSWER_PERMISSION = "can_answer_assistant_questions"


def notify_answerers(question):
    """Tell everyone allowed to answer assistant questions that one is waiting."""
    users = User.objects.filter(is_active=True).filter(
        Q(role="admin") | Q(groups__permissions__codename=ANSWER_PERMISSION)
    ).distinct()
    Notification.objects.bulk_create([
        Notification(
            user=u, message=f"The AI assistant needs an answer to a question ({question.code}).",
            link="/staff/assistant-questions",
        )
        for u in users
    ])


def topic_answer(key, lang):
    """A suggestion chip was tapped: answer that topic directly (no guessing)."""
    item = KNOWLEDGE_BY_KEY.get(key)
    if not item:
        return None
    reply = item["answers"][lang]
    if key == "categories":
        extra = categories_line(lang)
        reply = f"{reply}\n\n{extra}" if extra else reply
    return {"reply": reply, "source": "kb", "key": f"kb:{key}", "suggestions": suggestions_for(item.get("followups", []), lang)}


def answer_question(message, requested_lang="en", topic=None):
    """Returns (payload dict, forward: bool)."""
    if topic and requested_lang in ("en", "rw", "fr"):
        direct = topic_answer(topic, requested_lang)
        if direct:
            return direct, False
    lang = pick_language(message, requested_lang)

    m = CODE_RE.search(message)
    if m:
        return {"reply": tracking_answer(m.group(0), lang), "source": "system"}, False

    talk = small_talk(message, lang)
    if talk:
        return {"reply": talk, "source": "kb", "suggestions": suggestions_for(["how_submit", "track", "ussd"], lang)}, False

    if STATS_RE.search(message) and re.search(r"submission|case|complaint|suggestion|resolved|dossier|soumission|ikirego|igitekerezo", message, re.I):
        return {"reply": stats_answer(lang), "source": "system"}, False

    index = build_index()
    bias = feedback_bias()
    ranked = [(k, sc * (1 + bias.get(k, 0.0))) for k, sc in index.search(message, top=4)]
    ranked.sort(key=lambda kv: kv[1], reverse=True)

    # Staff-written FAQs win ties: a person wrote that answer for exactly this question.
    if ranked:
        best_key, best = ranked[0]
        for k, sc in ranked:
            if k.startswith("faq:") and sc >= best * 0.9:
                best_key, best = k, sc
                break
        if best >= THRESHOLD:
            if best_key.startswith("faq:"):
                entry = FAQEntry.objects.filter(pk=int(best_key[4:]), is_active=True).first()
                if entry:
                    return {"reply": faq_answer(entry, lang), "source": "faq", "key": best_key}, False
            else:
                item = KNOWLEDGE_BY_KEY[best_key[3:]]
                reply = item["answers"][lang]
                if item["key"] == "categories" or (CATEGORY_RE.search(message) and item["key"] in {"categories"}):
                    extra = categories_line(lang)
                    reply = f"{reply}\n\n{extra}" if extra else reply
                if DEPT_RE.search(message):
                    extra = departments_line(lang)
                    reply = f"{reply}\n\n{extra}" if extra else reply
                return {
                    "reply": reply, "source": "kb", "key": best_key,
                    "suggestions": suggestions_for(item.get("followups", []), lang),
                }, False
        if best >= MAYBE_THRESHOLD:
            labels = FOLLOWUP_LABELS.get(lang, FOLLOWUP_LABELS["en"])
            options = [labels[k[3:]] for k, _ in ranked if k.startswith("kb:") and k[3:] in labels][:3]
            if options:
                lead = {
                    "en": "I'm not completely sure what you mean. Did you want to know one of these?",
                    "rw": "Simbyumvise neza. Wari ushaka kumenya kimwe muri ibi?",
                    "fr": "Je ne suis pas certain de comprendre. Vouliez-vous savoir l'une de ces choses ?",
                }[lang]
                return {"reply": lead, "source": "kb", "suggestions": [{"label": o, "text": o, "topic": k[3:]} for o, k in zip(options, [kk for kk, _ in ranked if kk.startswith("kb:") and kk[3:] in labels])]}, False

    if DEPT_RE.search(message):
        line = departments_line(lang)
        if line:
            return {"reply": line, "source": "system"}, False

    if len(engine.tokenize(message)) < 2:
        return {"reply": DEFAULT_REPLY[lang], "source": "kb", "suggestions": suggestions_for(["how_submit", "track", "ussd"], lang)}, False
    return {"lang": lang}, True


class AssistantView(APIView):
    """Reads the question, answers from FAQs/knowledge/system data when it can
    and — when it can't — forwards the question to approved staff instead of
    guessing. The asker gets a reference code to come back for the answer."""

    permission_classes = [AllowAny]

    def post(self, request):
        message = (request.data.get("message") or "").strip()[:500]
        history = request.data.get("history") or []
        lang = request.data.get("lang") or "en"
        if not message:
            return Response({"reply": DEFAULT_REPLY.get(lang, DEFAULT_REPLY["en"]), "source": "kb"})

        llm_reply = call_llm(message, history)
        if llm_reply:
            return Response({"reply": llm_reply, "source": "llm"})

        payload, forward = answer_question(message, lang, topic=request.data.get("topic"))
        if not forward:
            return Response(payload)

        q = AssistantQuestion.objects.filter(question__iexact=message, status="pending").first()
        if not q:
            q = AssistantQuestion.objects.create(question=message)
            notify_answerers(q)
        return Response({
            "reply": FORWARDED[payload["lang"]].format(code=q.code),
            "source": "forwarded", "code": q.code,
        })


class AssistantFeedbackView(APIView):
    """Thumbs up / down on an answer — helps the assistant prefer good answers."""

    permission_classes = [AllowAny]

    def post(self, request):
        key = str(request.data.get("key") or "")[:60]
        if not (key.startswith("kb:") or key.startswith("faq:")):
            return Response({"detail": "Unknown answer."}, status=400)
        AnswerFeedback.objects.create(
            key=key, helpful=bool(request.data.get("helpful")),
            question=str(request.data.get("question") or "")[:500],
        )
        return Response({"detail": "Thanks for the feedback."}, status=201)


class AssistantQuestionStatusView(APIView):
    """Public: the asker checks on a forwarded question with its code."""

    permission_classes = [AllowAny]

    def get(self, request, code):
        q = AssistantQuestion.objects.filter(code=code.upper()).first()
        if not q:
            return Response({"detail": "No question found with that code."}, status=404)
        return Response({
            "code": q.code, "question": q.question, "status": q.status,
            "answer": q.answer if q.status == "answered" else "",
        })


class AssistantQuestionListView(APIView):
    """Staff with the 'answer assistant questions' permission see what the
    AI couldn't answer."""

    permission_classes = [permissions.IsAuthenticated, RequireGroupPermission(ANSWER_PERMISSION)]

    def get(self, request):
        status_filter = request.query_params.get("status", "pending")
        qs = AssistantQuestion.objects.select_related("answered_by")
        if status_filter in {"pending", "answered"}:
            qs = qs.filter(status=status_filter)
        return Response([
            {
                "id": q.id, "code": q.code, "question": q.question, "status": q.status, "answer": q.answer,
                "created_at": q.created_at, "answered_at": q.answered_at,
                "answered_by": (q.answered_by.get_full_name() or q.answered_by.username) if q.answered_by else None,
            }
            for q in qs[:200]
        ])


class AssistantQuestionAnswerView(APIView):
    permission_classes = [permissions.IsAuthenticated, RequireGroupPermission(ANSWER_PERMISSION)]

    def post(self, request, pk):
        q = AssistantQuestion.objects.filter(pk=pk).first()
        if not q:
            return Response({"detail": "Question not found."}, status=404)
        answer = (request.data.get("answer") or "").strip()
        if not answer:
            return Response({"detail": "Write an answer first."}, status=400)
        q.answer = answer
        q.status = AssistantQuestion.Status.ANSWERED
        q.answered_by = request.user
        q.answered_at = timezone.now()
        q.save()
        if request.data.get("add_to_faq") in (True, "true", "1", 1):
            FAQEntry.objects.get_or_create(question=q.question[:500], defaults={"answer": answer})
        return Response({"id": q.id, "code": q.code, "status": q.status})


def _builtin_question(item):
    """A readable question for a built-in topic: the first sentence of its match text."""
    first = item["match"].split("?")[0].strip()
    return (first + "?") if first else item["key"]


class FAQEntryView(APIView):
    """Admin3 ADM_02: list / add the assistant's FAQ entries. Changes are used by
    the assistant straight away (the index is rebuilt on every question)."""

    permission_classes = [permissions.IsAuthenticated, RequireGroupPermission(ANSWER_PERMISSION)]

    FIELDS = ("question", "question_rw", "question_fr", "answer", "answer_rw", "answer_fr", "is_active")

    @staticmethod
    def dump(e):
        return {
            "id": e.id, "question": e.question, "question_rw": e.question_rw, "question_fr": e.question_fr,
            "answer": e.answer, "answer_rw": e.answer_rw, "answer_fr": e.answer_fr,
            "is_active": e.is_active, "source_key": e.source_key, "created_at": e.created_at,
        }

    def get(self, request):
        return Response([self.dump(e) for e in FAQEntry.objects.all()])

    def post(self, request):
        data = {f: request.data.get(f) for f in self.FIELDS if f in request.data}
        question = (data.get("question") or "").strip()
        answer = (data.get("answer") or "").strip()
        if not question or not answer:
            return Response({"detail": "A question and an answer are both needed."}, status=400)
        entry = FAQEntry.objects.create(
            question=question[:500], answer=answer,
            question_rw=(data.get("question_rw") or "").strip()[:500], question_fr=(data.get("question_fr") or "").strip()[:500],
            answer_rw=(data.get("answer_rw") or "").strip(), answer_fr=(data.get("answer_fr") or "").strip(),
            source_key=str(request.data.get("source_key") or "")[:60],
            is_active=data.get("is_active", True) not in (False, "false", 0),
        )
        return Response(self.dump(entry), status=201)


class FAQEntryDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated, RequireGroupPermission(ANSWER_PERMISSION)]

    def patch(self, request, pk):
        entry = FAQEntry.objects.filter(pk=pk).first()
        if not entry:
            return Response({"detail": "Not found."}, status=404)
        for f in FAQEntryView.FIELDS:
            if f in request.data:
                value = request.data[f]
                if f == "is_active":
                    value = value not in (False, "false", 0)
                else:
                    value = (value or "").strip()
                    if f in ("question", "answer") and not value:
                        return Response({"detail": "A question and an answer are both needed."}, status=400)
                setattr(entry, f, value[:500] if f.startswith("question") else value)
        entry.save()
        return Response(FAQEntryView.dump(entry))

    def delete(self, request, pk):
        FAQEntry.objects.filter(pk=pk).delete()
        return Response(status=204)


class BuiltinTopicsView(APIView):
    """The topics the assistant already knows. Admins can customise one — that
    copies it into an editable FAQ entry which then replaces the built-in answer."""

    permission_classes = [permissions.IsAuthenticated, RequireGroupPermission(ANSWER_PERMISSION)]

    def get(self, request):
        customised = {e.source_key: e.id for e in FAQEntry.objects.exclude(source_key="")}
        return Response([
            {"key": k["key"], "question": _builtin_question(k), "answer": k["answers"]["en"],
             "customised_entry": customised.get(k["key"])}
            for k in KNOWLEDGE
        ])

    def post(self, request):
        item = KNOWLEDGE_BY_KEY.get(str(request.data.get("key") or ""))
        if not item:
            return Response({"detail": "Unknown topic."}, status=400)
        entry, _ = FAQEntry.objects.get_or_create(
            source_key=item["key"],
            defaults={
                "question": _builtin_question(item), "answer": item["answers"]["en"],
                "answer_rw": item["answers"]["rw"], "answer_fr": item["answers"]["fr"],
            },
        )
        return Response(FAQEntryView.dump(entry), status=201)


class AssistantQuestionDeleteView(APIView):
    permission_classes = [permissions.IsAuthenticated, RequireGroupPermission(ANSWER_PERMISSION)]

    def delete(self, request, pk):
        AssistantQuestion.objects.filter(pk=pk).delete()
        return Response(status=204)
