# Verificación de decisor con LLM (OpenRouter) — Paso 3

Diseño de la **capa LLM** del Paso 3 (`verify.py` → `VerificationMethod.llm_web`). El
LLM lee un perfil de LinkedIn (output de HarvestAPI) y decide, para un **área** y una
**empresa objetivo** dadas, si es **decisor**, si hay que **revisarlo** o si se
**descarta**. Filosofía heredada de las reglas de oro: *ante la duda, revisar; no se
borra a nadie salvo descalificador duro (otra empresa o fuera de España)*.

Mapeo con el código:

| Salida LLM (`verdict`) | `VerificationVerdict` | `Classification` final | ¿Conservar? |
|---|---|---|---|
| `confirmed` | `confirmed` | `decisor` | sí (Decisores) |
| `uncertain` | `uncertain` | `revisar` | sí (Revisar) |
| `rejected`  | `rejected`  | — | no (otra empresa / fuera de España) |

> Recomendación de coste: pásale al LLM **solo los dudosos** que sobreviven a las capas
> baratas (heurística + companyId), no todos los perfiles. Es la capa cara.

---

## 1) Qué enviar al LLM (input reducido)

**No mandes el JSON crudo.** El 90 % son imágenes, logos y `sizes` que no aportan y
disparan el coste. Extrae un objeto reducido con lo que decide la cuestión: **cargo
actual + empresa + ubicación**, y como apoyo `about`/skills/trayectoria.

Mapeo del output completo → input reducido:

| Campo reducido | Origen en el output de HarvestAPI |
|---|---|
| `nombre` | `firstName` + `lastName` |
| `headline` | `headline` |
| `headline_es` | `multiLocaleHeadline[]` con `locale = "es_ES"` (si existe) |
| `ubicacion` | `location.parsed` → `{ pais_code: countryCode, ciudad: city, pais: country }` + `location.linkedinText` |
| `linkedin_url` | `linkedinUrl` |
| `cargos_actuales[]` | `currentPosition[]` → `{ cargo: position, empresa: companyName, company_id: companyId, company_handle: companyUniversalName, desde: startDate.text, duracion: duration, descripcion: description (recortada ~400) }` |
| `about` | `about` (recortado ~700-800 caracteres) |
| `top_skills` | `topSkills` |
| `experiencia_reciente[]` *(opcional)* | `experience[0:3]` → solo `{ cargo, empresa, desde, hasta }` (sin `description`) |
| `honores` *(opcional, señal menor)* | `honorsAndAwards[].title` (+ `issuedBy`) |

**Descartar siempre** (ruido / coste): `*Logo`, `*Picture`, `photo`, `sizes`,
`profilePicture`, `coverPicture`, `certifications`, `volunteering`, `publications`,
`courses`, `patents`, `languages`, `causes`, `organizations`,
`receivedRecommendations`, `profileActions`, `composeOptionType`, `moreProfiles`,
`registeredAt`, `education` (salvo que quieras una línea), y las `description` largas de
toda la `experience` pasada (quédate solo con la del cargo actual, recortada).

Variables de la **empresa objetivo** (vienen del pipeline, no del perfil): nombre,
handle y `companyId` canónico de la empresa que se buscó.

---

## 2) Esquema de salida (structured output)

El LLM responde **solo** este JSON (encaja con `Verification.signal_json` + `verdict` +
`confidence`):

```json
{
  "verdict": "confirmed | uncertain | rejected",
  "confidence": 0.0,
  "es_decisor_area": true,
  "cargo_actual_detectado": "string",
  "empresa_coincide": "si | no | sin_dato",
  "ubicacion_ok": true,
  "motivo": "1 frase en español explicando la decisión"
}
```

`response_format` para OpenRouter (fuerza el formato):

