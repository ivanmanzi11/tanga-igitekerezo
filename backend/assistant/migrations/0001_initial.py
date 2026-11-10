import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models

import assistant.models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="FAQEntry",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("question", models.CharField(max_length=500)),
                ("answer", models.TextField()),
                ("is_active", models.BooleanField(default=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
            ],
            options={"verbose_name": "FAQ entry", "verbose_name_plural": "FAQ entries", "ordering": ["-created_at"]},
        ),
        migrations.CreateModel(
            name="AssistantQuestion",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("code", models.CharField(default=assistant.models._new_code, editable=False, max_length=12, unique=True)),
                ("question", models.TextField()),
                ("status", models.CharField(
                    choices=[("pending", "Waiting for a staff answer"), ("answered", "Answered")],
                    default="pending", max_length=10)),
                ("answer", models.TextField(blank=True)),
                ("answered_at", models.DateTimeField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("answered_by", models.ForeignKey(
                    blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL,
                    related_name="+", to=settings.AUTH_USER_MODEL)),
            ],
            options={"ordering": ["-created_at"]},
        ),
    ]
