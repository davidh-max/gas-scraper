# Prompt para opencode — Dockerizar GAS

Copia **todo lo que hay debajo de la línea** y pégalo en opencode (en la raíz del repo).
Está escrito como instrucciones directas para que genere los archivos Docker correctos
sin desviarse de las convenciones del proyecto.

---

Eres un ingeniero de DevOps trabajando en el repo GAS (lee `CLAUDE.md` antes de empezar).
Tu tarea: **dockerizar la app para desplegarla en un VPS** con `web` (Next.js), `worker`
(Python) y un reverse proxy **Caddy** que dé HTTPS automático. No despliegas nada: solo
creas los archivos, verificas que las imágenes construyen, y haces commit.

## Contexto del repo (no lo cambies salvo lo indicado)

- `web/` — Next.js 14 (App Router, TS). Gestor de paquetes **npm** (`package-lock.json`).
  Scripts: `build`, `start`. Variables `NEXT_PUBLIC_SUPABASE_URL` y
  `NEXT_PUBLIC_SUPABASE_ANON_KEY` (ver `web/.env.local.example`).
- `worker/` — Python ≥3.11, `pyproject.toml` (setuptools), paquete `worker`. Arranque en
  producción: `python -m worker.main` (bucle continuo que hace polling de Supabase).
  Dependencias con extensiones nativas: `pydantic` (pydantic-core) y `rapidfuzz`.
  Variables en `worker/.env.example` (Supabase service_role, Apify, OpenRouter, HarvestAPI).
- Supabase, Apify, OpenRouter y HarvestAPI son **servicios externos**: no se dockerizan.
- **Dato verificado**: en modo producción (live, sin `--use-fixtures`) el worker **NO** lee
  la carpeta `prompts/` ni los fixtures de `worker/tests/` — esos prompts están escritos en
  el código Python. Por tanto el **contexto de build del worker puede ser solo `./worker`**;
  no necesitas incluir `prompts/` ni `tests/` en la imagen.

## Reglas que NO puedes romper

1. **Bases Alpine.** Web: `node:20-alpine`. Worker: `python:3.11-alpine`.
2. **Builds multi-stage** en ambos, para imágenes pequeñas y sin compiladores en runtime.
3. **Cero secretos en las imágenes y en git.** Las claves se leen en runtime desde `.env`
   que solo existen en el servidor. La **única** excepción son las `NEXT_PUBLIC_*` (son
   públicas por diseño) y deben inyectarse **en build-time** (ver punto 4). El
   `SUPABASE_SERVICE_ROLE_KEY` y los tokens del worker **jamás** se hornean en la imagen.
4. **`NEXT_PUBLIC_*` se incrustan en el `next build`.** El `Dockerfile` de la web las recibe
   como `ARG` y las expone como `ENV` **antes** de `npm run build`. En el compose se pasan
   vía `build.args`, con sustitución `${...}` desde un `.env` en la raíz del repo.
5. **No mezcles código entre `web/` y `worker/`** (frontera limpia del proyecto). Cada uno
   su Dockerfile en su carpeta.
6. **Contenedores como usuario no-root** y con `restart: unless-stopped`.
7. **El worker no expone puertos.** La web expone el 3000 **solo en la red interna** de
   Docker; a Internet solo sale Caddy (80/443).
8. **Commits pequeños y en español**, con prefijo de ámbito (`chore:`, `web:`, `worker:`).

## Archivos que debes crear

### 1. `web/next.config.mjs` (modificar)
Añade `output: 'standalone'` al config (deja `reactStrictMode: true`). Es lo que permite
una imagen de runtime mínima que se ejecuta con `node server.js`.

### 2. `web/Dockerfile` (multi-stage)
Tres etapas sobre `node:20-alpine`:
- **deps**: copia `package.json` + `package-lock.json`, `npm ci`.
- **builder**: copia node_modules de `deps` y el resto del código; declara
  `ARG NEXT_PUBLIC_SUPABASE_URL` y `ARG NEXT_PUBLIC_SUPABASE_ANON_KEY`, los expone como `ENV`,
  `ENV NEXT_TELEMETRY_DISABLED=1`, y `npm run build`.
- **runner**: `NODE_ENV=production`, usuario no-root (`nextjs`), copia `public`,
  `.next/standalone` y `.next/static`, `EXPOSE 3000`, `ENV PORT=3000 HOSTNAME=0.0.0.0`,
  `CMD ["node", "server.js"]`.

Referencia (ajústala si hace falta):
```dockerfile
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL \
    NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY \
    NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
```

### 3. `web/.dockerignore`
Ignora `node_modules`, `.next`, `.env*`, `npm-debug.log*`, `.git`, `Dockerfile`, `README*`.

