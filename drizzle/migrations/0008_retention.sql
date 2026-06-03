-- Rétention RGPD : purge auto des conversations inactives via /api/cron/retention.
-- null = désactivé (défaut). Cf. src/app/api/cron/retention/route.ts.

ALTER TABLE "cabinet_settings"
  ADD COLUMN IF NOT EXISTS "retention_days" integer;
