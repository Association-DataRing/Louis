"use server";

import { revalidatePath } from "next/cache";
import { eq, sql } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { auth } from "@/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import { recordAudit } from "@/lib/audit";
import { rateLimit } from "@/lib/rate-limit";
import {
  generateTotpSecret,
  otpauthUri,
  verifyTotp,
  generateBackupCodes,
} from "@/lib/totp";

async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  return session.user;
}

/** Démarre l'enrôlement : génère un secret « pending » à confirmer. */
export async function startTotpEnrollment(): Promise<{
  secret: string;
  uri: string;
}> {
  const user = await requireUser();
  const secret = generateTotpSecret();
  await db
    .update(users)
    .set({ totpSecretPending: secret })
    .where(eq(users.id, user.id));
  return { secret, uri: otpauthUri(secret, user.email) };
}

export type ConfirmResult =
  | { ok: true; backupCodes: string[] }
  | { ok: false; error: string };

/**
 * Confirme l'enrôlement avec un premier code : promeut le secret pending,
 * active la 2FA et renvoie les codes de secours (affichés UNE seule fois).
 */
export async function confirmTotpEnrollment(
  code: string
): Promise<ConfirmResult> {
  const user = await requireUser();
  const rl = await rateLimit("totp", user.id);
  if (!rl.allowed) {
    return {
      ok: false,
      error: "Trop de tentatives. Réessayez dans quelques minutes.",
    };
  }
  const [row] = await db
    .select({ pending: users.totpSecretPending })
    .from(users)
    .where(eq(users.id, user.id))
    .limit(1);
  if (!row?.pending) {
    return { ok: false, error: "Aucun enrôlement en cours. Recommencez." };
  }
  if (!verifyTotp(row.pending, code)) {
    return {
      ok: false,
      error: "Code invalide. Vérifiez l'heure de votre téléphone et réessayez.",
    };
  }
  const backupCodes = generateBackupCodes(8);
  const hashed = await Promise.all(backupCodes.map((c) => bcrypt.hash(c, 10)));
  await db
    .update(users)
    .set({
      totpSecret: row.pending,
      totpSecretPending: null,
      totpEnabled: true,
      backupCodes: hashed,
    })
    .where(eq(users.id, user.id));
  await recordAudit({
    userId: user.id,
    action: "auth.totp.enabled",
    target: user.email,
  });
  revalidatePath("/settings/security");
  return { ok: true, backupCodes };
}

export type DisableResult = { ok: true } | { ok: false; error: string };

/**
 * Désactive la 2FA — exige un code TOTP courant valide (step-up). Sans cette
 * ré-authentification, une session volée suffirait à retirer le second facteur
 * du compte. Throttlé par compte pour éviter le brute-force du code.
 */
export async function disableTotp(code: string): Promise<DisableResult> {
  const user = await requireUser();
  const rl = await rateLimit("totp", user.id);
  if (!rl.allowed) {
    return {
      ok: false,
      error: "Trop de tentatives. Réessayez dans quelques minutes.",
    };
  }
  const [row] = await db
    .select({ secret: users.totpSecret })
    .from(users)
    .where(eq(users.id, user.id))
    .limit(1);
  if (!row?.secret) {
    return { ok: false, error: "La 2FA n'est pas active." };
  }
  if (!verifyTotp(row.secret, code)) {
    await recordAudit({
      userId: user.id,
      action: "auth.totp.failed",
      target: user.email,
      meta: { context: "disable" },
    });
    return {
      ok: false,
      error: "Code invalide. Saisissez un code de votre application.",
    };
  }
  await db
    .update(users)
    .set({
      totpEnabled: false,
      totpSecret: null,
      totpSecretPending: null,
      backupCodes: null,
      // Désactiver la 2FA invalide aussi les sessions existantes (cf. jwt).
      tokenVersion: sql`${users.tokenVersion} + 1`,
    })
    .where(eq(users.id, user.id));
  await recordAudit({
    userId: user.id,
    action: "auth.totp.disabled",
    target: user.email,
  });
  revalidatePath("/settings/security");
  return { ok: true };
}
