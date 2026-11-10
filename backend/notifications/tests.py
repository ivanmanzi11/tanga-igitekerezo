from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from accounts.models import Department
from submissions.models import Assignment, Category, Submission

User = get_user_model()


class InternalConversationTests(TestCase):
    """General2 GEN_02 / GEN_03: staff chat + the case's internal conversation."""

    def setUp(self):
        dept = Department.objects.create(name="Roads")
        self.admin = User.objects.create_user(username="adm", password="x", role="admin")
        self.a = User.objects.create_user(username="a", password="x", role="officer", department=dept)
        self.b = User.objects.create_user(username="b", password="x", role="officer", department=dept)
        cat = Category.objects.create(name="Cat")
        self.sub = Submission.objects.create(title="T", description="d", category=cat, department=dept,
                                             submission_type="identified", submitter_name="n")
        Assignment.objects.create(submission=self.sub, assigned_to=self.a, assigned_by=self.admin, department=dept)
        self.api = APIClient()
        self.api.force_authenticate(self.a)

    def test_dm_and_group_roundtrip(self):
        res = self.api.post("/api/conversations/", {"is_group": False, "participant_ids": [str(self.b.id)]}, format="json")
        self.assertEqual(res.status_code, 201, res.content)
        cid = res.json()["id"]
        self.assertEqual(self.api.post(f"/api/conversations/{cid}/send/", {"text": "hi"}, format="json").status_code, 201)
        self.assertEqual(len(self.api.get(f"/api/conversations/{cid}/messages/").json()), 1)
        g = self.api.post("/api/conversations/", {"is_group": True, "name": "Team", "participant_ids": [str(self.b.id)]}, format="json")
        self.assertEqual(g.status_code, 201)

    def test_case_group_shares_messages_with_case_conversation(self):
        convs = self.api.get("/api/conversations/").json()
        case = next(c for c in convs if c["kind"] == "case")
        self.api.post(f"/api/conversations/{case['id']}/send/", {"text": "from widget"}, format="json")
        self.api.post(f"/api/submissions/{self.sub.id}/messages/", {"message": "from case page"}, format="json")
        widget_texts = [m["text"] for m in self.api.get(f"/api/conversations/{case['id']}/messages/").json()]
        page_texts = [m["message"] for m in self.api.get(f"/api/submissions/{self.sub.id}/messages/").json()]
        self.assertEqual(widget_texts, ["from widget", "from case page"])
        self.assertEqual(page_texts, ["from widget", "from case page"])


class CaseGroupAccessAndMessageActionTests(TestCase):
    """General2 GEN_01 (staff working a case can reach its group, not only the
    admin) and GEN_02 (reply / edit / delete / pin)."""

    def setUp(self):
        self.dept = Department.objects.create(name="Roads")
        self.admin = User.objects.create_user(username="adm", password="x", role="admin")
        self.a = User.objects.create_user(username="a", password="x", role="officer", department=self.dept)
        self.b = User.objects.create_user(username="b", password="x", role="officer", department=self.dept)
        self.outsider = User.objects.create_user(
            username="z", password="x", role="officer", department=Department.objects.create(name="Water"))
        cat = Category.objects.create(name="Cat")
        self.sub = Submission.objects.create(title="T", description="d", category=cat, department=self.dept,
                                             submission_type="identified", submitter_name="n")
        Assignment.objects.create(submission=self.sub, assigned_to=self.a, assigned_by=self.admin, department=self.dept)

    def client_for(self, user):
        api = APIClient(); api.force_authenticate(user)
        return api

    def test_assignee_and_department_colleague_reach_the_case_group(self):
        for user in (self.a, self.b):
            api = self.client_for(user)
            kinds = [c["kind"] for c in api.get("/api/conversations/").json()]
            self.assertIn("case", kinds, user.username)
            self.assertEqual(api.get(f"/api/submissions/{self.sub.id}/messages/").status_code, 200)

    def test_unrelated_staff_cannot(self):
        api = self.client_for(self.outsider)
        self.assertNotIn("case", [c["kind"] for c in api.get("/api/conversations/").json()])
        self.assertIn(api.get(f"/api/submissions/{self.sub.id}/messages/").status_code, (403, 404))

    def test_reply_edit_pin_delete_from_widget(self):
        api = self.client_for(self.a)
        case = next(c for c in api.get("/api/conversations/").json() if c["kind"] == "case")
        first = api.post(f"/api/conversations/{case['id']}/send/", {"text": "hello"}, format="json").json()
        reply = api.post(f"/api/conversations/{case['id']}/send/", {"text": "re", "reply_to": first["id"]}, format="json").json()
        self.assertEqual(reply["reply_to"]["text"], "hello")

        base = f"/api/conversations/{case['id']}/messages/{first['id']}"
        self.assertTrue(api.post(f"{base}/edit/", {"text": "hello!"}, format="json").json()["edited"])
        self.assertTrue(api.post(f"{base}/pin/", {}, format="json").json()["pinned"])
        # someone else can't edit or delete it
        other = self.client_for(self.b)
        self.assertEqual(other.post(f"{base}/edit/", {"text": "x"}, format="json").status_code, 403)
        self.assertEqual(other.post(f"{base}/delete/", {}, format="json").status_code, 403)
        gone = api.post(f"{base}/delete/", {}, format="json").json()
        self.assertTrue(gone["deleted"])
        self.assertEqual(gone["text"], "")

    def test_message_actions_from_case_page(self):
        api = self.client_for(self.a)
        msg = api.post(f"/api/submissions/{self.sub.id}/messages/", {"message": "hi"}, format="json").json()
        res = api.post(f"/api/submissions/{self.sub.id}/messages/{msg['id']}/edit/", {"text": "hi there"}, format="json")
        self.assertEqual(res.status_code, 200, res.content)
        self.assertEqual(res.json()["text"], "hi there")
        self.assertTrue(api.post(f"/api/submissions/{self.sub.id}/messages/{msg['id']}/pin/", {}, format="json").json()["pinned"])
