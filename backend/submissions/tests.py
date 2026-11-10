from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from accounts.models import Department
from .models import Assignment, Category, PriorityKeyword, Submission
from . import services

User = get_user_model()


class PriorityClassificationTests(TestCase):
    """Admin2 ADM_01: the AI sets High / Medium / Low from the admin's keywords."""

    def setUp(self):
        PriorityKeyword.objects.create(level="high", word="Fire")
        PriorityKeyword.objects.create(level="medium", word="delay")
        PriorityKeyword.objects.create(level="high", word="not safe")

    def test_high_medium_low(self):
        self.assertEqual(services.classify_priority("There is a FIRE in the store"), "high")
        self.assertEqual(services.classify_priority("Long delay at the counter"), "medium")
        self.assertEqual(services.classify_priority("Thank you for the help"), "low")

    def test_high_wins_when_both_match(self):
        self.assertEqual(services.classify_priority("delay and a fire"), "high")

    def test_whole_words_only_and_phrases(self):
        self.assertEqual(services.classify_priority("the staff were fired up"), "low")
        self.assertEqual(services.classify_priority("this door is not safe"), "high")

    def test_keywords_are_normalised_and_unique(self):
        self.assertEqual(PriorityKeyword.objects.get(level="medium").word, "delay")
        admin = User.objects.create_user(username="ad", password="x", role="admin")
        api = APIClient(); api.force_authenticate(admin)
        dup = api.post("/api/priority-keywords/", {"level": "medium", "word": " FIRE "}, format="json")
        self.assertEqual(dup.status_code, 400)

    def test_only_admin_manages_keywords(self):
        dept = Department.objects.create(name="D")
        officer = User.objects.create_user(username="o", password="x", role="officer", department=dept)
        api = APIClient(); api.force_authenticate(officer)
        self.assertEqual(api.get("/api/priority-keywords/").status_code, 403)
        self.assertEqual(api.post("/api/priority-keywords/", {"level": "high", "word": "x"}, format="json").status_code, 403)

    def test_new_submission_gets_ai_priority(self):
        cat = Category.objects.create(name="C")
        res = APIClient().post("/api/submissions/", {
            "submission_type": "anonymous", "category": cat.id,
            "title": "Fire risk", "description": "wiring near the stairs",
        }, format="json")
        self.assertEqual(res.status_code, 201, res.content)
        self.assertEqual(Submission.objects.get(pk=res.json()["id"]).priority, "high")


class PriorityVisibilityTests(TestCase):
    """Admin2 ADM_02: High = admins; Medium = admins + the department's Head;
    Low = every staff user in the department."""

    def setUp(self):
        self.roads = Department.objects.create(name="Roads")
        self.water = Department.objects.create(name="Water")
        cat = Category.objects.create(name="C")
        self.admin = User.objects.create_user(username="adm", password="x", role="admin")
        self.head = User.objects.create_user(username="head", password="x", role="dept_head", department=self.roads)
        self.officer = User.objects.create_user(username="off", password="x", role="officer", department=self.roads)
        self.other_head = User.objects.create_user(username="oh", password="x", role="dept_head", department=self.water)
        mk = lambda p: Submission.objects.create(
            title=p, description="d", category=cat, department=self.roads,
            submission_type="anonymous", priority=p,
        )
        self.high, self.medium, self.low = mk("high"), mk("medium"), mk("low")

    def ids(self, user):
        api = APIClient(); api.force_authenticate(user)
        res = api.get("/api/submissions/")
        self.assertEqual(res.status_code, 200)
        return {r["title"] for r in res.json()["results"]}

    def test_admin_sees_all(self):
        self.assertEqual(self.ids(self.admin), {"high", "medium", "low"})

    def test_department_head_sees_medium_and_low_only(self):
        self.assertEqual(self.ids(self.head), {"medium", "low"})

    def test_officer_sees_low_only(self):
        self.assertEqual(self.ids(self.officer), {"low"})

    def test_other_department_sees_nothing(self):
        self.assertEqual(self.ids(self.other_head), set())

    def test_detail_is_blocked_too(self):
        api = APIClient(); api.force_authenticate(self.officer)
        self.assertEqual(api.get(f"/api/submissions/{self.high.id}/").status_code, 404)
        self.assertEqual(api.get(f"/api/submissions/{self.medium.id}/").status_code, 404)
        self.assertEqual(api.get(f"/api/submissions/{self.low.id}/").status_code, 200)

    def test_individual_assignment_does_not_unlock_high(self):
        Assignment.objects.create(submission=self.high, assigned_to=self.officer, assigned_by=self.admin, department=self.roads)
        api = APIClient(); api.force_authenticate(self.officer)
        self.assertEqual(api.get(f"/api/submissions/{self.high.id}/").status_code, 404)


