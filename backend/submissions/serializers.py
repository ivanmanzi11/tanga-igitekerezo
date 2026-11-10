from common.uploads import validate_upload_file
from django.db import transaction
from rest_framework import serializers

from accounts.models import Department
from accounts.serializers import DepartmentSerializer
from .models import Submission, Category, Attachment, Assignment, Response, StatusHistory, InternalMessage, PriorityKeyword, SiteSettings


class CategorySerializer(serializers.ModelSerializer):
    submission_count = serializers.SerializerMethodField()

    class Meta:
        model = Category
        fields = ["id", "name", "name_rw", "name_fr", "kind", "is_active", "is_other", "submission_count"]
        read_only_fields = ["is_active", "is_other", "submission_count"]
        extra_kwargs = {"name": {"validators": []}}  # uniqueness is handled in the view (archived names)

    def get_submission_count(self, obj):
        return getattr(obj, "submission_count", None) if hasattr(obj, "submission_count") else obj.submissions.count()

    def validate_name(self, value):
        value = " ".join((value or "").split())
        if not value:
            raise serializers.ValidationError("Give the category a name.")
        return value


class AttachmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Attachment
        fields = ["id", "file", "original_name", "uploaded_at"]
        read_only_fields = ["id", "uploaded_at"]


class ResponseSerializer(serializers.ModelSerializer):
    responder_name = serializers.SerializerMethodField()

    class Meta:
        model = Response
        fields = [
            "id", "message", "attachment", "is_request_for_info", "is_from_owner",
            "responder_name", "created_at",
        ]
        read_only_fields = ["id", "responder_name", "created_at", "is_from_owner"]

    def get_responder_name(self, obj):
        if obj.is_from_owner:
            return obj.submission.submitter_name or "Case owner"
        if obj.responder:
            return obj.responder.get_full_name() or obj.responder.username
        return "Institution"


class InternalMessageSerializer(serializers.ModelSerializer):
    sender_name = serializers.SerializerMethodField()
    text = serializers.SerializerMethodField()
    message = serializers.SerializerMethodField()
    attachment = serializers.SerializerMethodField()
    reply_to = serializers.SerializerMethodField()
    edited = serializers.SerializerMethodField()
    deleted = serializers.BooleanField(source="is_deleted", read_only=True)
    pinned = serializers.BooleanField(source="is_pinned", read_only=True)

    class Meta:
        model = InternalMessage
        fields = [
            "id", "message", "text", "attachment", "sender", "sender_name", "created_at",
            "reply_to", "edited", "deleted", "pinned",
        ]
        read_only_fields = ["id", "sender", "sender_name", "created_at"]

    def get_sender_name(self, obj):
        if obj.sender:
            return obj.sender.get_full_name() or obj.sender.username
        return "Unknown"

    def get_message(self, obj):
        return "" if obj.is_deleted else obj.message

    get_text = get_message

    def get_attachment(self, obj):
        if obj.is_deleted or not obj.attachment:
            return None
        request = self.context.get("request")
        return request.build_absolute_uri(obj.attachment.url) if request else obj.attachment.url

    def get_reply_to(self, obj):
        from notifications.serializers import _reply_preview
        p = _reply_preview(obj.reply_to, True)
        if p:
            p["id"] = obj.reply_to_id  # the case page uses plain ids
        return p

    def get_edited(self, obj):
        return bool(obj.edited_at)


class PriorityKeywordSerializer(serializers.ModelSerializer):
    class Meta:
        model = PriorityKeyword
        fields = ["id", "level", "word", "created_at"]
        read_only_fields = ["id", "created_at"]

    def validate_word(self, value):
        word = " ".join((value or "").lower().split())
        if not word:
            raise serializers.ValidationError("Type a word or short phrase.")
        if len(word) > 100:
            raise serializers.ValidationError("Keep it under 100 characters.")
        qs = PriorityKeyword.objects.filter(word=word)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError("This keyword is already in one of the lists.")
        return word


class StatusHistorySerializer(serializers.ModelSerializer):
    changed_by_name = serializers.SerializerMethodField()

    class Meta:
        model = StatusHistory
        fields = ["id", "old_status", "new_status", "changed_by_name", "note", "changed_at"]

    def get_changed_by_name(self, obj):
        if obj.changed_by:
            return obj.changed_by.get_full_name() or obj.changed_by.username
        return "System"


