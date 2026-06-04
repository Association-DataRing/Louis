-- 2FA TOTP (RFC 6238). totp_secret_pending détient le secret le temps de
-- l'enrôlement, promu vers totp_secret + totp_enabled une fois un code confirmé.
-- backup_codes = codes de secours à usage unique, HACHÉS (bcrypt). Cf. lib/totp.ts.

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "totp_secret" text;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "totp_secret_pending" text;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "totp_enabled" boolean NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "backup_codes" jsonb;
