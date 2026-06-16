-- Migración: añade 'llm_web' al enum resolution_method.
--
-- Motivo: la Fase 2 (Buscador de decisores) puede corregir la URL de LinkedIn de
-- una empresa con Gemini (OpenRouter + web search). Cuando lo hace, marca la empresa
-- con resolution_method = 'llm_web' para poder distinguir en reporting qué URLs
-- estaban mal y fueron corregidas por IA.
--
-- schema_v2.sql ya incluye 'llm_web' en el CREATE TYPE para instalaciones nuevas.
-- Para la BD ya aplicada (proyecto ftpgnimyjxlomjfdqfqy), ejecutar este statement.
-- ALTER TYPE ... ADD VALUE no puede ir dentro de un bloque do $$ ... $$.

alter type resolution_method add value if not exists 'llm_web';
