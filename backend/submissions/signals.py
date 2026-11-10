from django.db.models.signals import post_save
from django.dispatch import receiver

from .models import Assignment, Response, StatusHistory
from notifications.models import Notification
from notifications.services import ensure_case_group


@receiver(post_save, sender=Assignment)
def notify_assignment(sender, instance, created, **kwargs):
    # General3 GEN_09: everyone working a case is put in its case group
    # immediately, so they can talk about it from the Internal conversation.
    ensure_case_group(instance.submission)
    if created and instance.assigned_to:
        Notification.objects.create(
            user=instance.assigned_to,
            message=f"You were assigned submission {instance.submission.tracking_code}.",
            link=f"/staff/submissions/{instance.submission_id}",
        )


@receiver(post_save, sender=Response)
def notify_response(sender, instance, created, **kwargs):
    submission = instance.submission
    if created and submission.submitted_by_id:
        Notification.objects.create(
            user=submission.submitted_by,
            message=f"There's a new response on {submission.tracking_code}.",
            link=f"/track/{submission.tracking_code}",
        )


@receiver(post_save, sender=StatusHistory)
def notify_status_change(sender, instance, created, **kwargs):
    submission = instance.submission
    if created and submission.submitted_by_id:
        label = instance.new_status.replace("_", " ").title()
        Notification.objects.create(
            user=submission.submitted_by,
            message=f"{submission.tracking_code} status changed to {label}.",
            link=f"/track/{submission.tracking_code}",
        )
