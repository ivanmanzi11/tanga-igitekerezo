from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("submissions", "0007_priority_levels"),
    ]

    operations = [
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
                    ("can_access_high_priority_cases", "Can see and work on High priority cases"),
                    ("can_access_medium_priority_cases", "Can see and work on Medium priority cases"),
                    ("can_access_low_priority_cases", "Can see and work on Low priority (unmarked) cases"),
                ],
            },
        ),
    ]
