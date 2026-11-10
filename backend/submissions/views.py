import calendar
from datetime import datetime, timedelta

from django.contrib.auth import get_user_model
from django.db import transaction
from django.db.models import Count, Avg, F, ExpressionWrapper, DurationField, Q
from django.http import HttpResponse
from django.utils import timezone
from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.permissions import BasePermission
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from notifications.services import ensure_case_group, can_access_case_group, apply_message_op, parse_case_id
from common.visibility import visible_submissions
from common.uploads import anonymise_upload, validate_upload_file, validated_files
from common.permissions import IsStaffMember, IsDeptHeadOrAdmin, IsAdmin, RequireGroupPermission
from . import services, reports
from .models import PriorityKeyword, SiteSettings, Submission, Category, Attachment, Assignment, Response as SubmissionResponse, InternalMessage
from .serializers import (
    CategorySerializer, SubmissionCreateSerializer, SubmissionStaffSerializer,
    SubmissionListSerializer, TrackingLookupSerializer, StatusUpdateSerializer,
    AssignSerializer, RespondSerializer, AttachmentSerializer, OwnerReplySerializer,
    InternalMessageSerializer, PriorityKeywordSerializer,
)

User = get_user_model()


class IsStaffMemberOrOwner(BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated)

    def has_object_permission(self, request, view, obj):
        user = request.user
        if user.role in {"officer", "dept_head", "admin"}:
            return True
        return obj.submitted_by_id == user.id


