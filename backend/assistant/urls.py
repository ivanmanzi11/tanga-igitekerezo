from django.urls import path

from .views import (
    AssistantFeedbackView, AssistantQuestionDeleteView, BuiltinTopicsView, FAQEntryDetailView, FAQEntryView, AssistantQuestionAnswerView, AssistantQuestionListView, AssistantQuestionStatusView, AssistantView,
)

urlpatterns = [
    path("assistant/", AssistantView.as_view(), name="assistant"),
    path("assistant/feedback/", AssistantFeedbackView.as_view(), name="assistant-feedback"),
    path("assistant/questions/", AssistantQuestionListView.as_view(), name="assistant-questions"),
    path("assistant/faq/", FAQEntryView.as_view(), name="assistant-faq"),
    path("assistant/faq/<int:pk>/", FAQEntryDetailView.as_view(), name="assistant-faq-detail"),
    path("assistant/builtin/", BuiltinTopicsView.as_view(), name="assistant-builtin"),
    path("assistant/questions/<int:pk>/", AssistantQuestionDeleteView.as_view(), name="assistant-question-delete"),
    path("assistant/questions/<int:pk>/answer/", AssistantQuestionAnswerView.as_view(), name="assistant-question-answer"),
    path("assistant/questions/<str:code>/", AssistantQuestionStatusView.as_view(), name="assistant-question-status"),
]
