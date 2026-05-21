"use server";

import { revalidatePath } from "next/cache";
import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/db";
import { skills, type Skill } from "@/db/schema";
import { SKILL_PRESETS, findSkillPreset } from "@/lib/skills/presets";

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

/**
 * Liste les skills de l'utilisateur. PLUS d'auto-seed : l'app est
 * livrée vide et l'utilisateur crée/importe ses propres compétences.
 * Évite que des prompts livrés par défaut entachent la réputation du
 * cabinet si leur qualité n'est pas validée par l'utilisateur.
 */
export async function listSkills(): Promise<Skill[]> {
  const userId = await requireUserId();
  return await db
    .select()
    .from(skills)
    .where(eq(skills.userId, userId))
    .orderBy(asc(skills.name));
}

/**
 * Helper utilisé par le détecteur côté /api/chat. Sans auto-seed —
 * retourne [] si l'utilisateur n'a rien créé.
 */
export async function getEnabledSkills(userId: string): Promise<Skill[]> {
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

function deriveSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

export async function createSkill(
  data: z.infer<typeof upsertSchema>
): Promise<ActionResult> {
  const userId = await requireUserId();
  const parsed = upsertSchema.safeParse(data);
  if (!parsed.success) return { ok: false, error: "Champs invalides." };

  const slug = deriveSlug(parsed.data.name);
  if (!slug) return { ok: false, error: "Nom invalide." };

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

/**
 * Suppression libre : toute skill peut être supprimée par son
 * propriétaire, presets inclus. Le flag is_preset reste informatif
 * (badge UI) mais n'impose plus de restriction fonctionnelle.
 */
export async function deleteSkill(skillId: string): Promise<ActionResult> {
  const userId = await requireUserId();
  await db
    .delete(skills)
    .where(and(eq(skills.id, skillId), eq(skills.userId, userId)));
  revalidatePath("/settings/skills");
  revalidatePath("/chat");
  return { ok: true };
}

/**
 * Importe un exemple depuis SKILL_PRESETS (bibliothèque) dans les
 * skills de l'utilisateur. Crée une row avec is_preset=false pour que
 * l'utilisateur puisse l'éditer librement.
 */
export async function importSkillTemplate(
  presetSlug: string
): Promise<ActionResult> {
  const userId = await requireUserId();
  const preset = findSkillPreset(presetSlug);
  if (!preset) return { ok: false, error: "Modèle inconnu." };

  const existing = await db
    .select({ id: skills.id })
    .from(skills)
    .where(and(eq(skills.userId, userId), eq(skills.slug, preset.slug)))
    .limit(1);
  if (existing.length > 0) {
    return {
      ok: false,
      error: "Vous avez déjà une compétence avec ce slug. Renommez-la avant d'importer.",
    };
  }

  await db.insert(skills).values({
    userId,
    slug: preset.slug,
    name: preset.name,
    description: preset.description,
    triggerHint: preset.triggerHint,
    systemPrompt: preset.systemPrompt,
    enabled: true,
    isPreset: false,
  });

  revalidatePath("/settings/skills");
  return { ok: true };
}

/**
 * Liste les templates de la bibliothèque + indique quels slugs sont
 * déjà dans la liste de l'utilisateur (pour griser le bouton import).
 */
export async function listSkillTemplates(): Promise<
  Array<{
    slug: string;
    name: string;
    description: string;
    triggerHint: string;
    systemPrompt: string;
    alreadyImported: boolean;
  }>
> {
  const userId = await requireUserId();
  const userSlugs = await db
    .select({ slug: skills.slug })
    .from(skills)
    .where(eq(skills.userId, userId));
  const set = new Set(userSlugs.map((s) => s.slug));
  return SKILL_PRESETS.map((p) => ({
    ...p,
    alreadyImported: set.has(p.slug),
  }));
}

/**
 * Nettoie les anciens presets auto-seedés (avant le changement de
 * politique no-auto-seed). Permet aux comptes existants de repartir
 * d'une bibliothèque vide.
 */
export async function purgeSeededPresets(): Promise<ActionResult> {
  const userId = await requireUserId();
  await db
    .delete(skills)
    .where(and(eq(skills.userId, userId), eq(skills.isPreset, true)));
  revalidatePath("/settings/skills");
  revalidatePath("/chat");
  return { ok: true };
}