### 4. `worker/Dockerfile` (multi-stage)
Dos etapas sobre `python:3.11-alpine`:
- **builder**: instala dependencias de compilación (`build-base`, `libffi-dev`) por si algún
  paquete necesita compilar; crea un venv en `/opt/venv`; instala el paquete con
  `pip install --no-cache-dir .` (lee `pyproject.toml`). (pydantic-core y rapidfuzz
  publican wheels musllinux, así que normalmente no compilará; las build-deps son el
  cinturón de seguridad y se quedan en esta etapa.)
- **runner**: copia **solo** el venv `/opt/venv` desde builder, pone `PATH` al venv, usuario
  no-root, `CMD ["python", "-m", "worker.main"]`. **Sin** `--use-fixtures` ni `--once`
  (producción = bucle continuo).

Referencia:
```dockerfile
FROM python:3.11-alpine AS builder
WORKDIR /app
RUN apk add --no-cache build-base libffi-dev
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"
COPY . .
RUN pip install --no-cache-dir .

FROM python:3.11-alpine AS runner
WORKDIR /app
ENV PATH="/opt/venv/bin:$PATH" PYTHONUNBUFFERED=1
RUN adduser -S app -u 1001
COPY --from=builder /opt/venv /opt/venv
USER app
CMD ["python", "-m", "worker.main"]
```
> `PYTHONUNBUFFERED=1` para que los logs salgan en tiempo real en `docker compose logs`.
> El worker lee su config de variables de entorno (pydantic-settings); el compose se las
> inyecta con `env_file`. No necesita un `.env` dentro de la imagen.

### 5. `worker/.dockerignore`
Ignora `.venv`, `__pycache__`, `*.pyc`, `.pytest_cache`, `.ruff_cache`, `*.egg-info`,
`.env*`, `out/`, `tests/`, `.git`, `Dockerfile`.

### 6. `docker-compose.yml` (raíz del repo)
Tres servicios en una red común:
- **caddy**: imagen `caddy:2-alpine`. Puertos `80:80` y `443:443`. Monta `./Caddyfile` en
  `/etc/caddy/Caddyfile` (read-only) y volúmenes nombrados `caddy_data` y `caddy_config`
  (para persistir los certificados). `depends_on: [web]`. `restart: unless-stopped`.
- **web**: `build.context: ./web` con `build.args` para las dos `NEXT_PUBLIC_*` usando
  `${NEXT_PUBLIC_SUPABASE_URL}` y `${NEXT_PUBLIC_SUPABASE_ANON_KEY}` (compose los toma del
  `.env` de la raíz). `expose: ["3000"]` (NO `ports`, no debe salir a Internet).
  `restart: unless-stopped`.
- **worker**: `build.context: ./worker`. `env_file: [./worker/.env]`. Sin puertos.
  `restart: unless-stopped`.

### 7. `Caddyfile` (raíz del repo)
Reverse proxy del dominio al servicio web. Deja claramente marcados los dos huecos a
rellenar (dominio y email). Ejemplo:
```
gas.tudominio.com {
    encode gzip
    reverse_proxy web:3000
    tls tu-email@tudominio.com
}
```

### 8. `.env.example` (raíz del repo)
Documenta las variables que compose usa para los **build args** de la web:
```
NEXT_PUBLIC_SUPABASE_URL=https://ftpgnimyjxlomjfdqfqy.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```
Y actualiza `.gitignore` para asegurarte de que el `.env` de la raíz queda ignorado (ya
ignora `.env`, confírmalo).

### 9. `README.md` o sección nueva
Añade una sección breve "Despliegue con Docker" que remita a los pasos: crear `.env` (raíz)
y `worker/.env`, poner dominio/email en `Caddyfile`, y `docker compose up -d --build`.

## Verificación antes de hacer commit

1. `docker compose config` — valida que el compose es correcto y que las sustituciones
   `${...}` resuelven (usa un `.env` de prueba en la raíz con valores ficticios).
2. `docker compose build` — confirma que **ambas** imágenes construyen sin error en Alpine.
   Si la del worker fallara compilando `pydantic-core`, añade `cargo` a las build-deps del
   builder; si fallara otra, añade la `*-dev` correspondiente. Documenta cualquier ajuste.
3. Comprueba que el runner del worker **no** contiene compiladores (solo el venv copiado) y
   que ningún `.env` real ni secreto ha quedado dentro de las imágenes ni en git.
4. Verifica que `web/.dockerignore` y `worker/.dockerignore` excluyen `.env*`.

## Qué NO hacer
- No toques la lógica de negocio (`worker/pipeline/`, `web/src/`).
- No añadas un contenedor de base de datos: Supabase es externo.
- No expongas el puerto 3000 a Internet (solo `expose`, nunca `ports`).
- No metas claves reales en ningún archivo versionado.

Cuando termines, resume los archivos creados y deja indicado qué tiene que rellenar la
persona en el servidor (`.env` raíz, `worker/.env`, dominio y email del `Caddyfile`).
