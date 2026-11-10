"""
Centralizes every status change so the rules from the workflow spec live in
one place:

Manual (chosen by an admin/officer, via the status dropdown):
    - needs_info  (also settable by ticking "request more info" on a response)
    - resolved

Automatic (the system decides, nobody picks these from a dropdown):
    - received     -> set the moment a submission is created
    - under_review -> set the moment staff first opens the case
    - assigned     -> set the moment it's routed to a department/officer
    - responded    -> set the moment staff sends a response (unless that
                       response was itself a request for more info)
    - closed       -> set automatically 3 days after being marked resolved
"""

from datetime import timedelta

from django.utils import timezone

from .models import Submission, StatusHistory

AUTO_CLOSE_AFTER = timedelta(days=3)

# Only these may be chosen manually through the "change status" control.
MANUALLY_SETTABLE_STATUSES = {Submission.Status.NEEDS_INFO, Submission.Status.RESOLVED}


def transition(submission, new_status, changed_by=None, note=""):
    """Applies a status change and records it in history. Returns the
    submission unchanged if the status isn't actually changing."""
    if submission.status == new_status:
        return submission

    old_status = submission.status
    submission.status = new_status

    if new_status == Submission.Status.RESOLVED:
        submission.resolved_at = timezone.now()
        submission.closed_at = None
    elif new_status == Submission.Status.CLOSED:
        submission.closed_at = timezone.now()
    else:
        # Leaving "resolved" for any other manual/auto status (e.g. reopened
        # via "needs info") clears the resolve timer so it won't auto-close.
        submission.resolved_at = None

    submission.save()
    StatusHistory.objects.create(
        submission=submission, old_status=old_status, new_status=new_status,
        changed_by=changed_by, note=note,
    )
    return submission


def mark_opened_for_review(submission, staff_user):
    """Called the first time a staff member opens a 'received' case."""
    if submission.status == Submission.Status.RECEIVED:
        transition(submission, Submission.Status.UNDER_REVIEW, changed_by=staff_user, note="Opened for review.")


def mark_assigned(submission, staff_user, note=""):
    transition(submission, Submission.Status.ASSIGNED, changed_by=staff_user, note=note or "Assigned for handling.")


def mark_responded_or_needs_info(submission, staff_user, is_request_for_info):
    if is_request_for_info:
        transition(submission, Submission.Status.NEEDS_INFO, changed_by=staff_user, note="More information requested.")
    else:
        transition(submission, Submission.Status.RESPONDED, changed_by=staff_user, note="Response added.")


def mark_owner_replied(submission):
    """Called when the case owner replies via their tracking code. If staff
    was waiting on them ('needs_info'), this puts the case back under
    review; otherwise the status is left as-is."""
    if submission.status == Submission.Status.NEEDS_INFO:
        transition(submission, Submission.Status.UNDER_REVIEW, changed_by=None, note="Case owner replied.")


def auto_close_stale_resolved():
    """Closes any submission that has sat in 'resolved' for 3+ days.
    Safe to call often (e.g. on every list/detail request) and also exposed
    as a management command for a cron job."""
    cutoff = timezone.now() - AUTO_CLOSE_AFTER
    stale = Submission.objects.filter(status=Submission.Status.RESOLVED, resolved_at__lte=cutoff)
    count = 0
    for submission in stale:
        transition(submission, Submission.Status.CLOSED, changed_by=None, note="Automatically closed after 3 days.")
        count += 1
    return count


# ---------------------------------------------------------------------------
# Admin2 ADM_01: AI priority classification.
# The admin keeps a list of High and Medium keywords (PriorityKeyword). When a
# case comes in, the AI reads its title + description: one or more High
# keywords -> High; otherwise one or more Medium keywords -> Medium; anything
# else is Low (and is not specially marked).
# ---------------------------------------------------------------------------
import re

from .models import PriorityKeyword


def classify_priority(text):
    """Returns 'high', 'medium' or 'low' for the given text."""
    haystack = " ".join((text or "").lower().split())
    if not haystack:
        return Submission.Priority.LOW
    found = {PriorityKeyword.Level.HIGH: False, PriorityKeyword.Level.MEDIUM: False}
    for kw in PriorityKeyword.objects.all():
        if not kw.word or found[kw.level]:
            continue
        # Whole-word / whole-phrase match, so "fire" doesn't fire on "fired up".
        if re.search(rf"(?<!\w){re.escape(kw.word)}(?!\w)", haystack):
            found[kw.level] = True
    if found[PriorityKeyword.Level.HIGH]:
        return Submission.Priority.HIGH
    if found[PriorityKeyword.Level.MEDIUM]:
        return Submission.Priority.MEDIUM
    return Submission.Priority.LOW


def classify_submission(submission):
    return classify_priority(f"{submission.title} {submission.description}")


def average_resolution_hours(qs):
    """General2 GEN_07: average hours from a case being received to being
    resolved. Counts every resolved or closed case — the old figure only
    counted *closed* ones, so nothing showed until a case had sat resolved
    for 3 days. Uses the time it was resolved, else closed, else last updated
    (for older rows that never stored a resolved time)."""
    from django.db.models import Avg, DurationField, ExpressionWrapper, F
    from django.db.models.functions import Coalesce

    done = qs.filter(status__in=[Submission.Status.RESOLVED, Submission.Status.CLOSED]).annotate(
        turnaround=ExpressionWrapper(
            Coalesce("resolved_at", "closed_at", "updated_at") - F("created_at"),
            output_field=DurationField(),
        )
    )
    avg = done.aggregate(avg=Avg("turnaround"))["avg"]
    if avg is None:
        return None
    return round(max(avg.total_seconds(), 0) / 3600, 1)
