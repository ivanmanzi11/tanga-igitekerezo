from django.core.management.base import BaseCommand

from submissions.services import auto_close_stale_resolved


class Command(BaseCommand):
    help = "Closes any submission that has been 'resolved' for 3+ days. Intended to run on a daily cron/scheduled task."

    def handle(self, *args, **options):
        count = auto_close_stale_resolved()
        self.stdout.write(self.style.SUCCESS(f"Auto-closed {count} submission(s)."))