class CategoryViewSet(viewsets.ModelViewSet):
    """Admin3 ADM_03 / ADM_04: admins view, create, update and delete categories.

    History is never lost: deleting a category that submissions already use
    *archives* it (hidden from new submissions, still shown on old ones and in
    statistics); renaming such a category archives the old name and starts a
    new category with the new name, so old submissions stay under the name they
    were filed with. "Others" always comes last and can't be deleted."""

    queryset = Category.objects.all()
    serializer_class = CategorySerializer
    pagination_class = None  # lookup list used by dropdowns

    def get_permissions(self):
        if self.request.method in permissions.SAFE_METHODS:
            return [permissions.AllowAny()]
        return [permissions.IsAuthenticated(), RequireGroupPermission("can_manage_categories_departments")()]

    def get_queryset(self):
        from django.db.models import Count
        qs = Category.objects.annotate(submission_count=Count("submissions")).order_by("is_other", "name")
        user = self.request.user
        wants_all = self.request.query_params.get("all") in ("1", "true")
        # Staff screens (filters, statistics, the category manager) also need archived
        # categories so old submissions still show their category.
        if wants_all and user.is_authenticated and user.role != "citizen":
            return qs
        return qs.filter(is_active=True)

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        existing = Category.objects.filter(name__iexact=data["name"]).first()
        if existing and existing.is_active:
            return Response({"name": ["A category with this name already exists."]}, status=400)
        if existing:  # bringing back an archived category with the same name
            for field in ("name_rw", "name_fr", "kind"):
                if field in data:
                    setattr(existing, field, data[field])
            existing.is_active = True
            existing.save()
            return Response(self.get_serializer(existing).data, status=201)
        category = Category.objects.create(**{k: v for k, v in data.items()})
        return Response(self.get_serializer(category).data, status=201)

    def update(self, request, *args, **kwargs):
        category = self.get_object()
        partial = kwargs.pop("partial", False)
        serializer = self.get_serializer(category, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        new_name = data.get("name", category.name)
        clash = Category.objects.filter(name__iexact=new_name).exclude(pk=category.pk).first()
        if clash and clash.is_active:
            return Response({"name": ["A category with this name already exists."]}, status=400)
        renamed = new_name != category.name
        used = category.submissions.exists()
        if renamed and used and not category.is_other:
            with transaction.atomic():
                # Old submissions stay under the old name; new ones use the new category.
                category.is_active = False
                category.save(update_fields=["is_active"])
                if clash:  # an archived category already had that name — reuse it
                    replacement = clash
                    replacement.is_active = True
                else:
                    replacement = Category(name=new_name, is_active=True)
                for field in ("name_rw", "name_fr", "kind"):
                    setattr(replacement, field, data.get(field, getattr(category, field)))
                replacement.name = new_name
                replacement.save()
            return Response(self.get_serializer(replacement).data)
        if clash:  # unused category renamed to an archived one's name: free the name
            clash.delete() if not clash.submissions.exists() else None
        for field, value in data.items():
            setattr(category, field, value)
        category.save()
        return Response(self.get_serializer(category).data)

    def destroy(self, request, *args, **kwargs):
        category = self.get_object()
        if category.is_other:
            return Response({"detail": "“Others” is the catch-all category and can't be deleted."}, status=400)
        if category.submissions.exists():
            category.is_active = False
            category.save(update_fields=["is_active"])
            return Response({
                "archived": True,
                "detail": "This category already has submissions, so it was archived: they keep it in their history and statistics, but it is no longer offered for new submissions.",
            })
        category.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class SubmissionOptionsView(APIView):
    """General3 GEN_03: which ways of submitting are switched on. Anyone can
    read it (the Submit page needs it); only an admin can change it."""

    def get_permissions(self):
        if self.request.method in permissions.SAFE_METHODS:
            return [permissions.AllowAny()]
        return [permissions.IsAuthenticated(), IsAdmin()]

    def _payload(self, conf):
        return {
            "anonymous": True,
            "confidential": conf.allow_confidential,
            "identified": conf.allow_identified,
            "enabled_types": conf.enabled_types(),
        }

    def get(self, request):
        return Response(self._payload(SiteSettings.load()))

    def patch(self, request):
        conf = SiteSettings.load()
        for field in ("allow_confidential", "allow_identified"):
            key = field.replace("allow_", "")
            if key in request.data:
                setattr(conf, field, bool(request.data[key]))
        conf.save()
        return Response(self._payload(conf))


class PriorityKeywordViewSet(viewsets.ModelViewSet):
    """Admin2 ADM_01: the admin's High / Medium keyword lists the AI uses to
    decide each case's priority. Admin-only."""

    queryset = PriorityKeyword.objects.all()
    serializer_class = PriorityKeywordSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdmin]
    pagination_class = None
    http_method_names = ["get", "post", "delete", "head", "options"]

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    @action(detail=False, methods=["post"])
    def rescan(self, request):
        """Re-run the AI over cases that are still open, using the current
        keyword lists (e.g. after adding a keyword)."""
        changed = 0
        open_cases = Submission.objects.exclude(status__in=[Submission.Status.CLOSED, Submission.Status.RESOLVED])
        for sub in open_cases:
            new = services.classify_submission(sub)
            if new != sub.priority:
                sub.priority = new
                sub.save(update_fields=["priority", "updated_at"])
                changed += 1
        return Response({"checked": open_cases.count(), "changed": changed})


