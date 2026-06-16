# Desplegar GAS en un servidor con Docker

Guía para llevar GAS de tu portátil a un VPS, dockerizado y con HTTPS automático.
Pensada para alguien que no ha desplegado con Docker antes. **No tienes que escribir
los `Dockerfile` tú**: para eso está el `PROMPT-OPENCODE.md` (se lo pegas a opencode y
los genera). Esta guía explica **cómo funciona** y **qué hacer en el servidor**.

---

## 1. Qué vamos a montar

Tu app tiene dos piezas que solo se hablan a través de Supabase (que vive en la nube de
Supabase, así que **no se dockeriza**):

- **web/** — la interfaz (Next.js 14). Es lo que abre la gente en el navegador.
- **worker/** — un proceso Python que corre en bucle, coge los jobs `queued` de Supabase
  y los procesa. No tiene web, no abre ningún puerto: solo trabaja.

En el servidor levantaremos **tres contenedores** con un único comando:

```
                    Internet (tu dominio, https://gas.tudominio.com)
                              │
                              ▼
                     ┌─────────────────┐
                     │     caddy       │  ← reverse proxy: HTTPS automático (puertos 80/443)
                     └────────┬────────┘
                              │ (red interna de Docker)
                              ▼
                     ┌─────────────────┐
                     │      web        │  ← Next.js, puerto 3000 (NO expuesto a Internet)
                     └─────────────────┘

                     ┌─────────────────┐
                     │     worker      │  ← Python en bucle. Sin puertos. Solo procesa jobs.
                     └─────────────────┘
                              │
                              ▼
              Supabase (nube)  +  Apify / OpenRouter / HarvestAPI  (APIs externas)
```

**Caddy** es la pieza nueva: es un servidor que se pone delante de la web, gestiona el
dominio y saca **certificado HTTPS gratis y automático** (Let's Encrypt). Tú solo le dices
tu dominio y él se encarga del candado.

---

## 2. Docker en un minuto (los 3 conceptos)

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

> Importante: los archivos Docker (los `Dockerfile`, `docker-compose.yml`, `Caddyfile`)
> tienen que existir ya en el repo. Genera primero esos archivos con opencode
> (`PROMPT-OPENCODE.md`), haz commit, y luego clona/sube.

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

- [ ] opencode ha generado los Dockerfile, `docker-compose.yml`, `Caddyfile` y
      `.dockerignore`, y has hecho commit.
- [ ] El DNS `gas.tudominio.com` → IP del VPS responde.
- [ ] `worker/.env` y `.env` (raíz) creados en el servidor con claves reales.
- [ ] Dominio y email puestos en el `Caddyfile`.
- [ ] `docker compose up -d --build` deja los 3 contenedores en `running`.
- [ ] `https://gas.tudominio.com` carga con candado.
- [ ] `docker compose logs -f worker` muestra el bucle de polling sin errores.
- [ ] Firewall con 22, 80 y 443 abiertos; 3000 cerrado.

---

## 8. Coste aproximado

- VPS pequeño: **~4-8 €/mes** (Hetzner es el más barato).
- Dominio: **~10-15 €/año**.
- HTTPS: **gratis** (Let's Encrypt vía Caddy).
- Supabase / Apify / OpenRouter / HarvestAPI: lo que ya pagas, no cambia.

Total realista para empezar: **menos de 10 €/mes** además de lo que ya gastas en las APIs.
