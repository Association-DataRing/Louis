"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/db";
import { connectorKeys } from "@/db/schema";
import { encrypt } from "@/lib/crypto";
import { CONNECTOR_CATALOG, CONNECTOR_TYPES } from "@/lib/connectors/catalog";

const baseSchema = z.object({
  type: z.enum(CONNECTOR_TYPES as [string, ...string[]]),
  label: z.string().trim().min(1).max(80),
});

export type ActionResult = { ok: true } | { ok: false; error: string };

async function requireUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  return session.user.id;
}

export async function createConnectorKey(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const userId = await requireUserId();

  const base = baseSchema.safeParse({
    type: formData.get("type"),
    label: formData.get("label"),
  });

  if (!base.success) return { ok: false, error: "Champs invalides." };

  const meta = CONNECTOR_CATALOG[base.data.type as keyof typeof CONNECTOR_CATALOG];
  const credentials: Record<string, string> = {};

  for (const field of meta.credentialFields) {
    const v = formData.get(field.name);
    if (typeof v !== "string" || (field.required && !v.trim())) {
      return { ok: false, error: `Champ requis : ${field.label}` };
    }
    credentials[field.name] = v.trim();
  }

  const blob = encrypt(JSON.stringify(credentials));

  try {
    await db.insert(connectorKeys).values({
      userId,
      type: base.data.type as (typeof CONNECTOR_TYPES)[number],
      label: base.data.label,
      credentialsCiphertext: blob.ciphertext,
      credentialsIv: blob.iv,
      credentialsTag: blob.tag,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erreur";
    if (msg.includes("connector_keys_user_label_idx")) {
      return { ok: false, error: "Ce libellé est déjà utilisé." };
    }
    return { ok: false, error: "Impossible de créer le connecteur." };
  }

  revalidatePath("/connectors");
  return { ok: true };
}

export async function deleteConnectorKey(id: string): Promise<void> {
  const userId = await requireUserId();
  await db
    .delete(connectorKeys)
    .where(and(eq(connectorKeys.id, id), eq(connectorKeys.userId, userId)));
  revalidatePath("/connectors");
}

export async function toggleConnectorKeyActive(id: string): Promise<void> {
  const userId = await requireUserId();
  const [current] = await db
    .select({ isActive: connectorKeys.isActive })
    .from(connectorKeys)
    .where(and(eq(connectorKeys.id, id), eq(connectorKeys.userId, userId)))
    .limit(1);
  if (!current) return;
  await db
    .update(connectorKeys)
    .set({ isActive: !current.isActive })
    .where(and(eq(connectorKeys.id, id), eq(connectorKeys.userId, userId)));
  revalidatePath("/connectors");
}
