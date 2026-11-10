import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("submissions", "0008_priority_permissions"),
    ]

    operations = [
        migrations.CreateModel(
            name="SavedTrackingCode",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("tracking_code", models.CharField(max_length=20)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("user", models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE, related_name="saved_tracking_codes",
                    to=settings.AUTH_USER_MODEL)),
            ],
        ),
        migrations.AddConstraint(
            model_name="savedtrackingcode",
            constraint=models.UniqueConstraint(fields=("user", "tracking_code"), name="unique_saved_code_per_user"),
        ),
    ]
