"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionResult } from "@/lib/actions/result";
import { requireUserId } from "@/lib/auth/permissions";
import { db } from "@/db";
import { ocrSettings } from "@/db/schema";

const schema = z
  .object({
    mode: z.enum(["auto", "mistral", "vision", "tesseract"]),
    providerKeyId: z.string().uuid().optional().nullable(),
    modelId: z.string().trim().max(200).optional().nullable(),
  })
  .refine(
    (d) => d.mode !== "vision" || (d.providerKeyId && d.modelId),
    {
      message:
        "Le mode vision nécessite une clé provider et un identifiant de modèle.",
      path: ["modelId"],
    }
  );

export async function saveOcrSettings(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const userId = await requireUserId();

  const parsed = schema.safeParse({
    mode: formData.get("mode"),
    providerKeyId: (formData.get("providerKeyId") as string) || null,
    modelId: (formData.get("modelId") as string) || null,
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  const { mode, providerKeyId, modelId } = parsed.data;
  // Hors mode vision, on n'enregistre pas de clé/modèle (cohérence).
  const row = {
    userId,
    mode,
    providerKeyId: mode === "vision" ? providerKeyId ?? null : null,
    modelId: mode === "vision" ? modelId ?? null : null,
    updatedAt: new Date(),
  };

  await db
    .insert(ocrSettings)
    .values(row)
    .onConflictDoUpdate({
      target: ocrSettings.userId,
      set: {
        mode: row.mode,
        providerKeyId: row.providerKeyId,
        modelId: row.modelId,
        updatedAt: row.updatedAt,
      },
    });

  revalidatePath("/settings/ocr");
  return { ok: true };
}
