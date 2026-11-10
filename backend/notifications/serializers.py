from django.contrib.auth import get_user_model
from rest_framework import serializers

from .models import ChatMessage, Conversation, Notification

User = get_user_model()


class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = ["id", "message", "link", "is_read", "created_at"]


class ChatParticipantSerializer(serializers.ModelSerializer):
    display_name = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ["id", "username", "display_name", "role", "department"]

    def get_display_name(self, obj):
        full = f"{obj.first_name} {obj.last_name}".strip()
        return full or obj.username


def _name(user):
    if not user:
        return "Former staff member"
    return f"{user.first_name} {user.last_name}".strip() or user.username


def _reply_preview(parent, is_case):
    """General2 GEN_02: the quoted message shown above a reply."""
    if not parent:
        return None
    text = "" if parent.is_deleted else (parent.message if is_case else parent.text)
    return {
        "id": f"case-{parent.id}" if is_case else parent.id,
        "sender_name": _name(parent.sender),
        "text": text[:140],
        "deleted": parent.is_deleted,
    }


class ChatMessageSerializer(serializers.ModelSerializer):
    sender_name = serializers.SerializerMethodField()
    reply_to = serializers.SerializerMethodField()
    edited = serializers.SerializerMethodField()
    deleted = serializers.BooleanField(source="is_deleted", read_only=True)
    pinned = serializers.BooleanField(source="is_pinned", read_only=True)

    class Meta:
        model = ChatMessage
        fields = [
            "id", "conversation", "sender", "sender_name", "text", "created_at",
            "reply_to", "edited", "deleted", "pinned",
        ]
        read_only_fields = ["id", "sender", "created_at"]

    def get_sender_name(self, obj):
        return _name(obj.sender)

    def get_reply_to(self, obj):
        return _reply_preview(obj.reply_to, False)

    def get_edited(self, obj):
        return bool(obj.edited_at)


def case_message_dict(m, conv, request=None):
    """A case group's messages live in the case's own internal conversation
    (submissions.InternalMessage); present them in the same shape as a
    ChatMessage so the widget can treat every conversation alike."""
    attachment = None
    if m.attachment and not m.is_deleted:
        attachment = request.build_absolute_uri(m.attachment.url) if request else m.attachment.url
    return {
        "id": f"case-{m.id}",
        "conversation": conv.id,
        "sender": str(m.sender_id) if m.sender_id else None,
        "sender_name": _name(m.sender),
        "text": "" if m.is_deleted else m.message,
        "attachment": attachment,
        "created_at": m.created_at,
        "reply_to": _reply_preview(m.reply_to, True),
        "edited": bool(m.edited_at),
        "deleted": m.is_deleted,
        "pinned": m.is_pinned,
    }


class ConversationSerializer(serializers.ModelSerializer):
    participants = ChatParticipantSerializer(many=True, read_only=True)
    last_message = serializers.SerializerMethodField()
    unread_count = serializers.SerializerMethodField()
    display_name = serializers.SerializerMethodField()
    kind = serializers.CharField(read_only=True)
    tracking_code = serializers.CharField(source="submission.tracking_code", read_only=True, default=None)

    class Meta:
        model = Conversation
        fields = [
            "id", "kind", "is_group", "name", "display_name", "participants", "submission", "tracking_code",
            "created_by", "created_at", "last_message", "unread_count",
        ]
        read_only_fields = ["id", "created_by", "created_at", "submission"]

    def get_last_message(self, obj):
        if obj.submission_id:
            m = obj.submission.internal_messages.order_by("-created_at").first()
            return case_message_dict(m, obj, self.context.get("request")) if m else None
        msg = obj.messages.order_by("-created_at").first()
        if not msg:
            return None
        return ChatMessageSerializer(msg).data

    def get_unread_count(self, obj):
        request = self.context.get("request")
        if not request or obj.submission_id:
            return 0
        return obj.messages.exclude(read_by=request.user).exclude(sender=request.user).count()

    def get_display_name(self, obj):
        if obj.is_group:
            return obj.name or "Group chat"
        request = self.context.get("request")
        other = obj.participants.exclude(id=getattr(request.user, "id", None)).first()
        if not other:
            return obj.name or "Conversation"
        full = f"{other.first_name} {other.last_name}".strip()
        return full or other.username
