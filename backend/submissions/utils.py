import secrets

from django.utils import timezone


def generate_tracking_code(digits=4):
    """General3 GEN_02: institutional tracking code
    TGC-<year>-<month>-<day>-<case number>, e.g. TGC-2026-10-05-0427.
    The case number is random from 0001 up to 9999 (more digits are only used
    on the rare day when all 9999 are taken)."""
    today = timezone.localdate()
    number = secrets.randbelow(10 ** digits - 1) + 1
    return f"TGC-{today:%Y-%m-%d}-{number:0{digits}d}"
