"use server";

import type { ActionResult as BaseActionResult } from "@/lib/actions/result";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { requireUserId } from "@/lib/auth/permissions";
import { db } from "@/db";
import { workflows } from "@/db/schema";

export type ActionResult = BaseActionResult<{ id?: string }>;

const upsertSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(300).optional(),
  prompt: z.string().trim().min(1).max(4000),
});

export async function createWorkflow(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const userId = await requireUserId();
  const parsed = upsertSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") ?? undefined,
    prompt: formData.get("prompt"),
  });
  if (!parsed.success) return { ok: false, error: "Champs invalides." };

  const [row] = await db
    .insert(workflows)
    .values({
      userId,
      name: parsed.data.name,
      description: parsed.data.description || null,
      prompt: parsed.data.prompt,
    })
    .returning({ id: workflows.id });

  revalidatePath("/workflows");
  revalidatePath("/chat");
  return { ok: true, id: row.id };
}

export async function updateWorkflow(
  id: string,
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const userId = await requireUserId();
  const parsed = upsertSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") ?? undefined,
    prompt: formData.get("prompt"),
  });
  if (!parsed.success) return { ok: false, error: "Champs invalides." };

  await db
    .update(workflows)
    .set({
      name: parsed.data.name,
      description: parsed.data.description || null,
      prompt: parsed.data.prompt,
      updatedAt: new Date(),
    })
    .where(and(eq(workflows.id, id), eq(workflows.userId, userId)));

  revalidatePath("/workflows");
  revalidatePath("/chat");
  return { ok: true };
}

export async function deleteWorkflow(id: string): Promise<void> {
  const userId = await requireUserId();
  await db
    .delete(workflows)
    .where(and(eq(workflows.id, id), eq(workflows.userId, userId)));
  revalidatePath("/workflows");
  revalidatePath("/chat");
}

// Pas de workflows pré-fournis : la bibliothèque est livrée vide, à
// charge de chaque cabinet de construire ses propres templates. Évite
// que des prompts par défaut non validés engagent la qualité de l'app.
