from django.conf import settings
from django.db import models


# General2 ADM_07: internal, WhatsApp-style staff-to-staff messaging — group
# chats and one-on-one DMs, separate from the per-case "Internal conversation"
# already on a submission's detail page.
class Conversation(models.Model):
    is_group = models.BooleanField(default=False)
    name = models.CharField(max_length=120, blank=True)  # only used for groups
    participants = models.ManyToManyField(settings.AUTH_USER_MODEL, related_name="conversations")
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )
    # General3 GEN_09: a "case group" is the group chat of everyone working
    # one submission. It is created and kept in sync automatically as staff
    # are assigned to the case, and shares its messages with the case's own
    # internal conversation.
    submission = models.OneToOneField(
        "submissions.Submission", null=True, blank=True, on_delete=models.CASCADE, related_name="case_group"
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    @property
    def kind(self):
        if self.submission_id:
            return "case"
        return "group" if self.is_group else "dm"

    def __str__(self):
        return self.name or f"Conversation #{self.pk}"


class ChatMessage(models.Model):
    conversation = models.ForeignKey(Conversation, on_delete=models.CASCADE, related_name="messages")
    sender = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="+")
    text = models.TextField(blank=True)
    # General2 GEN_02: reply / edit / delete / pin, like WhatsApp.
    reply_to = models.ForeignKey("self", null=True, blank=True, on_delete=models.SET_NULL, related_name="replies")
    edited_at = models.DateTimeField(null=True, blank=True)
    is_deleted = models.BooleanField(default=False)
    is_pinned = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    read_by = models.ManyToManyField(settings.AUTH_USER_MODEL, related_name="+", blank=True)

    class Meta:
        ordering = ["created_at"]

    def __str__(self):
        return f"{self.sender}: {self.text[:40]}"


class Notification(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="notifications")
    message = models.CharField(max_length=255)
    link = models.CharField(max_length=255, blank=True)
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.user}: {self.message[:40]}"