class SubmissionViewSet(viewsets.ModelViewSet):
    """
    Citizen/Employee -> Submit -> Categorize -> Review -> Assign -> Respond -> Track -> Close

    Status is mostly automatic (see submissions/services.py). Staff only ever
    choose between 'needs_info' and 'resolved' through set_status/.
    """

    queryset = Submission.objects.select_related("category", "department").all()

    def get_serializer_class(self):
        if self.action == "create":
            return SubmissionCreateSerializer
        if self.action == "list":
            return SubmissionListSerializer
        return SubmissionStaffSerializer

    def get_permissions(self):
        if self.action in {"create", "attachments"}:
            return [permissions.AllowAny()]
        if self.action == "destroy":
            return [permissions.IsAuthenticated(), IsAdmin()]
        return [permissions.IsAuthenticated(), IsStaffMemberOrOwner()]

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        if not user.is_authenticated:
            return qs.none()
        # Admin2 ADM_02: what each role sees also depends on the case's priority.
        qs = visible_submissions(user, qs)

        params = self.request.query_params
        for field in ("status", "category", "department", "priority", "submission_type"):
            value = params.get(field)
            if value:
                qs = qs.filter(**{field: value})
        search = params.get("search")
        if search:
            qs = qs.filter(Q(title__icontains=search) | Q(tracking_code__icontains=search))
        if params.get("range"):
            start, end = _date_range_from_params(params)
            if start:
                qs = qs.filter(created_at__gte=start, created_at__lt=end)
        return qs

    def list(self, request, *args, **kwargs):
        services.auto_close_stale_resolved()
        return super().list(request, *args, **kwargs)

    def retrieve(self, request, *args, **kwargs):
        services.auto_close_stale_resolved()
        instance = self.get_object()
        if request.user.is_authenticated and request.user.is_staff_member():
            services.mark_opened_for_review(instance, request.user)
            instance.refresh_from_db()
        serializer = self.get_serializer(instance)
        return Response(serializer.data)

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        with transaction.atomic():
            submission = serializer.save()
            files = validated_files(request.FILES.getlist("attachments"))
            for i, file_obj in enumerate(files, start=1):
                if submission.submission_type == Submission.SubmissionType.ANONYMOUS:
                    # General3 GEN_04: strip metadata and the original file name.
                    clean, display = anonymise_upload(file_obj, i)
                    Attachment.objects.create(submission=submission, file=clean, original_name=display)
                else:
                    Attachment.objects.create(submission=submission, file=file_obj, original_name=file_obj.name)
        return Response(
            {
                "id": submission.id,
                "tracking_code": submission.tracking_code,
                "message": "Submission received. Save your tracking code to follow its progress.",
            },
            status=status.HTTP_201_CREATED,
        )

    @action(detail=False, methods=["get"], permission_classes=[permissions.IsAuthenticated, IsStaffMember])
    def similar(self, request):
        """Groups open submissions that look like they're about the same
        thing, using text similarity on title+description (General2 ADM_05).
        This is a simple, dependency-free clustering — a real NLP/embedding
        model would improve accuracy further, but this already surfaces
        genuine duplicates/related cases for review."""
        import difflib

        qs = self.get_queryset().exclude(status__in=[Submission.Status.CLOSED, Submission.Status.RESOLVED])
        items = list(qs.values("id", "tracking_code", "title", "description", "category_id", "status"))
        texts = {i["id"]: f"{i['title']} {i['description']}".lower() for i in items}

        visited = set()
        clusters = []
        THRESHOLD = 0.55
        for a in items:
            if a["id"] in visited:
                continue
            group = [a]
            visited.add(a["id"])
            for b in items:
                if b["id"] in visited or b["category_id"] != a["category_id"]:
                    continue
                ratio = difflib.SequenceMatcher(None, texts[a["id"]], texts[b["id"]]).ratio()
                if ratio >= THRESHOLD:
                    group.append(b)
                    visited.add(b["id"])
            if len(group) > 1:
                clusters.append([
                    {"id": g["id"], "tracking_code": g["tracking_code"], "title": g["title"], "status": g["status"]}
                    for g in group
                ])
        return Response({"clusters": clusters})

    @action(detail=True, methods=["post"], permission_classes=[permissions.IsAuthenticated, RequireGroupPermission("can_assign_cases")])
    def assign(self, request, pk=None):
        submission = self.get_object()
        serializer = AssignSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        with transaction.atomic():
            Assignment.objects.create(
                submission=submission,
                department=data.get("department") or submission.department,
                assigned_to=data.get("assigned_to"),
                assigned_by=request.user,
                note=data.get("note", ""),
            )
            if data.get("department"):
                submission.department = data["department"]
                submission.save(update_fields=["department"])
            services.mark_assigned(submission, request.user, note=data.get("note", ""))
        return Response(SubmissionStaffSerializer(submission, context={"request": request}).data)

    @action(detail=True, methods=["post"], permission_classes=[permissions.IsAuthenticated, RequireGroupPermission("can_respond_to_cases")])
    def set_status(self, request, pk=None):
        """Manual status changes — restricted to 'needs_info' and 'resolved'.
        Every other status is set automatically by the system (see services.py)."""
        submission = self.get_object()
        serializer = StatusUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        new_status = serializer.validated_data["status"]
        if new_status not in services.MANUALLY_SETTABLE_STATUSES:
            return Response(
                {"detail": "Only 'needs_info' and 'resolved' can be set manually. Other statuses are automatic."},
                status=400,
            )
        services.transition(submission, new_status, changed_by=request.user, note=serializer.validated_data.get("note", ""))
        return Response(SubmissionStaffSerializer(submission, context={"request": request}).data)

    @action(detail=True, methods=["post"], permission_classes=[permissions.IsAuthenticated, RequireGroupPermission("can_respond_to_cases")])
    def respond(self, request, pk=None):
        submission = self.get_object()
        serializer = RespondSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        with transaction.atomic():
            SubmissionResponse.objects.create(
                submission=submission, responder=request.user,
                message=data["message"], attachment=data.get("attachment"),
                is_request_for_info=data["is_request_for_info"],
                hidden_from_assignee=(request.user.role == "admin"),
            )
            services.mark_responded_or_needs_info(submission, request.user, data["is_request_for_info"])
        return Response(SubmissionStaffSerializer(submission, context={"request": request}).data)

    @action(detail=True, methods=["get", "post"], permission_classes=[permissions.IsAuthenticated])
    def messages(self, request, pk=None):
        """The internal conversation on a case is a group chat for everyone
        working it (General2 GEN_01 / General3 GEN_01): the admin, whoever it
        was assigned to, and the staff of the department it was routed to —
        within what the case's priority allows (Admin2 ADM_02). Still never
        visible to the case owner."""
        submission = self.get_object()
        user = request.user
        if not can_access_case_group(user, submission):
            return Response({"detail": "You don't have access to this conversation."}, status=403)

        ensure_case_group(submission, extra_users=[user])
        ctx = {"request": request}

        if request.method == "GET":
            qs = submission.internal_messages.select_related("sender", "reply_to", "reply_to__sender")
            return Response(InternalMessageSerializer(qs, many=True, context=ctx).data)

        message = (request.data.get("message") or "").strip()
        attachment = request.FILES.get("attachment")
        if attachment:
            validate_upload_file(attachment)
        if not message and not attachment:
            return Response({"detail": "Write a message or attach a file."}, status=400)
        reply_to = None
        raw_reply = request.data.get("reply_to")
        if raw_reply not in (None, ""):
            reply_to = submission.internal_messages.filter(pk=parse_case_id(raw_reply)).first()
        msg = InternalMessage.objects.create(
            submission=submission, sender=user, message=message, attachment=attachment, reply_to=reply_to,
        )
        return Response(InternalMessageSerializer(msg, context=ctx).data, status=201)

    @action(
        detail=True, methods=["post"], permission_classes=[permissions.IsAuthenticated],
        url_path=r"messages/(?P<mid>[^/.]+)/(?P<op>edit|delete|pin)",
    )
    def message_op(self, request, pk=None, mid=None, op=None):
        """General2 GEN_02: edit / delete / pin a message from the case page."""
        submission = self.get_object()
        if not can_access_case_group(request.user, submission):
            return Response({"detail": "You don't have access to this conversation."}, status=403)
        msg = submission.internal_messages.filter(pk=parse_case_id(mid)).first()
        if not msg:
            return Response({"detail": "Message not found."}, status=404)
        apply_message_op(request.user, msg, op, is_case=True, text=request.data.get("text"))
        return Response(InternalMessageSerializer(msg, context={"request": request}).data)

    @action(detail=True, methods=["post"], parser_classes=[], permission_classes=[permissions.AllowAny])
    def attachments(self, request, pk=None):
        submission = self.get_object()
        files = validated_files(request.FILES.getlist("file") or request.FILES.getlist("attachments"))
        if not files:
            return Response({"detail": "No file provided."}, status=400)
        created = [
            Attachment.objects.create(submission=submission, file=f, original_name=f.name)
            for f in files
        ]
        return Response(AttachmentSerializer(created, many=True).data, status=201)


