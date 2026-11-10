from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.contrib.auth.models import Group, Permission
from rest_framework import serializers

from common.permissions import user_permission_codenames
from .models import Department, GroupProfile, ensure_group_profile, ROLE_GROUP_NAMES, LAST_ADMIN_MESSAGE, is_last_admin

User = get_user_model()


class DepartmentSerializer(serializers.ModelSerializer):
    member_count = serializers.SerializerMethodField()
    case_count = serializers.SerializerMethodField()

    class Meta:
        model = Department
        fields = ["id", "name", "name_rw", "name_fr", "description", "is_active", "member_count", "case_count"]
        read_only_fields = ["is_active", "member_count", "case_count"]
        extra_kwargs = {"name": {"validators": []}}

    def get_member_count(self, obj):
        return getattr(obj, "member_count", None) if hasattr(obj, "member_count") else obj.staff.count()

    def get_case_count(self, obj):
        return getattr(obj, "case_count", None) if hasattr(obj, "case_count") else obj.submissions.count()

    def validate_name(self, value):
        value = " ".join((value or "").split())
        if not value:
            raise serializers.ValidationError("Give the department a name.")
        qs = Department.objects.filter(name__iexact=value, is_active=True)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError("A department with this name already exists.")
        return value


class UserSerializer(serializers.ModelSerializer):
    department_name = serializers.CharField(source="department.name", read_only=True)
    # Admin2 ADM_01: the codenames this user currently has via their group
    # (or all of them, for admins) — the frontend uses this to hide sections
    # and actions the user hasn't been allocated.
    permissions = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id", "username", "email", "first_name", "last_name",
            "role", "department", "department_name", "phone_number",
            "profile_image", "is_active", "date_joined", "permissions",
        ]
        read_only_fields = ["id", "date_joined"]

    def get_permissions(self, obj):
        return user_permission_codenames(obj)


class ProfileUpdateSerializer(serializers.ModelSerializer):
    """What a signed-in user can edit about themselves. Role/department are
    intentionally excluded — only an admin changes those, via UserAdminSerializer."""

    class Meta:
        model = User
        fields = ["first_name", "last_name", "email", "phone_number", "profile_image"]


class ChangePasswordSerializer(serializers.Serializer):
    current_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(write_only=True, validators=[validate_password])

    def validate_current_password(self, value):
        user = self.context["request"].user
        if not user.check_password(value):
            raise serializers.ValidationError("Current password is incorrect.")
        return value


class UserAdminSerializer(serializers.ModelSerializer):
    """Admin-only editing of another user's role/department/active status.

    Admin3 ADM_01: a user's "role" is one of the permission groups (built-in
    or created by an admin). Send `role_group` (a group id) to give someone
    that role — they're immediately put in that group, and get its access
    level and permissions. `role` (the base access level) follows from it."""

    department_name = serializers.CharField(source="department.name", read_only=True)
    group_names = serializers.SerializerMethodField()
    role_group = serializers.PrimaryKeyRelatedField(queryset=Group.objects.all(), write_only=True, required=False)
    current_group = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id", "username", "email", "first_name", "last_name",
            "role", "department", "department_name", "phone_number",
            "profile_image", "is_active", "date_joined", "group_names",
            "role_group", "current_group",
        ]
        read_only_fields = ["id", "username", "date_joined"]
        extra_kwargs = {"role": {"required": False}}

    def get_group_names(self, obj):
        return [g.name for g in obj.groups.all()]

    def get_current_group(self, obj):
        g = obj.groups.first()
        return g.id if g else None

    def validate(self, attrs):
        group = attrs.get("role_group")
        if group is not None:
            attrs["role"] = ensure_group_profile(group).base_role
        # Admin2 ADM_02: the last active admin keeps their role and stays
        # active until another admin can take over.
        if self.instance is not None and is_last_admin(self.instance):
            if attrs.get("role", self.instance.role) != User.Role.ADMIN or attrs.get("is_active") is False:
                raise serializers.ValidationError({"detail": LAST_ADMIN_MESSAGE})
        return attrs

    def update(self, instance, validated_data):
        group = validated_data.pop("role_group", None)
        if group is not None:
            instance._skip_group_sync = True  # placed in `group` just below
        instance = super().update(instance, validated_data)
        if group is not None:
            instance.groups.set([group])
        return instance


