-- Migración: siembra las 6 áreas que faltaban en `area_profiles`.
--
-- Motivo: el worker (worker/pipeline/area_profiles.py DEFAULT_AREA_PROFILES) tiene 8
-- áreas, pero el seed de schema_v2.sql (y por tanto la BD ya aplicada) solo tenía 2
-- ('it', 'maximos'). En modo normal la web lee las áreas de esta tabla, así que el
-- desplegable 'Área del decisor' solo mostraba esas dos. Esto añade las que faltaban.
-- Idempotente: re-ejecutar re-sincroniza params/nombre/descripción con el worker.

insert into public.area_profiles (key, name, description, params) values
(
  'rrhh',
  'Decisores RRHH (España)',
  'CHRO/Director de RRHH/Head of People/Director de Talento y equivalentes, en España.',
  $json$
  {
    "locations": [
      "Spain"
    ],
    "pass_a": {
      "functionIds": [
        "12"
      ],
      "seniorityLevelIds": [
        "310",
        "300",
        "220",
        "210"
      ]
    },
    "pass_b": {
      "jobTitles": [
        "CHRO",
        "Chief People Officer",
        "Director de Recursos Humanos",
        "Director de RRHH",
        "HR Director",
        "Head of HR",
        "Head of People",
        "Director de Personas",
        "Director de Talento",
        "People & Culture Director",
        "Responsable de Recursos Humanos",
        "HR Manager"
      ]
    },
    "classify": {
      "clevel_acr": [
        "chro"
      ],
      "clevel_phrases": [
        "chief people",
        "chief human resources",
        "chief hr",
        "chief talent"
      ],
      "strong": [
        "director de recursos humanos",
        "director de rrhh",
        "directora de recursos humanos",
        "directora de rrhh",
        "hr director",
        "director of hr",
        "head of hr",
        "head of people",
        "people director",
        "director de personas",
        "responsable de recursos humanos",
        "responsable de rrhh",
        "director de talento",
        "head of talent",
        "people & culture",
        "people and culture",
        "director de gestión de personas",
        "director de gestion de personas",
        "human resources director",
        "director de desarrollo de personas"
      ],
      "exclude": [
        "sales",
        "ventas",
        "comercial",
        "marketing",
        "finance",
        "financ",
        "contab",
        "legal",
        "jurídic",
        "juridic",
        "compras",
        "procurement",
        "purchasing",
        "operaciones",
        "operations",
        "logístic",
        "logistic",
        "sistemas",
        "tecnolog"
      ],
      "lead_words": [
        "director",
        "directora",
        "manager",
        "head",
        "lead",
        "responsable",
        "jefe",
        "jefa",
        "chief",
        "vp"
      ],
      "domain_acr": [
        "rrhh",
        "rh",
        "hr",
        "hrbp"
      ],
      "domain_sub": [
        "recursos humanos",
        "personas",
        "talento",
        "talent",
        "people",
        "selección",
        "seleccion",
        "formación",
        "formacion",
        "relaciones laborales",
        "nómina",
        "nomina",
        "cultura",
        "people & culture"
      ]
    }
  }
  $json$::jsonb
),
(
  'financiero',
  'Decisores Financiero (España)',
  'CFO/Director Financiero/Director de Finanzas/Controller y equivalentes, en España.',
  $json$
  {
    "locations": [
      "Spain"
    ],
    "pass_a": {
      "functionIds": [
        "10"
      ],
      "seniorityLevelIds": [
        "310",
        "300",
        "220",
        "210"
      ]
    },
    "pass_b": {
      "jobTitles": [
        "CFO",
        "Chief Financial Officer",
        "Director Financiero",
        "Director de Finanzas",
        "Finance Director",
        "Head of Finance",
        "Director Administrativo Financiero",
        "Director Económico Financiero",
        "Financial Controller",
        "Controller",
        "Responsable Financiero"
      ]
    },
    "classify": {
      "clevel_acr": [
        "cfo"
      ],
      "clevel_phrases": [
        "chief financial",
        "chief finance"
      ],
      "strong": [
        "director financiero",
        "director de finanzas",
        "finance director",
        "head of finance",
        "director administrativo financiero",
        "director económico financiero",
        "director economico financiero",
        "director de administración y finanzas",
        "director de administracion y finanzas",
        "financial controller",
        "controller",
        "director de control de gestión",
        "director de control de gestion",
        "responsable financiero",
        "vp finance",
        "director de contabilidad",
        "director de tesorería",
        "director de tesoreria",
        "finance officer"
      ],
      "exclude": [
        "sales",
        "ventas",
        "comercial",
        "marketing",
        "recursos humanos",
        "rrhh",
        "recruit",
        "talent",
        "legal",
        "jurídic",
        "juridic",
        "compras",
        "procurement",
        "purchasing",
        "operaciones",
        "operations",
        "logístic",
        "logistic",
        "sistemas",
        "tecnolog"
      ],
      "lead_words": [
        "director",
        "directora",
        "manager",
        "head",
        "lead",
        "responsable",
        "jefe",
        "jefa",
        "chief",
        "vp"
      ],
      "domain_acr": [
        "fp&a",
        "fpa"
      ],
      "domain_sub": [
        "financ",
        "finanzas",
        "contab",
        "tesorer",
        "fiscal",
        "control de gestión",
        "control de gestion",
        "auditor",
        "administración y finanzas",
        "administracion y finanzas",
        "económico financiero",
        "economico financiero",
        "accounting"
      ]
    }
  }
  $json$::jsonb
),
(
  'operaciones',
  'Decisores Operaciones (España)',
  'COO/Director de Operaciones/Director Industrial/Supply Chain y equivalentes, en España.',
  $json$
  {
    "locations": [
      "Spain"
    ],
    "pass_a": {
      "functionIds": [
        "18"
      ],
      "seniorityLevelIds": [
        "310",
        "300",
        "220",
        "210"
      ]
    },
    "pass_b": {
      "jobTitles": [
        "COO",
        "Chief Operating Officer",
        "Director de Operaciones",
        "Operations Director",
        "Head of Operations",
        "Director Industrial",
        "Director de Planta",
        "Director de Producción",
        "Director de Logística",
        "Supply Chain Director",
        "Responsable de Operaciones",
        "Operations Manager"
      ]
    },
    "classify": {
      "clevel_acr": [
        "coo"
      ],
      "clevel_phrases": [
        "chief operating",
        "chief operations"
      ],
      "strong": [
        "director de operaciones",
        "operations director",
        "head of operations",
        "director industrial",
        "director de planta",
        "plant director",
        "director de producción",
        "director de produccion",
        "director de fábrica",
        "director de fabrica",
        "director de logística",
        "director de logistica",
        "supply chain director",
        "head of supply chain",
        "director de cadena de suministro",
        "responsable de operaciones",
        "vp operations",
        "operations manager",
        "director de supply chain",
        "operations officer"
      ],
      "exclude": [
        "sales",
        "ventas",
        "comercial",
        "marketing",
        "finance",
        "financ",
        "contab",
        "recursos humanos",
        "rrhh",
        "recruit",
        "talent",
        "legal",
        "jurídic",
        "juridic",
        "sistemas",
        "tecnolog"
      ],
      "lead_words": [
        "director",
        "directora",
        "manager",
        "head",
        "lead",
        "responsable",
        "jefe",
        "jefa",
        "chief",
        "vp"
      ],
      "domain_acr": [
        "scm",
        "s&op"
      ],
      "domain_sub": [
        "operacion",
        "operations",
        "producción",
        "produccion",
        "planta",
        "fábrica",
        "fabrica",
        "industrial",
        "logístic",
        "logistic",
        "supply chain",
        "cadena de suministro",
        "manufactura",
        "manufacturing",
        "almacén",
        "almacen",
        "aprovisionamiento",
        "distribución",
        "distribucion"
      ]
    }
  }
  $json$::jsonb
),
(
  'ventas',
  'Decisores Ventas (España)',
  'CRO/Director Comercial/Director de Ventas/Business Development y equivalentes, en España.',
  $json$
  {
    "locations": [
      "Spain"
    ],
    "pass_a": {
      "functionIds": [
        "25"
      ],
      "seniorityLevelIds": [
        "310",
        "300",
        "220",
        "210"
      ]
    },
    "pass_b": {
      "jobTitles": [
        "CRO",
        "Chief Revenue Officer",
        "Director Comercial",
        "Director de Ventas",
        "Sales Director",
        "Head of Sales",
        "VP Sales",
        "Director de Desarrollo de Negocio",
        "Business Development Director",
        "Country Manager",
        "Responsable Comercial",
        "Sales Manager"
      ]
    },
    "classify": {
      "clevel_acr": [
        "cro",
        "cco"
      ],
      "clevel_phrases": [
        "chief revenue",
        "chief sales",
        "chief commercial"
      ],
      "strong": [
        "director comercial",
        "director de ventas",
        "sales director",
        "head of sales",
        "vp sales",
        "vp of sales",
        "director de desarrollo de negocio",
        "business development director",
        "director de negocio",
        "responsable comercial",
        "country manager",
        "director comercial y marketing",
        "key account director",
        "regional sales director",
        "national sales manager",
        "director de expansión",
        "director de expansion",
        "sales manager",
        "director de grandes cuentas",
        "revenue officer"
      ],
      "exclude": [
        "account manager",
        "account exec",
        "account executive",
        "ejecutivo de cuentas",
        "sales representative",
        "sales rep",
        "representante",
        "preventa",
        "presale",
        "pre-sale",
        "store manager",
        "tienda",
        "dependient",
        "finance",
        "financ",
        "contab",
        "recursos humanos",
        "rrhh",
        "legal",
        "compras",
        "procurement",
        "sistemas",
        "tecnolog"
      ],
      "lead_words": [
        "director",
        "directora",
        "manager",
        "head",
        "lead",
        "responsable",
        "jefe",
        "jefa",
        "chief",
        "vp"
      ],
      "domain_acr": [
        "b2b",
        "b2c"
      ],
      "domain_sub": [
        "ventas",
        "comercial",
        "sales",
        "desarrollo de negocio",
        "business development",
        "grandes cuentas",
        "key account",
        "revenue",
        "go-to-market",
        "expansión",
        "expansion",
        "canal"
      ]
    }
  }
  $json$::jsonb
),
(
  'marketing',
  'Decisores Marketing (España)',
  'CMO/Director de Marketing/Director de Comunicación/Head of Growth y equivalentes, en España.',
  $json$
  {
    "locations": [
      "Spain"
    ],
    "pass_a": {
      "functionIds": [
        "15"
      ],
      "seniorityLevelIds": [
        "310",
        "300",
        "220",
        "210"
      ]
    },
    "pass_b": {
      "jobTitles": [
        "CMO",
        "Chief Marketing Officer",
        "Director de Marketing",
        "Marketing Director",
        "Head of Marketing",
        "Director de Comunicación",
        "Head of Communications",
        "Director de Marca",
        "Director de Marketing Digital",
        "Head of Growth",
        "Responsable de Marketing",
        "Marketing Manager"
      ]
    },
    "classify": {
      "clevel_acr": [
        "cmo"
      ],
      "clevel_phrases": [
        "chief marketing",
        "chief brand",
        "chief growth"
      ],
      "strong": [
        "director de marketing",
        "marketing director",
        "head of marketing",
        "director de comunicación",
        "director de comunicacion",
        "head of communications",
        "director de marca",
        "brand director",
        "director de marketing digital",
        "head of growth",
        "growth director",
        "responsable de marketing",
        "director de marketing y comunicación",
        "director de marketing y comunicacion",
        "vp marketing",
        "director de publicidad",
        "director de contenidos",
        "demand generation",
        "marketing officer"
      ],
      "exclude": [
        "community manager",
        "social media specialist",
        "content creator",
        "copywriter",
        "diseñador",
        "disenador",
        "designer",
        "finance",
        "financ",
        "contab",
        "recursos humanos",
        "rrhh",
        "legal",
        "compras",
        "procurement",
        "operaciones",
        "operations",
        "sistemas",
        "tecnolog"
      ],
      "lead_words": [
        "director",
        "directora",
        "manager",
        "head",
        "lead",
        "responsable",
        "jefe",
        "jefa",
        "chief",
        "vp"
      ],
      "domain_acr": [
        "seo",
        "sem",
        "ppc",
        "crm"
      ],
      "domain_sub": [
        "marketing",
        "comunicación",
        "comunicacion",
        "marca",
        "brand",
        "publicidad",
        "growth",
        "contenidos",
        "content",
        "demanda",
        "demand",
        "redes sociales",
        "social media",
        "captación",
        "captacion",
        "adquisición",
        "adquisicion"
      ]
    }
  }
  $json$::jsonb
),
(
  'compras',
  'Decisores Compras (España)',
  'CPO/Director de Compras/Head of Procurement/Director de Sourcing y equivalentes, en España.',
  $json$
  {
    "locations": [
      "Spain"
    ],
    "pass_a": {
      "functionIds": [
        "21"
      ],
      "seniorityLevelIds": [
        "310",
        "300",
        "220",
        "210"
      ]
    },
    "pass_b": {
      "jobTitles": [
        "CPO",
        "Chief Procurement Officer",
        "Director de Compras",
        "Purchasing Director",
        "Head of Procurement",
        "Director de Aprovisionamiento",
        "Strategic Sourcing Director",
        "Director de Sourcing",
        "Responsable de Compras",
        "Procurement Manager",
        "Purchasing Manager"
      ]
    },
    "classify": {
      "clevel_acr": [
        "cpo"
      ],
      "clevel_phrases": [
        "chief procurement",
        "chief purchasing"
      ],
      "strong": [
        "director de compras",
        "purchasing director",
        "head of procurement",
        "director de aprovisionamiento",
        "strategic sourcing director",
        "director de sourcing",
        "responsable de compras",
        "procurement manager",
        "purchasing manager",
        "head of purchasing",
        "director de procurement",
        "vp procurement",
        "category director",
        "director de categoría",
        "director de categoria",
        "procurement officer",
        "director de compras y logística"
      ],
      "exclude": [
        "sales",
        "ventas",
        "comercial",
        "marketing",
        "finance",
        "financ",
        "contab",
        "recursos humanos",
        "rrhh",
        "recruit",
        "talent",
        "legal",
        "jurídic",
        "juridic",
        "sistemas",
        "tecnolog"
      ],
      "lead_words": [
        "director",
        "directora",
        "manager",
        "head",
        "lead",
        "responsable",
        "jefe",
        "jefa",
        "chief",
        "vp"
      ],
      "domain_acr": [
        "mro"
      ],
      "domain_sub": [
        "compras",
        "aprovisionamiento",
        "procurement",
        "purchasing",
        "sourcing",
        "abastecimiento",
        "category",
        "categoría",
        "categoria",
        "proveedores",
        "supply"
      ]
    }
  }
  $json$::jsonb
)
on conflict (key) do update set params = excluded.params, name = excluded.name,
  description = excluded.description;
