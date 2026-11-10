from django.db import migrations

ROLE_GROUP_NAMES = {
    "officer": "Officer",
    "dept_head": "Department Head",
    "admin": "Administrator",
}


def forwards(apps, schema_editor):
    """Admin3 ADM_01 — 'roles = permission groups': backfill every existing
    user into the group matching their current role, and give a freshly
    created Administrator group every submissions.* permission by default."""
    User = apps.get_model("accounts", "User")
    Group = apps.get_model("auth", "Group")
    Permission = apps.get_model("auth", "Permission")

    groups_by_role = {}
    for role, group_name in ROLE_GROUP_NAMES.items():
        group, created = Group.objects.get_or_create(name=group_name)
        if created and role == "admin":
            group.permissions.set(Permission.objects.filter(content_type__app_label="submissions"))
        groups_by_role[role] = group

    for user in User.objects.all():
        group = groups_by_role.get(user.role)
        if group:
            user.groups.set([group])
        else:
            user.groups.clear()


def backwards(apps, schema_editor):
    # Nothing to undo — the groups themselves are harmless to leave in place.
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0002_user_profile_image"),
    ]

    operations = [
        migrations.RunPython(forwards, backwards),
    ]
