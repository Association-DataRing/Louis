-- v0.4 — Enrichit model_settings avec label + hint pour snapshot des
-- métadonnées du modèle au moment où il est ajouté à la plateforme
-- (évite de devoir réinterroger l'API du provider à chaque picker).
-- Idempotent.

ALTER TABLE "model_settings"
  ADD COLUMN IF NOT EXISTS "label" text;

ALTER TABLE "model_settings"
  ADD COLUMN IF NOT EXISTS "hint" text;
