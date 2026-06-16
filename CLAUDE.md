# GAS — guía para Claude Code (y para el equipo)

GAS hace **prospección B2B por delegación** para 7-8 clientes. A partir de una
lista heterogénea de empresas (razón social / CIF / nombre comercial / a veces ya
la URL de LinkedIn) produce una lista de **decisores verificados, lista para
llamar**.

Pipeline por empresa:

1. **Resolver** la URL de LinkedIn de la empresa (input heterogéneo → URL fiable,
   con `resolution_method` y `resolution_confidence`).
2. **Buscar** al decisor del área elegida con el Actor de Apify
   `harvestapi/linkedin-company-employees` (ID `Vb6LZkh4EqRlR0Ka9`).
3. **Fallback** si la pasada principal no devuelve nada.
4. **Verificar por capas** (Paso 3 — *stub en esta tanda*): heurística gratis →
   re-scrape barato → escalado a LLM/web solo para dudosos.
5. **Teléfono + cumplimiento** (Paso 4 — *stub en esta tanda*): número + Lista
   Robinson + base legal RGPD.
6. **Salida**: Excel (Decisores / Revisar / Sin resultado) + estado en BD.

---

## 🟡 REGLAS DE ORO (no negociables)

Estas reglas son producto de pruebas reales con el Actor. Romperlas hace que la
búsqueda devuelva casi todo a 0 o que se dispare el coste.

1. **Una sola llamada al Actor por pasada y por lote.** Todas las URLs van en el
   campo `companies` de UNA llamada, con `companyBatchMode: "one_by_one"`. El
   Actor procesa cada empresa por separado (resultados etiquetados por empresa)
   pero en un único run. **Nunca** una llamada por empresa (pasar de N llamadas a
   1 ahorra créditos y tokens).
2. **No mezclar `jobTitles` con `seniorityLevelIds` en la misma llamada.**
   Combinarlos es un `AND` demasiado estricto → casi todo 0. Van en **pasadas
   separadas**: Pasada **A** (`jobTitles`) y Pasada **B** (`seniorityLevelIds`).
3. **Al leer el dataset usar `omit`, nunca `fields`.** La proyección de campos
   anidados rompe arrays como `currentPositions`. Usar
   `omit = "summary,pictureUrl,openProfile,premium,id"`.
4. **Agrupar cada item por `_meta.query.currentCompanies[0]`** (la URL que se
   consultó), no a mano. En `one_by_one` cada item viene etiquetado con su
   empresa.
5. **`profileScraperMode: "Short ($4 per 1k)"`.** Trae nombre, apellidos,
   ubicación, URL de perfil y `currentPositions[].title` — suficiente para
   clasificar. No usar `Full`.
6. **Anti-homónimos por `companyId` canónico.** Si el `companyId` del perfil
   difiere del canónico de la empresa buscada → **descartar** (es otra empresa).
   Si **falta** el `companyId` y la empresa sí tiene uno → **degradar a
   `revisar`** con flag `verificar_empresa` (no se borra, se señala). El canónico
   es el `companyId` **numérico** real de la empresa buscada cuando la resolución
   lo proporciona; si solo se tiene un handle de vanidad (no comparable con los ids
   numéricos de los perfiles), se usa como respaldo la **moda** de los `companyId`
   que traen los perfiles devueltos para esa empresa.
7. **Ante la duda, `revisar`. Nunca se borra a nadie.** Mejor que el cliente
   descarte un dudoso a colar un falso positivo.
8. **Antes de gastar en un lote, validar la cuenta Apify** con una llamada mínima
   a `https://www.linkedin.com/company/amadeus/`. Si devuelve 0 items en un run
   de ~3-5 s → problema de cuenta (sin saldo, plan free o permisos del Actor sin
   aprobar), no de configuración. Usar SIEMPRE el handle exacto de Amadeus.

### Plantillas de input del Actor (referencia)

```jsonc
// Pasada A — por título (principal). NO añadir functionIds/seniorityLevelIds.
{
  "companies": ["<URL_1>", "<URL_2>", "..."],
  "locations": ["Spain"],
  "jobTitles": ["CEO", "Director General", "..."],   // de area_profiles.params
  "profileScraperMode": "Short ($4 per 1k)",
  "companyBatchMode": "one_by_one",
  "maxItemsPerCompany": 6,
  "maxItems": <n_empresas * 6>
}

// Pasada B — por seniority (refuerzo / fallback). NO añadir jobTitles.
{
  "companies": ["<URLs vacías de A>"],
  "locations": ["Spain"],
  "seniorityLevelIds": ["320", "310"],               // de area_profiles.params
  "profileScraperMode": "Short ($4 per 1k)",
  "companyBatchMode": "one_by_one",
  "maxItemsPerCompany": 6,
  "maxItems": <n_empresas_vacias * 6>
}
```

`seniorityLevelIds`: `320` Owner/Partner · `310` CXO · `300` VP · `220` Director ·
`210` Experienced Manager. `functionIds`: `13` Information Technology.

