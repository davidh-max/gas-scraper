# Paso 3 (verify) — brief de integración HarvestAPI + LLM

> Esto COMPLEMENTA `prompts/verify_decisor_llm.md` (que ya tienes): allí está el input
> reducido, el system prompt por área y el esquema de salida. Aquí solo lo que faltaba:
> **de dónde sale el perfil y cómo se llama a HarvestAPI**, más la lógica del paso.

## Objetivo del Paso 3 (con su lógica)

Es la capa de verificación de `run_layered_verification` en `worker/pipeline/verify.py`.
Para cada contacto **dudoso** que sale del Paso 2, enriquece el perfil y lo somete al
LLM para decidir `confirmed` / `uncertain` / `rejected`. Por capas de coste, en orden:

1. **Entran solo los dudosos.** No todos: procesa los contactos con
   `classification == revisar`, o `verify_flag == "verificar_empresa"`, o `decisor` con
   `heuristic_score` bajo. Un `decisor` con score alto puede saltarse esta capa (ahorro).
2. **Scrape enriquecido** del perfil con **HarvestAPI REST** (abajo). De ahí sale el
   perfil completo (about, experiencia, ubicación) que el Paso 2 no tenía.
3. **Re-check barato de empresa** con los datos nuevos: extrae el companyId del cargo
   actual con `canonical_company_id()` y compáralo con el canónico. Si es homónimo claro
   → `rejected` **sin gastar LLM**.
4. **LLM (OpenRouter)** solo si sigue dudoso: system prompt del área + input reducido
   (ver el otro doc) → JSON de veredicto.
5. **Persistir** 1 fila en `verifications` (`method = llm_web`, `verdict`, `confidence`,
   `signal_json` = JSON del LLM, `cost`) y mapear a `Classification`:
   `confirmed → decisor`, `uncertain → revisar`, `rejected → no conservar`.
6. **Cachear** por `cache_key` (persona + área) en `verification_cache` para no pagar
   dos veces el mismo perfil.

Regla de oro intacta: ante la duda → `revisar`; `rejected` solo para descalificador duro
(otra empresa confirmada o persona fuera de España).

## La fuente del perfil

El perfil a verificar es el del propio contacto: usa `Contact.linkedin_url` (la URL del
perfil de la persona que ya guardó el Paso 2) como entrada de la llamada.

## HarvestAPI — REST directa (esto es lo que faltaba)

⚠️ **Son dos superficies distintas del mismo proveedor. No las confundas:**
- **Paso 2 (búsqueda de empleados)** → Actor de **Apify** `harvestapi/linkedin-company-employees` (cliente Apify actual). **No se toca.**
- **Paso 3 (verify de UN perfil)** → **API REST directa** `api.harvest-api.com`. Cliente
  nuevo y fino; **no reutilices el cliente de Apify** para esto.

Endpoint:

```
GET https://api.harvest-api.com/linkedin/profile
Header:  X-API-Key: <HARVEST_API_KEY>
Query (al menos uno): url | publicIdentifier | profileId
```

Parámetros que SÍ usamos:
- `url` = `Contact.linkedin_url` (o `publicIdentifier` si lo tienes).
- `main=true` → devuelve la versión principal (hasta 5 experiencias, 2 educaciones…).
  **Cobra menos créditos y es suficiente** para verificar (cargo actual + ubicación +
  about + experiencia reciente). Úsalo.

Parámetros que NO usamos aquí:
- `findEmail` / `skipSmtp` → el email es del Paso 4 (enrich), no de verify. **No activar.**
- `includeAboutProfile` → no necesario.

Ejemplo (Python, como en el worker):

```python
import requests

def fetch_profile(linkedin_url: str, api_key: str) -> dict:
    r = requests.get(
        "https://api.harvest-api.com/linkedin/profile",
        headers={"X-API-Key": api_key},
        params={"url": linkedin_url, "main": "true"},
        timeout=30,
    )
    r.raise_for_status()
    return r.json()  # { "element": {...}, "status": "...", "error": "...", "query": {...} }
```

Config / secretos:
- Añade `HARVEST_API_KEY` a `worker/.env` y a `worker/.env.example` (clave nueva,
  **distinta** del `APIFY_TOKEN`). Léela desde `worker/config.py` (`get_settings`).

Manejo de respuesta y errores:
- El perfil va en `element`. Comprueba `status`/`error`: si la API falla o `element` es
  nulo, **no rompas ni borres** → registra el contacto como `uncertain` (no verificable)
  y sigue.
- ⚠️ **El esquema de la doc está abreviado.** Antes de fijar el mapeo, imprime UNA
  respuesta real y mira los campos que llegan de verdad (p. ej. el enlace de empresa del
  cargo actual puede venir como `companyLink` / `companyLinkedinUrl`). Para el match de
  empresa, saca el handle/id de esa URL con `canonical_company_id()` y pásalo al LLM como
  `empresa_company_id` / `empresa_handle`. Mapea de forma defensiva (campos que pueden
  faltar → trátalos como ausentes, motivo de duda, no de invento).

## Entregables de esta tanda

1. Cliente REST fino de HarvestAPI (`fetch_profile`) con `HARVEST_API_KEY` desde config.
2. `HARVEST_API_KEY` en `.env` + `.env.example`.
3. Implementar la capa en `run_layered_verification`: seleccionar dudosos → `fetch_profile`
   (`main=true`) → re-check companyId → construir input reducido → llamar OpenRouter con
   el system prompt del área → persistir `Verification` + actualizar `Classification`.
4. Caché en `verification_cache` por `cache_key`.
5. Detrás del flag `--use-fixtures`: con fixtures, leer un perfil de ejemplo de
   `worker/tests/fixtures/` en vez de llamar a la API real (probar gratis, como el resto).

No implementes el Paso 4 (teléfono/Robinson) aquí. Mantén la frontera limpia: la lógica
vive en `worker/pipeline/`.
