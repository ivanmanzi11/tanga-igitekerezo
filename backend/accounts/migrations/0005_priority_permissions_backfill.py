from django.db import migrations

NEW = {
    "can_access_high_priority_cases": "Can see and work on High priority cases",
    "can_access_medium_priority_cases": "Can see and work on Medium priority cases",
    "can_access_low_priority_cases": "Can see and work on Low priority (unmarked) cases",
}


def backfill(apps, schema_editor):
    """Admin2 ADM_01: existing groups keep working exactly as before —
    everyone keeps Low, department-head level groups get Medium, and
    Administrator-level groups get all three. High stays admin-only until an
    admin grants it to a group."""
    Group = apps.get_model("auth", "Group")
    Permission = apps.get_model("auth", "Permission")
    ContentType = apps.get_model("contenttypes", "ContentType")
    GroupProfile = apps.get_model("accounts", "GroupProfile")

    ct, _ = ContentType.objects.get_or_create(app_label="submissions", model="submission")
    perms = {}
    for codename, name in NEW.items():
        perms[codename], _ = Permission.objects.get_or_create(
            content_type=ct, codename=codename, defaults={"name": name}
        )
    for group in Group.objects.all():
        profile = GroupProfile.objects.filter(group=group).first()
        base = profile.base_role if profile else "officer"
        group.permissions.add(perms["can_access_low_priority_cases"])
        if base in ("dept_head", "admin"):
            group.permissions.add(perms["can_access_medium_priority_cases"])
        if base == "admin":
            group.permissions.add(perms["can_access_high_priority_cases"])


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0004_groupprofile"),
        ("auth", "0001_initial"),
        ("contenttypes", "0002_remove_content_type_name"),
        ("submissions", "0008_priority_permissions"),
    ]

    operations = [
        migrations.RunPython(backfill, migrations.RunPython.noop),
    ]
