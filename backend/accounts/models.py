import uuid

from django.contrib.auth.models import AbstractUser, Group
from django.db import models
from django.db.models.signals import post_save
from django.dispatch import receiver


class Department(models.Model):
    """A responsible unit/service that submissions can be routed to."""

    name = models.CharField(max_length=150, unique=True)
    name_rw = models.CharField("Name (Kinyarwanda)", max_length=150, blank=True)
    name_fr = models.CharField("Name (French)", max_length=150, blank=True)
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name


class User(AbstractUser):
    """Custom user supporting citizens, officers, department heads and admins."""

    class Role(models.TextChoices):
        CITIZEN = "citizen", "Citizen / Employee"
        OFFICER = "officer", "Officer"
        DEPT_HEAD = "dept_head", "Department Head"
        ADMIN = "admin", "Administrator"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    role = models.CharField(max_length=20, choices=Role.choices, default=Role.CITIZEN)
    department = models.ForeignKey(
        Department,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="staff",
        help_text="Required for officers and department heads.",
    )
    phone_number = models.CharField(max_length=20, blank=True)
    profile_image = models.ImageField(upload_to="profile_images/", null=True, blank=True)

    def is_staff_member(self):
        return self.role in {self.Role.OFFICER, self.Role.DEPT_HEAD, self.Role.ADMIN}

    def __str__(self):
        return f"{self.username} ({self.get_role_display()})"


# Admin3 ADM_01: roles are permission groups. Officer, Department Head and
# Administrator are the starter groups every install begins with (Admin2
# ADM_01/ADM_02: they are ordinary groups now — no "built in" marking, and
# they can be renamed or deleted like any other); an admin (or anyone with
# the right) can create as many extra groups as they like, choose what each
# may do, and hand them out as roles. Every group carries a GroupProfile
# saying which built-in access level ("base role") its members get for
# things like data scoping (an officer sees their own cases, a department
# head sees their department's) — while the group's permissions decide
# what actions they can take.
ROLE_GROUP_NAMES = {
    User.Role.OFFICER: "Officer",
    User.Role.DEPT_HEAD: "Department Head",
    User.Role.ADMIN: "Administrator",
}
SYSTEM_GROUP_ROLES = {name: role for role, name in ROLE_GROUP_NAMES.items()}


class GroupProfile(models.Model):
    group = models.OneToOneField(Group, on_delete=models.CASCADE, related_name="profile")
    base_role = models.CharField(
        max_length=20,
        choices=[(User.Role.OFFICER, "Officer level"), (User.Role.DEPT_HEAD, "Department head level"),
                 (User.Role.ADMIN, "Administrator level")],
        default=User.Role.OFFICER,
    )
    description = models.CharField(max_length=255, blank=True)

    def __str__(self):
        return f"{self.group.name} ({self.base_role})"


def ensure_group_profile(group):
    profile = getattr(group, "profile", None) if GroupProfile.objects.filter(group=group).exists() else None
    if profile is None:
        base = SYSTEM_GROUP_ROLES.get(group.name, User.Role.OFFICER)
        profile = GroupProfile.objects.create(group=group, base_role=base)
    return profile


def get_role_group(role):
    """The built-in group for a base role, created (with profile and, for
    admins, every submissions.* permission) on first use."""
    from django.contrib.auth.models import Permission
    name = ROLE_GROUP_NAMES[role]
    group, created = Group.objects.get_or_create(name=name)
    ensure_group_profile(group)
    if created and role == User.Role.ADMIN:
        group.permissions.set(Permission.objects.filter(content_type__app_label="submissions"))
    elif created:
        # Admin2 ADM_01: starter priority access — Department Head works on
        # Medium + Low cases, Officer on Low; High stays with admins until an
        # admin ticks it for a group.
        wanted = ["can_access_low_priority_cases"]
        if role == User.Role.DEPT_HEAD:
            wanted.append("can_access_medium_priority_cases")
        group.permissions.add(*Permission.objects.filter(content_type__app_label="submissions", codename__in=wanted))
    return group


@receiver(post_save, sender=User)
def sync_role_group(sender, instance, **kwargs):
    # Admin2 ADM_01/ADM_02: when an admin picks a specific group for someone
    # the serializer places them in it right after saving — don't first
    # (re)create a default group just to move them out of it again.
    if getattr(instance, "_skip_group_sync", False):
        return
    if instance.role not in ROLE_GROUP_NAMES:
        # Citizens aren't staff and don't carry any permission group.
        instance.groups.clear()
        return
    current = list(instance.groups.all())
    if len(current) == 1:
        profile = GroupProfile.objects.filter(group=current[0]).first()
        if profile and profile.base_role == instance.role:
            return  # already in a (possibly custom) group for this access level
    instance.groups.set([get_role_group(instance.role)])


# Admin2 ADM_02: the system must always keep at least one active admin.
LAST_ADMIN_MESSAGE = (
    "You are the only administrator left. Make someone else an administrator first — "
    "the system must always have at least one active admin."
)


def is_last_admin(user):
    """True when `user` is an active admin and no other active admin exists."""
    if user.role != User.Role.ADMIN or not user.is_active:
        return False
    return not User.objects.filter(role=User.Role.ADMIN, is_active=True).exclude(pk=user.pk).exists()