class AssignmentSerializer(serializers.ModelSerializer):
    department_name = serializers.CharField(source="department.name", read_only=True)
    assigned_to_name = serializers.SerializerMethodField()

    class Meta:
        model = Assignment
        fields = [
            "id", "department", "department_name", "assigned_to", "assigned_to_name",
            "note", "assigned_at",
        ]
        read_only_fields = ["id", "assigned_at"]

    def get_assigned_to_name(self, obj):
        if obj.assigned_to:
            return obj.assigned_to.get_full_name() or obj.assigned_to.username
        return None


class SubmissionCreateSerializer(serializers.ModelSerializer):
    """Public-facing creation. Identity fields are only required/kept for
    'identified' and 'confidential' submissions; anonymous submissions never
    store a name, email, phone, or linked user account."""

    class Meta:
        model = Submission
        fields = [
            "submission_type", "category", "department", "title", "description",
            "submitter_name", "submitter_email", "submitter_phone",
        ]

    def validate(self, attrs):
        sub_type = attrs.get("submission_type")
        # General3 GEN_03: the admin can switch Confidential / Identified off.
        if sub_type not in SiteSettings.load().enabled_types():
            raise serializers.ValidationError(
                "This way of submitting is not available right now. Please submit anonymously."
            )
        if sub_type in {Submission.SubmissionType.IDENTIFIED, Submission.SubmissionType.CONFIDENTIAL}:
            if not attrs.get("submitter_name") or not (attrs.get("submitter_email") or attrs.get("submitter_phone")):
                raise serializers.ValidationError(
                    "Identified and confidential submissions need a name and at least an email or phone number."
                )
        if sub_type == Submission.SubmissionType.ANONYMOUS:
            attrs["submitter_name"] = ""
            attrs["submitter_email"] = ""
            attrs["submitter_phone"] = ""
        return attrs

    def create(self, validated_data):
        request = self.context.get("request")
        user = getattr(request, "user", None)
        signed_in = user is not None and user.is_authenticated
        # General3 GEN_04: an anonymous submission is never tied to an account —
        # not even if the person happens to be signed in. Identity fields are
        # forced empty so nothing the browser sent can be stored.
        if validated_data["submission_type"] == Submission.SubmissionType.ANONYMOUS:
            validated_data["submitted_by"] = None
            validated_data["submitter_name"] = ""
            validated_data["submitter_email"] = ""
            validated_data["submitter_phone"] = ""
        elif signed_in:
            validated_data["submitted_by"] = user
        # Admin2 ADM_01: the AI sets the priority from the admin's keyword list.
        from . import services
        validated_data["priority"] = services.classify_priority(
            f"{validated_data.get('title', '')} {validated_data.get('description', '')}"
        )
        with transaction.atomic():
            submission = Submission.objects.create(**validated_data)
            StatusHistory.objects.create(
                submission=submission,
                old_status="",
                new_status=Submission.Status.RECEIVED,
                note="Submission received.",
            )
        return submission


class SubmissionStaffSerializer(serializers.ModelSerializer):
    """Full detail view for staff — respects confidentiality: only staff who
    are authorized (assigned officer, department head of the target
    department, or admin) see the submitter's identity for confidential
    submissions."""

    category_detail = CategorySerializer(source="category", read_only=True)
    department_detail = DepartmentSerializer(source="department", read_only=True)
    attachments = AttachmentSerializer(many=True, read_only=True)
    responses = serializers.SerializerMethodField()
    status_history = StatusHistorySerializer(many=True, read_only=True)
    assignments = AssignmentSerializer(many=True, read_only=True)
    identity_visible = serializers.SerializerMethodField()
    submitter_name = serializers.SerializerMethodField()
    submitter_email = serializers.SerializerMethodField()
    submitter_phone = serializers.SerializerMethodField()
    can_message_internally = serializers.SerializerMethodField()

    class Meta:
        model = Submission
        fields = [
            "id", "tracking_code", "submission_type", "category", "category_detail",
            "department", "department_detail", "title", "description", "status", "priority",
            "identity_visible", "submitter_name", "submitter_email", "submitter_phone",
            "attachments", "responses", "status_history", "assignments", "can_message_internally",
            "created_at", "updated_at", "closed_at",
        ]
        read_only_fields = ["id", "tracking_code", "created_at", "updated_at"]

    def get_responses(self, obj):
        """An admin's direct responses to the owner are kept out of the
        assigned officer's view of the thread (GEN_04) — everyone else
        (admin, dept head, the owner via the tracking endpoint) sees it all."""
        user = self.context["request"].user
        qs = obj.responses.all()
        if user.role == "officer":
            qs = qs.exclude(hidden_from_assignee=True)
        return ResponseSerializer(qs, many=True).data

    def get_can_message_internally(self, obj):
        # General2 GEN_01: anyone working the case (not just the admin) can
        # join its group — see notifications.services.can_access_case_group.
        from notifications.services import can_access_case_group
        return can_access_case_group(self.context["request"].user, obj)

    def _can_see_identity(self, obj):
        user = self.context["request"].user
        if obj.submission_type == Submission.SubmissionType.ANONYMOUS:
            return False
        if obj.submission_type == Submission.SubmissionType.IDENTIFIED:
            return True
        # Confidential: restricted to admin, the target department's head,
        # or an officer currently assigned to this submission.
        if user.role == "admin":
            return True
        if user.role == "dept_head" and obj.department_id == user.department_id:
            return True
        if user.role == "officer" and obj.assignments.filter(assigned_to=user).exists():
            return True
        return False

    def get_identity_visible(self, obj):
        return self._can_see_identity(obj)

    def get_submitter_name(self, obj):
        return obj.submitter_name if self._can_see_identity(obj) else None

    def get_submitter_email(self, obj):
        return obj.submitter_email if self._can_see_identity(obj) else None

    def get_submitter_phone(self, obj):
        return obj.submitter_phone if self._can_see_identity(obj) else None


class SubmissionListSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source="category.name", read_only=True)
    department_name = serializers.CharField(source="department.name", read_only=True)

    class Meta:
        model = Submission
        fields = [
            "id", "tracking_code", "submission_type", "category_name", "department_name",
            "title", "status", "priority", "created_at", "updated_at",
        ]


class TrackingLookupSerializer(serializers.Serializer):
    """What an anonymous / any submitter sees when checking a tracking code —
    status + public responses only, never internal notes or identity data."""

    tracking_code = serializers.CharField()
    title = serializers.CharField()
    category = serializers.CharField(source="category.name")
    status = serializers.CharField()
    created_at = serializers.DateTimeField()
    updated_at = serializers.DateTimeField()
    responses = serializers.SerializerMethodField()
    status_history = serializers.SerializerMethodField()
    satisfaction_rating = serializers.IntegerField(allow_null=True)
    satisfaction_comment = serializers.CharField()
    can_rate = serializers.SerializerMethodField()

    def get_responses(self, obj):
        return ResponseSerializer(obj.responses.all(), many=True).data

    def get_status_history(self, obj):
        return StatusHistorySerializer(obj.status_history.all(), many=True).data

    def get_can_rate(self, obj):
        # General3 GEN_07: rating opens once the case is marked resolved
        # (and stays open if it later auto-closes).
        return obj.status in {Submission.Status.RESOLVED, Submission.Status.CLOSED}


class StatusUpdateSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=Submission.Status.choices)
    note = serializers.CharField(required=False, allow_blank=True)


class AssignSerializer(serializers.Serializer):
    department = serializers.PrimaryKeyRelatedField(queryset=Department.objects.all(), required=False)
    assigned_to = serializers.PrimaryKeyRelatedField(queryset=Department.objects.none(), required=False)
    note = serializers.CharField(required=False, allow_blank=True)

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        from django.contrib.auth import get_user_model
        self.fields["assigned_to"].queryset = get_user_model().objects.exclude(role="citizen")

    def validate(self, attrs):
        if not attrs.get("department") and not attrs.get("assigned_to"):
            raise serializers.ValidationError("Provide a department and/or a specific staff member to assign to.")
        department = attrs.get("department")
        assigned_to = attrs.get("assigned_to")
        if department and assigned_to and assigned_to.department_id and assigned_to.department_id != department.id:
            raise serializers.ValidationError(
                {"assigned_to": "This staff member doesn't belong to the selected department."}
            )
        return attrs


class RespondSerializer(serializers.Serializer):
    message = serializers.CharField()
    attachment = serializers.FileField(required=False, allow_null=True, validators=[validate_upload_file])
    is_request_for_info = serializers.BooleanField(default=False)
    new_status = serializers.ChoiceField(choices=Submission.Status.choices, required=False)


class OwnerReplySerializer(serializers.Serializer):
    """What the case owner submits from the public Track page."""

    message = serializers.CharField()
    attachment = serializers.FileField(required=False, allow_null=True, validators=[validate_upload_file])
