from rest_framework.routers import DefaultRouter

from .views import (
    CategoryViewSet, SubmissionViewSet, TrackSubmissionView, TrackReplyView, TrackRateView,
    AnalyticsSummaryView, CasesReportView, SingleCaseReportView, AnalyticsReportView,
    DashboardSummaryView, PriorityKeywordViewSet, SubmissionOptionsView,
)
from django.urls import path

router = DefaultRouter()
router.register("categories", CategoryViewSet, basename="category")
router.register("priority-keywords", PriorityKeywordViewSet, basename="priority-keyword")
router.register("submissions", SubmissionViewSet, basename="submission")

urlpatterns = [
    path("submission-options/", SubmissionOptionsView.as_view(), name="submission-options"),
    path("track/<str:tracking_code>/", TrackSubmissionView.as_view(), name="track-submission"),
    path("track/<str:tracking_code>/reply/", TrackReplyView.as_view(), name="track-reply"),
    path("track/<str:tracking_code>/rate/", TrackRateView.as_view(), name="track-rate"),
    path("dashboard/summary/", DashboardSummaryView.as_view(), name="dashboard-summary"),
    path("analytics/summary/", AnalyticsSummaryView.as_view(), name="analytics-summary"),
    path("reports/cases/", CasesReportView.as_view(), name="report-cases"),
    path("reports/cases/<uuid:pk>/", SingleCaseReportView.as_view(), name="report-single-case"),
    path("reports/analytics/", AnalyticsReportView.as_view(), name="report-analytics"),
] + router.urls
