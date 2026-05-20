"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/db";
import { modelSettings } from "@/db/schema";

export type ActionResult =
  | { ok: true }
  | { ok: false; error: string };

async function requireUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  return session.user.id;
}

const toggleSchema = z.object({
  providerType: z.string().min(1).max(50),
  modelId: z.string().min(1).max(200),
  enabled: z.boolean(),
});

/**
 * Bascule l'état d'un modèle pour l'utilisateur courant. Comme l'approche
 * est opt-out, on insère/update une row uniquement quand on veut DÉSACTIVER
 * (enabled=false). Pour réactiver, on supprime la row — comme ça les futurs
 * modèles ajoutés au MODEL_CATALOG restent activés par défaut sans row.
 */
export async function toggleModel(
  payload: z.infer<typeof toggleSchema>
): Promise<ActionResult> {
  const userId = await requireUserId();
  const parsed = toggleSchema.safeParse(payload);
  if (!parsed.success) return { ok: false, error: "Champs invalides." };

  const { providerType, modelId, enabled } = parsed.data;

  if (enabled) {
    // Réactivation = suppression de l'override
    await db
      .delete(modelSettings)
      .where(
        and(
          eq(modelSettings.userId, userId),
          eq(modelSettings.providerType, providerType),
          eq(modelSettings.modelId, modelId)
        )
      );
  } else {
    // Désactivation = upsert d'une row enabled=false
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
        .set({ enabled: false, updatedAt: new Date() })
        .where(eq(modelSettings.id, existing[0].id));
    } else {
      await db.insert(modelSettings).values({
        userId,
        providerType,
        modelId,
        enabled: false,
      });
    }
  }

  revalidatePath("/settings/models");
  revalidatePath("/chat");
  revalidatePath("/bureau");
  return { ok: true };
}

/**
 * Récupère la liste des modèles désactivés pour l'utilisateur courant.
 * Format Set keyed par "providerType:modelId" pour des lookups O(1)
 * côté UI ou côté serveur (filtrage des pickers).
 */
export async function getDisabledModelKeys(
  userId: string
): Promise<Set<string>> {
  const rows = await db
    .select({
      providerType: modelSettings.providerType,
      modelId: modelSettings.modelId,
    })
    .from(modelSettings)
    .where(
      and(
        eq(modelSettings.userId, userId),
        eq(modelSettings.enabled, false)
      )
    );
  return new Set(rows.map((r) => `${r.providerType}:${r.modelId}`));
}