```json
{
  "type": "json_schema",
  "json_schema": {
    "name": "verificacion_decisor",
    "strict": true,
    "schema": {
      "type": "object",
      "properties": {
        "verdict": { "type": "string", "enum": ["confirmed", "uncertain", "rejected"] },
        "confidence": { "type": "number", "minimum": 0, "maximum": 1 },
        "es_decisor_area": { "type": "boolean" },
        "cargo_actual_detectado": { "type": "string" },
        "empresa_coincide": { "type": "string", "enum": ["si", "no", "sin_dato"] },
        "ubicacion_ok": { "type": ["boolean", "null"] },
        "motivo": { "type": "string" }
      },
      "required": ["verdict", "confidence", "es_decisor_area",
        "cargo_actual_detectado", "empresa_coincide", "ubicacion_ok", "motivo"],
      "additionalProperties": false
    }
  }
}
```

---

## 3) System prompt (con variables)

> Variables a sustituir: `{{area_nombre}}`, `{{ubicacion_requerida}}` (p. ej. "España"),
> `{{empresa_objetivo}}`, `{{empresa_handle}}`, `{{empresa_company_id}}`,
> `{{perfil_decisor_area}}` (bloque del apartado 4). Opcional:
> `{{company_match_previo}}` (resultado del match determinista de companyId, si ya lo
> tienes, para que el LLM no lo rehaga).

```
Eres un analista de prospección B2B. Verificas si un perfil de LinkedIn es un
DECISOR del área "{{area_nombre}}" en la empresa objetivo, con la PERSONA ubicada en
{{ubicacion_requerida}}. Decides de forma conservadora: si no está claro, "uncertain".
No inventas datos: si falta información relevante, es motivo de duda, no de afirmación.
Evalúas SIEMPRE el cargo ACTUAL, no los pasados.

EMPRESA OBJETIVO
- Nombre: {{empresa_objetivo}}
- Handle de LinkedIn: {{empresa_handle}}
- companyId canónico: {{empresa_company_id}}
- Match de empresa ya calculado (si se aporta): {{company_match_previo}}

QUÉ ES UN DECISOR DE "{{area_nombre}}"
{{perfil_decisor_area}}

REGLAS DE DECISIÓN (en este orden)
1. EMPRESA: el cargo ACTUAL debe ser en la empresa objetivo. Compara company_id /
   handle / nombre del puesto actual con los de arriba. Si el company_id actual es
   DISTINTO al canónico -> "rejected" (otra empresa, homónimo). Si coincide, o no hay
   company_id pero el nombre encaja claramente, continúa.
2. UBICACIÓN: la PERSONA debe estar en {{ubicacion_requerida}} (usa el país del
   perfil, NO el de la empresa, que puede ser global). Si está claramente fuera ->
   "rejected". Si no consta -> trátalo como duda.
3. ROL: evalúa el cargo ACTUAL contra la definición de arriba.
   - Encaja claramente como responsable del área -> "confirmed".
   - Encaja pero con dudas de nivel o alcance (mando intermedio en empresa grande,
     título ambiguo, datos escasos) -> "uncertain".
   - Es de otra área, perfil individual sin equipo, consultor / preventa / interino,
     o no decide en el área -> "uncertain" (no lo descartes: lo revisa una persona).
4. Solo el cargo ACTUAL cuenta. Un ex-responsable que hoy ocupa otro puesto no es
   decisor actual.
5. ANTE CUALQUIER DUDA -> "uncertain". Reserva "rejected" SOLO para descalificadores
   duros: empresa distinta confirmada, o persona fuera de {{ubicacion_requerida}}.

SALIDA
Responde EXCLUSIVAMENTE con el JSON del esquema (sin texto adicional, sin markdown).
confidence = tu seguridad en el veredicto (0-1). empresa_coincide: "si" si el cargo
actual es en la empresa objetivo, "no" si es otra, "sin_dato" si no puedes saberlo.
ubicacion_ok: true/false según {{ubicacion_requerida}}, o null si no consta.
```

---

## 4) Bloques por área — valor de `{{perfil_decisor_area}}`

