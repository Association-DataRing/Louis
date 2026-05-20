"use server";

import { revalidatePath } from "next/cache";
import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/db";
import { skills, type Skill } from "@/db/schema";
import { SKILL_PRESETS } from "@/lib/skills/presets";

export type ActionResult =
  | { ok: true }
  | { ok: false; error: string };

async function requireUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  return session.user.id;
}

const upsertSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().min(1).max(500),
  triggerHint: z.string().trim().min(1).max(500),
  systemPrompt: z.string().trim().min(1).max(8000),
});

export async function listSkills(): Promise<Skill[]> {
  const userId = await requireUserId();

  const rows = await db
    .select()
    .from(skills)
    .where(eq(skills.userId, userId))
    .orderBy(asc(skills.isPreset), asc(skills.name));

  if (rows.length === 0) {
    // Seed initial des presets pour ce user
    await db.insert(skills).values(
      SKILL_PRESETS.map((p) => ({
        userId,
        slug: p.slug,
        name: p.name,
        description: p.description,
        triggerHint: p.triggerHint,
        systemPrompt: p.systemPrompt,
        enabled: true,
        isPreset: true,
      }))
    );
    return await db
      .select()
      .from(skills)
      .where(eq(skills.userId, userId))
      .orderBy(asc(skills.isPreset), asc(skills.name));
  }
  return rows;
}

export async function getEnabledSkills(userId: string): Promise<Skill[]> {
  const rows = await db
    .select()
    .from(skills)
    .where(and(eq(skills.userId, userId), eq(skills.enabled, true)));
  if (rows.length > 0) return rows;

  // Auto-seed si l'utilisateur n'a jamais visité /settings/skills
  await db.insert(skills).values(
    SKILL_PRESETS.map((p) => ({
      userId,
      slug: p.slug,
      name: p.name,
      description: p.description,
      triggerHint: p.triggerHint,
      systemPrompt: p.systemPrompt,
      enabled: true,
      isPreset: true,
    }))
  );
  return await db
    .select()
    .from(skills)
    .where(and(eq(skills.userId, userId), eq(skills.enabled, true)));
}

export async function toggleSkill(
  skillId: string,
  enabled: boolean
): Promise<ActionResult> {
  const userId = await requireUserId();
  await db
    .update(skills)
    .set({ enabled, updatedAt: new Date() })
    .where(and(eq(skills.id, skillId), eq(skills.userId, userId)));
  revalidatePath("/settings/skills");
  revalidatePath("/chat");
  return { ok: true };
}

export async function createSkill(
  data: z.infer<typeof upsertSchema>
): Promise<ActionResult> {
  const userId = await requireUserId();
  const parsed = upsertSchema.safeParse(data);
  if (!parsed.success) return { ok: false, error: "Champs invalides." };

  // Slug auto à partir du nom — kebab-case ASCII
  const slug = parsed.data.name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);

  if (!slug) return { ok: false, error: "Nom invalide." };

  // Empêche la collision de slug pour le même user
  const existing = await db
    .select({ id: skills.id })
    .from(skills)
    .where(and(eq(skills.userId, userId), eq(skills.slug, slug)))
    .limit(1);
  if (existing.length > 0) {
    return { ok: false, error: "Une compétence avec ce nom existe déjà." };
  }

  await db.insert(skills).values({
    userId,
    slug,
    name: parsed.data.name,
    description: parsed.data.description,
    triggerHint: parsed.data.triggerHint,
    systemPrompt: parsed.data.systemPrompt,
    enabled: true,
    isPreset: false,
  });

  revalidatePath("/settings/skills");
  return { ok: true };
}

export async function updateSkill(
  skillId: string,
  data: z.infer<typeof upsertSchema>
): Promise<ActionResult> {
  const userId = await requireUserId();
  const parsed = upsertSchema.safeParse(data);
  if (!parsed.success) return { ok: false, error: "Champs invalides." };

  await db
    .update(skills)
    .set({
      name: parsed.data.name,
      description: parsed.data.description,
      triggerHint: parsed.data.triggerHint,
      systemPrompt: parsed.data.systemPrompt,
      updatedAt: new Date(),
    })
    .where(and(eq(skills.id, skillId), eq(skills.userId, userId)));

  revalidatePath("/settings/skills");
  revalidatePath("/chat");
  return { ok: true };
}

export async function deleteSkill(skillId: string): Promise<ActionResult> {
  const userId = await requireUserId();
  // Empêche la suppression des presets — on les désactive plutôt
  const [row] = await db
    .select({ isPreset: skills.isPreset })
    .from(skills)
    .where(and(eq(skills.id, skillId), eq(skills.userId, userId)))
    .limit(1);
  if (!row) return { ok: false, error: "Compétence introuvable." };
  if (row.isPreset) {
    return {
      ok: false,
      error:
        "Impossible de supprimer un preset système. Désactivez-le à la place.",
    };
  }

  await db
    .delete(skills)
    .where(and(eq(skills.id, skillId), eq(skills.userId, userId)));
  revalidatePath("/settings/skills");
  return { ok: true };
}
