from rest_framework.permissions import BasePermission, SAFE_METHODS

# Admin2 ADM_01: a staff user's ability to do things (assign cases, respond,
# view analytics, export reports, manage categories/departments) comes from
# the Django permission groups an admin has put them in — nothing else.
# Putting a user in a group is what grants those permissions; taking them out
# of it (or moving them to a different group) takes those permissions away.
# Admins are the only role that bypasses this and always has full access.
GROUP_PERMISSION_CODENAMES = {
    "can_assign_cases",
    "can_respond_to_cases",
    "can_view_analytics",
    "can_export_reports",
    "can_manage_categories_departments",
    "can_answer_assistant_questions",
    "can_access_high_priority_cases",
    "can_access_medium_priority_cases",
    "can_access_low_priority_cases",
}

PRIORITY_PERMISSION = {
    "high": "can_access_high_priority_cases",
    "medium": "can_access_medium_priority_cases",
    "low": "can_access_low_priority_cases",
}


def has_group_permission(user, codename):
    if not user or not user.is_authenticated:
        return False
    if user.role == "admin":
        return True
    return user.has_perm(f"submissions.{codename}")


def user_permission_codenames(user):
    """The codenames (from GROUP_PERMISSION_CODENAMES) this user currently
    has — via their group membership, or all of them if they're an admin.
    Used to tell the frontend which sections/actions to show."""
    if not user or not user.is_authenticated:
        return []
    if user.role == "admin":
        return sorted(GROUP_PERMISSION_CODENAMES)
    all_perms = user.get_all_permissions()
    return sorted(
        codename for codename in GROUP_PERMISSION_CODENAMES
        if f"submissions.{codename}" in all_perms
    )


def RequireGroupPermission(codename):
    """Returns a DRF permission class requiring the given submissions.*
    codename, via the user's group(s), unless they're an admin."""

    class _RequireGroupPermission(BasePermission):
        def has_permission(self, request, view):
            u = request.user
            return bool(u and u.is_authenticated and u.is_staff_member() and has_group_permission(u, codename))

    _RequireGroupPermission.__name__ = f"RequireGroupPermission_{codename}"
    return _RequireGroupPermission


class IsAdmin(BasePermission):
    def has_permission(self, request, view):
        u = request.user
        return bool(u and u.is_authenticated and u.role == "admin")


class IsDeptHeadOrAdmin(BasePermission):
    def has_permission(self, request, view):
        u = request.user
        return bool(u and u.is_authenticated and u.role in {"dept_head", "admin"})


class IsStaffMember(BasePermission):
    """Officer, department head or admin — i.e. anyone who works for the institution."""

    def has_permission(self, request, view):
        u = request.user
        return bool(u and u.is_authenticated and u.role in {"officer", "dept_head", "admin"})


class IsOwnerOrStaff(BasePermission):
    """Allows the identified submitter to view their own submission, plus any staff."""

    def has_object_permission(self, request, view, obj):
        u = request.user
        if u and u.is_authenticated and u.is_staff_member():
            return True
        if u and u.is_authenticated and getattr(obj, "submitted_by_id", None) == u.id:
            return True
        return False


class ReadOnlyOrStaff(BasePermission):
    def has_permission(self, request, view):
        if request.method in SAFE_METHODS:
            return True
        u = request.user
        return bool(u and u.is_authenticated and u.is_staff_member())
