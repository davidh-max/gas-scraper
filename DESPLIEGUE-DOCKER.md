# Desplegar GAS

Guía para desplegar GAS. El camino **recomendado y más sencillo** es:

- **Cloudflare Pages** para la web (Next.js).
- **Railway** para el worker Python.
- **Supabase** ya está en la nube y no cambia.

También dejamos documentadas las alternativas con **Docker en VPS** (Caddy o Load Balancer)
por si en el futuro quieres volver a ellas.

---

## TL;DR — Cloudflare Pages + Railway (recomendado)

1. Conectar el repo de GitHub a **Cloudflare Pages**.
2. Configurar el build:
   - Framework preset: None / o el que detecte.
   - Build command: `npm run pages:build`
   - Build output directory: `.vercel/output/static`
   - Root directory: `web`
3. Añadir variables de entorno en Cloudflare Pages:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Crear proyecto en **Railway** y conectar el mismo repo.
   - Seleccionar como servicio el `worker/Dockerfile`.
   - Añadir variables de entorno desde `worker/.env.example`.
5. En tu DNS (Namecheap) apunta `fknscraper.gascoolcalling.com` a Cloudflare Pages.

Listo. HTTPS, caché global y CI/CD automáticos sin tocar servidores.

---

> **Nota:** si prefieres la opción Docker/VPS, sigue a partir de la sección "Alternativa: Docker en VPS".

---

## 1. Arquitectura Cloudflare Pages + Railway

```
                    Internet (https://gas.tudominio.com)
                               │
                               ▼
                      ┌─────────────────┐
                      │ Cloudflare Pages│  ← Next.js, HTTPS automático, CDN global
                      └────────┬────────┘
                               │
                               ▼
                      ┌─────────────────┐
                      │    Supabase     │  ← Auth + Postgres + Storage
                      └─────────────────┘

                      ┌─────────────────┐
                      │     Railway     │  ← Worker Python en Docker
                      └─────────────────┘
```

- **Cloudflare Pages** sirve la web. Cloudflare gestiona HTTPS, dominio y caché.
- **Railway** corre el worker Python a partir del `Dockerfile` existente.
- **Supabase** sigue siendo el centro: web y worker solo se hablan por la BD.

---

## 2. Preparar la web para Cloudflare Pages

Ya está hecho en el repositorio:

- `web/package.json` incluye `@cloudflare/next-on-pages` y `wrangler` como devDependencies.
- `web/wrangler.toml` con la configuración base.
- `web/next.config.mjs` sin `output: 'standalone'` (no es necesario en Pages).
- `.node-version` para que Cloudflare Pages use Node 20.
- `.gitignore` ignora `.vercel/` y `.wrangler/`.

Los scripts importantes son:

```bash
cd web
npm install          # instala next-on-pages y wrangler
npm run pages:build  # genera .vercel/output/static
npm run pages:deploy # sube a Cloudflare Pages (uso local)
```

### Pasos en Cloudflare Pages

