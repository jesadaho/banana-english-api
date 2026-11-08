FROM ghcr.io/astral-sh/uv:python3.12-bookworm-slim

ENV PYTHONUNBUFFERED=1 \
    UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy

WORKDIR /app

COPY pyproject.toml ./
RUN uv sync --no-dev

COPY src ./src

CMD ["uv", "run", "--no-sync", "src/agent.py", "start"]