class TrackSubmissionView(APIView):
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "track"
    """Public lookup by tracking code — no login required. This is how an
    anonymous submitter checks on their suggestion/complaint."""

    permission_classes = [permissions.AllowAny]

    def get(self, request, tracking_code):
        services.auto_close_stale_resolved()
        try:
            submission = Submission.objects.get(tracking_code=(tracking_code or "").strip().upper())
        except Submission.DoesNotExist:
            return Response({"detail": "No submission found with that tracking code."}, status=404)
        return Response(TrackingLookupSerializer(submission).data)


class TrackRateView(APIView):
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "track"
    """General3 GEN_07: the case owner ranks their satisfaction with the
    answer (1-10) once the case is resolved, using only the tracking code."""

    permission_classes = [permissions.AllowAny]

    def post(self, request, tracking_code):
        try:
            submission = Submission.objects.get(tracking_code=(tracking_code or "").strip().upper())
        except Submission.DoesNotExist:
            return Response({"detail": "No submission found with that tracking code."}, status=404)
        if submission.status not in {Submission.Status.RESOLVED, Submission.Status.CLOSED}:
            return Response({"detail": "You can rate the answer once the case has been resolved."}, status=400)
        try:
            rating = int(request.data.get("rating"))
        except (TypeError, ValueError):
            return Response({"detail": "Pick a rating from 1 to 10."}, status=400)
        if not 1 <= rating <= 10:
            return Response({"detail": "Pick a rating from 1 to 10."}, status=400)
        submission.satisfaction_rating = rating
        submission.satisfaction_comment = (request.data.get("comment") or "").strip()[:1000]
        submission.satisfaction_rated_at = timezone.now()
        submission.save(update_fields=["satisfaction_rating", "satisfaction_comment", "satisfaction_rated_at"])
        return Response(TrackingLookupSerializer(submission).data)


