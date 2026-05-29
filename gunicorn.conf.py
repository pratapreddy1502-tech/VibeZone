import os


bind = f"0.0.0.0:{os.getenv('PORT', '8000')}"
worker_class = "uvicorn.workers.UvicornWorker"

# Realtime presence/call signaling currently uses in-memory connection maps.
# Keep one worker unless you add a shared Socket.IO manager such as Redis.
workers = int(os.getenv("WEB_CONCURRENCY", "1"))

timeout = int(os.getenv("WEB_TIMEOUT", "120"))
graceful_timeout = int(os.getenv("WEB_GRACEFUL_TIMEOUT", "30"))
keepalive = int(os.getenv("WEB_KEEPALIVE", "30"))
accesslog = "-"
errorlog = "-"
loglevel = os.getenv("LOG_LEVEL", "info")