Inyecta el bloque del área del job. (Derivados de las reglas `classify` de
`area_profiles.py`, en lenguaje natural para el LLM.)

**IT / Tecnología** (`{{area_nombre}}` = "Tecnología / IT")
```
SÍ decisor: máximo o alto responsable de la tecnología/sistemas/IT INTERNOS de la
empresa: CIO, CTO, CISO, CDO, Director de Sistemas/IT/Tecnología, Head of
IT/Technology/Data/Infraestructura/Plataforma/Engineering, Director o Responsable de
Transformación Digital, IT Manager si lidera el área.
NO / revisar: roles que tocan tecnología pero no la deciden dentro de la empresa:
consultoría/preventa, ventas o comercial de IT, marketing, UX/diseño, research,
ingeniero o desarrollador individual sin mando, perfiles de IT en finanzas/RRHH.
Matiz: en pymes, "Responsable de Sistemas" puede ser el máximo de IT (decisor); un
técnico/administrador de sistemas sin equipo es revisar.
```

**RRHH** (`{{area_nombre}}` = "Recursos Humanos")
```
SÍ decisor: CHRO, Director de RRHH / Recursos Humanos, Head of HR / People, Director
de Personas / Talento, People & Culture Director, Chief People Officer.
NO / revisar: recruiter o técnico de selección sin mando, HR Business Partner
individual, nómina / administración de personal, prácticas/becario, o roles de otra área.
Matiz: en pymes, "Responsable de RRHH" que lidera el área es decisor.
```

**Financiero** (`{{area_nombre}}` = "Financiero")
```
SÍ decisor: CFO, Director Financiero / de Finanzas, Director Administrativo-Financiero
o Económico-Financiero, Head of Finance, Financial Controller / Controller si lidera,
Director de Contabilidad / Tesorería / Control de Gestión.
NO / revisar: contable, auxiliar, becario, analista financiero individual, controller
júnior sin equipo, finanzas embebidas en otra área, o roles de ventas/compras.
```

**Operaciones** (`{{area_nombre}}` = "Operaciones")
```
SÍ decisor: COO, Director de Operaciones / Industrial / de Planta / de Producción / de
Logística, Supply Chain Director, Head of Operations / Supply Chain.
NO / revisar: jefe de turno o de línea sin alcance de compañía, técnico de operaciones,
coordinador individual, o roles de otra área.
```

**Ventas** (`{{area_nombre}}` = "Ventas / Comercial")
```
SÍ decisor: CRO, Chief Commercial Officer, Director Comercial / de Ventas / de
Desarrollo de Negocio, Head of Sales, VP Sales, Country Manager si lidera ventas,
Director de Grandes Cuentas. (Un "Director Comercial y de Marketing" SÍ vale.)
NO / revisar: Account Manager / Sales Manager individual sin equipo, KAM individual,
comercial / representante de ventas, preventa, SDR/BDR, gerente o director de TIENDA.
```

**Marketing** (`{{area_nombre}}` = "Marketing")
```
SÍ decisor: CMO, Director de Marketing / Comunicación / Marca, Head of Marketing /
Growth, Director de Marketing Digital. (Un "Director de Marketing y Comunicación" o un
"Director Comercial y de Marketing" SÍ vale.)
NO / revisar: community / social media manager, content creator, copywriter, diseñador,
especialista SEO/SEM individual, o perfiles puramente operativos sin mando.
```

**Compras** (`{{area_nombre}}` = "Compras")
```
SÍ decisor: CPO (Chief Procurement Officer), Director de Compras / Aprovisionamiento,
Head of Procurement / Purchasing, Strategic Sourcing Director, Director de Sourcing o
de Categoría.
NO / revisar: comprador / buyer individual, técnico de compras, administrativo de
compras, o roles de otra área.
```

