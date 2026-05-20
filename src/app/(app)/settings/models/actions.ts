"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/db";
import { modelSettings, type ModelSetting } from "@/db/schema";
import { MODEL_CATALOG } from "@/lib/providers/models";
import type { ProviderType } from "@/lib/providers/catalog";

export type ActionResult =
  | { ok: true }
  | { ok: false; error: string };

async function requireUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  return session.user.id;
}

const addModelSchema = z.object({
  providerType: z.string().min(1).max(50),
  modelId: z.string().min(1).max(200),
  label: z.string().min(1).max(200),
  hint: z.string().max(500).nullable().optional(),
});

/**
 * Ajoute un modèle à la plateforme de l'utilisateur (upsert enabled=true).
 * Si une row existe déjà (enabled=false), on la flip ; sinon on insère.
 */
export async function addModel(
  payload: z.infer<typeof addModelSchema>
): Promise<ActionResult> {
  const userId = await requireUserId();
  const parsed = addModelSchema.safeParse(payload);
  if (!parsed.success) return { ok: false, error: "Champs invalides." };

  const { providerType, modelId, label, hint } = parsed.data;

  const existing = await db
    .select()
    .from(modelSettings)
    .where(
      and(
        eq(modelSettings.userId, userId),
        eq(modelSettings.providerType, providerType),
        eq(modelSettings.modelId, modelId)
      )
    )
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(modelSettings)
      .set({
        enabled: true,
        label,
        hint: hint ?? null,
        updatedAt: new Date(),
      })
      .where(eq(modelSettings.id, existing[0].id));
  } else {
    await db.insert(modelSettings).values({
      userId,
      providerType,
      modelId,
      enabled: true,
      label,
      hint: hint ?? null,
    });
  }

  revalidatePath("/settings/models");
  revalidatePath("/settings/models/library");
  revalidatePath("/chat");
  revalidatePath("/bureau");
  return { ok: true };
}

const bulkSchema = z.object({
  providerType: z.string().min(1).max(50),
  models: z
    .array(
      z.object({
        modelId: z.string().min(1).max(200),
        label: z.string().min(1).max(200),
        hint: z.string().max(500).nullable().optional(),
      })
    )
    .max(500),
});

/**
 * Bulk add — ajoute N modèles d'un même provider en une seule action.
 * Utile depuis la bibliothèque quand l'utilisateur sélectionne plusieurs
 * modèles à la fois. Idempotent (upsert).
 */
export async function addModelsBulk(
  payload: z.infer<typeof bulkSchema>
): Promise<ActionResult> {
  // Auth check (chaque addModel re-vérifie l'auth, mais on coupe court
  // ici si l'utilisateur n'est pas loggué pour éviter N appels inutiles).
  await requireUserId();
  const parsed = bulkSchema.safeParse(payload);
  if (!parsed.success) return { ok: false, error: "Champs invalides." };

  for (const m of parsed.data.models) {
    const result = await addModel({
      providerType: parsed.data.providerType,
      modelId: m.modelId,
      label: m.label,
      hint: m.hint ?? null,
    });
    if (!result.ok) return result;
  }
  return { ok: true };
}

/**
 * Retire un modèle de la plateforme (delete row).
 */
export async function removeModel(payload: {
  providerType: string;
  modelId: string;
}): Promise<ActionResult> {
  const userId = await requireUserId();

  // Filtre par userId : un user ne peut supprimer QUE ses propres rows
  // (sinon faille IDOR). Le triplet (user, provider, model) est unique
  // grâce à l'index du schéma.
  await db
    .delete(modelSettings)
    .where(
      and(
        eq(modelSettings.userId, userId),
        eq(modelSettings.providerType, payload.providerType),
        eq(modelSettings.modelId, payload.modelId)
      )
    );
  revalidatePath("/settings/models");
  revalidatePath("/settings/models/library");
  revalidatePath("/chat");
  revalidatePath("/bureau");
  return { ok: true };
}

/**
 * Liste les modèles activés (ajoutés) pour l'utilisateur courant.
 * Si l'utilisateur n'a JAMAIS rien ajouté (0 row), on bootstrap avec
 * MODEL_CATALOG (le pack curé) pour ne pas casser un compte existant.
 */
export async function listEnabledModels(
  userId: string
): Promise<ModelSetting[]> {
  const rows = await db
    .select()
    .from(modelSettings)
    .where(
      and(eq(modelSettings.userId, userId), eq(modelSettings.enabled, true))
    );

  if (rows.length > 0) return rows;

  // Auto-seed du pack curé à la première visite — empêche le compte
  // existant de voir des pickers vides après le passage opt-in.
  const seed: Array<{
    userId: string;
    providerType: string;
    modelId: string;
    label: string;
    hint: string | null;
    enabled: boolean;
  }> = [];
  for (const [type, models] of Object.entries(MODEL_CATALOG) as [
    ProviderType,
    typeof MODEL_CATALOG[ProviderType],
  ][]) {
    for (const m of models) {
      seed.push({
        userId,
        providerType: type,
        modelId: m.id,
        label: m.label,
        hint: m.hint ?? null,
        enabled: true,
      });
    }
  }
  if (seed.length > 0) {
    await db
      .insert(modelSettings)
      .values(seed)
      .onConflictDoNothing();
  }

  return await db
    .select()
    .from(modelSettings)
    .where(
      and(eq(modelSettings.userId, userId), eq(modelSettings.enabled, true))
    );
}

/**
 * Renvoie un Set "providerType:modelId" des modèles activés — format
 * pratique pour filtrer un picker O(1).
 */
export async function getEnabledModelKeys(
  userId: string
): Promise<Set<string>> {
  const rows = await listEnabledModels(userId);
  return new Set(rows.map((r) => `${r.providerType}:${r.modelId}`));
}

/** Compat : conserve l'ancienne API pour les pages déjà branchées. */
export async function getDisabledModelKeys(
  userId: string
): Promise<Set<string>> {
  // Migration logique : l'ancienne page n'utilise plus ce concept,
  // mais on garde une implémentation pour ne pas casser les imports.
  const rows = await db
    .select({
      providerType: modelSettings.providerType,
      modelId: modelSettings.modelId,
    })
    .from(modelSettings)
    .where(
      and(eq(modelSettings.userId, userId), eq(modelSettings.enabled, false))
    );
  return new Set(rows.map((r) => `${r.providerType}:${r.modelId}`));
}