class PriorityPermissionTests(TestCase):
    """Admin2 ADM_01: the admin decides, per permission group, who may see and
    work on High / Medium / Low priority cases."""

    def setUp(self):
        from django.contrib.auth.models import Permission
        self.Permission = Permission
        self.dept = Department.objects.create(name="Roads")
        cat = Category.objects.create(name="C")
        self.officer = User.objects.create_user(username="off", password="x", role="officer", department=self.dept)
        for level in ("high", "medium", "low"):
            Submission.objects.create(title=level, description="d", category=cat, department=self.dept,
                                      submission_type="anonymous", priority=level)

    def titles(self, user):
        api = APIClient(); api.force_authenticate(User.objects.get(pk=user.pk))  # fresh perm cache
        return {r["title"] for r in api.get("/api/submissions/").json()["results"]}

    def grant(self, user, *codenames):
        group = user.groups.first()
        group.permissions.add(*self.Permission.objects.filter(codename__in=codenames))

    def test_defaults_officer_low_only(self):
        self.assertEqual(self.titles(self.officer), {"low"})

    def test_granting_high_and_medium_unlocks_them(self):
        self.grant(self.officer, "can_access_high_priority_cases", "can_access_medium_priority_cases")
        self.assertEqual(self.titles(self.officer), {"high", "medium", "low"})

    def test_removing_low_hides_unmarked_cases(self):
        group = self.officer.groups.first()
        group.permissions.remove(self.Permission.objects.get(codename="can_access_low_priority_cases"))
        self.assertEqual(self.titles(self.officer), set())

    def test_new_permissions_are_offered_to_groups(self):
        admin = User.objects.create_user(username="a", password="x", role="admin")
        api = APIClient(); api.force_authenticate(admin)
        codenames = {p["codename"] for p in api.get("/api/permissions/").json()}
        self.assertTrue({"can_access_high_priority_cases", "can_access_medium_priority_cases",
                         "can_access_low_priority_cases"} <= codenames)


class AnonymityTests(TestCase):
    """General3 GEN_04: an anonymous case is never tied to a person — even a
    signed-in one — and no staff screen can show who sent it."""

    def setUp(self):
        self.cat = Category.objects.create(name="C")
        self.citizen = User.objects.create_user(
            username="secretname", email="secret@example.com", password="x", role="citizen",
            first_name="Alice", last_name="Hidden",
        )
        self.admin = User.objects.create_user(username="adm", password="x", role="admin")

    def submit_signed_in(self, **extra):
        api = APIClient(); api.force_authenticate(self.citizen)
        payload = {"submission_type": "anonymous", "category": self.cat.id, "title": "Hidden", "description": "text",
                   "submitter_name": "Alice Hidden", "submitter_email": "secret@example.com", "submitter_phone": "0788"}
        payload.update(extra)
        res = api.post("/api/submissions/", payload, format="json")
        self.assertEqual(res.status_code, 201, res.content)
        return Submission.objects.get(pk=res.json()["id"])

    def test_signed_in_anonymous_submission_has_no_identity_anywhere(self):
        sub = self.submit_signed_in()
        self.assertIsNone(sub.submitted_by_id)
        self.assertEqual((sub.submitter_name, sub.submitter_email, sub.submitter_phone), ("", "", ""))
        # not listed under the person's account either
        mine = APIClient(); mine.force_authenticate(self.citizen)
        self.assertEqual(mine.get("/api/submissions/").json()["results"], [])

    def test_no_staff_endpoint_leaks_the_sender(self):
        sub = self.submit_signed_in()
        api = APIClient(); api.force_authenticate(self.admin)
        blob = (api.get(f"/api/submissions/{sub.id}/").content + api.get("/api/submissions/").content).decode().lower()
        for needle in ("secretname", "secret@example.com", "alice", "hidden\"", "0788", str(self.citizen.id)):
            if needle == 'hidden"':
                continue  # the case title is "Hidden"
            self.assertNotIn(needle, blob)

    def test_owner_reply_and_rating_store_no_account(self):
        sub = self.submit_signed_in()
        api = APIClient(); api.force_authenticate(self.citizen)
        res = api.post(f"/api/track/{sub.tracking_code}/reply/", {"message": "more info"}, format="json")
        self.assertEqual(res.status_code, 201)
        reply = sub.responses.get()
        self.assertIsNone(reply.responder_id)

    def test_attachment_metadata_and_name_are_removed(self):
        import io
        from PIL import Image
        from django.core.files.uploadedfile import SimpleUploadedFile
        buf = io.BytesIO()
        img = Image.new("RGB", (4, 4), "red")
        exif = Image.Exif(); exif[0x010F] = "SecretPhoneMaker"
        img.save(buf, format="JPEG", exif=exif.tobytes())
        upload = SimpleUploadedFile("alice_passport_photo.jpg", buf.getvalue(), content_type="image/jpeg")
        api = APIClient()
        res = api.post("/api/submissions/", {
            "submission_type": "anonymous", "category": self.cat.id, "title": "t", "description": "d",
            "attachments": upload,
        }, format="multipart")
        self.assertEqual(res.status_code, 201, res.content)
        att = Submission.objects.get(pk=res.json()["id"]).attachments.get()
        self.assertEqual(att.original_name, "attachment-1.jpg")
        self.assertNotIn("alice", att.file.name.lower())
        data = att.file.read()
        self.assertNotIn(b"SecretPhoneMaker", data)


