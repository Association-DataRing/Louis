"use server";

import { revalidatePath } from "next/cache";
import { and, eq, ne, sql } from "drizzle-orm";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { db } from "@/db";
import { users } from "@/db/schema";
import { requireAdmin } from "@/lib/auth/permissions";
import { recordAudit } from "@/lib/audit";

const createSchema = z.object({
  email: z.email(),
  name: z.string().trim().min(1).max(80),
  password: z.string().min(10, "Au moins 10 caractères"),
  role: z.enum(["admin", "member"]),
});

export type ActionResult = { ok: true } | { ok: false; error: string };

export async function createUser(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const { userId: adminId } = await requireAdmin();

  const parsed = createSchema.safeParse({
    email: formData.get("email"),
    name: formData.get("name"),
    password: formData.get("password"),
    role: formData.get("role"),
  });

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 12);

  try {
    await db.insert(users).values({
      email: parsed.data.email,
      name: parsed.data.name,
      passwordHash,
      role: parsed.data.role,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erreur";
    if (msg.includes("users_email_unique")) {
      return { ok: false, error: "Cet email est déjà utilisé." };
    }
    return { ok: false, error: "Impossible de créer l'utilisateur." };
  }

  await recordAudit({
    userId: adminId,
    action: "user.create",
    target: parsed.data.email,
    meta: { role: parsed.data.role },
  });
  revalidatePath("/admin/users");
  return { ok: true };
}

export async function toggleUserActive(id: string): Promise<void> {
  const { userId: adminId } = await requireAdmin();
  // Prevent admin from deactivating themselves to avoid locking out their own session.
  if (id === adminId) return;

  const [current] = await db
    .select({ isActive: users.isActive, email: users.email })
    .from(users)
    .where(eq(users.id, id))
    .limit(1);
  if (!current) return;

  await db
    .update(users)
    .set({ isActive: !current.isActive })
    .where(eq(users.id, id));
  await recordAudit({
    userId: adminId,
    action: current.isActive ? "user.disable" : "user.enable",
    target: current.email,
  });
  revalidatePath("/admin/users");
}

export async function deleteUser(id: string): Promise<void> {
  const { userId: adminId } = await requireAdmin();
  if (id === adminId) return;
  const [target] = await db
    .select({ email: users.email })
    .from(users)
    .where(eq(users.id, id))
    .limit(1);
  await db.delete(users).where(eq(users.id, id));
  await recordAudit({
    userId: adminId,
    action: "user.delete",
    target: target?.email ?? id,
  });
  revalidatePath("/admin/users");
}

/**
 * Bascule le rôle d'un utilisateur (member ↔ admin). Garde-fou : un admin
 * ne peut pas se rétrograder lui-même — anti-lockout côté serveur en
 * complément du masquage du menu sur sa propre ligne côté UI.
 *
 * Garde-fou supplémentaire : on refuse de rétrograder le DERNIER admin
 * actif du cabinet — sans quoi plus personne ne peut administrer
 * l'instance.
 */
export async function setUserRole(
  id: string,
  role: "admin" | "member"
): Promise<ActionResult> {
  const { userId: adminId } = await requireAdmin();
  if (id === adminId) {
    return {
      ok: false,
      error: "Vous ne pouvez pas changer votre propre rôle.",
    };
  }

  const [target] = await db
    .select({
      email: users.email,
      role: users.role,
      isActive: users.isActive,
    })
    .from(users)
    .where(eq(users.id, id))
    .limit(1);
  if (!target) return { ok: false, error: "Utilisateur introuvable." };
  if (target.role === role) return { ok: true };

  // Si on rétrograde un admin → vérifier qu'il reste au moins un autre
  // admin actif. Sinon le cabinet serait orphelin.
  if (role === "member" && target.role === "admin") {
    const otherAdmins = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(users)
      .where(
        and(
          eq(users.role, "admin"),
          eq(users.isActive, true),
          ne(users.id, id)
        )
      );
    if ((otherAdmins[0]?.n ?? 0) === 0) {
      return {
        ok: false,
        error: "Au moins un administrateur actif doit rester.",
      };
    }
  }

  await db.update(users).set({ role }).where(eq(users.id, id));
  await recordAudit({
    userId: adminId,
    action: role === "admin" ? "user.role.promote" : "user.role.demote",
    target: target.email,
    meta: { from: target.role, to: role },
  });
  revalidatePath("/admin/users");
  return { ok: true };
}

/**
 * Modifie le quota mensuel d'un user (en centimes d'euros). `null` =
 * pas de limite. À 0 = bloqué de fait. Audit log enregistre la valeur
 * avant/après pour traçabilité cabinet.
 */
export async function updateUserQuota(
  id: string,
  monthlyQuotaCents: number | null
): Promise<ActionResult> {
  const { userId: adminId } = await requireAdmin();
  if (monthlyQuotaCents != null) {
    if (!Number.isInteger(monthlyQuotaCents) || monthlyQuotaCents < 0) {
      return {
        ok: false,
        error: "Montant invalide — saisissez un nombre d'euros positif.",
      };
    }
    if (monthlyQuotaCents > 1_000_000_00) {
      return { ok: false, error: "Quota trop élevé (max 1 000 000 €)." };
    }
  }
  const [target] = await db
    .select({ email: users.email, monthlyQuotaCents: users.monthlyQuotaCents })
    .from(users)
    .where(eq(users.id, id))
    .limit(1);
  if (!target) return { ok: false, error: "Utilisateur introuvable." };

  await db
    .update(users)
    .set({ monthlyQuotaCents })
    .where(eq(users.id, id));
  await recordAudit({
    userId: adminId,
    action: "user.quota.update",
    target: target.email,
    meta: {
      from: target.monthlyQuotaCents,
      to: monthlyQuotaCents,
    },
  });
  revalidatePath("/admin/users");
  return { ok: true };
}

export async function resetUserPassword(
  id: string,
  newPassword: string
): Promise<ActionResult> {
  const { userId: adminId } = await requireAdmin();
  if (!newPassword || newPassword.length < 10) {
    return { ok: false, error: "Mot de passe trop court (10 minimum)." };
  }
  const passwordHash = await bcrypt.hash(newPassword, 12);
  const [target] = await db
    .select({ email: users.email })
    .from(users)
    .where(eq(users.id, id))
    .limit(1);
  await db.update(users).set({ passwordHash }).where(eq(users.id, id));
  await recordAudit({
    userId: adminId,
    action: "user.password.reset",
    target: target?.email ?? id,
  });
  return { ok: true };
}
