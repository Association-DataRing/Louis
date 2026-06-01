"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/db";
import { connectorKeys } from "@/db/schema";
import { encrypt } from "@/lib/crypto";
import { CONNECTOR_CATALOG, CONNECTOR_TYPES } from "@/lib/connectors/catalog";
import { recordAudit } from "@/lib/audit";
import { testPisteConnection } from "@/lib/connectors/piste";
import { testPappersConnection } from "@/lib/connectors/pappers";

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

  await recordAudit({
    userId,
    action: "connector.add",
    target: `${base.data.type}:${base.data.label}`,
  });

  revalidatePath("/settings/connectors");
  return { ok: true };
}

/**
 * R5 : teste les identifiants d'un connecteur (OAuth PISTE / token Pappers) et
 * persiste le résultat (lastTestStatus/lastTestedAt). Consomme un appel API
 * réel — déclenché explicitement par l'utilisateur.
 */
export async function testConnectorKey(id: string): Promise<string | null> {
  const userId = await requireUserId();
  const [key] = await db
    .select({ type: connectorKeys.type })
    .from(connectorKeys)
    .where(and(eq(connectorKeys.id, id), eq(connectorKeys.userId, userId)))
    .limit(1);
  if (!key) return null;

  const status =
    key.type === "piste"
      ? await testPisteConnection(userId)
      : await testPappersConnection(userId);

  await db
    .update(connectorKeys)
    .set({ lastTestedAt: new Date(), lastTestStatus: status })
    .where(and(eq(connectorKeys.id, id), eq(connectorKeys.userId, userId)));
  revalidatePath("/settings/connectors");
  return status;
}

export async function deleteConnectorKey(id: string): Promise<void> {
  const userId = await requireUserId();
  const [target] = await db
    .select({ type: connectorKeys.type, label: connectorKeys.label })
    .from(connectorKeys)
    .where(and(eq(connectorKeys.id, id), eq(connectorKeys.userId, userId)))
    .limit(1);
  await db
    .delete(connectorKeys)
    .where(and(eq(connectorKeys.id, id), eq(connectorKeys.userId, userId)));
  if (target) {
    await recordAudit({
      userId,
      action: "connector.delete",
      target: `${target.type}:${target.label}`,
    });
  }
  revalidatePath("/settings/connectors");
}

export async function updateConnectorKey(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const userId = await requireUserId();

  const id = formData.get("id");
  if (typeof id !== "string" || !id) {
    return { ok: false, error: "ID manquant." };
  }

  const [existing] = await db
    .select()
    .from(connectorKeys)
    .where(and(eq(connectorKeys.id, id), eq(connectorKeys.userId, userId)))
    .limit(1);

  if (!existing) return { ok: false, error: "Connecteur introuvable." };

  const meta = CONNECTOR_CATALOG[existing.type];
  const updates: {
    label?: string;
    credentialsCiphertext?: string;
    credentialsIv?: string;
    credentialsTag?: string;
  } = {};

  const labelRaw = formData.get("label");
  if (typeof labelRaw === "string" && labelRaw.trim()) {
    updates.label = labelRaw.trim();
  }

  // Si au moins un champ credential est renseigné, on construit un nouveau
  // blob complet (tous les champs requis doivent être présents ensemble —
  // une rotation de credentials est tout-ou-rien).
  const newCredentials: Record<string, string> = {};
  let anyCredentialProvided = false;
  for (const field of meta.credentialFields) {
    const v = formData.get(field.name);
    if (typeof v === "string" && v.trim()) {
      newCredentials[field.name] = v.trim();
      anyCredentialProvided = true;
    }
  }
  if (anyCredentialProvided) {
    for (const field of meta.credentialFields) {
      if (field.required && !newCredentials[field.name]) {
        return {
          ok: false,
          error: `Pour rotater les identifiants, renseignez tous les champs requis (${field.label} manquant).`,
        };
      }
    }
    const blob = encrypt(JSON.stringify(newCredentials));
    updates.credentialsCiphertext = blob.ciphertext;
    updates.credentialsIv = blob.iv;
    updates.credentialsTag = blob.tag;
  }

  if (Object.keys(updates).length === 0) {
    return { ok: true };
  }

  try {
    await db
      .update(connectorKeys)
      .set(updates)
      .where(and(eq(connectorKeys.id, id), eq(connectorKeys.userId, userId)));
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erreur";
    if (msg.includes("connector_keys_user_label_idx")) {
      return { ok: false, error: "Ce libellé est déjà utilisé." };
    }
    return { ok: false, error: "Impossible de modifier le connecteur." };
  }

  revalidatePath("/settings/connectors");
  return { ok: true };
}

export async function toggleConnectorKeyActive(
  id: string
): Promise<ActionResult> {
  const userId = await requireUserId();
  const [current] = await db
    .select({ isActive: connectorKeys.isActive })
    .from(connectorKeys)
    .where(and(eq(connectorKeys.id, id), eq(connectorKeys.userId, userId)))
    .limit(1);
  if (!current) return { ok: false, error: "Connecteur introuvable." };
  try {
    await db
      .update(connectorKeys)
      .set({ isActive: !current.isActive })
      .where(and(eq(connectorKeys.id, id), eq(connectorKeys.userId, userId)));
  } catch {
    return { ok: false, error: "Impossible de modifier l'état du connecteur." };
  }
  revalidatePath("/settings/connectors");
  return { ok: true };
}
