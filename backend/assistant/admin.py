from django.contrib import admin

from .models import AssistantQuestion, FAQEntry

admin.site.register(FAQEntry)
admin.site.register(AssistantQuestion)
