import uuid

from django.conf import settings
from django.db import models

from accounts.models import Department
from .utils import generate_tracking_code


class Category(models.Model):
    class Kind(models.TextChoices):
        SUGGESTION = "suggestion", "Suggestion"
        COMPLAINT = "complaint", "Complaint"
        APPRECIATION = "appreciation", "Appreciation"
        OTHER = "other", "Others"

    name = models.CharField(max_length=100, unique=True)
    name_rw = models.CharField("Name (Kinyarwanda)", max_length=100, blank=True)
    name_fr = models.CharField("Name (French)", max_length=100, blank=True)
    kind = models.CharField(max_length=20, choices=Kind.choices, default=Kind.SUGGESTION)
    # Admin3 ADM_03: a deleted/renamed category is archived (is_active=False), never
    # erased, so submissions already filed under it keep their history and statistics.
    is_active = models.BooleanField(default=True)
    # Admin3 ADM_04: "Others" always appears after every other category.
    is_other = models.BooleanField(default=False)

    class Meta:
        verbose_name_plural = "Categories"
        ordering = ["is_other", "name"]

    def __str__(self):
        return self.name


class Submission(models.Model):
    class SubmissionType(models.TextChoices):
        ANONYMOUS = "anonymous", "Anonymous"
        CONFIDENTIAL = "confidential", "Confidential"
        IDENTIFIED = "identified", "Identified"

    class Status(models.TextChoices):
        RECEIVED = "received", "Received"
        UNDER_REVIEW = "under_review", "Under Review"
        ASSIGNED = "assigned", "Assigned"
        NEEDS_INFO = "needs_info", "More Information Needed"
        RESOLVED = "resolved", "Resolved"
        RESPONDED = "responded", "Responded"
        CLOSED = "closed", "Closed"

    # Admin2 ADM_01: three priority levels, decided automatically by the AI
    # from the keywords an admin maintains (see PriorityKeyword / services).
    class Priority(models.TextChoices):
        LOW = "low", "Low"
        MEDIUM = "medium", "Medium"
        HIGH = "high", "High"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tracking_code = models.CharField(max_length=20, unique=True, editable=False)

    submission_type = models.CharField(max_length=20, choices=SubmissionType.choices)
    category = models.ForeignKey(Category, on_delete=models.PROTECT, related_name="submissions")
    department = models.ForeignKey(
        Department, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="submissions", help_text="Service/department this concerns.",
    )

    title = models.CharField(max_length=200)
    description = models.TextField()

    # Identity fields — only populated for 'confidential' and 'identified' submissions.
    # For 'confidential', these are restricted at the serializer/permission level to staff only.
    submitted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="submissions",
    )
    submitter_name = models.CharField(max_length=150, blank=True)
    submitter_email = models.EmailField(blank=True)
    submitter_phone = models.CharField(max_length=20, blank=True)

    status = models.CharField(max_length=20, choices=Status.choices, default=Status.RECEIVED)
    priority = models.CharField(max_length=10, choices=Priority.choices, default=Priority.LOW)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    # General3 GEN_07: once a case is resolved its owner can rank how
    # satisfied they are with the answer, from 1 to 10.
    satisfaction_rating = models.PositiveSmallIntegerField(null=True, blank=True)
    satisfaction_comment = models.TextField(blank=True)
    satisfaction_rated_at = models.DateTimeField(null=True, blank=True)
    resolved_at = models.DateTimeField(
        null=True, blank=True,
        help_text="When the status became 'resolved'. Used to auto-close 3 days later.",
    )
    closed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]
        permissions = [
            ("can_assign_cases", "Can assign cases to staff"),
            ("can_respond_to_cases", "Can respond to cases"),
            ("can_view_analytics", "Can view analytics"),
            ("can_export_reports", "Can export reports"),
            ("can_manage_categories_departments", "Can manage categories and departments"),
            # General2 GEN_03: staff allowed to answer questions the AI assistant
            # couldn't answer from its FAQs.
            ("can_answer_assistant_questions", "Can answer questions forwarded from the AI assistant"),
            # Admin2 ADM_01: who may see and work on cases of each priority.
            # Low = cases the AI did not mark High or Medium.
            ("can_access_high_priority_cases", "Can see and work on High priority cases"),
            ("can_access_medium_priority_cases", "Can see and work on Medium priority cases"),
            ("can_access_low_priority_cases", "Can see and work on Low priority (unmarked) cases"),
        ]

    def save(self, *args, **kwargs):
        if not self.tracking_code:
            code = generate_tracking_code()
            attempts = 0
            while Submission.objects.filter(tracking_code=code).exists():
                attempts += 1
                # 9,999 numbers a day; if a day is ever that busy, widen to 5 digits.
                code = generate_tracking_code(digits=4 if attempts < 60 else 5)
            self.tracking_code = code
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.tracking_code} — {self.title}"

    def reveals_identity(self):
        return self.submission_type != self.SubmissionType.ANONYMOUS


