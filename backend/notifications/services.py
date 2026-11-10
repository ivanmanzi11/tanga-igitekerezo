"""General3 GEN_09: case groups — the group chat of everyone working a case.
General2 GEN_01: who may enter a case group. General2 GEN_02: message actions
(reply, edit, delete, pin) shared by the chat widget and the case page."""
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, ValidationError

from .models import Conversation

User = get_user_model()


def _dept_member_allowed(user, submission):
    """Admin2 ADM_01 applied to case groups: a department colleague joins the
    group only if their permission group lets them work on cases of this
    priority (admins always may)."""
    from common.visibility import can_access_priority
    return can_access_priority(user, submission.priority)


def can_access_case_group(user, submission):
    """General2 GEN_01: staff who are working a case — not just the admin —
    can open its case group / internal conversation. That means: admins;
    anyone the case was assigned to, or who assigned it; staff of a
    department it was routed to; the head of the case's department; or
    anyone already enrolled in its group. All subject to the case-visibility
    rule for its priority."""
    if not user or not user.is_authenticated or user.role == "citizen":
        return False
    if user.role == "admin":
        return True
    from common.visibility import can_view_case
    if not can_view_case(user, submission):
        return False
    if submission.assignments.filter(assigned_to=user).exists():
        return True
    if submission.assignments.filter(assigned_by=user).exists():
        return True
    if user.department_id and submission.assignments.filter(department_id=user.department_id).exists():
        return True
    if user.role == "dept_head" and user.department_id and submission.department_id == user.department_id:
        return True
    return Conversation.objects.filter(submission=submission, participants=user).exists()


def ensure_case_group(submission, extra_users=()):
    """Create (or refresh) the case group for a submission and put everyone
    who's working it in: each person it was assigned to, whoever assigned it,
    and the staff of a department it was routed to (as far as the case's
    priority lets them see it)."""
    conv, _ = Conversation.objects.get_or_create(
        submission=submission,
        defaults={"is_group": True, "name": f"{submission.tracking_code} · {submission.title[:50]}"},
    )
    member_ids = set()
    dept_ids = set()
    for a in submission.assignments.all():
        if a.assigned_to_id:
            member_ids.add(a.assigned_to_id)
        if a.assigned_by_id:
            member_ids.add(a.assigned_by_id)
        if a.department_id:
            dept_ids.add(a.department_id)
    if dept_ids:
        for u in User.objects.filter(department_id__in=dept_ids, is_active=True).exclude(role=User.Role.CITIZEN):
            if _dept_member_allowed(u, submission):
                member_ids.add(u.id)
    for u in extra_users:
        if can_access_case_group(u, submission):
            member_ids.add(u.id)
    if member_ids:
        conv.participants.add(*member_ids)
    return conv


# --- message actions -------------------------------------------------------

def parse_case_id(raw):
    """Case-group message ids are exposed as "case-<id>" in the chat widget
    and as plain ids on the case page; accept both."""
    raw = str(raw)
    raw = raw[5:] if raw.startswith("case-") else raw
    if not raw.isdigit():
        raise ValidationError({"detail": "Unknown message."})
    return int(raw)


def apply_message_op(user, msg, op, is_case, text=None):
    """op is 'edit', 'delete' or 'pin' (pin toggles)."""
    field = "message" if is_case else "text"
    if op == "edit":
        if msg.sender_id != user.id:
            raise PermissionDenied("You can only edit your own messages.")
        if msg.is_deleted:
            raise ValidationError({"detail": "This message was deleted."})
        text = (text or "").strip()
        if not text:
            raise ValidationError({"detail": "A message can't be empty."})
        setattr(msg, field, text)
        msg.edited_at = timezone.now()
        msg.save(update_fields=[field, "edited_at"])
    elif op == "delete":
        if msg.sender_id != user.id and user.role != "admin":
            raise PermissionDenied("You can only delete your own messages.")
        setattr(msg, field, "")
        msg.is_deleted = True
        msg.is_pinned = False
        msg.save(update_fields=[field, "is_deleted", "is_pinned"])
    elif op == "pin":
        if msg.is_deleted:
            raise ValidationError({"detail": "This message was deleted."})
        msg.is_pinned = not msg.is_pinned
        msg.save(update_fields=["is_pinned"])
    else:
        raise ValidationError({"detail": "Unknown action."})
    return msg
