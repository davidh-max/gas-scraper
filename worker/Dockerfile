# syntax=docker/dockerfile:1
FROM python:3.11-alpine AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

# Instalar dependencias del sistema necesarias para compilar algunas librerías
RUN apk add --no-cache \
    gcc \
    musl-dev \
    libffi-dev \
    && rm -rf /var/cache/apk/*

# Crear usuario no-root
RUN addgroup -S gas -g 1001 && adduser -S gas -u 1001

# Instalar dependencias Python
COPY worker/pyproject.toml ./
COPY worker/worker ./worker
RUN pip install --no-cache-dir -e .

# Cambiar propietario para que el usuario no-root pueda leer y escribir
RUN chown -R gas:gas /app

# Cambiar a usuario no-root
USER gas

# El entrypoint es el loop del worker (modo live por defecto)
CMD ["python", "-m", "worker.main"]
