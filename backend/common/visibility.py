"""Admin2 ADM_01 / ADM_02: which cases each staff user may see and work on.

Two things decide it:

  1. Priority — the admin chooses, in each permission group, whether its
     members may see/work on High, Medium and/or Low (unmarked) priority
     cases (permissions can_access_{high,medium,low}_priority_cases). Admins
     always have all three.
  2. Reach — as before: a department head sees their department's cases; an
     officer sees cases assigned to them or sent to their department.

Starter groups: Administrator = all three; Department Head = Medium + Low;
Officer = Low. Every place that lists or opens cases goes through
`visible_submissions`, so the rule holds for the list, detail, case groups,
reports and dashboard alike.
"""
from django.db.models import Q

from .permissions import PRIORITY_PERMISSION, has_group_permission

PRIORITY_LEVELS = ("high", "medium", "low")


def allowed_priorities(user):
    """The priority levels this user's groups let them see and work on."""
    if not user or not user.is_authenticated:
        return []
    if user.role == "admin":
        return list(PRIORITY_LEVELS)
    return [lvl for lvl in PRIORITY_LEVELS if has_group_permission(user, PRIORITY_PERMISSION[lvl])]


def can_access_priority(user, level):
    return level in allowed_priorities(user)


def visible_submissions(user, qs):
    if not user or not user.is_authenticated:
        return qs.none()
    if user.role == "admin":
        return qs
    if user.role == "citizen":
        # General3 GEN_04: anonymous cases are never linked to an account, so a
        # signed-in person only ever sees cases they filed under their name.
        return qs.filter(submitted_by=user)
    levels = allowed_priorities(user)
    if not levels:
        return qs.none()
    qs = qs.filter(priority__in=levels)
    if user.role == "dept_head":
        if not user.department_id:
            return qs.none()
        return qs.filter(department_id=user.department_id)
    reach = Q(assignments__assigned_to=user)
    if user.department_id:
        reach |= Q(department_id=user.department_id)
    return qs.filter(reach).distinct()


def can_view_case(user, submission):
    """Object-level version of the same rule."""
    return visible_submissions(user, type(submission).objects.filter(pk=submission.pk)).exists()