class TrackReplyView(APIView):
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "track"
    """Lets the case owner reply from the Track page using only their
    tracking code — no account needed. Used when staff has asked for more
    information, or any time the owner wants to add something."""

    permission_classes = [permissions.AllowAny]

    def post(self, request, tracking_code):
        try:
            submission = Submission.objects.get(tracking_code=(tracking_code or "").strip().upper())
        except Submission.DoesNotExist:
            return Response({"detail": "No submission found with that tracking code."}, status=404)

        serializer = OwnerReplySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        with transaction.atomic():
            attachment = data.get("attachment")
            if attachment and submission.submission_type == Submission.SubmissionType.ANONYMOUS:
                attachment, _ = anonymise_upload(attachment, 1)
            SubmissionResponse.objects.create(
                submission=submission, responder=None, is_from_owner=True,
                message=data["message"], attachment=attachment,
            )
            services.mark_owner_replied(submission)
        return Response(TrackingLookupSerializer(submission).data, status=201)


def _date_range_from_params(params):
    """Returns (start, end) datetimes (end exclusive) for the analytics range,
    or (None, None) for all-time."""
    now = timezone.now()
    range_key = params.get("range", "all")

    if range_key == "today":
        start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        return start, start + timedelta(days=1)
    if range_key == "7d":
        return now - timedelta(days=7), now
    if range_key == "month":
        start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        return start, now
    if range_key == "year":
        start = now.replace(month=1, day=1, hour=0, minute=0, second=0, microsecond=0)
        return start, now
    if range_key == "date":
        # An exact chosen day, or a chosen from/to range — "choose a date".
        tz = now.tzinfo
        date_str = params.get("date")
        from_str = params.get("date_from")
        to_str = params.get("date_to")
        try:
            if date_str:
                d = datetime.strptime(date_str, "%Y-%m-%d").replace(tzinfo=tz)
                return d, d + timedelta(days=1)
            if from_str:
                start = datetime.strptime(from_str, "%Y-%m-%d").replace(tzinfo=tz)
                if to_str:
                    end = datetime.strptime(to_str, "%Y-%m-%d").replace(tzinfo=tz) + timedelta(days=1)
                else:
                    end = now
                return start, end
        except ValueError:
            # General2 GEN_09: a malformed date shouldn't crash an export.
            return None, None
        return None, None
    if range_key == "custom":
        year = int(params.get("year", now.year))
        month = params.get("month")
        if month:
            month = int(month)
            start = datetime(year, month, 1, tzinfo=now.tzinfo)
            last_day = calendar.monthrange(year, month)[1]
            end = datetime(year, month, last_day, 23, 59, 59, tzinfo=now.tzinfo)
        else:
            start = datetime(year, 1, 1, tzinfo=now.tzinfo)
            end = datetime(year, 12, 31, 23, 59, 59, tzinfo=now.tzinfo)
        return start, end
    return None, None


