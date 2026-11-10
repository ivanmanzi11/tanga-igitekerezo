from django.db import migrations, models


def idea_becomes_others(apps, schema_editor):
    """Admin3 ADM_04: the old "Idea" category (too close to "Suggestion") becomes
    "Others", the catch-all that always comes last. Submissions already filed
    under it simply carry on under the new name."""
    Category = apps.get_model("submissions", "Category")
    idea = Category.objects.filter(kind="idea").first() or Category.objects.filter(name__iexact="idea").first()
    others = Category.objects.filter(is_other=True).first() or Category.objects.filter(name__iexact="others").first()
    if idea and not others:
        idea.name, idea.name_rw, idea.name_fr = "Others", "Ibindi", "Autres"
        idea.kind, idea.is_other, idea.is_active = "other", True, True
        idea.save()
    elif idea and others:
        # both exist: move Idea's submissions under Others and archive Idea
        idea.submissions.update(category=others)
        idea.is_active = False
        idea.save()
        if not others.is_other:
            others.is_other = True
            others.kind = "other"
            others.save()
    elif not others:
        Category.objects.create(name="Others", name_rw="Ibindi", name_fr="Autres", kind="other", is_other=True)
    Category.objects.filter(kind="idea").update(kind="other")


class Migration(migrations.Migration):

    dependencies = [
        ("submissions", "0009_savedtrackingcode"),
    ]

    operations = [
        migrations.AddField(model_name="category", name="is_other", field=models.BooleanField(default=False)),
        migrations.AlterField(
            model_name="category", name="kind",
            field=models.CharField(
                choices=[("suggestion", "Suggestion"), ("complaint", "Complaint"),
                         ("appreciation", "Appreciation"), ("other", "Others")],
                default="suggestion", max_length=20),
        ),
        migrations.AlterModelOptions(
            name="category", options={"ordering": ["is_other", "name"], "verbose_name_plural": "Categories"},
        ),
        migrations.RunPython(idea_becomes_others, migrations.RunPython.noop),
        # General3 GEN_04: no link between an account and an anonymous case, ever.
        migrations.DeleteModel(name="SavedTrackingCode"),
        migrations.CreateModel(
            name="SiteSettings",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("allow_confidential", models.BooleanField(default=True)),
                ("allow_identified", models.BooleanField(default=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
            options={"verbose_name_plural": "Site settings"},
        ),
    ]