class PriorityKeyword(models.Model):
    """Admin2 ADM_01: a word/phrase that tells the AI a case is High or Medium
    priority. Cases matching none of them are Low priority."""

    class Level(models.TextChoices):
        HIGH = "high", "High"
        MEDIUM = "medium", "Medium"

    level = models.CharField(max_length=10, choices=Level.choices)
    word = models.CharField(max_length=100)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["level", "word"]
        constraints = [models.UniqueConstraint(fields=["word"], name="unique_priority_keyword_word")]

    def save(self, *args, **kwargs):
        self.word = " ".join((self.word or "").lower().split())
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.word} ({self.level})"


class SiteSettings(models.Model):
    """General3 GEN_03: the admin decides which non-anonymous submission types
    are offered. Anonymous is always available and is the default."""

    allow_confidential = models.BooleanField(default=True)
    allow_identified = models.BooleanField(default=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name_plural = "Site settings"

    @classmethod
    def load(cls):
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj

    def enabled_types(self):
        types = ["anonymous"]
        if self.allow_confidential:
            types.append("confidential")
        if self.allow_identified:
            types.append("identified")
        return types


class Attachment(models.Model):
    submission = models.ForeignKey(Submission, on_delete=models.CASCADE, related_name="attachments")
    file = models.FileField(upload_to="attachments/%Y/%m/")
    original_name = models.CharField(max_length=255, blank=True)
    uploaded_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.original_name or self.file.name


class Assignment(models.Model):
    submission = models.ForeignKey(Submission, on_delete=models.CASCADE, related_name="assignments")
    department = models.ForeignKey(Department, on_delete=models.SET_NULL, null=True, blank=True)
    assigned_to = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="assigned_submissions",
    )
    assigned_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="assignments_made",
    )
    note = models.TextField(blank=True)
    assigned_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-assigned_at"]

    def __str__(self):
        return f"{self.submission.tracking_code} -> {self.department or self.assigned_to}"


class Response(models.Model):
    submission = models.ForeignKey(Submission, on_delete=models.CASCADE, related_name="responses")
    responder = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        help_text="Null when is_from_owner is True — the case owner has no staff account.",
    )
    message = models.TextField()
    attachment = models.FileField(upload_to="response_attachments/%Y/%m/", null=True, blank=True)
    is_request_for_info = models.BooleanField(
        default=False, help_text="Marks this as a request for more information from the submitter."
    )
    is_from_owner = models.BooleanField(
        default=False, help_text="True when the case owner/writer sent this via their tracking code."
    )
    hidden_from_assignee = models.BooleanField(
        default=False,
        help_text=(
            "True for responses an admin sent directly to the owner outside the normal "
            "assignment — kept out of the assigned officer's view of the thread."
        ),
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at"]

    def __str__(self):
        return f"Response on {self.submission.tracking_code}"


class InternalMessage(models.Model):
    """Private chat between the admin who assigned a case and the staff
    member it was assigned to — never visible to the case owner."""

    submission = models.ForeignKey(Submission, on_delete=models.CASCADE, related_name="internal_messages")
    sender = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True)
    message = models.TextField(blank=True)
    attachment = models.FileField(upload_to="internal_message_attachments/%Y/%m/", null=True, blank=True)
    # General2 GEN_02: reply / edit / delete / pin, like WhatsApp.
    reply_to = models.ForeignKey("self", null=True, blank=True, on_delete=models.SET_NULL, related_name="replies")
    edited_at = models.DateTimeField(null=True, blank=True)
    is_deleted = models.BooleanField(default=False)
    is_pinned = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at"]

    def __str__(self):
        return f"Internal message on {self.submission.tracking_code}"


class StatusHistory(models.Model):
    submission = models.ForeignKey(Submission, on_delete=models.CASCADE, related_name="status_history")
    old_status = models.CharField(max_length=20, blank=True)
    new_status = models.CharField(max_length=20)
    changed_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True)
    note = models.CharField(max_length=255, blank=True)
    changed_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["changed_at"]
        verbose_name_plural = "Status histories"

    def __str__(self):
        return f"{self.submission.tracking_code}: {self.old_status} -> {self.new_status}"
