from rest_framework.pagination import PageNumberPagination


class StandardPagination(PageNumberPagination):
    """General3 GEN_01: every table-backed list paginates at 10 rows per page.
    Dropdown/lookup fetches can ask for more with ?page_size=N (max 500)."""

    page_size = 10
    page_size_query_param = "page_size"
    max_page_size = 500
