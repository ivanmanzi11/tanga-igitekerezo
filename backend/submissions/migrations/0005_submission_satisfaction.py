from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("submissions", "0004_alter_submission_options"),
    ]

    operations = [
        migrations.AddField(
            model_name="submission",
            name="satisfaction_rating",
            field=models.PositiveSmallIntegerField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="submission",
            name="satisfaction_comment",
            field=models.TextField(blank=True),
        ),
        migrations.AddField(
            model_name="submission",
            name="satisfaction_rated_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]
