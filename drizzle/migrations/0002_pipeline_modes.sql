-- v0.3 — Builder universel : modes d'exécution et tours de débat.
-- Ajoute les colonnes mode (text) et rounds (int) à la table pipelines.
-- Idempotent : utilise IF NOT EXISTS pour pouvoir s'appliquer en prod
-- existante comme en dev frais.

ALTER TABLE "pipelines"
  ADD COLUMN IF NOT EXISTS "mode" text NOT NULL DEFAULT 'sequential';

ALTER TABLE "pipelines"
  ADD COLUMN IF NOT EXISTS "rounds" integer NOT NULL DEFAULT 1;
