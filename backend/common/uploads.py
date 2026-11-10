"""General3 GEN_06: one place that decides which uploads are acceptable —
PDF, Word, Excel, PNG, WebP, JPG, MP3 and MP4, at most 10 MB each."""
import os

from rest_framework.exceptions import ValidationError

MAX_UPLOAD_BYTES = 10 * 1024 * 1024
ALLOWED_EXTENSIONS = {
    ".pdf", ".doc", ".docx", ".xls", ".xlsx",
    ".png", ".webp", ".jpg", ".jpeg",
    ".mp3", ".mp4",
}


def validate_upload_file(f):
    name = getattr(f, "name", "file")
    ext = os.path.splitext(name)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise ValidationError(
            f"“{name}” isn't an accepted file type. Allowed: PDF, Word, Excel, PNG, WebP, JPG, MP3, MP4."
        )
    if f.size > MAX_UPLOAD_BYTES:
        raise ValidationError(f"“{name}” is larger than 10 MB.")
    return f


def validated_files(files):
    """Validate every file up front so a bad one rejects the whole upload
    before anything is saved."""
    for f in files:
        validate_upload_file(f)
    return files


# General3 GEN_04: files sent with an anonymous case can carry the sender's
# identity in their metadata (camera/phone model, GPS location, author name) or
# in their file name. For anonymous cases we re-encode images (dropping all
# EXIF/GPS data) and store every file under a random name.
import io
import uuid

from django.core.files.base import ContentFile

IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".webp"}


def anonymise_upload(f, index=1):
    """Returns (clean_file, display_name) for an upload on an anonymous case."""
    ext = os.path.splitext(getattr(f, "name", "") or "")[1].lower()
    display = f"attachment-{index}{ext}"
    if ext in IMAGE_EXTS:
        try:
            from PIL import Image
            f.seek(0)
            img = Image.open(f)
            img.load()
            fmt = {".jpg": "JPEG", ".jpeg": "JPEG", ".png": "PNG", ".webp": "WEBP"}[ext]
            has_alpha = img.mode in ("RGBA", "LA") or (img.mode == "P" and "transparency" in img.info)
            mode = "RGBA" if (has_alpha and fmt != "JPEG") else "RGB"
            clean = Image.new(mode, img.size)
            clean.paste(img.convert(mode))  # pixels only — no metadata survives
            buf = io.BytesIO()
            clean.save(buf, format=fmt)
            return ContentFile(buf.getvalue(), name=f"{uuid.uuid4().hex}{ext}"), display
        except Exception:
            pass  # not a decodable image: fall through and just rename it
    f.seek(0)
    return ContentFile(f.read(), name=f"{uuid.uuid4().hex}{ext}"), display