**Máximos decisores** (`{{area_nombre}}` = "Máximo responsable de la empresa")
```
SÍ decisor: quien dirige la EMPRESA entera: CEO, Director General / Ejecutivo,
Consejero Delegado, Managing Director, Fundador / Owner / Propietario / Dueño,
Presidente Ejecutivo, Administrador Único.
NO / revisar: directores de área (CTO/CFO/CMO/COO, Director de X), VPs; gerentes o
directores de tienda/franquicia, franquiciados; consejeros no ejecutivos /
independientes, accionistas / socios sin rol ejecutivo, board members.
Matiz: una señal fuerte de cúpula (CEO/Fundador) manda sobre el ruido de "franquicia".
```

---

## 5) Plantilla de mensaje de usuario

```
Perfil a evaluar (JSON reducido):
{{perfil_json_reducido}}
```

---

## 6) Ejemplo completo (Beatriz — CIO de Amadeus, área IT)

Input reducido que se le pasa al LLM:

```json
{
  "nombre": "Beatriz Méndez-Villamil",
  "headline": "C-Level Executive & Advisory Board Member | Digital, AI and Technology Strategy | ... | Global CIO at Amadeus",
  "headline_es": "Directiva C-Level y consejera | Estrategia Digital, IA y Tecnología | ... | CIO Global en Amadeus",
  "ubicacion": { "pais_code": "ES", "ciudad": "Madrid", "pais": "Spain", "texto": "Madrid, Community of Madrid, Spain" },
  "linkedin_url": "https://www.linkedin.com/in/beatrizmvg",
  "cargos_actuales": [
    {
      "cargo": "Global CIO at Amadeus",
      "empresa": "Amadeus",
      "company_id": "2780",
      "company_handle": "amadeus",
      "desde": "Jul 2024",
      "duracion": "2 yrs",
      "descripcion": "I lead Amadeus' global digital, data, AI and innovation strategy..."
    }
  ],
  "about": "C-Level Executive and Industrial Engineer... I currently serve as Global CIO at Amadeus...",
  "top_skills": "Global Leadership • Digital Transformation • Artificial Intelligence Strategy • IT Risk Management • Corporate Governance",
  "honores": ["Best CIO 2026 — Forbes"]
}
```

Con empresa objetivo `Amadeus` / handle `amadeus` / companyId `2780`, salida esperada:

```json
{
  "verdict": "confirmed",
  "confidence": 0.97,
  "es_decisor_area": true,
  "cargo_actual_detectado": "Global CIO at Amadeus",
  "empresa_coincide": "si",
  "ubicacion_ok": true,
  "motivo": "Global CIO de Amadeus (companyId 2780 coincide), máxima responsable de IT, ubicada en Madrid, España."
}
```

---

## 7) Notas de implementación (OpenRouter)

- **Modelo**: reutiliza el que ya usáis vía OpenRouter para el resolver (familia Gemini
  Flash o un "mini" equivalente). Para esta tarea de clasificación con salida
  estructurada, un modelo barato basta; no necesitas el más caro.
- **Parámetros**: `temperature: 0` (decisión determinista), `response_format` con el
  `json_schema` del apartado 2, `max_tokens` bajo (la salida es pequeña).
- **Coste**: el input reducido (~500-900 tokens) + system (~700) sale muy barato;
  mandar el JSON crudo costaría ~10×. Manda el reducido.
- **Solo dudosos**: invoca esta capa solo para los `uncertain` que sobreviven a la
  heurística y al companyId-match (regla del `run_layered_verification`).
- **Caché**: guarda por `cache_key` (persona + área) en `verification_cache` para no
  pagar dos veces el mismo perfil.
- **Persistencia**: 1 fila en `verifications` con `method = llm_web`, `verdict`,
  `confidence`, `signal_json` (todo el JSON de salida) y `cost` (el de OpenRouter).
- **Homónimos**: el rechazo duro por `companyId` distinto ya lo hace `verify.py` de
  forma determinista; aquí el LLM lo usa como apoyo y para cuando falte el `companyId`.
```
