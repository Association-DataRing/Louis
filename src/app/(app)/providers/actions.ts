"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/db";
import { providerKeys } from "@/db/schema";
import { encrypt, decrypt } from "@/lib/crypto";
import { PROVIDER_TYPES } from "@/lib/providers/catalog";
import { testProvider } from "@/lib/providers/test";

const createSchema = z.object({
  type: z.enum(PROVIDER_TYPES as [string, ...string[]]),
  label: z.string().trim().min(1).max(80),
  apiKey: z.string().trim().min(1),
  baseUrl: z.string().trim().url().optional().or(z.literal("")),
});

async function requireUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  return session.user.id;
}

export type ActionResult = { ok: true } | { ok: false; error: string };

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

  revalidatePath("/providers");
  return { ok: true };
}

export async function deleteProviderKey(id: string): Promise<void> {
  const userId = await requireUserId();
  await db
    .delete(providerKeys)
    .where(and(eq(providerKeys.id, id), eq(providerKeys.userId, userId)));
  revalidatePath("/providers");
}

export async function toggleProviderKeyActive(id: string): Promise<void> {
  const userId = await requireUserId();
  const [current] = await db
    .select({ isActive: providerKeys.isActive })
    .from(providerKeys)
    .where(and(eq(providerKeys.id, id), eq(providerKeys.userId, userId)))
    .limit(1);
  if (!current) return;
  await db
    .update(providerKeys)
    .set({ isActive: !current.isActive })
    .where(and(eq(providerKeys.id, id), eq(providerKeys.userId, userId)));
  revalidatePath("/providers");
}

export async function setProviderKeyDefault(id: string): Promise<void> {
  const userId = await requireUserId();
  const [target] = await db
    .select({ id: providerKeys.id, type: providerKeys.type })
    .from(providerKeys)
    .where(and(eq(providerKeys.id, id), eq(providerKeys.userId, userId)))
    .limit(1);
  if (!target) return;
  await db
    .update(providerKeys)
    .set({ isDefault: false })
    .where(
      and(eq(providerKeys.userId, userId), eq(providerKeys.type, target.type))
    );
  await db
    .update(providerKeys)
    .set({ isDefault: true })
    .where(and(eq(providerKeys.id, id), eq(providerKeys.userId, userId)));
  revalidatePath("/providers");
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

  revalidatePath("/providers");
}
