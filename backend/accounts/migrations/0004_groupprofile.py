import django.db.models.deletion
from django.db import migrations, models

SYSTEM = {"Officer": "officer", "Department Head": "dept_head", "Administrator": "admin"}


def backfill(apps, schema_editor):
    Group = apps.get_model("auth", "Group")
    GroupProfile = apps.get_model("accounts", "GroupProfile")
    for name, role in SYSTEM.items():
        group, _ = Group.objects.get_or_create(name=name)
        GroupProfile.objects.get_or_create(group=group, defaults={"base_role": role})


class Migration(migrations.Migration):

    dependencies = [
        # Only the Group model itself is needed here (created in auth's
        # first migration) — pinning to a later auth migration number is
        # unnecessary and can break across Django versions.
        ("auth", "0001_initial"),
        ("accounts", "0003_backfill_role_groups"),
    ]

    operations = [
        migrations.CreateModel(
            name="GroupProfile",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("base_role", models.CharField(
                    choices=[("officer", "Officer level"), ("dept_head", "Department head level"), ("admin", "Administrator level")],
                    default="officer", max_length=20)),
                ("description", models.CharField(blank=True, max_length=255)),
                ("group", models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name="profile", to="auth.group")),
            ],
        ),
        migrations.RunPython(backfill, migrations.RunPython.noop),
    ]
