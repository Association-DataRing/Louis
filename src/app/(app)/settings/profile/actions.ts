"use server";

import type { ActionResult as BaseActionResult } from "@/lib/actions/result";

import { revalidatePath } from "next/cache";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { requireUserId } from "@/lib/auth/permissions";
import { db } from "@/db";
import { users } from "@/db/schema";
import { recordAudit } from "@/lib/audit";

export type ActionResult = BaseActionResult;

const nameSchema = z.object({
  name: z.string().trim().min(1, "Nom requis").max(80),
});

export async function updateName(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const userId = await requireUserId();
  const parsed = nameSchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }
  await db.update(users).set({ name: parsed.data.name }).where(eq(users.id, userId));
  revalidatePath("/settings");
  return { ok: true };
}

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1),
    newPassword: z.string().min(10, "Au moins 10 caractères"),
    confirm: z.string(),
  })
  .refine((d) => d.newPassword === d.confirm, {
    message: "Les deux mots de passe ne correspondent pas",
    path: ["confirm"],
  });

export async function updatePassword(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const userId = await requireUserId();

  const parsed = passwordSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
    confirm: formData.get("confirm"),
  });

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  const [user] = await db
    .select({ passwordHash: users.passwordHash, email: users.email })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) return { ok: false, error: "Compte introuvable." };

  const ok = await bcrypt.compare(parsed.data.currentPassword, user.passwordHash);
  if (!ok) return { ok: false, error: "Mot de passe actuel incorrect." };

  const newHash = await bcrypt.hash(parsed.data.newPassword, 12);
  // Bump tokenVersion → invalide les sessions JWT existantes (cf. callback jwt).
  await db
    .update(users)
    .set({ passwordHash: newHash, tokenVersion: sql`${users.tokenVersion} + 1` })
    .where(eq(users.id, userId));

  // Audit : changement de mot de passe self-service (l'équivalent admin
  // user.password.reset était déjà tracé — ici c'était un angle mort).
  await recordAudit({
    userId,
    action: "auth.password.change",
    target: user.email,
  });

  return { ok: true };
}