class TrackingCodeTests(TestCase):
    """General3 GEN_02: TGC-<year>-<month>-<day>-<0001..9999>."""

    def test_format(self):
        import re
        from django.utils import timezone
        cat = Category.objects.create(name="C")
        sub = Submission.objects.create(title="t", description="d", category=cat, submission_type="anonymous")
        today = timezone.localdate()
        m = re.fullmatch(r"TGC-(\d{4})-(\d{2})-(\d{2})-(\d{4})", sub.tracking_code)
        self.assertIsNotNone(m, sub.tracking_code)
        self.assertEqual((int(m[1]), int(m[2]), int(m[3])), (today.year, today.month, today.day))
        self.assertTrue(1 <= int(m[4]) <= 9999)

    def test_codes_are_unique(self):
        cat = Category.objects.create(name="C")
        codes = {Submission.objects.create(title="t", description="d", category=cat, submission_type="anonymous").tracking_code
                 for _ in range(30)}
        self.assertEqual(len(codes), 30)


class SubmissionOptionsTests(TestCase):
    """General3 GEN_03: the admin switches Confidential / Identified on or off."""

    def setUp(self):
        self.cat = Category.objects.create(name="C")
        self.admin = User.objects.create_user(username="adm", password="x", role="admin")
        self.officer = User.objects.create_user(username="off", password="x", role="officer")

    def body(self, kind):
        return {"submission_type": kind, "category": self.cat.id, "title": "t", "description": "d",
                "submitter_name": "N", "submitter_email": "n@example.com"}

    def test_public_can_read_and_everything_is_on_by_default(self):
        res = APIClient().get("/api/submission-options/").json()
        self.assertEqual(res["enabled_types"], ["anonymous", "confidential", "identified"])

    def test_only_admin_can_change_and_disabled_types_are_refused(self):
        officer = APIClient(); officer.force_authenticate(self.officer)
        self.assertEqual(officer.patch("/api/submission-options/", {"identified": False}, format="json").status_code, 403)
        admin = APIClient(); admin.force_authenticate(self.admin)
        res = admin.patch("/api/submission-options/", {"identified": False, "confidential": False}, format="json")
        self.assertEqual(res.json()["enabled_types"], ["anonymous"])
        anon = APIClient()
        self.assertEqual(anon.post("/api/submissions/", self.body("identified"), format="json").status_code, 400)
        self.assertEqual(anon.post("/api/submissions/", self.body("confidential"), format="json").status_code, 400)
        self.assertEqual(anon.post("/api/submissions/", self.body("anonymous"), format="json").status_code, 201)


