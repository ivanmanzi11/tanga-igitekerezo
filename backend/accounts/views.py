from django.contrib.auth import get_user_model
from django.db.models import Q
from rest_framework import generics, viewsets, permissions
from rest_framework.decorators import action
from rest_framework.exceptions import AuthenticationFailed
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from common.permissions import IsAdmin, RequireGroupPermission, has_group_permission, user_permission_codenames
from .models import Department, LAST_ADMIN_MESSAGE, is_last_admin
from .serializers import (
    DepartmentSerializer, UserSerializer, RegisterSerializer, StaffCreateSerializer,
    ProfileUpdateSerializer, ChangePasswordSerializer, UserAdminSerializer, StaffSignupSerializer,
    GroupSerializer,
)
from django.contrib.auth.models import Group, Permission

User = get_user_model()


class _IsAdminOrCanAssign(permissions.BasePermission):
    def has_permission(self, request, view):
        u = request.user
        return bool(u and u.is_authenticated and (u.role == "admin" or has_group_permission(u, "can_assign_cases")))


class TangaTokenObtainPairSerializer(TokenObtainPairSerializer):
    """Adds role/department info into the JWT + login response so the
    frontend can route the person straight to the right dashboard."""

    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token["role"] = user.role
        token["department_id"] = user.department_id
        token["full_name"] = user.get_full_name() or user.username
        return token

    def validate(self, attrs):
        data = super().validate(attrs)
        # General3 GEN_04: the sign-in page is split into a Staff tab and a
        # Case owner tab. Enforce it here too, not just in the UI, so a
        # staff account can't sign in through the case-owner form (and vice versa).
        portal = (self.initial_data.get("portal") or "").strip()
        is_citizen = self.user.role == "citizen"
        if portal == "staff" and is_citizen:
            raise AuthenticationFailed("This is a case owner account — use the “Case owner” tab to sign in.")
        if portal == "citizen" and not is_citizen:
            raise AuthenticationFailed("This is a staff account — use the “Staff” tab to sign in.")
        data["user"] = UserSerializer(self.user).data
        return data


class TangaTokenObtainPairView(TokenObtainPairView):
    serializer_class = TangaTokenObtainPairSerializer


class RegisterView(generics.CreateAPIView):
    """Public sign-up — for citizens/employees who want an account so they can
    track all their own submissions in one place. Anonymous submission never
    requires this."""

    queryset = User.objects.all()
    serializer_class = RegisterSerializer
    permission_classes = [permissions.AllowAny]


class StaffSignupView(generics.CreateAPIView):
    """Public sign-up for staff (officer/dept head). The account is created
    disabled until an admin approves it from the Users screen."""

    queryset = User.objects.all()
    serializer_class = StaffSignupSerializer
    permission_classes = [permissions.AllowAny]

    def create(self, request, *args, **kwargs):
        response = super().create(request, *args, **kwargs)
        response.data = {
            "detail": "Account created. An administrator must approve it before you can sign in.",
        }
        return response