1. Entra en [dash.cloudflare.com](https://dash.cloudflare.com) → **Pages**.
2. **Create a project** → **Connect to Git** → selecciona tu repo.
3. Configura el build:
   - **Project name**: `gas-web`
   - **Production branch**: `main`
   - **Root directory**: `web`
   - **Build command**: `npm run pages:build`
   - **Build output directory**: `.vercel/output/static`
4. En **Environment variables**, añade:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
5. Guarda y despliega.

> **Importante:** las variables `NEXT_PUBLIC_*` deben estar presentes **en build time**, no solo en runtime. Cloudflare Pages las inyecta durante el build.

---

## 3. Desplegar el worker en Railway

Railway lee directamente el `worker/Dockerfile`.

### Pasos

1. Entra en [railway.app](https://railway.app) y crea un proyecto.
2. **Deploy from GitHub repo** y selecciona tu repo.
3. Railway detectará el `railway.json` en la raíz o el `Dockerfile`. Si no, selecciona **Dockerfile** y apunta a `worker/Dockerfile`.
4. Añade las variables de entorno del worker (ver `worker/.env.example`):
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `APIFY_TOKEN`
   - `APIFY_EMPLOYEES_ACTOR_ID`
   - `OPENROUTER_API_KEY`
   - `HARVEST_API_KEY`
   - etc.
5. Railway arrancará el contenedor y ejecutará `python -m worker.main`.

### Escala

Railway cobra por uso de CPU/memoria. El worker de GAS consume poco cuando está en espera.

---

## 4. DNS y dominio

Si tu dominio ya está usando Cloudflare (nameservers de Cloudflare):

1. En Cloudflare Pages, ve a **Custom domains** y añade `fknscraper.gascoolcalling.com`.
2. Cloudflare te dará un registro CNAME. Lo añades en el DNS de Cloudflare.
3. Listo.

Si tu dominio está en Namecheap pero solo quieres apuntar el subdominio:

1. En Namecheap avanzado DNS, crea un registro **CNAME**:
   ```
   fknscraper   →   CNAME   →   <tu-proyecto>.pages.dev
   ```
2. Espera a que propague.

---

## 5. Checklist Cloudflare + Railway

- [ ] Repo conectado a Cloudflare Pages.
- [ ] Build command: `npm run pages:build`.
- [ ] Build output: `.vercel/output/static`.
- [ ] Variables `NEXT_PUBLIC_SUPABASE_*` añadidas en Cloudflare Pages.
- [ ] Worker desplegado en Railway con todas las variables de `worker/.env`.
- [ ] Logs de Railway muestran el bucle de polling sin errores.
- [ ] Dominio apunta a Cloudflare Pages y carga con HTTPS.

---

# Alternativa: Docker en VPS


- **Imagen**: una "foto" congelada de tu app con todo lo que necesita para correr (el
  código, Node o Python, las librerías). Se construye una vez con un `Dockerfile` (la
  receta). Es inmutable.
- **Contenedor**: una imagen *en ejecución*. Como abrir la foto y darle al play. Puedes
  arrancar, parar y borrar contenedores sin afectar a la imagen.
- **docker compose**: un archivo (`docker-compose.yml`) que describe **todos** los
  contenedores y cómo se conectan, para levantarlos juntos con `docker compose up`.

La gracia de dockerizar: la app corre **igual** en tu portátil que en el servidor, porque
la imagen lleva dentro su entorno. Se acabó el "en mi máquina funcionaba".

---

## 3. El detalle que rompe a casi todo el mundo: `NEXT_PUBLIC_*`

En Next.js, las variables que empiezan por `NEXT_PUBLIC_` (las tuyas:
`NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`) **se incrustan en el código
cuando se hace el `build`**, no cuando arranca. Es decir: tienen que estar presentes
**al construir la imagen** de la web, no solo al ejecutarla.

Por eso el `Dockerfile` de la web las recibe como *build args* y el `docker-compose.yml`
se las pasa en `build.args`. (Tranquila: tu clave es la `anon` / `publishable`, que es
**pública** por diseño — no pasa nada porque quede en el bundle.)

La clave **secreta** (`SUPABASE_SERVICE_ROLE_KEY` del worker, y los tokens de Apify /
OpenRouter / HarvestAPI) es harina de otro costal: **nunca** se hornean en la imagen. Van
como variables de entorno en tiempo de ejecución, leídas de un archivo `.env` que solo
existe en el servidor. Esto ya está contemplado en el prompt.

---

## 4. Secretos: nada de claves en el repo

Tu `.gitignore` ya ignora `.env` y `.env.local`, perfecto. La regla en el servidor es la
misma: los archivos con claves reales **se crean a mano en el servidor** y no se suben a
git ni se copian dentro de la imagen. El `docker-compose.yml` los lee con `env_file`.

En el servidor necesitarás dos archivos:

- `worker/.env` — Supabase service_role, Apify, OpenRouter, HarvestAPI. **Todo secreto.**
  (a partir de `worker/.env.example`).
- `.env` en la **raíz** del repo — las dos `NEXT_PUBLIC_*`. `docker compose` lee este
  archivo automáticamente para inyectarlas en el *build* de la web (públicas, pero las
  gestionamos igual). El prompt deja un `.env.example` en la raíz como plantilla.

---

## 5. Pasos para desplegar en el VPS

### Paso 0 — Elegir el servidor

Como aún no lo tienes claro, una opción sencilla y barata: un VPS pequeño con **Ubuntu
24.04 LTS**. Con 2 vCPU y 4 GB de RAM te sobra para los tres contenedores. Proveedores
habituales: **Hetzner** (el más barato, ~4-6 €/mes el CX22), **DigitalOcean**, **Vultr**,
**OVH**. Cualquiera vale: lo único que necesitas es acceso **SSH** y una **IP pública**.

> Si prefieres no gestionar servidor, una plataforma como **Railway**, **Render** o
> **Fly.io** despliega contenedores Docker casi solos (leen tu `docker-compose` o el
> `Dockerfile`). Es más caro pero más cómodo. La dockerización que genera el prompt sirve
> igual para ese camino.

### Paso 1 — Apuntar el dominio al servidor (DNS)

En tu proveedor de dominio crea un registro **A**:

```
gas.tudominio.com   →   A   →   <IP pública del VPS>
```

Espera a que propague (suele ser minutos). Compruébalo con `ping gas.tudominio.com`: debe
responder la IP del VPS. **Esto tiene que estar listo antes de levantar Caddy**, porque
Let's Encrypt verifica el dominio para emitir el certificado.

### Paso 2 — Entrar por SSH e instalar Docker

```bash
ssh root@<IP-del-VPS>

# Instalar Docker + el plugin de compose (script oficial)
curl -fsSL https://get.docker.com | sh

# Comprobar
docker --version
docker compose version
```

### Paso 3 — Traer el código al servidor

Lo más cómodo es **git**. Si tu repo está en GitHub/GitLab:

```bash
git clone <url-de-tu-repo> gas
cd gas
```

Si no usas git remoto, puedes subirlo con `scp` desde tu portátil:

```bash
# (ejecutar en tu portátil, no en el servidor)
scp -r "/ruta/a/GAS Scraper" root@<IP-del-VPS>:/root/gas
```

> Importante: los archivos Docker (`Dockerfile` de web y worker, `docker-compose.yml`,
> `Caddyfile`, `.dockerignore`) están ya versionados en el repo. La web se construye con
> `output: 'standalone'` para que la imagen sea ligera y Caddy haga de proxy inverso.

### Paso 4 — Crear los `.env` reales en el servidor

```bash
# Worker (TODO secreto: rellena con tus claves reales)
cp worker/.env.example worker/.env
nano worker/.env

# Raíz: las dos NEXT_PUBLIC_* para el build de la web
cp .env.example .env
nano .env
```

Y pon tu dominio en el `Caddyfile` (cambia `gas.tudominio.com` por el tuyo) y tu email en
él para los avisos de Let's Encrypt. El prompt deja el `Caddyfile` preparado con esos dos
huecos señalados.

### Paso 5 — Levantar todo

```bash
docker compose up -d --build
```

- `--build` construye las imágenes (la primera vez tarda unos minutos).
- `-d` lo deja corriendo en segundo plano.

Comprueba que los tres contenedores están arriba:

```bash
docker compose ps
```

Y mira los logs si algo no va:

```bash
docker compose logs -f          # todos
docker compose logs -f worker   # solo el worker
docker compose logs -f caddy    # útil para ver si el certificado se emitió bien
```

Abre `https://gas.tudominio.com` en el navegador: deberías ver la app con el candado de
HTTPS. El worker, mientras, ya estará escuchando jobs de Supabase (no verás nada en web,
pero en `docker compose logs -f worker` verás "No hay jobs 'queued'." en bucle, que es lo
normal cuando está a la espera).

---

## 5B. Variante con Load Balancer (TLS externo)

Si tu infraestructura ya tiene un Load Balancer que gestiona HTTPS, usa este camino en
lugar de Caddy.

### Paso 0 — Configurar el Load Balancer

- Crea un **backend** / **service** que apunte a la IP privada de la VM donde corre Docker,
  puerto **3000**.
- Configura el **health check** del LB contra `http://<VM>:3000/api/health`. Espera respuesta
  HTTP 200.
- El LB debe terminar TLS: el tráfico entre Internet y el LB es HTTPS, y entre el LB y la
  VM es HTTP al puerto 3000.
- Asegúrate de que el firewall del LB/la red interna permite tráfico del LB a la VM en el
  puerto 3000.

### Paso 1 — Preparar la VM

Entra por SSH y asegúrate de que Docker está instalado (ver Paso 2 de la sección 5).

### Paso 2 — Traer el código y configurar secretos

```bash
git clone <url-de-tu-repo> gas
cd gas

cp .env.example .env
nano .env
# Rellena NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY

cp worker/.env.example worker/.env
nano worker/.env
# Rellena los secretos del worker
```

**No necesitas tocar el `Caddyfile`** en esta variante.

### Paso 3 — Levantar con docker-compose.lb.yml

```bash
docker compose -f docker-compose.lb.yml up -d --build
```

Esto levanta solo `web` (puerto 3000) y `worker`. Comprueba que están running:

```bash
docker compose -f docker-compose.lb.yml ps
docker compose -f docker-compose.lb.yml logs -f web
docker compose -f docker-compose.lb.yml logs -f worker
```

Comprueba que el health check responde desde la propia VM:

```bash
curl http://localhost:3000/api/health
# Debe devolver: {"status":"ok","service":"gas-web",...}
```

Cuando el LB vea el health check verde, empezará a mandar tráfico HTTPS a la app.

### Paso 4 — Firewall en la VM

```bash
ufw allow 22/tcp     # SSH
ufw allow from <IP-del-LB> to any port 3000  # solo el LB puede hablar con la web
ufw enable
```

Si no sabes la IP del LB, una alternativa rápida es limitar la red interna:
```bash
ufw allow 22/tcp
# Asegúrate de que la interfaz donde escucha Docker (generalmente docker0) puede seguir
# hablando; ufw por defecto no bloquea el tráfico local entre contenedores.
```

**Importante:** no expongas el puerto 3000 a Internet directamente; debe ser accesible solo
desde el Load Balancer.

---

### Paso 6 — Firewall (recomendado)

```bash
ufw allow 22/tcp     # SSH (no te cierres la puerta)
ufw allow 80/tcp     # HTTP (Caddy lo usa para el reto de Let's Encrypt)
ufw allow 443/tcp    # HTTPS
ufw enable
```

No abras el 3000: la web solo debe verse a través de Caddy, no directamente.

---

## 6. El día a día

```bash
# Actualizar tras cambios en el código
git pull
docker compose up -d --build

# Parar / arrancar
docker compose stop
docker compose start

# Reiniciar un servicio
docker compose restart worker

# Ver consumo
docker stats
```

Los contenedores llevan `restart: unless-stopped`, así que si el servidor se reinicia,
vuelven a arrancar solos. (Docker arranca con el sistema por defecto tras instalarlo con
el script oficial.)

---

## 7. Checklist antes de dar por hecho el despliegue

### Opción Caddy (servidor directo)

- [x] Los archivos Docker (`Dockerfile` web/worker, `docker-compose.yml`, `Caddyfile`,
      `.dockerignore`) existen en el repo.
- [ ] El DNS `gas.tudominio.com` → IP del VPS responde.
- [ ] `worker/.env` y `.env` (raíz) creados en el servidor con claves reales.
- [ ] Dominio y email puestos en el `Caddyfile`.
- [ ] `docker compose up -d --build` deja los 3 contenedores en `running`.
- [ ] `https://gas.tudominio.com` carga con candado.
- [ ] `docker compose logs -f worker` muestra el bucle de polling sin errores.
- [ ] Firewall con 22, 80 y 443 abiertos; 3000 cerrado.

### Opción Load Balancer (TLS externo)

- [x] `docker-compose.lb.yml` y endpoint `/api/health` existen en el repo.
- [ ] Backend/Service del LB apunta a la VM en el puerto 3000.
- [ ] Health check del LB configurado contra `http://<VM>:3000/api/health` (HTTP 200).
- [ ] `worker/.env` y `.env` (raíz) creados en el servidor con claves reales.
- [ ] `docker compose -f docker-compose.lb.yml up -d --build` deja `web` y `worker` en `running`.
- [ ] Desde la VM, `curl http://localhost:3000/api/health` responde OK.
- [ ] El LB marca el backend como sano/verde.
- [ ] `https://gas.tudominio.com` carga a través del LB.
- [ ] `docker compose -f docker-compose.lb.yml logs -f worker` muestra polling sin errores.
- [ ] Puerto 3000 de la VM accesible solo desde el LB, no desde Internet.

---

## 8. Coste aproximado

- VPS pequeño: **~4-8 €/mes** (Hetzner es el más barato).
- Dominio: **~10-15 €/año**.
- HTTPS: **gratis** (Let's Encrypt vía Caddy).
- Supabase / Apify / OpenRouter / HarvestAPI: lo que ya pagas, no cambia.

Total realista para empezar: **menos de 10 €/mes** además de lo que ya gastas en las APIs.
