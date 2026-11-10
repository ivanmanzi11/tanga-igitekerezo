from django.contrib import admin

from .models import Category, Submission, Attachment, Assignment, Response, StatusHistory, InternalMessage, PriorityKeyword


class AttachmentInline(admin.TabularInline):
    model = Attachment
    extra = 0


class ResponseInline(admin.TabularInline):
    model = Response
    extra = 0


class StatusHistoryInline(admin.TabularInline):
    model = StatusHistory
    extra = 0
    readonly_fields = ["old_status", "new_status", "changed_by", "note", "changed_at"]


class AssignmentInline(admin.TabularInline):
    model = Assignment
    extra = 0


@admin.register(Submission)
class SubmissionAdmin(admin.ModelAdmin):
    list_display = ["tracking_code", "title", "submission_type", "category", "department", "status", "priority", "created_at"]
    list_filter = ["status", "submission_type", "category", "department", "priority"]
    search_fields = ["tracking_code", "title", "submitter_email"]
    readonly_fields = ["tracking_code", "created_at", "updated_at"]
    inlines = [AttachmentInline, AssignmentInline, ResponseInline, StatusHistoryInline]


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ["name", "name_rw", "name_fr", "kind", "is_active"]


admin.site.register(InternalMessage)


@admin.register(PriorityKeyword)
class PriorityKeywordAdmin(admin.ModelAdmin):
    list_display = ["word", "level", "created_at"]
    list_filter = ["level"]
