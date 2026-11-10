import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("submissions", "0005_submission_satisfaction"),
    ]

    operations = [
        migrations.CreateModel(
            name="PriorityKeyword",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("level", models.CharField(choices=[("high", "High"), ("medium", "Medium")], max_length=10)),
                ("word", models.CharField(max_length=100)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("created_by", models.ForeignKey(
                    blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL,
                    related_name="+", to=settings.AUTH_USER_MODEL)),
            ],
            options={"ordering": ["level", "word"]},
        ),
        migrations.AddConstraint(
            model_name="prioritykeyword",
            constraint=models.UniqueConstraint(fields=("word",), name="unique_priority_keyword_word"),
        ),
        migrations.AlterModelOptions(
            name="submission",
            options={
                "ordering": ["-created_at"],
                "permissions": [
                    ("can_assign_cases", "Can assign cases to staff"),
                    ("can_respond_to_cases", "Can respond to cases"),
                    ("can_view_analytics", "Can view analytics"),
                    ("can_export_reports", "Can export reports"),
                    ("can_manage_categories_departments", "Can manage categories and departments"),
                    ("can_answer_assistant_questions", "Can answer questions forwarded from the AI assistant"),
                ],
            },
        ),
        migrations.AddField(
            model_name="internalmessage",
            name="reply_to",
            field=models.ForeignKey(
                blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL,
                related_name="replies", to="submissions.internalmessage"),
        ),
        migrations.AddField(model_name="internalmessage", name="edited_at",
                            field=models.DateTimeField(blank=True, null=True)),
        migrations.AddField(model_name="internalmessage", name="is_deleted",
                            field=models.BooleanField(default=False)),
        migrations.AddField(model_name="internalmessage", name="is_pinned",
                            field=models.BooleanField(default=False)),
    ]
