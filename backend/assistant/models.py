import secrets

from django.conf import settings
from django.db import models


class FAQEntry(models.Model):
    """General2 GEN_03: the assistant's knowledge base. Staff grow it by
    ticking 'add to FAQs' when they answer a forwarded question."""

    question = models.CharField(max_length=500)
    answer = models.TextField()
    # Admin3 ADM_02: optional Kinyarwanda / French versions, so the assistant can
    # answer in the asker's language.
    question_rw = models.CharField(max_length=500, blank=True)
    question_fr = models.CharField(max_length=500, blank=True)
    answer_rw = models.TextField(blank=True)
    answer_fr = models.TextField(blank=True)
    # Set when this entry customises one of the assistant's built-in topics.
    source_key = models.CharField(max_length=60, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "FAQ entry"
        verbose_name_plural = "FAQ entries"

    def __str__(self):
        return self.question[:80]


def _new_code():
    return "AQ-" + secrets.token_hex(3).upper()


class AssistantQuestion(models.Model):
    """A question the assistant couldn't answer from the FAQs, forwarded to an
    approved staff member. The asker follows it with `code` — no account."""

    class Status(models.TextChoices):
        PENDING = "pending", "Waiting for a staff answer"
        ANSWERED = "answered", "Answered"

    code = models.CharField(max_length=12, unique=True, default=_new_code, editable=False)
    question = models.TextField()
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.PENDING)
    answer = models.TextField(blank=True)
    answered_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )
    answered_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.code}: {self.question[:60]}"


class AnswerFeedback(models.Model):
    """Thumbs up / down on an assistant answer. The assistant uses the totals to
    prefer answers people found helpful (General2 GEN_06)."""

    key = models.CharField(max_length=60, db_index=True)  # "kb:<topic>" or "faq:<id>"
    helpful = models.BooleanField()
    question = models.CharField(max_length=500, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.key} {'+' if self.helpful else '-'}"
