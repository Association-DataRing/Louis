"use server";

import type { ActionResult as BaseActionResult } from "@/lib/actions/result";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { requireUserId } from "@/lib/auth/permissions";
import { db } from "@/db";
import {
  modelSettings,
  providerKeys,
  type ModelSetting,
} from "@/db/schema";
import { MODEL_CATALOG } from "@/lib/providers/models";
import type { ProviderType } from "@/lib/providers/catalog";

export type ActionResult = BaseActionResult;

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
  revalidatePath("/board");
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
  revalidatePath("/board");
  return { ok: true };
}

/**
 * Liste les modèles activés (ajoutés) pour l'utilisateur courant.
 * Auto-seed à la première visite mais UNIQUEMENT pour les providers
 * dont l'utilisateur a déjà configuré une clé active — sinon on
 * polluait la liste avec Mistral / Anthropic / OpenAI alors que
 * l'utilisateur n'avait qu'OpenRouter.
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

  // Récupère les providers réellement connectés pour ne pas seed des
  // modèles d'un type non utilisable (clé absente).
  const activeKeys = await db
    .select({ type: providerKeys.type })
    .from(providerKeys)
    .where(
      and(eq(providerKeys.userId, userId), eq(providerKeys.isActive, true))
    );
  const activeTypes = new Set<ProviderType>(activeKeys.map((k) => k.type));
  if (activeTypes.size === 0) return [];

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
    if (!activeTypes.has(type)) continue;
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

/**
 * Supprime les modèles activés pour des providers que l'utilisateur n'a
 * plus en clé active. Cas typique : seed legacy qui avait inséré tous
 * les providers de MODEL_CATALOG, ou clé désactivée a posteriori.
 */
export async function pruneOrphanModels(): Promise<ActionResult> {
  const userId = await requireUserId();

  const activeKeys = await db
    .select({ type: providerKeys.type })
    .from(providerKeys)
    .where(
      and(eq(providerKeys.userId, userId), eq(providerKeys.isActive, true))
    );
  const activeTypes = activeKeys.map((k) => k.type);

  if (activeTypes.length === 0) {
    // Pas de provider actif → on retire tout, plus rien à utiliser.
    await db
      .delete(modelSettings)
      .where(eq(modelSettings.userId, userId));
  } else {
    // Garde uniquement les modèles dont le providerType est encore actif.
    const rows = await db
      .select()
      .from(modelSettings)
      .where(eq(modelSettings.userId, userId));
    const orphanIds = rows
      .filter((r) => !activeTypes.includes(r.providerType as ProviderType))
      .map((r) => r.id);
    if (orphanIds.length > 0) {
      // Drizzle ne supporte pas IN avec drizzle-orm sans helpers ici, on
      // fait N delete séquentiels — N petit (modèles non couverts).
      for (const id of orphanIds) {
        await db.delete(modelSettings).where(eq(modelSettings.id, id));
      }
    }
  }

  revalidatePath("/settings/models");
  revalidatePath("/settings/models/library");
  revalidatePath("/chat");
  revalidatePath("/board");
  return { ok: true };
}