class GroupSerializer(serializers.ModelSerializer):
    """Admin3 ADM_01: permission groups are the roles. Admin2 ADM_01 /
    ADM_02: every group is treated the same — none is marked "built in" and
    any of them can be renamed or deleted. Admins can create any number of
    groups, pick their permissions and access level, and then hand them out
    as roles."""

    permissions = serializers.SlugRelatedField(
        many=True, slug_field="codename", required=False,
        queryset=Permission.objects.filter(content_type__app_label="submissions"),
    )
    base_role = serializers.ChoiceField(
        choices=[("officer", "Officer level"), ("dept_head", "Department head level")],
        required=False, write_only=True,
    )
    access_level = serializers.SerializerMethodField()
    member_count = serializers.SerializerMethodField()

    class Meta:
        model = Group
        fields = ["id", "name", "permissions", "base_role", "access_level", "member_count"]

    def get_access_level(self, obj):
        return ensure_group_profile(obj).base_role

    def get_member_count(self, obj):
        return obj.user_set.count()

    def validate_name(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("Give the group a name.")
        clash = Group.objects.filter(name__iexact=value)
        if self.instance:
            clash = clash.exclude(pk=self.instance.pk)
        if clash.exists():
            raise serializers.ValidationError("A group with this name already exists.")
        return value

    def create(self, validated_data):
        perms = validated_data.pop("permissions", [])
        base_role = validated_data.pop("base_role", "officer")
        group = Group.objects.create(**validated_data)
        GroupProfile.objects.create(group=group, base_role=base_role)
        group.permissions.set(perms)
        return group

    def update(self, instance, validated_data):
        perms = validated_data.pop("permissions", None)
        base_role = validated_data.pop("base_role", None)
        name = validated_data.pop("name", None)
        if name and name != instance.name:
            instance.name = name
            instance.save()
        if base_role:
            profile = ensure_group_profile(instance)
            # An Administrator-level group keeps its level (admins always
            # have full access; this serializer only offers officer/dept head).
            if profile.base_role != User.Role.ADMIN and profile.base_role != base_role:
                profile.base_role = base_role
                profile.save()
                # Keep members' access level in step with their group.
                instance.user_set.update(role=base_role)
        if perms is not None:
            instance.permissions.set(perms)
        return instance


class RegisterSerializer(serializers.ModelSerializer):
    """Public self-registration — always creates a citizen/employee account.
    Staff accounts (officer/dept_head/admin) are created by an administrator only,
    via the admin-only UserCreateSerializer below."""

    password = serializers.CharField(write_only=True, validators=[validate_password])

    class Meta:
        model = User
        fields = ["id", "username", "email", "first_name", "last_name", "phone_number", "password"]
        read_only_fields = ["id"]

    def create(self, validated_data):
        password = validated_data.pop("password")
        user = User(role=User.Role.CITIZEN, **validated_data)
        user.set_password(password)
        user.save()
        return user


class StaffCreateSerializer(serializers.ModelSerializer):
    """Used by admins to create officer / department_head / admin accounts.

    Admin3 ADM_01 — "roles = permission groups": there's no `groups` field
    to fill in anymore. Whichever `role` is picked here is what puts the new
    user straight into that role's permission group, automatically, via the
    sync_role_group signal on the User model."""

    password = serializers.CharField(write_only=True, validators=[validate_password])
    role_group = serializers.PrimaryKeyRelatedField(queryset=Group.objects.all(), write_only=True, required=False)

    class Meta:
        model = User
        fields = [
            "id", "username", "email", "first_name", "last_name",
            "phone_number", "password", "role", "role_group", "department",
        ]
        read_only_fields = ["id"]
        extra_kwargs = {"role": {"required": False}}

    def validate(self, attrs):
        group = attrs.get("role_group")
        if group is not None:
            attrs["role"] = ensure_group_profile(group).base_role
        if not attrs.get("role"):
            raise serializers.ValidationError({"role": "Pick a role."})
        role = attrs.get("role")
        if role in {User.Role.OFFICER, User.Role.DEPT_HEAD} and not attrs.get("department"):
            raise serializers.ValidationError({"department": "Required for officers and department heads."})
        return attrs

    def create(self, validated_data):
        password = validated_data.pop("password")
        group = validated_data.pop("role_group", None)
        user = User(**validated_data)
        user.set_password(password)
        if group is not None:
            user._skip_group_sync = True  # placed in `group` just below
        user.save()
        if group is not None:
            user.groups.set([group])
        return user


class StaffSignupSerializer(serializers.ModelSerializer):
    """Public self-registration for staff (officer/dept_head). The account
    is created inactive — an admin must approve it in the Users screen
    before the person can sign in (Admin2 ADM_10 / General2 ADM_04)."""

    password = serializers.CharField(write_only=True, validators=[validate_password])
    role = serializers.ChoiceField(choices=[User.Role.OFFICER, User.Role.DEPT_HEAD])

    class Meta:
        model = User
        fields = [
            "id", "username", "email", "first_name", "last_name",
            "phone_number", "password", "role", "department",
        ]
        read_only_fields = ["id"]

    def validate(self, attrs):
        if not attrs.get("department"):
            raise serializers.ValidationError({"department": "Select the department you work in."})
        return attrs

    def create(self, validated_data):
        password = validated_data.pop("password")
        user = User(is_active=False, **validated_data)
        user.set_password(password)
        user.save()
        return user
