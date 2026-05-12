"use server";

import { revalidatePath } from "next/cache";
import { eq, ne } from "drizzle-orm";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { db } from "@/db";
import { users } from "@/db/schema";
import { requireAdmin } from "@/lib/auth/permissions";

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
  await requireAdmin();

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

  revalidatePath("/admin/users");
  return { ok: true };
}

export async function toggleUserActive(id: string): Promise<void> {
  const { userId: adminId } = await requireAdmin();
  // Prevent admin from deactivating themselves to avoid locking out their own session.
  if (id === adminId) return;

  const [current] = await db
    .select({ isActive: users.isActive })
    .from(users)
    .where(eq(users.id, id))
    .limit(1);
  if (!current) return;

  await db
    .update(users)
    .set({ isActive: !current.isActive })
    .where(eq(users.id, id));
  revalidatePath("/admin/users");
}

export async function deleteUser(id: string): Promise<void> {
  const { userId: adminId } = await requireAdmin();
  // Can never delete oneself.
  if (id === adminId) return;

  await db.delete(users).where(eq(users.id, id));
  revalidatePath("/admin/users");
}

export async function resetUserPassword(
  id: string,
  newPassword: string
): Promise<ActionResult> {
  await requireAdmin();
  if (!newPassword || newPassword.length < 10) {
    return { ok: false, error: "Mot de passe trop court (10 minimum)." };
  }
  const passwordHash = await bcrypt.hash(newPassword, 12);
  await db.update(users).set({ passwordHash }).where(eq(users.id, id));
  return { ok: true };
}

// Re-export needed in components for safe equality check without leaking adminId.
export async function listOtherUsers(): Promise<typeof users.$inferSelect[]> {
  const { userId: adminId } = await requireAdmin();
  return db.select().from(users).where(ne(users.id, adminId));
}
