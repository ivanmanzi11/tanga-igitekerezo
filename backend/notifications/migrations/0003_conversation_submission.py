import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("notifications", "0002_conversation_chatmessage"),
        ("submissions", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="conversation",
            name="submission",
            field=models.OneToOneField(
                blank=True, null=True, on_delete=django.db.models.deletion.CASCADE,
                related_name="case_group", to="submissions.submission",
            ),
        ),
    ]
