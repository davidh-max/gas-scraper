# GAS — Prospección B2B por delegación

Monorepo con tres piezas que **solo comparten la base de datos** (frontera limpia):

- **`web/`** — Next.js (App Router, TypeScript strict). Interfaz del equipo.
- **`worker/`** — Python 3.11+. Proceso de larga ejecución que toma jobs `queued`
  de Supabase y ejecuta el pipeline.
- **`supabase/`** — `schema_v2.sql`, copia de referencia del esquema (ya aplicado).

Las reglas de negocio y de uso del Actor de Apify están en **[`CLAUDE.md`](CLAUDE.md)**.

```
web (Next.js) ──insert job 'queued'──▶ Supabase (Postgres) ◀──polling/escribe── worker (Python)
```

---

## Requisitos

- Node ≥ 18 y npm (web)
- Python ≥ 3.11 (worker)
- Un proyecto Supabase con `supabase/schema_v2.sql` aplicado
  (proyecto actual: ref `ftpgnimyjxlomjfdqfqy`)

> **Secretos:** nunca van en el repo. Cópialos a `worker/.env` y `web/.env.local`
> (ambos en `.gitignore`). Las claves `anon` y `service_role` están en Supabase →
> Project Settings → API.

---

## Worker (Python)

### 1. Instalar

```bash
cd worker
python3 -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
```

### 2. Variables de entorno

```bash
cp .env.example .env
# rellena SUPABASE_SERVICE_ROLE_KEY y (para modo live) APIFY_TOKEN
```

### 3. Tests

```bash
pytest -q          # 44 tests: classify, verify (companyId), confidence
ruff check .       # lint
```

### 4. CLI con fixtures (gratis, sin Apify)

```bash
python -m worker.pipeline.cli run tests/fixtures/companies_sample.csv \
    --area it --backup maximos --use-fixtures --out out/Decisores_GAS.xlsx
```

Genera un `.xlsx` de 3 hojas (**Decisores / Revisar / Sin resultado**) e imprime un
resumen JSON. No toca la red.

### 5. Worker loop (cola de Supabase)

```bash
# procesa jobs 'queued' usando fixtures (no gasta Apify), uno y sale:
python -m worker.main --use-fixtures --once
# loop continuo:
python -m worker.main --use-fixtures
# modo live (cuando esté implementado el path real de Apify):
python -m worker.main
```

El worker reclama el job `queued` más antiguo, avanza la máquina de estados
(`queued → resolving → searching → verifying → enriching → done`), registra cada
cambio en `job_events`, escribe `companies`/`contacts`, sube el Excel al bucket
`resultados` y deja el job en `done` con sus contadores.

> Para probar el loop, crea un job desde la web (o inserta una fila en `jobs` +
> filas en `companies`) con `use_fixtures = true`.

---

## Web (Next.js)

### 1. Instalar

```bash
cd web
npm install
```

### 2. Variables de entorno

```bash
cp .env.local.example .env.local
# rellena NEXT_PUBLIC_SUPABASE_ANON_KEY
```

### 3. Arrancar

```bash
npm run dev          # http://localhost:3000
npm run build        # build de producción (incluye type-check)
npm run lint
```

Crea un usuario en Supabase → Authentication para poder hacer login. Flujo:
**Login → Dashboard (jobs por cliente) → Nuevo job → Progreso → Revisar → Descargar**.

---

## Estado de esta tanda

| Pieza | Estado |
|---|---|
| Pasos 1-2-2b con fixtures, clasificación, confidence, Excel 3 hojas | ✅ real |
| Orquestación + worker loop + persistencia + máquina de estados | ✅ real |
| Web completa (login, dashboard, crear, progreso, revisión, descarga) | ✅ real |
| Llamada real a Apify (Actor empleados + SERP) | 🟡 stub tras flag |
| Paso 3 (verificación por capas) | 🟡 stub (+ companyId-match real) |
| Paso 4 (teléfono + Robinson + RGPD) | 🟡 stub |
| Estimador de coste / validación de cuenta Apify | 🟡 aproximado / firma |

### TODO (siguiente fase)

Buscar `# TODO` en el repo. Resumen:

- **Apify live** (`worker/pipeline/apify/client.py`): verificar el flujo real
  `run-sync-get-dataset-items` con `omit`, polling y manejo de errores de cuenta;
  `validate_account()` con la llamada mínima a Amadeus.
- **SERP de resolución** (`worker/pipeline/resolver/apify_serp.py`): llamada real al
  Actor SERP + cacheo en `company_url_cache`.
- **Paso 3 — verificación por capas** (`worker/pipeline/verify.py`,
  `run_layered_verification`): heurística → re-scrape barato → LLM/web para dudosos,
  con coste y `verification_cache`; persistir filas en `verifications`.
- **Paso 4 — teléfono** (`worker/pipeline/enrich_phone.py`): número, tipo, Lista
  Robinson y base legal RGPD; persistir filas en `phones`.
- **Estimador de coste** (`web/src/lib/cost.ts`): calibrar la tarifa real de
  `one_by_one` y el nº medio de pasadas.
- **Persistencia ampliada** (`worker/worker/main.py`): insertar `verifications` y
  `phones` (requieren los ids de contacto recién creados).
- **`heuristic_score`** (`worker/pipeline/classify.py`): sustituir el score coarse
  por uno calibrado en el Paso 3.
- **RLS**: endurecer las policies por `client_id` (las actuales son mínimas).

---

## Criterios de aceptación (esta tanda)

1. `pytest` pasa (classify, verify, confidence). ✅
2. La CLI con fixtures genera el `.xlsx` de 3 hojas. ✅
3. `worker/main.py --use-fixtures` procesa un job `queued`, escribe
   `companies`/`contacts`/`job_events`, sube el Excel y deja el job en `done`.
   *(Requiere `SUPABASE_SERVICE_ROLE_KEY` en `worker/.env`.)*
4. La web arranca, login funciona, dashboard lista jobs, crear job inserta `queued`,
   el progreso refleja el estado, la revisión actualiza `contacts.status`, y la
   descarga baja el Excel. *(Requiere `NEXT_PUBLIC_SUPABASE_ANON_KEY` en `.env.local`.)*
