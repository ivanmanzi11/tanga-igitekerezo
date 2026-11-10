import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("notifications", "0003_conversation_submission"),
    ]

    operations = [
        migrations.AddField(
            model_name="chatmessage", name="reply_to",
            field=models.ForeignKey(
                blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL,
                related_name="replies", to="notifications.chatmessage"),
        ),
        migrations.AddField(model_name="chatmessage", name="edited_at",
                            field=models.DateTimeField(blank=True, null=True)),
        migrations.AddField(model_name="chatmessage", name="is_deleted",
                            field=models.BooleanField(default=False)),
        migrations.AddField(model_name="chatmessage", name="is_pinned",
                            field=models.BooleanField(default=False)),
    ]
