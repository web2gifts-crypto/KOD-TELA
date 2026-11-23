FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1
WORKDIR /app

COPY requirements.txt .
RUN pip install -r requirements.txt && useradd --system --uid 10001 app

COPY alembic.ini .
COPY migrations migrations
COPY app app

USER app
EXPOSE 8000
# миграции при старте, затем сервер; заголовки X-Forwarded-* доверяем только Caddy из docker-сети
CMD ["sh", "-c", "alembic upgrade head && exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 2 --proxy-headers --forwarded-allow-ips='*' --no-server-header"]
