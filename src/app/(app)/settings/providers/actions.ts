"use server";

import type { ActionResult as BaseActionResult } from "@/lib/actions/result";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { requireUserId } from "@/lib/auth/permissions";
import { db } from "@/db";
import { providerKeys } from "@/db/schema";
import { encrypt, decrypt } from "@/lib/crypto";
import { assertSafeUrl, SsrfError } from "@/lib/net-guard";
import { PROVIDER_TYPES } from "@/lib/providers/catalog";
import { testProvider } from "@/lib/providers/test";
import { recordAudit } from "@/lib/audit";

const createSchema = z.object({
  type: z.enum(PROVIDER_TYPES as [string, ...string[]]),
  label: z.string().trim().min(1).max(80),
  apiKey: z.string().trim().min(1),
  baseUrl: z.url().optional().or(z.literal("")),
});

export type ActionResult = BaseActionResult;

export async function createProviderKey(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const userId = await requireUserId();

  const parsed = createSchema.safeParse({
    type: formData.get("type"),
    label: formData.get("label"),
    apiKey: formData.get("apiKey"),
    baseUrl: formData.get("baseUrl") ?? "",
  });

  if (!parsed.success) {
    return { ok: false, error: "Champs invalides." };
  }

  const { type, label, apiKey, baseUrl } = parsed.data;

  if (baseUrl) {
    try {
      assertSafeUrl(baseUrl);
    } catch (err) {
      if (err instanceof SsrfError) return { ok: false, error: err.message };
      throw err;
    }
  }

  const blob = encrypt(apiKey);

  try {
    await db.insert(providerKeys).values({
      userId,
      type: type as (typeof PROVIDER_TYPES)[number],
      label,
      apiKeyCiphertext: blob.ciphertext,
      apiKeyIv: blob.iv,
      apiKeyTag: blob.tag,
      baseUrl: baseUrl || null,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erreur inconnue";
    if (msg.includes("provider_keys_user_label_idx")) {
      return { ok: false, error: "Ce libellé est déjà utilisé." };
    }
    return { ok: false, error: "Impossible de créer la clé." };
  }

  await recordAudit({
    userId,
    action: "provider.add",
    target: `${type}:${label}`,
  });

  revalidatePath("/settings/providers");
  return { ok: true };
}

const testedCreateSchema = createSchema.extend({
  force: z.literal("true").optional().or(z.literal("")),
});

export type TestedCreateResult =
  | { ok: true; testStatus: "ok" | "skipped" }
  | { ok: false; error: string; canForce?: boolean };

/**
 * Variante « tester avant d'enregistrer » de createProviderKey — utilisée par
 * l'assistant /setup et le quick-add du chat. La clé n'est stockée que si le
 * provider la reconnaît (ou si le test est impossible / forcé). Une clé
 * refusée (401/403) n'est jamais enregistrée : c'est l'erreur la plus
 * fréquente du premier lancement, autant la attraper au moment du collage.
 */
export async function createProviderKeyTested(
  _prev: TestedCreateResult | null,
  formData: FormData
): Promise<TestedCreateResult> {
  const userId = await requireUserId();

  const parsed = testedCreateSchema.safeParse({
    type: formData.get("type"),
    label: formData.get("label"),
    apiKey: formData.get("apiKey"),
    baseUrl: formData.get("baseUrl") ?? "",
    force: formData.get("force") ?? "",
  });
  if (!parsed.success) return { ok: false, error: "Champs invalides." };

  const { type, label, apiKey, baseUrl } = parsed.data;
  const force = parsed.data.force === "true";

  if (baseUrl) {
    try {
      assertSafeUrl(baseUrl);
    } catch (err) {
      if (err instanceof SsrfError) return { ok: false, error: err.message };
      throw err;
    }
  }

  const status = await testProvider(
    type as (typeof PROVIDER_TYPES)[number],
    apiKey,
    baseUrl || null
  );

  if (status === "auth_error") {
    return {
      ok: false,
      error:
        "Le provider a refusé cette clé. Vérifiez qu'elle est complète et toujours valide sur la console du provider.",
    };
  }
  if (status === "network_error" && !force) {
    return {
      ok: false,
      error:
        "Impossible de joindre le provider pour vérifier la clé. Réessayez, ou enregistrez sans test.",
      canForce: true,
    };
  }

  const blob = encrypt(apiKey);

  // Première clé de l'utilisateur → défaut d'office, pour que le chat soit
  // utilisable immédiatement sans passage par les réglages.
  const [existing] = await db
    .select({ id: providerKeys.id })
    .from(providerKeys)
    .where(eq(providerKeys.userId, userId))
    .limit(1);

  try {
    await db.insert(providerKeys).values({
      userId,
      type: type as (typeof PROVIDER_TYPES)[number],
      label,
      apiKeyCiphertext: blob.ciphertext,
      apiKeyIv: blob.iv,
      apiKeyTag: blob.tag,
      baseUrl: baseUrl || null,
      isDefault: !existing,
      lastTestedAt: new Date(),
      lastTestStatus: status,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erreur inconnue";
    if (msg.includes("provider_keys_user_label_idx")) {
      return { ok: false, error: "Ce libellé est déjà utilisé." };
    }
    return { ok: false, error: "Impossible de créer la clé." };
  }

  await recordAudit({
    userId,
    action: "provider.add",
    target: `${type}:${label}`,
  });

  revalidatePath("/settings/providers");
  revalidatePath("/chat");
  revalidatePath("/dashboard");
  return { ok: true, testStatus: status === "ok" ? "ok" : "skipped" };
}

export async function deleteProviderKey(id: string): Promise<void> {
  const userId = await requireUserId();
  const [target] = await db
    .select({ type: providerKeys.type, label: providerKeys.label })
    .from(providerKeys)
    .where(and(eq(providerKeys.id, id), eq(providerKeys.userId, userId)))
    .limit(1);
  await db
    .delete(providerKeys)
    .where(and(eq(providerKeys.id, id), eq(providerKeys.userId, userId)));
  if (target) {
    await recordAudit({
      userId,
      action: "provider.delete",
      target: `${target.type}:${target.label}`,
    });
  }
  revalidatePath("/settings/providers");
}

export async function toggleProviderKeyActive(
  id: string
): Promise<ActionResult> {
  const userId = await requireUserId();
  const [current] = await db
    .select({
      isActive: providerKeys.isActive,
      type: providerKeys.type,
      label: providerKeys.label,
    })
    .from(providerKeys)
    .where(and(eq(providerKeys.id, id), eq(providerKeys.userId, userId)))
    .limit(1);
  if (!current) return { ok: false, error: "Clé introuvable." };
  try {
    await db
      .update(providerKeys)
      .set({ isActive: !current.isActive })
      .where(and(eq(providerKeys.id, id), eq(providerKeys.userId, userId)));
  } catch {
    return { ok: false, error: "Impossible de modifier l'état de la clé." };
  }
  await recordAudit({
    userId,
    action: "provider.toggle",
    target: `${current.type}:${current.label}`,
    meta: { newState: !current.isActive ? "active" : "inactive" },
  });
  revalidatePath("/settings/providers");
  return { ok: true };
}

export async function setProviderKeyDefault(id: string): Promise<void> {
  const userId = await requireUserId();
  const [target] = await db
    .select({ id: providerKeys.id, type: providerKeys.type })
    .from(providerKeys)
    .where(and(eq(providerKeys.id, id), eq(providerKeys.userId, userId)))
    .limit(1);
  if (!target) return;
  // Transaction : démarquer l'ancien défaut puis marquer le nouveau doivent
  // être atomiques, sinon un échec entre les deux laisse l'utilisateur sans
  // aucune clé par défaut pour ce type de provider.
  await db.transaction(async (tx) => {
    await tx
      .update(providerKeys)
      .set({ isDefault: false })
      .where(
        and(eq(providerKeys.userId, userId), eq(providerKeys.type, target.type))
      );
    await tx
      .update(providerKeys)
      .set({ isDefault: true })
      .where(and(eq(providerKeys.id, id), eq(providerKeys.userId, userId)));
  });
  revalidatePath("/settings/providers");
}

const updateSchema = z.object({
  id: z.uuid(),
  label: z.string().trim().min(1).max(80).optional(),
  apiKey: z.string().trim().min(1).optional(),
  baseUrl: z.url().optional().or(z.literal("")),
});

export async function updateProviderKey(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const userId = await requireUserId();

  const parsed = updateSchema.safeParse({
    id: formData.get("id"),
    label: formData.get("label") ?? undefined,
    apiKey: formData.get("apiKey") ?? undefined,
    baseUrl: formData.get("baseUrl") ?? "",
  });

  if (!parsed.success) {
    return { ok: false, error: "Champs invalides." };
  }

  if (parsed.data.baseUrl) {
    try {
      assertSafeUrl(parsed.data.baseUrl);
    } catch (err) {
      if (err instanceof SsrfError) return { ok: false, error: err.message };
      throw err;
    }
  }

  const updates: {
    label?: string;
    apiKeyCiphertext?: string;
    apiKeyIv?: string;
    apiKeyTag?: string;
    baseUrl?: string | null;
  } = {};
  if (parsed.data.label) updates.label = parsed.data.label;
  if (parsed.data.apiKey) {
    const blob = encrypt(parsed.data.apiKey);
    updates.apiKeyCiphertext = blob.ciphertext;
    updates.apiKeyIv = blob.iv;
    updates.apiKeyTag = blob.tag;
  }
  if (parsed.data.baseUrl !== undefined) {
    updates.baseUrl = parsed.data.baseUrl || null;
  }

  try {
    await db
      .update(providerKeys)
      .set(updates)
      .where(
        and(eq(providerKeys.id, parsed.data.id), eq(providerKeys.userId, userId))
      );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erreur inconnue";
    if (msg.includes("provider_keys_user_label_idx")) {
      return { ok: false, error: "Ce libellé est déjà utilisé." };
    }
    return { ok: false, error: "Impossible de modifier la clé." };
  }

  revalidatePath("/settings/providers");
  return { ok: true };
}

export async function testProviderKey(id: string): Promise<void> {
  const userId = await requireUserId();
  const [key] = await db
    .select()
    .from(providerKeys)
    .where(and(eq(providerKeys.id, id), eq(providerKeys.userId, userId)))
    .limit(1);
  if (!key) return;

  const apiKey = decrypt({
    ciphertext: key.apiKeyCiphertext,
    iv: key.apiKeyIv,
    tag: key.apiKeyTag,
  });

  const status = await testProvider(key.type, apiKey, key.baseUrl);

  await db
    .update(providerKeys)
    .set({ lastTestedAt: new Date(), lastTestStatus: status })
    .where(eq(providerKeys.id, id));

  revalidatePath("/settings/providers");
}