def _period_label(params):
    """General2 GEN_09: a readable description of the chosen reporting period,
    printed on the exported report."""
    key = params.get("range", "all")
    if key == "date":
        d, f, t = params.get("date"), params.get("date_from"), params.get("date_to")
        if d:
            return d
        if f and t:
            return f"{f} to {t}"
        if f:
            return f"{f} to today"
    return {
        "today": "Today", "7d": "Last 7 days", "month": "This month", "year": "This year",
    }.get(key, "All time" if key == "all" else None)


class DashboardSummaryView(APIView):
    """KPI/metric-card numbers for the staff dashboard (Admin2 ADM_02 /
    General2 ADM_04). Admins see institution-wide numbers plus
    avg. resolution time, active departments and total users; other staff
    see the same core counts, scoped to the submissions assigned to them."""

    permission_classes = [permissions.IsAuthenticated, IsStaffMember]

    def get(self, request):
        from accounts.models import Department

        services.auto_close_stale_resolved()
        user = request.user
        qs = reports.scoped_queryset(user)

        today_start = timezone.now().replace(hour=0, minute=0, second=0, microsecond=0)
        today_end = today_start + timedelta(days=1)

        unresolved_statuses_excluded = [Submission.Status.CLOSED, Submission.Status.RESOLVED]
        all_unresolved = qs.exclude(status__in=unresolved_statuses_excluded).count()
        all_resolved = qs.filter(status__in=unresolved_statuses_excluded).count()

        today_qs = qs.filter(created_at__gte=today_start, created_at__lt=today_end)
        today_new = today_qs.count()
        today_unresolved = today_qs.exclude(status__in=unresolved_statuses_excluded).count()
        today_solved = qs.filter(
            resolved_at__gte=today_start, resolved_at__lt=today_end
        ).count()

        data = {
            "total_submissions": qs.count(),
            "all_unresolved": all_unresolved,
            "all_resolved": all_resolved,
            "today_new": today_new,
            "today_unresolved": today_unresolved,
            "today_solved": today_solved,
        }

        if user.role == "admin":
            data["avg_resolution_hours"] = services.average_resolution_hours(qs)
            data["departments_active"] = Department.objects.filter(is_active=True).count()
            data["total_users"] = User.objects.count()
            avg_sat = qs.filter(satisfaction_rating__isnull=False).aggregate(avg=Avg("satisfaction_rating"))["avg"]
            data["avg_satisfaction"] = round(avg_sat, 1) if avg_sat is not None else None

        return Response(data)


class AnalyticsSummaryView(APIView):
    permission_classes = [permissions.IsAuthenticated, RequireGroupPermission("can_view_analytics")]

    def get(self, request):
        services.auto_close_stale_resolved()
        user = request.user
        qs = visible_submissions(user, Submission.objects.all())

        start, end = _date_range_from_params(request.query_params)
        if start:
            qs = qs.filter(created_at__gte=start, created_at__lt=end)

        by_category = list(qs.values("category__name").annotate(count=Count("id")).order_by("-count"))
        by_department = list(
            qs.filter(department__isnull=False)
            .values("department__name").annotate(count=Count("id")).order_by("-count")
        )
        by_status = list(qs.values("status").annotate(count=Count("id")).order_by("-count"))
        by_day = list(
            qs.extra(select={"day": "date(created_at)"}).values("day").annotate(count=Count("id")).order_by("day")
        )

        avg_hours = services.average_resolution_hours(qs)

        unresolved = qs.exclude(status__in=[Submission.Status.CLOSED, Submission.Status.RESOLVED]).count()

        # General3 GEN_07: survey results — how satisfied case owners were.
        rated = qs.filter(satisfaction_rating__isnull=False)
        rating_counts = {r["satisfaction_rating"]: r["count"] for r in rated.values("satisfaction_rating").annotate(count=Count("id"))}
        avg_rating = rated.aggregate(avg=Avg("satisfaction_rating"))["avg"]
        satisfaction = {
            "average": round(avg_rating, 1) if avg_rating is not None else None,
            "count": rated.count(),
            "distribution": [{"rating": n, "count": rating_counts.get(n, 0)} for n in range(1, 11)],
        }

        return Response({
            "satisfaction": satisfaction,
            "total_submissions": qs.count(),
            "unresolved": unresolved,
            "average_response_time_hours": avg_hours,
            "by_category": by_category,
            "by_department": by_department,
            "by_status": by_status,
            "by_day": by_day,
        })


