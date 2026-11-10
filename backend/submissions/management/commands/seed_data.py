from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand

from accounts.models import Department
from submissions.models import Category, PriorityKeyword

User = get_user_model()


class Command(BaseCommand):
    help = "Seeds default departments, categories, and an initial admin account."

    def handle(self, *args, **options):
        departments = [
            ("ICT", "IKORANABUHANGA", "TIC"),
            ("Human Resources", "UMUTUNGO KAMERE", "Ressources Humaines"),
            ("Finance", "IMARI", "Finances"),
            ("Customer Service", "SERIVISI KU BAKIRIYA", "Service Client"),
            ("Infrastructure & Maintenance", "IBIKORWA REMEZO", "Infrastructure"),
        ]
        for name, rw, fr in departments:
            Department.objects.get_or_create(name=name, defaults={"name_rw": rw, "name_fr": fr})
        self.stdout.write(self.style.SUCCESS(f"Seeded {len(departments)} departments."))

        categories = [
            ("Suggestion", "IGITEKEREZO", "Suggestion", Category.Kind.SUGGESTION),
            ("Complaint", "IKIREGO", "Plainte", Category.Kind.COMPLAINT),
            ("Appreciation", "ISHIMWE", "Appréciation", Category.Kind.APPRECIATION),
            # Admin3 ADM_04: "Others" replaces "Idea" and always comes last.
            ("Others", "IBINDI", "Autres", Category.Kind.OTHER),
        ]
        for name, rw, fr, kind in categories:
            Category.objects.get_or_create(
                name=name, defaults={"name_rw": rw, "name_fr": fr, "kind": kind, "is_other": kind == Category.Kind.OTHER}
            )
        self.stdout.write(self.style.SUCCESS(f"Seeded {len(categories)} categories."))

        # Admin2 ADM_01: starter keywords for the AI priority classifier; the
        # admin can add/remove them from the Priority section.
        starter = {
            "high": ["urgent", "emergency", "danger", "fire", "corruption", "bribe", "harassment", "abuse", "threat", "unsafe"],
            "medium": ["delay", "broken", "unfair", "overcharged", "rude", "not working", "complaint"],
        }
        for level, words in starter.items():
            for w in words:
                PriorityKeyword.objects.get_or_create(word=w, defaults={"level": level})
        self.stdout.write(self.style.SUCCESS("Seeded starter priority keywords."))

        if not User.objects.filter(role=User.Role.ADMIN).exists():
            User.objects.create_superuser(
                username="admin", email="admin@tanga-igitekerezo.rw", password="ChangeMe123!",
                role=User.Role.ADMIN,
            )
            self.stdout.write(self.style.SUCCESS(
                "Created admin account -> username: admin / password: ChangeMe123! (change this immediately)."
            ))
        else:
            self.stdout.write("Admin account already exists, skipping.")
