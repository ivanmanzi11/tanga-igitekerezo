from rest_framework.routers import DefaultRouter

from .views import ChatDirectoryView, ConversationViewSet, NotificationViewSet

router = DefaultRouter()
router.register("notifications", NotificationViewSet, basename="notification")
router.register("chat-directory", ChatDirectoryView, basename="chat-directory")
router.register("conversations", ConversationViewSet, basename="conversation")

urlpatterns = router.urls
