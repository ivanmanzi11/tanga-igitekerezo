class AnonymousSafeguardMiddleware:
    """General3 GEN_04: when someone sends a new case, remove everything about
    their connection (IP address, browser, referring page) from the request
    before any other code — logging, analytics, the app itself — can see it.
    Nothing about the sender can then be stored, even by accident."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if request.method == "POST" and request.path.rstrip("/") == "/api/submissions":
            for key in ("REMOTE_ADDR", "HTTP_X_FORWARDED_FOR", "HTTP_X_REAL_IP", "HTTP_USER_AGENT", "HTTP_REFERER", "HTTP_ORIGIN_IP"):
                request.META.pop(key, None)
            request.META["REMOTE_ADDR"] = "0.0.0.0"
        return self.get_response(request)
