from django.contrib.auth import get_user_model
from django.db.models import Q
from rest_framework import viewsets, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.exceptions import PermissionDenied

from common.permissions import IsStaffMember
from .models import ChatMessage, Conversation, Notification
from .services import ensure_case_group, can_access_case_group, apply_message_op, parse_case_id
from .serializers import case_message_dict, ChatMessageSerializer, ChatParticipantSerializer, ConversationSerializer, NotificationSerializer

User = get_user_model()


class NotificationViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = NotificationSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Notification.objects.filter(user=self.request.user)

    @action(detail=True, methods=["post"])
    def mark_read(self, request, pk=None):
        notif = self.get_object()
        notif.is_read = True
        notif.save()
        return Response(NotificationSerializer(notif).data)

    @action(detail=False, methods=["post"])
    def mark_all_read(self, request):
        self.get_queryset().update(is_read=True)
        return Response({"detail": "All notifications marked as read."})


class ChatDirectoryView(viewsets.ViewSet):
    """General2 ADM_07: the list of staff a user can start a group or DM
    with — every officer/dept-head/admin except the requester."""

    permission_classes = [permissions.IsAuthenticated, IsStaffMember]

    def list(self, request):
        qs = User.objects.exclude(role=User.Role.CITIZEN).exclude(id=request.user.id).order_by("first_name", "username")
        return Response(ChatParticipantSerializer(qs, many=True).data)


class ConversationViewSet(viewsets.ModelViewSet):
    """General2 ADM_07: WhatsApp-style internal messaging — group chats and
    one-on-one DMs between staff, separate from the per-case internal
    conversation on a submission's detail page."""

    serializer_class = ConversationSerializer
    permission_classes = [permissions.IsAuthenticated, IsStaffMember]

    def get_queryset(self):
        return Conversation.objects.filter(participants=self.request.user).distinct()

    pagination_class = None

    def list(self, request, *args, **kwargs):
        # General2 GEN_01: make sure every case the user is working has its
        # case group and that they're in it — covers cases assigned before
        # case groups existed and colleagues who joined a department later.
        from submissions.models import Submission
        user = request.user
        q = Q(assignments__assigned_to=user) | Q(assignments__assigned_by=user)
        if user.department_id:
            q |= Q(assignments__department_id=user.department_id)
            if user.role == "dept_head":
                q |= Q(department_id=user.department_id)
        if user.role == "admin":
            q = Q(assignments__assigned_by=user) | Q(assignments__assigned_to=user)
        joined = set(
            Conversation.objects.filter(submission__isnull=False, participants=user).values_list("submission_id", flat=True)
        )
        for sub in Submission.objects.filter(q).distinct().order_by("-updated_at")[:100]:
            if sub.pk not in joined:
                ensure_case_group(sub, extra_users=[user])
        return super().list(request, *args, **kwargs)

    def _guard(self, conv, user):
        """A case group only stays open to people who may still work the case."""
        if conv.submission_id and not can_access_case_group(user, conv.submission):
            raise PermissionDenied("You don't have access to this case group.")
        return conv

    def get_serializer_context(self):
        return {"request": self.request}

    def create(self, request):
        is_group = bool(request.data.get("is_group"))
        # General3 GEN_01: user IDs here are UUIDs (accounts.User uses a
        # UUIDField primary key), not integers — the old `str(pid).isdigit()`
        # filter silently threw every participant away, so a conversation
        # could never actually be created in either Direct message or Group
        # mode. IDs just need to be non-empty strings that are real users.
        raw_ids = request.data.get("participant_ids") or []
        valid_ids = set(str(pid) for pid in User.objects.exclude(role=User.Role.CITIZEN).values_list("id", flat=True))
        participant_ids = [str(pid) for pid in raw_ids if str(pid) in valid_ids]

        if not is_group:
            # 1:1 DM — reuse an existing conversation with that person if one exists.
            if len(participant_ids) != 1:
                return Response({"detail": "Pick exactly one person to message."}, status=400)
            other_id = participant_ids[0]
            existing = (
                Conversation.objects.filter(is_group=False, participants=request.user)
                .filter(participants__id=other_id)
                .distinct()
                .first()
            )
            if existing:
                return Response(ConversationSerializer(existing, context={"request": request}).data)
            conv = Conversation.objects.create(is_group=False, created_by=request.user)
            conv.participants.set({request.user.id, other_id})
            return Response(ConversationSerializer(conv, context={"request": request}).data, status=201)

        name = (request.data.get("name") or "").strip()
        if not name:
            return Response({"detail": "Give the group a name."}, status=400)
        if not participant_ids:
            return Response({"detail": "Pick at least one other person for the group."}, status=400)
        conv = Conversation.objects.create(is_group=True, name=name, created_by=request.user)
        conv.participants.set({request.user.id, *participant_ids})
        return Response(ConversationSerializer(conv, context={"request": request}).data, status=201)

    @action(detail=True, methods=["get"])
    def messages(self, request, pk=None):
        conv = self._guard(self.get_object(), request.user)
        if conv.submission_id:
            return Response([
                case_message_dict(m, conv, request)
                for m in conv.submission.internal_messages.select_related("sender", "reply_to", "reply_to__sender").all()
            ])
        msgs = conv.messages.select_related("sender", "reply_to", "reply_to__sender").all()
        # Opening the thread marks everything in it as read.
        for msg in msgs.exclude(sender=request.user):
            msg.read_by.add(request.user)
        return Response(ChatMessageSerializer(msgs, many=True).data)

    @action(detail=True, methods=["post"])
    def send(self, request, pk=None):
        conv = self._guard(self.get_object(), request.user)
        text = (request.data.get("text") or "").strip()
        if not text:
            return Response({"detail": "Message can't be empty."}, status=400)
        raw_reply = request.data.get("reply_to")
        if conv.submission_id:
            from submissions.models import InternalMessage
            reply_to = None
            if raw_reply not in (None, ""):
                reply_to = conv.submission.internal_messages.filter(pk=parse_case_id(raw_reply)).first()
            m = InternalMessage.objects.create(
                submission=conv.submission, sender=request.user, message=text, reply_to=reply_to,
            )
            return Response(case_message_dict(m, conv, request), status=201)
        reply_to = None
        if raw_reply not in (None, ""):
            reply_to = conv.messages.filter(pk=raw_reply).first() if str(raw_reply).isdigit() else None
        msg = ChatMessage.objects.create(conversation=conv, sender=request.user, text=text, reply_to=reply_to)
        msg.read_by.add(request.user)
        return Response(ChatMessageSerializer(msg).data, status=201)

    @action(detail=True, methods=["post"], url_path=r"messages/(?P<mid>[^/.]+)/(?P<op>edit|delete|pin)")
    def message_op(self, request, pk=None, mid=None, op=None):
        """General2 GEN_02: edit, delete or pin (toggle) a message — the
        chevron menu on every message bubble."""
        conv = self._guard(self.get_object(), request.user)
        text = request.data.get("text")
        if conv.submission_id:
            msg = conv.submission.internal_messages.filter(pk=parse_case_id(mid)).first()
            if not msg:
                return Response({"detail": "Message not found."}, status=404)
            apply_message_op(request.user, msg, op, is_case=True, text=text)
            return Response(case_message_dict(msg, conv, request))
        msg = conv.messages.filter(pk=mid).first() if str(mid).isdigit() else None
        if not msg:
            return Response({"detail": "Message not found."}, status=404)
        apply_message_op(request.user, msg, op, is_case=False, text=text)
        return Response(ChatMessageSerializer(msg).data)
