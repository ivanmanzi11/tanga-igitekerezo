from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("assistant", "0002_answerfeedback"),
    ]

    operations = [
        migrations.AddField(model_name="faqentry", name="question_rw", field=models.CharField(blank=True, max_length=500)),
        migrations.AddField(model_name="faqentry", name="question_fr", field=models.CharField(blank=True, max_length=500)),
        migrations.AddField(model_name="faqentry", name="answer_rw", field=models.TextField(blank=True)),
        migrations.AddField(model_name="faqentry", name="answer_fr", field=models.TextField(blank=True)),
        migrations.AddField(model_name="faqentry", name="source_key", field=models.CharField(blank=True, max_length=60)),
    ]