class CategoryManagementTests(TestCase):
    """Admin3 ADM_03 / ADM_04: categories are managed without losing history."""

    def setUp(self):
        self.admin = User.objects.create_user(username="adm", password="x", role="admin")
        self.api = APIClient(); self.api.force_authenticate(self.admin)
        self.suggestion = Category.objects.create(name="Suggestion")
        # the migration already created "Others"; make sure it is flagged
        self.others, _ = Category.objects.get_or_create(name="Others", defaults={"kind": "other"})
        Category.objects.filter(pk=self.others.pk).update(is_other=True, kind="other")
        self.others.refresh_from_db()

    def file_one(self, cat):
        return Submission.objects.create(title="t", description="d", category=cat, submission_type="anonymous")

    def test_others_is_listed_last_and_cannot_be_deleted(self):
        Category.objects.create(name="Zebra")
        names = [c["name"] for c in self.api.get("/api/categories/").json()]
        self.assertEqual(names[-1], "Others")
        self.assertEqual(self.api.delete(f"/api/categories/{self.others.id}/").status_code, 400)

    def test_create_and_delete_unused_category(self):
        res = self.api.post("/api/categories/", {"name": "Safety"}, format="json")
        self.assertEqual(res.status_code, 201, res.content)
        self.assertEqual(self.api.delete(f"/api/categories/{res.json()['id']}/").status_code, 204)

    def test_deleting_a_used_category_archives_it_and_keeps_history(self):
        sub = self.file_one(self.suggestion)
        res = self.api.delete(f"/api/categories/{self.suggestion.id}/")
        self.assertEqual(res.status_code, 200)
        self.assertTrue(res.json()["archived"])
        sub.refresh_from_db()
        self.assertEqual(sub.category.name, "Suggestion")
        offered = {c["name"] for c in APIClient().get("/api/categories/").json()}
        self.assertNotIn("Suggestion", offered)
        everything = {c["name"] for c in self.api.get("/api/categories/", {"all": 1}).json()}
        self.assertIn("Suggestion", everything)

    def test_renaming_a_used_category_keeps_old_submissions_under_the_old_name(self):
        sub = self.file_one(self.suggestion)
        res = self.api.patch(f"/api/categories/{self.suggestion.id}/", {"name": "Proposal"}, format="json")
        self.assertEqual(res.status_code, 200, res.content)
        sub.refresh_from_db()
        self.assertEqual(sub.category.name, "Suggestion")
        self.assertFalse(sub.category.is_active)
        offered = {c["name"] for c in APIClient().get("/api/categories/").json()}
        self.assertIn("Proposal", offered)
        self.assertNotIn("Suggestion", offered)

    def test_non_admin_cannot_manage(self):
        officer = User.objects.create_user(username="o", password="x", role="officer")
        api = APIClient(); api.force_authenticate(officer)
        self.assertEqual(api.post("/api/categories/", {"name": "X"}, format="json").status_code, 403)


class AverageResolutionTests(TestCase):
    """General2 GEN_07: average resolution counts resolved cases too."""

    def test_resolved_case_counts_without_waiting_to_be_closed(self):
        from datetime import timedelta
        from django.utils import timezone
        cat = Category.objects.create(name="C")
        sub = Submission.objects.create(title="t", description="d", category=cat, submission_type="anonymous")
        Submission.objects.filter(pk=sub.pk).update(
            status="resolved", created_at=timezone.now() - timedelta(hours=10), resolved_at=timezone.now() - timedelta(hours=4),
        )
        avg = services.average_resolution_hours(Submission.objects.all())
        self.assertEqual(avg, 6.0)

    def test_no_resolved_cases_is_none(self):
        self.assertIsNone(services.average_resolution_hours(Submission.objects.none()))


class ReportExportTests(TestCase):
    """General2 GEN_01 / GEN_09: reports export for a chosen period."""

    def setUp(self):
        self.admin = User.objects.create_user(username="adm", password="x", role="admin")
        cat = Category.objects.create(name="C")
        Submission.objects.create(title="One", description="d", category=cat, submission_type="anonymous")
        self.api = APIClient(); self.api.force_authenticate(self.admin)

    def test_pdf_for_custom_period(self):
        res = self.api.get("/api/reports/cases/", {"range": "date", "date_from": "2000-01-01", "filetype": "pdf"})
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res["Content-Type"], "application/pdf")

    def test_xlsx_for_custom_period_and_bad_date_does_not_crash(self):
        ok = self.api.get("/api/reports/cases/", {"range": "date", "date_from": "2000-01-01", "date_to": "2999-01-01", "filetype": "xlsx"})
        self.assertEqual(ok.status_code, 200)
        bad = self.api.get("/api/reports/cases/", {"range": "date", "date_from": "not-a-date", "filetype": "pdf"})
        self.assertEqual(bad.status_code, 200)

    def test_analytics_pdf_with_period(self):
        res = self.api.get("/api/reports/analytics/", {"range": "date", "date_from": "2000-01-01", "filetype": "pdf"})
        self.assertEqual(res.status_code, 200)