class MeView(APIView):
    """The signed-in user's own profile: view and edit (name, email, phone,
    profile image). Role/department are not editable here."""

    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get(self, request):
        return Response(UserSerializer(request.user).data)

    def patch(self, request):
        serializer = ProfileUpdateSerializer(request.user, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(UserSerializer(request.user).data)


class ChangePasswordView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = ChangePasswordSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        request.user.set_password(serializer.validated_data["new_password"])
        request.user.save()
        return Response({"detail": "Password changed successfully."})


class DepartmentViewSet(viewsets.ModelViewSet):
    """Admin3 ADM_01: admins create, update and delete departments and can read
    everyone allocated to each. A department that still has staff can't be
    deleted (move them first); one with past submissions is archived so those
    cases keep their department in history."""

    queryset = Department.objects.filter(is_active=True)
    serializer_class = DepartmentSerializer
    pagination_class = None  # lookup list used by dropdowns

    def get_permissions(self):
        if self.request.method in permissions.SAFE_METHODS and self.action != "members":
            return [permissions.AllowAny()]
        return [permissions.IsAuthenticated(), RequireGroupPermission("can_manage_categories_departments")()]

    def get_queryset(self):
        from django.db.models import Count
        return (
            Department.objects.filter(is_active=True)
            .annotate(member_count=Count("staff", distinct=True), case_count=Count("submissions", distinct=True))
            .order_by("name")
        )

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        name = serializer.validated_data["name"]
        archived = Department.objects.filter(name__iexact=name, is_active=False).first()
        if archived:  # bring an archived department back instead of clashing with its name
            for field, value in serializer.validated_data.items():
                setattr(archived, field, value)
            archived.is_active = True
            archived.save()
            return Response(self.get_serializer(archived).data, status=201)
        return super().create(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        dept = self.get_object()
        members = User.objects.filter(department=dept).count()
        if members:
            return Response({
                "detail": f"This department still has {members} staff member(s). Move them to another department first, then delete it.",
            }, status=400)
        if dept.submissions.exists():
            dept.is_active = False
            dept.save(update_fields=["is_active"])
            return Response({
                "archived": True,
                "detail": "This department already has cases, so it was archived: those cases keep it in their history, but it is no longer offered.",
            })
        dept.delete()
        return Response(status=204)

    @action(detail=True, methods=["get"])
    def members(self, request, pk=None):
        """Everyone allocated to this department."""
        dept = self.get_object()
        people = User.objects.filter(department=dept).order_by("role", "first_name", "username")
        return Response([
            {
                "id": str(u.id), "name": u.get_full_name() or u.username, "username": u.username,
                "email": u.email, "role": u.role, "is_active": u.is_active,
            }
            for u in people
        ])


class StaffUserViewSet(viewsets.ModelViewSet):
    """Admin-only management of staff accounts (officers, department heads, admins).

    Used for two things:
      - the "assign to staff member" dropdown, optionally filtered by
        ?department=<id> so it only lists staff in the chosen department;
      - the "Users" admin screen, which lists everyone (?all=true) and lets
        an admin open a user to edit their role/department/active status.
    """

    def get_permissions(self):
        # Full account management (create/edit/deactivate/delete) stays
        # admin-only. But a staff member who has been granted can_assign_cases
        # (Admin2 ADM_01) needs to be able to see the staff directory too, or
        # they'd have permission to assign cases with no way to pick who to
        # assign them to — so read access is allowed for that permission as well.
        if self.request.method in permissions.SAFE_METHODS:
            return [permissions.IsAuthenticated(), _IsAdminOrCanAssign()]
        return [IsAdmin()]

    def get_queryset(self):
        # Only admins get the full account-management listing (?all=true,
        # including citizens); everyone else always gets the staff directory
        # (officers/dept heads/admins only) regardless of that flag.
        if self.request.query_params.get("all") == "true" and self.request.user.role == "admin":
            qs = User.objects.all()
        else:
            qs = User.objects.exclude(role=User.Role.CITIZEN)
        department = self.request.query_params.get("department")
        if department:
            qs = qs.filter(department_id=department)
        role = self.request.query_params.get("role")
        if role:
            qs = qs.filter(role=role)
        group = self.request.query_params.get("group")
        if group:
            qs = qs.filter(groups__id=group)
        active = self.request.query_params.get("is_active")
        if active in {"true", "false"}:
            qs = qs.filter(is_active=(active == "true"))
        search = self.request.query_params.get("search")
        if search:
            qs = qs.filter(
                Q(username__icontains=search) | Q(first_name__icontains=search)
                | Q(last_name__icontains=search) | Q(email__icontains=search)
            )
        return qs.order_by("username")

    def get_serializer_class(self):
        if self.request.method == "POST":
            return StaffCreateSerializer
        return UserAdminSerializer

    @action(detail=True, methods=["post"])
    def set_active(self, request, pk=None):
        user = self.get_object()
        new_active = bool(request.data.get("is_active", True))
        # Admin2 ADM_02: the last active admin can't be disabled.
        if not new_active and is_last_admin(user):
            return Response({"detail": LAST_ADMIN_MESSAGE}, status=400)
        user.is_active = new_active
        user.save(update_fields=["is_active"])
        return Response(UserAdminSerializer(user).data)

    def destroy(self, request, *args, **kwargs):
        # Admin2 ADM_02: the last active admin can't be deleted either.
        if is_last_admin(self.get_object()):
            return Response({"detail": LAST_ADMIN_MESSAGE}, status=400)
        return super().destroy(request, *args, **kwargs)

    @action(detail=True, methods=["get"])
    def casework(self, request, pk=None):
        """A 'check-up' on one staff member (Admin2 ADM_07): the cases
        they've handled and their stats, optionally within a date range."""
        from submissions.models import Submission
        from submissions.views import _date_range_from_params
        from django.db.models import Q, Count

        target = self.get_object()
        qs = Submission.objects.filter(
            Q(assignments__assigned_to=target) | Q(responses__responder=target)
        ).distinct()
        start, end = _date_range_from_params(request.query_params)
        if start:
            qs = qs.filter(created_at__gte=start, created_at__lt=end)

        by_status = list(qs.values("status").annotate(count=Count("id")).order_by("-count"))
        return Response({
            "total_cases": qs.count(),
            "by_status": by_status,
            "cases": [
                {
                    "id": s.id, "tracking_code": s.tracking_code, "title": s.title,
                    "status": s.status, "created_at": s.created_at,
                }
                for s in qs.order_by("-created_at")[:50]
            ],
        })


class GroupViewSet(viewsets.ModelViewSet):
    """Admin3 ADM_01: permission groups ARE the roles.

    Admin2 ADM_01 / ADM_02: there is no "built in" kind of group any more.
    Every group — including the Officer / Department Head / Administrator
    starters — can be renamed, have its permissions tuned, and be deleted
    (as long as nobody currently holds it as their role). An admin can create
    any number of groups, pick what each is allowed to do and which access
    level (officer or department head) its members get for data scoping, then
    give them to users as a role — the user lands in that group immediately
    and it shows up everywhere a role is chosen.

    Permissions are enforced through common.permissions.RequireGroupPermission.
    Admins keep full access regardless, as a safety net."""

    queryset = Group.objects.all().order_by("id")
    serializer_class = GroupSerializer
    pagination_class = None

    def get_permissions(self):
        # Reading the list feeds the "Role" dropdowns, so the admin screens
        # only need admin; managing groups needs admin too.
        return [IsAdmin()]

    def destroy(self, request, *args, **kwargs):
        group = self.get_object()
        if group.user_set.exists():
            return Response(
                {"detail": "Move everyone out of this group (change their role) before deleting it."}, status=400
            )
        return super().destroy(request, *args, **kwargs)


class PermissionListView(APIView):
    """The curated set of permissions a group can be given."""

    permission_classes = [IsAdmin]

    def get(self, request):
        perms = Permission.objects.filter(content_type__app_label="submissions")
        return Response([{"codename": p.codename, "name": p.name} for p in perms])
