from django.contrib import admin

from .models import ChatMessage, Conversation, Notification

admin.site.register(Notification)
admin.site.register(Conversation)
admin.site.register(ChatMessage)
