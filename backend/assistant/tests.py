from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from .models import AssistantQuestion, FAQEntry

User = get_user_model()


class AssistantTests(TestCase):
    """General2 GEN_03: answer from FAQs, otherwise forward to approved staff."""

    def setUp(self):
        self.admin = User.objects.create_user(username="adm", password="x", role="admin")
        self.api = APIClient()

    def ask(self, text):
        return self.api.post("/api/assistant/", {"message": text}, format="json").json()

    def test_builtin_knowledge_answers_in_the_askers_language(self):
        self.assertEqual(self.ask("how do I track my case?")["source"], "kb")
        fr = self.api.post("/api/assistant/", {"message": "Comment suivre ma plainte ?", "lang": "fr"}, format="json").json()
        self.assertIn("code de suivi", fr["reply"])
        rw = self.api.post("/api/assistant/", {"message": "Nigute nohereza igitekerezo?"}, format="json").json()
        self.assertIn("Ohereza", rw["reply"])

    def test_contact_details_are_the_ministry_ones(self):
        reply = self.ask("How can I contact you?")["reply"]
        self.assertIn("info@minijust.gov.rw", reply)
        self.assertIn("3936", reply)

    def test_ussd_question_gets_the_ussd_answer(self):
        data = self.ask("I don't have a smartphone, how can I use this?")
        self.assertIn("*502#", data["reply"])

    def test_tracking_code_lookup_uses_live_data(self):
        from submissions.models import Category, Submission
        cat = Category.objects.create(name="C")
        sub = Submission.objects.create(title="t", description="d", category=cat, submission_type="anonymous")
        data = self.ask(f"what is the status of {sub.tracking_code}?")
        self.assertEqual(data["source"], "system")
        self.assertIn(sub.tracking_code, data["reply"])

    def test_feedback_is_recorded(self):
        res = self.api.post("/api/assistant/feedback/", {"key": "kb:track", "helpful": True}, format="json")
        self.assertEqual(res.status_code, 201)

    def test_unknown_question_is_forwarded_with_a_code(self):
        data = self.ask("Which office issues parking permits for visitors?")
        self.assertEqual(data["source"], "forwarded")
        q = AssistantQuestion.objects.get(code=data["code"])
        self.assertEqual(q.status, "pending")

    def test_small_talk_is_not_forwarded(self):
        self.ask("hello")
        self.assertEqual(AssistantQuestion.objects.count(), 0)

    def test_staff_answer_reaches_the_asker_and_can_teach_the_faq(self):
        code = self.ask("Which office issues parking permits for visitors?")["code"]
        staff = APIClient(); staff.force_authenticate(self.admin)
        q = AssistantQuestion.objects.get(code=code)
        res = staff.post(f"/api/assistant/questions/{q.id}/answer/",
                         {"answer": "Visit the Facilities office.", "add_to_faq": True}, format="json")
        self.assertEqual(res.status_code, 200, res.content)
        status = self.api.get(f"/api/assistant/questions/{code}/").json()
        self.assertEqual(status["answer"], "Visit the Facilities office.")
        self.assertTrue(FAQEntry.objects.exists())
        # next time the assistant answers it itself
        again = self.ask("Which office issues parking permits for visitors?")
        self.assertEqual(again["source"], "faq")
        self.assertIn("Facilities", again["reply"])

    def test_answering_needs_the_permission(self):
        officer = User.objects.create_user(username="o", password="x", role="officer")
        api = APIClient(); api.force_authenticate(officer)
        self.assertEqual(api.get("/api/assistant/questions/").status_code, 403)


class FAQManagementTests(TestCase):
    """Admin3 ADM_02: an admin manages FAQ entries and the assistant uses them at once."""

    def setUp(self):
        self.admin = User.objects.create_user(username="adm", password="x", role="admin")
        self.api = APIClient(); self.api.force_authenticate(self.admin)
        self.public = APIClient()

    def test_admin_adds_edits_and_deletes_and_assistant_follows(self):
        res = self.api.post("/api/assistant/faq/", {
            "question": "Where is the head office parking?", "answer": "Behind the main building.",
            "answer_fr": "Derrière le bâtiment principal.",
        }, format="json")
        self.assertEqual(res.status_code, 201, res.content)
        eid = res.json()["id"]
        ask = lambda q, lang="en": self.public.post("/api/assistant/", {"message": q, "lang": lang}, format="json").json()
        self.assertIn("Behind the main building", ask("Where is the head office parking?")["reply"])
        self.assertIn("Derrière", ask("Where is the head office parking?", "fr")["reply"])
        self.api.patch(f"/api/assistant/faq/{eid}/", {"answer": "Next to the east gate."}, format="json")
        self.assertIn("east gate", ask("Where is the head office parking?")["reply"])
        self.api.delete(f"/api/assistant/faq/{eid}/")
        self.assertEqual(ask("Where is the head office parking?")["source"], "forwarded")

    def test_builtin_topics_can_be_customised(self):
        topics = self.api.get("/api/assistant/builtin/").json()
        self.assertTrue(any(t["key"] == "track" for t in topics))
        entry = self.api.post("/api/assistant/builtin/", {"key": "track"}, format="json").json()
        self.api.patch(f"/api/assistant/faq/{entry['id']}/", {"answer": "Custom tracking answer."}, format="json")
        reply = self.public.post("/api/assistant/", {"message": "how do I track my case?"}, format="json").json()
        self.assertIn("Custom tracking answer", reply["reply"])

    def test_admin_can_delete_forwarded_questions_and_non_staff_cannot_manage(self):
        from .models import AssistantQuestion
        q = AssistantQuestion.objects.create(question="Anything?")
        self.assertEqual(self.api.delete(f"/api/assistant/questions/{q.id}/").status_code, 204)
        officer = User.objects.create_user(username="o", password="x", role="officer")
        other = APIClient(); other.force_authenticate(officer)
        self.assertEqual(other.get("/api/assistant/faq/").status_code, 403)
