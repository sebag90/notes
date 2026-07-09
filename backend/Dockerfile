FROM python:3.12-alpine

WORKDIR /app

# Install essential dependencies for compile-time if needed
RUN apk add --no-cache gcc musl-dev postgresql-dev libffi-dev

# Copy uv from its official image
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/

# Copy project files
COPY pyproject.toml uv.lock ./

# Sync dependencies using uv (creates /app/.venv)
RUN uv sync --frozen --no-dev --no-install-project

# Copy application code
COPY app ./app

# Expose FastAPI default port
EXPOSE 8000

# Put virtualenv on the path
ENV PATH="/app/.venv/bin:$PATH"
ENV HTPASSWD_PATH="/etc/notes/htpasswd"

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