class CasesReportView(APIView):
    """Export of the cases list, scoped to the requester's role
    (ADM_07 / GEN_05) — supports the same range params as analytics, plus
    the same status/category/department filters as the submissions list,
    and a choice of CSV, Excel, or Word (Admin2 ADM_03)."""

    permission_classes = [permissions.IsAuthenticated, RequireGroupPermission("can_export_reports")]

    def get(self, request):
        qs = reports.scoped_queryset(request.user)
        start, end = _date_range_from_params(request.query_params)
        if start:
            qs = qs.filter(created_at__gte=start, created_at__lt=end)
        for field in ("status", "category", "department", "priority"):
            value = request.query_params.get(field)
            if value:
                qs = qs.filter(**{field: value})
        fmt = request.query_params.get("filetype", "pdf")
        if fmt not in reports.ALLOWED_EXPORT_FORMATS:
            return Response({"detail": "Only 'pdf' and 'xlsx' exports are supported."}, status=400)
        return reports.cases_report(qs.order_by("-created_at"), fmt, period=_period_label(request.query_params))


class SingleCaseReportView(APIView):
    permission_classes = [permissions.IsAuthenticated, RequireGroupPermission("can_export_reports")]

    def get(self, request, pk):
        qs = reports.scoped_queryset(request.user)
        submission = qs.filter(pk=pk).first()
        if not submission:
            return Response({"detail": "Not found or not accessible to you."}, status=404)
        fmt = request.query_params.get("filetype", "pdf")
        if fmt not in reports.ALLOWED_EXPORT_FORMATS:
            return Response({"detail": "Only 'pdf' and 'xlsx' exports are supported."}, status=400)
        return reports.single_case_report(submission, fmt)


class AnalyticsReportView(APIView):
    permission_classes = [permissions.IsAuthenticated, RequireGroupPermission("can_export_reports")]

    def get(self, request):
        user = request.user
        qs = visible_submissions(user, Submission.objects.all())
        start, end = _date_range_from_params(request.query_params)
        if start:
            qs = qs.filter(created_at__gte=start, created_at__lt=end)
        data = {
            "total_submissions": qs.count(),
            "unresolved": qs.exclude(status__in=[Submission.Status.CLOSED, Submission.Status.RESOLVED]).count(),
            "average_response_time_hours": services.average_resolution_hours(qs),
            "by_category": list(qs.values("category__name").annotate(count=Count("id")).order_by("-count")),
            "by_department": list(qs.filter(department__isnull=False).values("department__name").annotate(count=Count("id")).order_by("-count")),
            "by_status": list(qs.values("status").annotate(count=Count("id")).order_by("-count")),
        }
        # General2 ADM_03: exports are limited to PDF and Excel only.
        fmt = request.query_params.get("filetype", "pdf")
        if fmt not in reports.ALLOWED_EXPORT_FORMATS:
            return Response({"detail": "Only 'pdf' and 'xlsx' exports are supported."}, status=400)
        if fmt == "xlsx":
            return reports.analytics_xlsx(data)
        from . import pdf_reports
        return pdf_reports.analytics_pdf(data, period=_period_label(request.query_params))
