from django.db import migrations, models


def old_to_new_levels(apps, schema_editor):
    """Admin2 ADM_01: the old Low/Normal/High/Urgent scale becomes Low/Medium/High."""
    Submission = apps.get_model("submissions", "Submission")
    Submission.objects.filter(priority="normal").update(priority="low")
    Submission.objects.filter(priority="urgent").update(priority="high")


class Migration(migrations.Migration):

    dependencies = [
        ("submissions", "0006_prioritykeyword_and_message_features"),
    ]

    operations = [
        migrations.RunPython(old_to_new_levels, migrations.RunPython.noop),
        migrations.AlterField(
            model_name="submission",
            name="priority",
            field=models.CharField(
                choices=[("low", "Low"), ("medium", "Medium"), ("high", "High")],
                default="low", max_length=10),
        ),
    ]
