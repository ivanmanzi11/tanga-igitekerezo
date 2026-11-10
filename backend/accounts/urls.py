from django.urls import path
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView

from .views import (
    TangaTokenObtainPairView, RegisterView, MeView, ChangePasswordView, StaffSignupView,
    DepartmentViewSet, StaffUserViewSet, GroupViewSet, PermissionListView,
)

router = DefaultRouter()
router.register("departments", DepartmentViewSet, basename="department")
router.register("staff-users", StaffUserViewSet, basename="staff-user")
router.register("groups", GroupViewSet, basename="group")

urlpatterns = [
    path("auth/register/", RegisterView.as_view(), name="register"),
    path("auth/staff-signup/", StaffSignupView.as_view(), name="staff-signup"),
    path("auth/login/", TangaTokenObtainPairView.as_view(), name="login"),
    path("auth/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("auth/me/", MeView.as_view(), name="me"),
    path("auth/change-password/", ChangePasswordView.as_view(), name="change-password"),
    path("permissions/", PermissionListView.as_view(), name="permissions-list"),
] + router.urls
