from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from rest_framework.test import APIClient
from django.test import TestCase

from .models import Department, get_role_group

User = get_user_model()


class PermissionGroupTests(TestCase):
    """Admin2 ADM_01 / ADM_02: no group is 'built in' — all can be deleted."""

    def setUp(self):
        self.dept = Department.objects.create(name="Health")
        self.admin = User.objects.create_user(username="boss", password="x", role="admin")
        self.client = APIClient()
        self.client.force_authenticate(self.admin)

    def test_no_is_system_flag_in_api(self):
        res = self.client.get("/api/groups/")
        self.assertEqual(res.status_code, 200)
        self.assertTrue(res.json())
        for g in res.json():
            self.assertNotIn("is_system", g)

    def test_starter_group_can_be_deleted_and_stays_deleted(self):
        officer_group = get_role_group("officer")
        res = self.client.delete(f"/api/groups/{officer_group.id}/")
        self.assertEqual(res.status_code, 204)
        # Listing the groups must not silently bring it back.
        names = [g["name"] for g in self.client.get("/api/groups/").json()]
        self.assertNotIn("Officer", names)

    def test_group_with_members_cannot_be_deleted(self):
        admin_group = self.admin.groups.first()
        res = self.client.delete(f"/api/groups/{admin_group.id}/")
        self.assertEqual(res.status_code, 400)
        self.assertTrue(Group.objects.filter(pk=admin_group.pk).exists())

    def test_starter_group_can_be_renamed(self):
        g = get_role_group("dept_head")
        res = self.client.patch(f"/api/groups/{g.id}/", {"name": "Section Lead"}, format="json")
        self.assertEqual(res.status_code, 200)
        g.refresh_from_db()
        self.assertEqual(g.name, "Section Lead")

    def test_creating_staff_in_chosen_group_does_not_recreate_deleted_default(self):
        custom = self.client.post("/api/groups/", {"name": "Reviewer", "base_role": "officer", "permissions": []}, format="json").json()
        Group.objects.filter(name="Officer").delete()
        res = self.client.post("/api/staff-users/", {
            "username": "newbie", "password": "Str0ng!Passw0rd", "role_group": custom["id"], "department": self.dept.id,
        }, format="json")
        self.assertEqual(res.status_code, 201, res.content)
        self.assertFalse(Group.objects.filter(name="Officer").exists())
        self.assertEqual(list(User.objects.get(username="newbie").groups.values_list("name", flat=True)), ["Reviewer"])


class LastAdminProtectionTests(TestCase):
    """Admin2 ADM_02: the system always keeps at least one active admin."""

    def setUp(self):
        self.admin = User.objects.create_user(username="only", password="x", role="admin")
        self.api = APIClient(); self.api.force_authenticate(self.admin)

    def test_cannot_disable_the_last_admin(self):
        res = self.api.post(f"/api/staff-users/{self.admin.id}/set_active/", {"is_active": False}, format="json")
        self.assertEqual(res.status_code, 400)
        self.admin.refresh_from_db()
        self.assertTrue(self.admin.is_active)

    def test_cannot_delete_the_last_admin(self):
        res = self.api.delete(f"/api/staff-users/{self.admin.id}/")
        self.assertEqual(res.status_code, 400)
        self.assertTrue(User.objects.filter(pk=self.admin.pk).exists())

    def test_cannot_change_role_or_deactivate_via_edit(self):
        res = self.api.patch(f"/api/staff-users/{self.admin.id}/", {"role": "officer"}, format="json")
        self.assertEqual(res.status_code, 400)
        res = self.api.patch(f"/api/staff-users/{self.admin.id}/", {"is_active": False}, format="json")
        self.assertEqual(res.status_code, 400)
        self.admin.refresh_from_db()
        self.assertEqual(self.admin.role, "admin")

    def test_allowed_once_another_active_admin_exists(self):
        second = User.objects.create_user(username="second", password="x", role="admin")
        res = self.api.post(f"/api/staff-users/{self.admin.id}/set_active/", {"is_active": False}, format="json")
        self.assertEqual(res.status_code, 200)
        # …and now `second` is the last one
        api2 = APIClient(); api2.force_authenticate(second)
        res = api2.post(f"/api/staff-users/{second.id}/set_active/", {"is_active": False}, format="json")
        self.assertEqual(res.status_code, 400)

    def test_an_inactive_admin_does_not_count_as_a_backup(self):
        User.objects.create_user(username="dormant", password="x", role="admin", is_active=False)
        res = self.api.post(f"/api/staff-users/{self.admin.id}/set_active/", {"is_active": False}, format="json")
        self.assertEqual(res.status_code, 400)


class DepartmentManagementTests(TestCase):
    """Admin3 ADM_01: create / update / delete departments and read their members."""

    def setUp(self):
        self.admin = User.objects.create_user(username="adm", password="x", role="admin")
        self.api = APIClient(); self.api.force_authenticate(self.admin)

    def test_create_update_delete(self):
        res = self.api.post("/api/departments/", {"name": "Legal"}, format="json")
        self.assertEqual(res.status_code, 201, res.content)
        did = res.json()["id"]
        res = self.api.patch(f"/api/departments/{did}/", {"name": "Legal Affairs"}, format="json")
        self.assertEqual(res.json()["name"], "Legal Affairs")
        self.assertEqual(self.api.delete(f"/api/departments/{did}/").status_code, 204)

    def test_members_are_listed_and_block_deletion(self):
        dept = Department.objects.create(name="Roads")
        User.objects.create_user(username="officer1", password="x", role="officer", department=dept, first_name="Ann")
        members = self.api.get(f"/api/departments/{dept.id}/members/").json()
        self.assertEqual([m["username"] for m in members], ["officer1"])
        self.assertEqual(self.api.delete(f"/api/departments/{dept.id}/").status_code, 400)

    def test_department_with_cases_is_archived_not_erased(self):
        from submissions.models import Category, Submission
        dept = Department.objects.create(name="Water")
        cat = Category.objects.create(name="C")
        sub = Submission.objects.create(title="t", description="d", category=cat, department=dept, submission_type="anonymous")
        res = self.api.delete(f"/api/departments/{dept.id}/")
        self.assertTrue(res.json()["archived"])
        sub.refresh_from_db()
        self.assertEqual(sub.department.name, "Water")

    def test_only_permitted_staff_can_read_members(self):
        dept = Department.objects.create(name="Roads")
        officer = User.objects.create_user(username="o", password="x", role="officer", department=dept)
        api = APIClient(); api.force_authenticate(officer)
        self.assertEqual(api.get(f"/api/departments/{dept.id}/members/").status_code, 403)