---

## Arquitectura (no desviarse sin avisar)

```
┌────────────┐   inserta job 'queued'   ┌────────────┐   polling   ┌──────────────┐
│  Next.js   │ ───────────────────────▶ │  Supabase  │ ◀────────── │ Python worker│
│ (web/, TS) │ ◀─── lee estado/datos ── │ (Postgres) │ ── escribe ─▶ (worker/)    │
└────────────┘                          └────────────┘             └──────────────┘
        El front y el worker NO comparten código. Solo la base de datos.
```

- **web/** — Next.js (App Router, TS strict). Interfaz + API ligera. Donde el
  equipo opera sin tocar código. Despliega en Vercel/Cloudflare Pages.
- **Supabase** — Postgres + Auth + Storage + **cola de jobs**. Proyecto ref
  `ftpgnimyjxlomjfdqfqy` (`https://ftpgnimyjxlomjfdqfqy.supabase.co`). Esquema en
  `supabase/schema_v2.sql` (ya aplicado).
- **worker/** — Python 3.11+, **proceso de larga ejecución** (no serverless: un
  lote de 100-200 empresas tarda minutos y hace muchas llamadas externas).
  Arranque: `python -m worker.main`. Toda la **lógica de negocio** vive en
  `worker/pipeline/`; el worker solo orquesta y persiste.
- **Apify** — vía API REST (cliente fino en `worker/pipeline/apify/client.py`).

### Frontera limpia

El front inserta una fila `jobs` con estado `queued`. El worker hace polling,
procesa y escribe `companies` / `contacts` / `job_events` y sube el Excel a
Storage (bucket `resultados`). **No** hay imports cruzados entre `web/` y
`worker/`.

---

## Máquina de estados de `jobs.status`

```
queued → resolving → searching → verifying → enriching → done
                                                       ↘ error
                          (cualquiera) → cancelled
```

El worker avanza el estado y **registra cada cambio en `job_events`** (con
`from_status`, `to_status`, contadores y mensaje).

---

## Qué es DATO y qué es CÓDIGO

- **El área es DATO.** `area_profiles.params` (jsonb) contiene los parámetros del
  Actor del área (`jobTitles`, `seniorityLevelIds`, `functionIds`) y las **reglas
  de clasificación** (`include` / `exclude` por palabras clave). Añadir un área
  nueva = insertar una fila, **no** tocar código.
- `classify.py` es **determinista y parametrizado** por `area_profiles.params`.

---

## Convenciones de código

- **Python**: type hints en todo. `ruff` + `pytest`. Lógica de negocio SOLO en
  `worker/pipeline/`. Pydantic para los modelos (espejo de las tablas).
- **TypeScript**: `strict: true`, **sin `any`**. Tipos espejo del esquema en
  `web/src/types/db.ts`.
- **Secretos**: `.env` (worker) y `.env.local` (web), ambos con `*.example`
  versionado y los reales en `.gitignore`. **Nunca** claves en el repo.
- **Commits pequeños**, en español, con prefijo de ámbito (`worker:`, `web:`,
  `chore:`).

---

## Modo fixtures (probar gratis, sin gastar Apify)

`--use-fixtures` hace que el resolver y el cliente de Apify lean
`worker/tests/fixtures/*.json` en vez de llamar a los servicios reales. La
rebanada vertical (Pasos 1-2-2b → clasificación → Excel) corre end-to-end sin
coste. La llamada real queda detrás de ese flag.

```bash
# CLI end-to-end con fixtures
python -m worker.pipeline.cli run worker/tests/fixtures/companies_sample.csv --area it --use-fixtures
# Worker contra Supabase, procesando con fixtures
python -m worker.main --use-fixtures
```

---

## Estado de esta tanda (scaffold)

- **Real**: Pasos 1-2-2b con fixtures, clasificación determinista, confidence
  fuzzy, Excel de 3 hojas, lectura de `area_profiles`, orquestación, persistencia,
  worker loop, y toda la web (login, dashboard, crear job, progreso, revisión,
  descarga). **Paso 3** completo (companyId-match determinista + capa LLM: enriquece el
  perfil con HarvestAPI REST `harvest.py`, re-chequea empresa, y somete los dudosos al
  LLM vía OpenRouter `verify_llm.py`; cachea en `verification_cache` y persiste filas en
  `verifications`). Corre gratis con `--use-fixtures`.
- **Stub (firma + `# TODO`)**: llamada real al SERP (`resolver/apify_serp.py`),
  llamada real al Actor de empleados (`apify/client.py`, `apify/employees.py`),
  estimador de coste y validación de cuenta Apify.
- **Fuera de alcance (descartado)**: **Paso 4** (teléfono + Lista Robinson + RGPD,
  `enrich_phone.py`) queda como stub no-op. El andamiaje (`phones`, estado `enriching`)
  sigue en BD/web por si se retoma.

Ver `README.md` (TODO list) para la lista completa de pendientes.
