from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from .models import User, Department


@admin.register(User)
class TangaUserAdmin(UserAdmin):
    list_display = ["username", "email", "role", "department", "is_active"]
    list_filter = ["role", "department", "is_active"]
    fieldsets = UserAdmin.fieldsets + (
        ("Tanga Igitekerezo", {"fields": ("role", "department", "phone_number")}),
    )


@admin.register(Department)
class DepartmentAdmin(admin.ModelAdmin):
    list_display = ["name", "name_rw", "name_fr", "is_active"]
    search_fields = ["name", "name_rw", "name_fr"]
