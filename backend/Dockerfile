FROM python:3.12-slim

COPY --from=ghcr.io/astral-sh/uv:0.11.16 /uv /usr/local/bin/uv

WORKDIR /app
ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    PYTHONUNBUFFERED=1 \
    DATABASE_PATH=/app/data/wind.db \
    PATH="/app/.venv/bin:$PATH"

COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev

ENV UV_NO_SYNC=1 \
    UVICORN_PORT=8000

COPY app ./app
RUN useradd --create-home app && mkdir -p /app/data && chown app:app /app/data
USER app

EXPOSE 8000
HEALTHCHECK --interval=15s --timeout=15s --start-period=30s --retries=3 \
    CMD ["python", "-c", "import os, urllib.request; urllib.request.urlopen('http://127.0.0.1:' + os.environ['UVICORN_PORT'] + os.getenv('API_PREFIX', '/api/v1') + '/health', timeout=5)"]
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0"]
